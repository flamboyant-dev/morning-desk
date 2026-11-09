import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { adminPassword } from "@/lib/auth";
import { env } from "@/lib/env";

export const DRIVE_LINK_COOKIE = "desk_drive";
export const DRIVE_STATE_COOKIE = "desk_drive_state";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export type DriveLink = {
  refreshToken: string;
  folderId: string;
};

function secret(): string {
  return adminPassword() || "12345";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

function pack(value: unknown): string {
  const body = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function unpack(value: string | undefined | null): unknown {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(body);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function driveRedirectUri(origin: string): string {
  return `${origin}/api/drive/callback`;
}

export function createDriveState(): { cookie: string; state: string } {
  const state = randomBytes(16).toString("base64url");
  return {
    state,
    cookie: pack({ n: state, e: Date.now() + 10 * 60 * 1000 }),
  };
}

export function driveStateMatches(value: string | undefined, expected: string | undefined): boolean {
  if (!value || !expected) return false;
  const parsed = unpack(value) as { n?: string; e?: number } | null;
  if (!parsed?.n || !parsed.e || parsed.e < Date.now()) return false;
  const left = Buffer.from(parsed.n);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signDriveLink(link: DriveLink): string {
  return pack({ refreshToken: link.refreshToken, folderId: link.folderId });
}

export function readDriveLink(value: string | undefined | null): DriveLink | null {
  const parsed = unpack(value) as Partial<DriveLink> | null;
  const refreshToken = String(parsed?.refreshToken ?? "").trim();
  const folderId = String(parsed?.folderId ?? "").trim();
  if (!refreshToken || !folderId) return null;
  return { refreshToken, folderId };
}

export function googleAuthUrl(origin: string, state: string): string {
  const clientId = env("GOOGLE_CLIENT_ID");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", driveRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeDriveCode(origin: string, code: string): Promise<DriveLink> {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google client ID and secret are not set on the server.");
  }
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: driveRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const json = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  };
  if (!json.refresh_token || !json.access_token) {
    throw new Error(
      json.error_description ||
        "Google did not return a refresh token. Remove Morning desk under your Google Account permissions and try again.",
    );
  }
  const folderId = await createMorningFolder(json.access_token);
  return { refreshToken: json.refresh_token, folderId };
}

async function createMorningFolder(accessToken: string): Promise<string> {
  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Morning desk",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const json = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !json.id) {
    throw new Error(json.error?.message || "Google Drive did not create the Morning desk folder.");
  }
  return json.id;
}

export function requestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (host) return `${proto || "https"}://${host}`;
  return new URL(request.url).origin;
}
