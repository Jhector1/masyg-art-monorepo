import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import { prisma } from "@acme/core/lib/prisma";
import { cloudinary } from "@acme/core/lib/cloudinary";
import { requireSameOriginJson } from "@acme/server/lib/public-request-guard";
import { z } from "zod";
import bcrypt from "bcryptjs";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = {"Cache-Control": "private, no-store"};
const safeUserSelect = {id:true,name:true,email:true,image:true,passwordHash:true,createdAt:true,updatedAt:true} as const;

/** Identity is global to the signed-in buyer, never selected from a client userId. */
async function authenticatedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({where:{email:session.user.email},select:safeUserSelect});
}
function publicUser(user: {id:string;name:string|null;email:string;image:string|null;createdAt:Date;updatedAt:Date}) {
  return {id:user.id,name:user.name,email:user.email,image:user.image,avatarUrl:user.image,
    createdAt:user.createdAt,updatedAt:user.updatedAt};
}
export async function GET() {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({error:"Unauthorized"},{status:401,headers:noStore});
    const [orders, last, grants] = await Promise.all([
      prisma.order.count({where:{customer:{is:{userId:user.id}}}}),
      prisma.order.findFirst({where:{customer:{is:{userId:user.id}}},
        orderBy:{createdAt:"desc"},select:{id:true,status:true,currency:true,totalMinor:true,createdAt:true}}),
      prisma.digitalGrant.aggregate({where:{item:{order:{customer:{is:{userId:user.id}}}}},
        _sum:{uses:true}}),
    ]);
    // Counts are the actual canonical records. Do not manufacture legacy design-credit balances.
    return NextResponse.json({user:{...publicUser(user),downloadCount:grants._sum.uses ?? 0,
      counts:{orders},lastOrder:last ? {id:last.id,status:last.status,total:last.totalMinor/100,
        currency:last.currency,placedAt:last.createdAt} : null}}, {headers:noStore});
  } catch (error) {
    console.error("Profile lookup failed",error);
    return NextResponse.json({error:"Unable to load profile"},{status:500,headers:noStore});
  }
}

const patchNameSchema = z.object({name:z.string().trim().min(1).max(120),password:z.string().min(1)}).strict();
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

async function uploadAvatar(userId:string, file:File) {
  if (file.size < 1 || file.size > MAX_AVATAR_BYTES || !["image/jpeg","image/png","image/webp"].includes(file.type)) {
    throw new Error("Avatar must be JPEG, PNG or WebP under 5MB");
  }
  const bytes=Buffer.from(await file.arrayBuffer());
  const metadata=await sharp(bytes, {limitInputPixels:20_000_000}).metadata();
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > 20_000_000) {
    throw new Error("Invalid avatar dimensions");
  }
  const safe=await sharp(bytes,{limitInputPixels:20_000_000}).rotate()
    .resize({width:1024,height:1024,fit:"inside",withoutEnlargement:true})
    .webp({quality:80}).toBuffer();
  const uploaded=await new Promise<import("cloudinary").UploadApiResponse>((resolve,reject) => {
    const stream=cloudinary.uploader.upload_stream({
      public_id:`ziledigital/identity/avatar/${userId}`,overwrite:true,invalidate:true,
      resource_type:"image",format:"webp",unique_filename:false,use_filename:false,
    },(error,result) => error ? reject(error) : result ? resolve(result) : reject(new Error("Upload unavailable")));
    stream.end(safe);
  });
  return uploaded.secure_url;
}

/** Same-origin protection for both JSON and multipart updates. Email changes require a separate verified workflow. */
export async function PATCH(req:NextRequest) {
  try {
    const user=await authenticatedUser();
    if (!user) return NextResponse.json({error:"Unauthorized"},{status:401,headers:noStore});
    if (req.headers.get("origin") !== req.nextUrl.origin) {
      return NextResponse.json({error:"Invalid request origin"},{status:403,headers:noStore});
    }
    const mediaType=req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (mediaType === "multipart/form-data") {
      const form=await req.formData();
      const file=form.get("avatar");
      if (!(file instanceof File)) return NextResponse.json({error:"Avatar file required"},{status:400,headers:noStore});
      try {
        const image=await uploadAvatar(user.id,file);
        const updated=await prisma.user.update({where:{id:user.id},data:{image},select:safeUserSelect});
        return NextResponse.json({user:publicUser(updated)},{headers:noStore});
      } catch (error) {
        if (error instanceof Error && /Avatar|avatar|Invalid/.test(error.message)) {
          return NextResponse.json({error:error.message},{status:400,headers:noStore});
        }
        throw error;
      }
    }
    requireSameOriginJson(req);
    const raw=await req.text();
    if (raw.length>2048) return NextResponse.json({error:"Invalid profile request"},{status:400,headers:noStore});
    const inputUnknown:unknown=JSON.parse(raw);
    // Do not silently mutate verified login emails without confirmation of mailbox ownership.
    if (typeof inputUnknown === "object" && inputUnknown && "email" in inputUnknown) {
      return NextResponse.json({error:"Email changes require verified email confirmation"},{status:409,headers:noStore});
    }
    const parsed=patchNameSchema.safeParse(inputUnknown);
    if (!parsed.success) return NextResponse.json({error:"Invalid profile request"},{status:400,headers:noStore});
    if (!user.passwordHash || !(await bcrypt.compare(parsed.data.password,user.passwordHash))) {
      return NextResponse.json({error:"Current password required"},{status:403,headers:noStore});
    }
    const updated=await prisma.user.update({where:{id:user.id},data:{name:parsed.data.name},select:safeUserSelect});
    return NextResponse.json({user:publicUser(updated)},{headers:noStore});
  } catch(error) {
    if (error instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON"},{status:400,headers:noStore});
    console.error("Profile update failed",error);
    return NextResponse.json({error:"Unable to update profile"},{status:500,headers:noStore});
  }
}
