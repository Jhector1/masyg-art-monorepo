import { NextResponse } from "next/server";
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("guest_id", "", { path: "/", maxAge: 0 });
  res.cookies.set("next-auth.callback-url", "", { path: "/", maxAge: 0 });
  res.cookies.set("__Secure-next-auth.callback-url", "", { path: "/", maxAge: 0 });
  return res;
}
