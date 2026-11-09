import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { mediaFilePath } from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const kind = url.searchParams.get("kind") === "audio" ? "audio" : "video";
  let file: string;
  try {
    file = mediaFilePath(id, kind);
  } catch {
    return new Response("That recording id is not valid.", { status: 400 });
  }

  let size: number;
  try {
    size = (await fs.stat(file)).size;
  } catch {
    return new Response("That file is not on this machine.", { status: 404 });
  }

  const type = kind === "audio" ? "audio/mpeg" : "video/mp4";
  const range = request.headers.get("range");
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : Math.min(start + 1024 * 1024 - 1, size - 1);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end >= size ||
      start > end
    ) {
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${size}` },
      });
    }
    const stream = Readable.toWeb(
      createReadStream(file, { start, end }),
    ) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        "content-type": type,
        "content-length": String(end - start + 1),
        "content-range": `bytes ${start}-${end}/${size}`,
        "accept-ranges": "bytes",
        "cache-control": "private, max-age=3600",
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "content-type": type,
      "content-length": String(size),
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
    },
  });
}
