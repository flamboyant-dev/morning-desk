import { env } from "@/lib/env";

export function githubDispatchConfigured(): boolean {
  return Boolean(env("GITHUB_DISPATCH_TOKEN") && githubRepository());
}

export function githubRepository(): string {
  return env("GITHUB_REPOSITORY") || env("GITHUB_REPO");
}

export async function dispatchTestRecording(seconds: number): Promise<void> {
  const token = env("GITHUB_DISPATCH_TOKEN");
  const repo = githubRepository();
  const ref = env("GITHUB_DISPATCH_REF") || "main";
  if (!token || !repo) {
    throw new Error(
      "GitHub Actions is not connected. Add GITHUB_DISPATCH_TOKEN and GITHUB_REPOSITORY.",
    );
  }
  const response = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/record.yml/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: { seconds: String(seconds) },
      }),
    },
  );
  if (response.status === 204) return;
  const detail = (await response.text()).slice(0, 240);
  throw new Error(
    `GitHub did not start the recording (${response.status}). ${detail}`,
  );
}
