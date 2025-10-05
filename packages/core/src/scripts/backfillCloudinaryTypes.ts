import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseFromSecureUrl(secureUrl: string) {
  const u = new URL(secureUrl);
  // /<cloud>/<resource>/<type>/v123/<public_id>.<ext>
  const parts = u.pathname.split("/").filter(Boolean);
  const resourceType = parts[1] as "image" | "raw" | "video";
  const deliveryType = parts[2] as "upload" | "authenticated" | "private";
  const tail = parts[3]?.startsWith("v") ? parts.slice(4) : parts.slice(3);
  const withExt = tail.join("/");
  const dot = withExt.lastIndexOf(".");
  const publicId = dot === -1 ? withExt : withExt.slice(0, dot);
  return { resourceType, deliveryType, publicId };
}

async function main() {
  const rows = await prisma.productAsset.findMany({
    where: { OR: [ { resourceType: null }, { deliveryType: null }, { storageKey: null } ] },
  });

  for (const r of rows) {
    const { resourceType, deliveryType, publicId } = parseFromSecureUrl(r.url);
    await prisma.productAsset.update({
      where: { id: r.id },
      data: {
        resourceType: (r as any).resourceType ?? resourceType,
        deliveryType: (r as any).deliveryType ?? deliveryType,
        storageKey: r.storageKey ?? publicId, // keep existing if set
      },
    });
    console.log("Updated", r.id);
  }
}

main().finally(() => prisma.$disconnect());
