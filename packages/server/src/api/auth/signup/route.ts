import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { requireSameOriginJson } from "@acme/server/lib/public-request-guard";
import { z } from "zod";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
const schema = z.object({
  email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),
  name:z.string().trim().min(1).max(120).optional(),
  password:z.string().min(12).max(128),
}).strict();
/** Default closed. Enable only with provider-backed rate limits + email verification in place. */
export async function POST(req: NextRequest) {
  if (process.env.ZILEDIGITAL_PUBLIC_SIGNUP_ENABLED !== "true") {
    return NextResponse.json({error:"Registration is not enabled"},{status:503});
  }
  try {
    requireSameOriginJson(req);
    const raw = await req.text();
    if (raw.length > 4096) return NextResponse.json({error:"Invalid signup payload"},{status:400});
    const input=schema.safeParse(JSON.parse(raw));
    if (!input.success) return NextResponse.json({error:"Invalid signup payload"},{status:400});
    const passwordHash = await bcrypt.hash(input.data.password,12);
    const user = await prisma.user.create({
      data:{email:input.data.email,name:input.data.name ?? null,passwordHash},
      select:{id:true,email:true,name:true},
    });
    return NextResponse.json({user},{status:201,headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    if (error instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON"},{status:400});
    if (error instanceof Error && error.name === "CartSafetyError") return NextResponse.json({error:"Invalid request origin or type"},{status:400});
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({error:"Account already exists"},{status:409});
    }
    console.error("Signup failed",error);
    return NextResponse.json({error:"Unable to register"},{status:500});
  }
}
