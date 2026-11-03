import { NextResponse } from "next/server";
import { isRequestAuthed, usingDevPassword } from "@/lib/auth";

export async function GET(request: Request) {
  return NextResponse.json({
    ok: isRequestAuthed(request),
    devPassword: usingDevPassword(),
  });
}
