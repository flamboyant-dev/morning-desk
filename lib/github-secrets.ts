import { seal } from "tweetsodium";
import { env } from "@/lib/env";

function repoName(): string {
  const raw = env("GITHUB_REPOSITORY");
  if (/^[\w.-]+\/[\w.-]+$/.test(raw)) return raw;
  return "flamboyant-dev/morning-desk";
}

export async function saveActionsSecret(name: string, value: string): Promise<void> {
  const token = env("GH_SECRETS_TOKEN");
  if (!token || !value) {
    throw new Error("The morning job cannot store the Drive login yet.");
  }
  const repo = repoName();
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "content-type": "application/json",
  };
  const keyResponse = await fetch(
    `https://api.github.com/repos/${repo}/actions/secrets/public-key`,
    { headers },
  );
  const keyJson = (await keyResponse.json()) as { key?: string; key_id?: string };
  if (!keyResponse.ok || !keyJson.key || !keyJson.key_id) {
    throw new Error("GitHub did not provide a key for the morning job.");
  }
  const encrypted = Buffer.from(
    seal(Buffer.from(value), Buffer.from(keyJson.key, "base64")),
  ).toString("base64");
  const put = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/${name}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ encrypted_value: encrypted, key_id: keyJson.key_id }),
  });
  if (!put.ok && put.status !== 201 && put.status !== 204) {
    throw new Error("GitHub did not save the Drive login for the morning job.");
  }
}
