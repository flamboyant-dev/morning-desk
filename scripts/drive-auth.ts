import http from "node:http";
import { env } from "../lib/env";

const clientId = env("GOOGLE_CLIENT_ID");
const clientSecret = env("GOOGLE_CLIENT_SECRET");
const port = 53682;
const redirect = `http://127.0.0.1:${port}`;

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then run this again.");
  process.exit(1);
}

const scope = "https://www.googleapis.com/auth/drive.file";

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirect);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", scope);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

function pastedCode(): string | undefined {
  const flag = process.argv.indexOf("--code");
  const raw = flag === -1 ? undefined : process.argv[flag + 1];
  if (!raw) return undefined;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return new URL(raw).searchParams.get("code") ?? undefined;
  }
  return raw;
}

async function finish(code: string): Promise<void> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  const json = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  };
  if (!json.refresh_token) {
    console.error(
      json.error_description ||
        "Google did not return a refresh token. Remove this app under your Google Account permissions and run the command again.",
    );
    process.exit(1);
  }
  const folderId = json.access_token
    ? await createMorningFolder(json.access_token)
    : "";
  console.log("\nDrive is connected. Keep these out of the repository:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${json.refresh_token}`);
  if (folderId) console.log(`DRIVE_FOLDER_ID=${folderId}`);
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
  const json = (await response.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!response.ok || !json.id) {
    throw new Error(json.error?.message || "Google Drive did not create the Morning desk folder.");
  }
  return json.id;
}

const existing = pastedCode();
if (existing) {
  finish(existing)
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
} else {
  console.log("Open this link in a browser and approve Drive access:\n");
  console.log(authUrl.toString());
  console.log(
    "\nIf the browser cannot open this computer, copy the full address-bar URL after Google redirects and run:",
  );
  console.log('npm run drive-auth -- --code "PASTED_URL"');
  console.log("\nWaiting for Google to redirect back to this computer…");
  listen();
}

function listen(): void {
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", redirect);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (!code && !error) {
    response.statusCode = 404;
    response.end("Waiting for Google.");
    return;
  }
  if (error || !code) {
    response.end("Google did not return a code. You can close this tab.");
    console.error(error || "Missing code");
    process.exit(1);
  }

  response.end("Drive access captured. You can close this tab and return to the terminal.");
  try {
    await finish(code);
  } catch (caught) {
    console.error(caught instanceof Error ? caught.message : caught);
    process.exit(1);
  }
  process.exit(0);
});

server.listen(port, "127.0.0.1");
}
