import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { passwordResetInput } from "@acme/core/lib/password-reset-input";
import { requireSameOriginJson } from "@acme/server/lib/public-request-guard";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
const headers = {"Cache-Control": "private, no-store"};
const invalid = () => NextResponse.json({error:"Invalid or expired reset link"}, {status:400,headers});

/** Single-use reset: consuming a token and updating its owner's hash must commit together.
 * The token's identifier, never a request-body userId/email, is the authority.
 */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req);
    const raw = await req.text();
    if (raw.length > 2048) return NextResponse.json({error:"Invalid password reset request"}, {status:400,headers});
    const parsed = passwordResetInput.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({error:"Invalid password reset request"}, {status:400,headers});
    const {token,newPassword} = parsed.data;
    const passwordHash = await bcrypt.hash(newPassword, 12);
    let succeeded = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        succeeded = await prisma.$transaction(async tx => {
          const now = new Date();
          const vt = await tx.verificationToken.findUnique({where:{token},select:{identifier:true,expires:true}});
          if (!vt || vt.expires <= now) return false;
          const user = await tx.user.findUnique({where:{email:vt.identifier},select:{id:true}});
          if (!user) return false;
          // Guard against a replay, expiry between reads, or competing requests.
          const consumed = await tx.verificationToken.deleteMany({where:{token,identifier:vt.identifier,expires:{gt:now}}});
          if (consumed.count !== 1) return false;
          const changed = await tx.user.updateMany({where:{id:user.id,email:vt.identifier},data:{passwordHash}});
          if (changed.count !== 1) throw new Error("RESET_UPDATE_CONFLICT");
          return true;
        }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
        break;
      } catch (error) {
        const code = (error as {code?:unknown})?.code;
        if (code === "P2034" || code === "P2002") {
          if (attempt === 0) continue;
          return invalid();
        }
        if (error instanceof Error && error.message === "RESET_UPDATE_CONFLICT") return invalid();
        throw error;
      }
    }
    if (!succeeded) return invalid();
    return NextResponse.json({message:"Password updated."},{headers});
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON"},{status:400,headers});
    if (error instanceof Error && error.name === "CartSafetyError") {
      return NextResponse.json({error:"Invalid request origin or type"},{status:400,headers});
    }
    console.error("Password reset failed",error);
    return NextResponse.json({error:"Unable to reset password"},{status:500,headers});
  }
}
