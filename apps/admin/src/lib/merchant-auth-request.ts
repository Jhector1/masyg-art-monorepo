import { NextRequest, NextResponse } from "next/server";
export function requireLocalJson(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).origin : req.nextUrl.origin;
  if (!origin || origin !== expected || !req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new Error("Invalid origin or content type");
}
export async function jsonBody(req: NextRequest): Promise<unknown> {
  requireLocalJson(req);
  const raw = await req.text();
  if (raw.length > 4096) throw new Error("Request too large");
  return JSON.parse(raw);
}
export function invalidInput() { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
