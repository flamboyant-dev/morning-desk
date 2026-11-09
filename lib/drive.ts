import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import { env } from "@/lib/env";

// Files this app creates. A normal Gmail account can store those against its
// own 15 GB, and this scope can be published without a Google verification review.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type Credentials = {
  client_email: string;
  private_key: string;
};

let cachedToken: { token: string; exp: number } | null = null;

export function oauthConfigured(): boolean {
  return Boolean(
    env("GOOGLE_CLIENT_ID") &&
      env("GOOGLE_CLIENT_SECRET") &&
      env("GOOGLE_REFRESH_TOKEN") &&
      env("DRIVE_FOLDER_ID"),
  );
}

export function serviceAccountConfigured(): boolean {
  return Boolean(env("GOOGLE_SERVICE_ACCOUNT_JSON") && env("DRIVE_FOLDER_ID"));
}

export function driveConfigured(): boolean {
  return oauthConfigured() || serviceAccountConfigured();
}

export function driveMode(): "oauth" | "service-account" | "off" {
  if (oauthConfigured()) return "oauth";
  if (serviceAccountConfigured()) return "service-account";
  return "off";
}

export function folderId(): string {
  const id = env("DRIVE_FOLDER_ID");
  if (!id) throw new Error("Set DRIVE_FOLDER_ID to the Google Drive folder.");
  return id;
}

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function driveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function loadServiceAccount(): Credentials {
  const raw = env("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Google Drive is not connected.");
  const json = raw.startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json) as Credentials;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("The service account JSON is missing client_email or private_key.");
  }
  return parsed;
}

async function oauthAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  const json = (await response.json()) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || "Google refused the refresh token.",
    );
  }
  return json.access_token;
}

async function serviceAccountAccessToken(): Promise<string> {
  const creds = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
    "base64url",
  );
  const claim = Buffer.from(
    JSON.stringify({
      iss: creds.client_email,
      scope: DRIVE_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  signer.end();
  const assertion = `${header}.${claim}.${signer.sign(creds.private_key).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await response.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || "Google refused the service account.");
  }
  return json.access_token;
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const token = oauthConfigured()
    ? await oauthAccessToken()
    : await serviceAccountAccessToken();
  cachedToken = { token, exp: Date.now() + 50 * 60 * 1000 };
  return token;
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function driveError(response: Response, action: string): Promise<Error> {
  let detail = "";
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    detail = json.error?.message ?? "";
  } catch {
    detail = "";
  }
  return new Error(detail || `Google Drive could not ${action} (${response.status}).`);
}

function escapeQuery(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function findNamedFile(name: string): Promise<string | null> {
  const parent = folderId();
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set(
    "q",
    `name = '${escapeQuery(name)}' and '${escapeQuery(parent)}' in parents and trashed = false`,
  );
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  const response = await driveFetch(url.toString());
  if (!response.ok) throw await driveError(response, "list files");
  const json = (await response.json()) as { files?: { id: string }[] };
  return json.files?.[0]?.id ?? null;
}

export async function readDriveJson<T>(name: string): Promise<T | null> {
  const id = await findNamedFile(name);
  if (!id) return null;
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${id}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  const response = await driveFetch(url.toString());
  if (response.status === 404) return null;
  if (!response.ok) throw await driveError(response, `read ${name}`);
  return (await response.json()) as T;
}

export async function writeDriveJson(name: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value, null, 2);
  const existing = await findNamedFile(name);
  if (existing) {
    const url = new URL(
      `https://www.googleapis.com/upload/drive/v3/files/${existing}`,
    );
    url.searchParams.set("uploadType", "media");
    url.searchParams.set("supportsAllDrives", "true");
    const response = await driveFetch(url.toString(), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body,
    });
    if (!response.ok) throw await driveError(response, `update ${name}`);
    return;
  }
  await uploadBuffer(Buffer.from(body), name, "application/json");
}

export async function uploadLocalFile(
  localPath: string,
  name: string,
  mime: string,
): Promise<string> {
  const bytes = await readFile(localPath);
  return uploadBuffer(bytes, name, mime);
}

async function uploadBuffer(bytes: Buffer, name: string, mime: string): Promise<string> {
  const boundary = `morningdesk${Date.now()}`;
  const metadata = JSON.stringify({ name, parents: [folderId()] });
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const ending = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([preamble, bytes, ending]);
  const url = new URL("https://www.googleapis.com/upload/drive/v3/files");
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("fields", "id");
  url.searchParams.set("supportsAllDrives", "true");
  const response = await driveFetch(url.toString(), {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) throw await driveError(response, `upload ${name}`);
  const json = (await response.json()) as { id?: string };
  if (!json.id) throw new Error(`Google Drive uploaded ${name} without an id.`);
  return json.id;
}

export async function shareAnyone(fileId: string): Promise<void> {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
  );
  url.searchParams.set("supportsAllDrives", "true");
  const response = await driveFetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (response.status === 409) return;
  if (!response.ok) throw await driveError(response, "share the file");
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  url.searchParams.set("supportsAllDrives", "true");
  const response = await driveFetch(url.toString(), { method: "DELETE" });
  if (response.status === 404) return;
  if (!response.ok) throw await driveError(response, "delete a file");
}
