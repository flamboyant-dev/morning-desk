const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function browserUserAgent(): string {
  return UA;
}

function isPlaylistUrl(url: URL): boolean {
  const haystack = `${url.pathname} ${url.search}`.toLowerCase();
  return (
    haystack.includes(".m3u8") ||
    haystack.includes("format=m3u8") ||
    haystack.includes("output=hls")
  );
}

function cleanUrl(value: string): string {
  return value.replace(/[),.;]+$/, "");
}

export function extractM3u8(body: string, base: string): string | null {
  const decoded = body
    .replace(/\\u002F/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
  const absolute = decoded.match(/https?:\/\/[^\s"'<>\\]+?\.m3u8[^\s"'<>\\]*/i);
  if (absolute) return cleanUrl(absolute[0]);
  const relative = decoded.match(/[^\s"'=<>\\]+?\.m3u8[^\s"'<>\\]*/i);
  if (!relative) return null;
  try {
    return cleanUrl(new URL(relative[0], base).toString());
  } catch {
    return null;
  }
}

/** Use a direct playlist, or pull the first .m3u8 out of a player page. */
export async function resolveStreamUrl(input: string): Promise<string> {
  const trimmed = input.trim();
  let page: URL;
  try {
    page = new URL(trimmed);
  } catch {
    throw new Error("That stream URL is not a valid link.");
  }
  if (page.protocol !== "http:" && page.protocol !== "https:") {
    throw new Error("The stream URL has to start with http or https.");
  }
  if (isPlaylistUrl(page)) return page.toString();

  const response = await fetch(page, {
    redirect: "follow",
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/vnd.apple.mpegurl,*/*",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`The page did not open (${response.status}).`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("mpegurl") || type.includes("vnd.apple.mpegurl")) {
    return response.url;
  }
  const html = (await response.text()).slice(0, 1_500_000);
  const found = extractM3u8(html, response.url);
  if (!found) {
    throw new Error(
      "No .m3u8 link was found on that page. Paste the playlist address itself.",
    );
  }
  return found;
}
