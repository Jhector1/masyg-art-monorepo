// src/server/stripe/webhook/cloudinaryHelper.ts
import { cloudinary } from "../../../lib/cloudinary";
import { composeSvgFromDesign } from "./utils";

export async function createPurchaseWebP(opts: {
  orderId: string;
  orderItemId: string;
  userId?: string | null;
  guestId?: string | null;
  design: { previewPublicId?: string | null; previewUrl?: string | null; style: any; defs?: string | null };
}) {
  const { orderId, orderItemId, userId, guestId, design } = opts;

  const ownerFolder = userId ? `user_${userId}` : `guest_${guestId ?? "unknown"}`;
  const folder = `purchases-${process.env.NEXT_ENV}/${ownerFolder}/${orderId}`;
  const public_id = `${orderItemId}`;

  let uploadSource: string;
  if (design.previewPublicId) {
    uploadSource = cloudinary.url(design.previewPublicId, {}); // original asset
  } else if (design.previewUrl) {
    uploadSource = design.previewUrl;
  } else {
    const svg = composeSvgFromDesign(design.style, design.defs ?? null);
    const b64 = Buffer.from(svg, "utf8").toString("base64");
    uploadSource = `data:image/svg+xml;base64,${b64}`;
  }

  const res = await cloudinary.uploader.upload(uploadSource, {
    folder,
    public_id,
    overwrite: true,
    format: "webp",
     transformation: [
        { quality: "auto", fetch_format: "auto" },
        {
          overlay: { public_id: "watermark" },
          width: "1.0",
          height: "1.0",
          crop: "fill",
          gravity: "center",
          opacity: 10,
          flags: ["relative"],
        },
      ],
  });

  return { url: res.secure_url, publicId: res.public_id };
}
