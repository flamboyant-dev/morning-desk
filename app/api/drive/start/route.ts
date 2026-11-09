import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  DRIVE_STATE_COOKIE,
  createDriveState,
  googleAuthUrl,
  requestOrigin,
} from "@/lib/drive-link";

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  if (!env("GOOGLE_CLIENT_ID") || !env("GOOGLE_CLIENT_SECRET")) {
    const back = new URL("/settings", origin);
    back.searchParams.set(
      "driveError",
      "Google client ID and secret are not on the server yet.",
    );
    return NextResponse.redirect(back);
  }
  const pending = createDriveState();
  const response = NextResponse.redirect(googleAuthUrl(origin, pending.state));
  response.cookies.set(DRIVE_STATE_COOKIE, pending.cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
