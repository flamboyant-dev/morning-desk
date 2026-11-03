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

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirect);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/drive");
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("Open this link in a browser and approve Drive access:\n");
console.log(authUrl.toString());
console.log("\nWaiting for Google to redirect back to this computer…");

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
    refresh_token?: string;
    error_description?: string;
  };
  response.end("Drive access captured. You can close this tab and return to the terminal.");
  if (!json.refresh_token) {
    console.error(
      json.error_description ||
        "Google did not return a refresh token. Remove this app under your Google Account permissions and run the command again.",
    );
    process.exit(1);
  }
  console.log("\nAdd this secret to GitHub Actions and Vercel:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${json.refresh_token}`);
  process.exit(0);
});

server.listen(port, "127.0.0.1");
