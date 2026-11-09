import { NextResponse } from "next/server";
import {
  DRIVE_LINK_COOKIE,
  DRIVE_STATE_COOKIE,
  driveStateMatches,
  exchangeDriveCode,
  requestOrigin,
  signDriveLink,
} from "@/lib/drive-link";
import { env } from "@/lib/env";
import { saveActionsSecret } from "@/lib/github-secrets";

function fail(origin: string, message: string) {
  const back = new URL("/settings", origin);
  back.searchParams.set("driveError", message.slice(0, 180));
  const response = NextResponse.redirect(back);
  response.cookies.delete(DRIVE_STATE_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DRIVE_STATE_COOKIE}=`));
  const saved = cookie ? decodeURIComponent(cookie.slice(DRIVE_STATE_COOKIE.length + 1)) : "";
  if (!driveStateMatches(saved, state)) {
    return fail(origin, "That Google sign-in expired. Press Connect Google Drive again.");
  }
  if (!code) {
    return fail(origin, "Google did not return a sign-in code.");
  }
  try {
    const link = await exchangeDriveCode(origin, code);
    await saveActionsSecret("GOOGLE_CLIENT_ID", env("GOOGLE_CLIENT_ID"));
    await saveActionsSecret("GOOGLE_CLIENT_SECRET", env("GOOGLE_CLIENT_SECRET"));
    await saveActionsSecret("GOOGLE_REFRESH_TOKEN", link.refreshToken);
    await saveActionsSecret("DRIVE_FOLDER_ID", link.folderId);
    const back = new URL("/settings", origin);
    back.searchParams.set("drive", "connected");
    back.searchParams.set("morning", "saved");
    const response = NextResponse.redirect(back);
    response.cookies.set(DRIVE_LINK_COOKIE, signDriveLink(link), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    response.cookies.delete(DRIVE_STATE_COOKIE);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Drive did not connect.";
    return fail(origin, message);
  }
}
