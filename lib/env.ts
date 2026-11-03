/** Read env at runtime. A direct `process.env.NAME` can be frozen at build time. */
export function env(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function isVercel(): boolean {
  return env("VERCEL") === "1";
}

export function isGitHubActions(): boolean {
  return env("GITHUB_ACTIONS") === "true";
}
