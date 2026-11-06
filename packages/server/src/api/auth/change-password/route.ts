import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import { prisma } from "@acme/core/lib/prisma";
import { requireSameOriginJson } from "@acme/server/lib/public-request-guard";
import { z } from "zod";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
const form = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128),
}).strict().refine(v => v.newPassword === v.confirmPassword, {message:"Passwords do not match"});

/** Only change a verified session's own password; never accept a user ID from JSON. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req);
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({error:"Unauthorized"},{status:401});
    const raw = await req.text();
    if (raw.length > 4096) return NextResponse.json({error:"Invalid request"},{status:400});
    const parsed = form.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({error:"Invalid password request"},{status:400});
    const user = await prisma.user.findUnique({
      where:{email:session.user.email},select:{id:true,passwordHash:true},
    });
    if (!user) return NextResponse.json({error:"Unauthorized"},{status:401});
    if (!user.passwordHash) return NextResponse.json({error:"Use the account password setup flow"},{status:409});
    if (!await bcrypt.compare(parsed.data.oldPassword,user.passwordHash)) {
      return NextResponse.json({error:"Current password incorrect"},{status:403});
    }
    const newHash = await bcrypt.hash(parsed.data.newPassword,12);
    const changed = await prisma.user.updateMany({
      where:{id:user.id,passwordHash:user.passwordHash},data:{passwordHash:newHash},
    });
    if (changed.count !== 1) return NextResponse.json({error:"Account changed; retry"},{status:409});
    return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON"},{status:400});
    if (error instanceof Error && error.name === "CartSafetyError") return NextResponse.json({error:"Invalid request origin or type"},{status:400});
    console.error("Password change failed",error);
    return NextResponse.json({error:"Unable to change password"},{status:500});
  }
}
