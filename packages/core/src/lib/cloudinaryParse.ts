// Parse resourceType/type/publicId from a Cloudinary secure_url
export function parseFromSecureUrl(secureUrl: string) {
  try {
    const u = new URL(secureUrl);
    // /<cloud>/<resource_type>/<type>/v<ver>/<public_id>.<ext>
    const parts = u.pathname.split("/").filter(Boolean);
    // parts[0] = <cloud_name>
    const resourceType = parts[1];                 // image | raw | video
    const deliveryType = parts[2];                 // upload | authenticated | private
    const afterV = parts[3]?.startsWith("v") ? parts.slice(4) : parts.slice(3);
    const withExt = afterV.join("/");
    const dot = withExt.lastIndexOf(".");
    const publicId = dot === -1 ? withExt : withExt.slice(0, dot);
    return { resourceType, deliveryType, publicId };
  } catch {
    return { resourceType: "image", deliveryType: "upload", publicId: "" };
  }
}
