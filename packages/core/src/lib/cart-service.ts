import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@acme/core/lib/prisma";
import { hashGuestCartToken } from "@acme/auth/guestIdentity";
import { resolvePublishedStore } from "./public-catalog";
import { assessVariant, CartSafetyError, guestCartAddInput, guestCartSetInput, quoteLines } from "./cart-contract";

const selection = {
  id:true,
  items:{
    orderBy:{id:"asc" as const},
    select:{
      quantity:true,
      variant:{ select:{
        id:true, name:true, attributes:true, fulfillment:true, inventoryPolicy:true,
        active:true, priceMinor:true, currency:true,
        inventory:{select:{onHand:true,reserved:true}},
        digitalFiles:{where:{retiredAt:null,asset:{private:true}},select:{id:true}},
        product:{select:{id:true,title:true,status:true,offersDigitalLicenses:true, offersFraming:true, offersGlazing:true,listings:{
          where:{status:"PUBLISHED" as const},
          select:{status:true,storeId:true,organizationId:true},
        }}},
      }},
    },
  },
} satisfies Prisma.CartSelect;

type CartRow = Prisma.CartGetPayload<{select:typeof selection}>;

function tokenHash(rawToken: string | undefined): string | null {
  if (!rawToken) return null;
  try { return hashGuestCartToken(rawToken); }
  catch { return null; }
}

function publicCart(cart: CartRow | null, organizationId: string, storeId: string) {
  if (!cart) return quoteLines([]);
  return quoteLines(cart.items.map(item => ({
    quantity:item.quantity,
    variant:{...item.variant, product:{...item.variant.product,
      listings:item.variant.product.listings.filter(listing =>
        listing.organizationId === organizationId && listing.storeId === storeId),
    }},
  })));
}

export async function getGuestCart(args:{storeId:string; rawToken?:string}) {
  const store = await resolvePublishedStore(args.storeId);
  const hash = tokenHash(args.rawToken);
  if (!hash) return publicCart(null,store.organizationId,store.id);
  const cart = await prisma.cart.findFirst({
    where:{ organizationId:store.organizationId, storeId:store.id, guestTokenHash:hash },
    select:selection,
  });
  return publicCart(cart,store.organizationId,store.id);
}

/** All lookups and writes are scoped to the server-resolved published store. */
export async function mutateGuestCart(args:{
  storeId:string; rawToken?:string; payload:unknown; mode:"add"|"set";
}) {
  const input = (args.mode === "add" ? guestCartAddInput : guestCartSetInput).parse(args.payload);
  const store = await resolvePublishedStore(args.storeId);
  const incoming = tokenHash(args.rawToken);
  const candidateToken = randomBytes(32).toString("base64url");
  const candidateHash = hashGuestCartToken(candidateToken);
  let issuedNewToken = false;
  let cartId = "";
  for(let attempt=0; attempt<3; attempt++) {
    try {
      const result = await prisma.$transaction(async tx => {
        let cart = incoming ? await tx.cart.findFirst({
          where:{organizationId:store.organizationId,storeId:store.id,guestTokenHash:incoming},
          select:{id:true},
        }) : null;
        // Removing an existing line never requires the product to remain published.
        const variant = args.mode === "set" && input.quantity === 0 ? null : await tx.productVariant.findFirst({
          where:{
            id:input.variantId, organizationId:store.organizationId,
            active:true,
            product:{ status:"PUBLISHED", listings:{ some:{
              organizationId:store.organizationId, storeId:store.id, status:"PUBLISHED",
            }}},
          },
          select:{
            id:true,name:true,attributes:true,fulfillment:true,inventoryPolicy:true,priceMinor:true,currency:true,active:true,
            inventory:{select:{onHand:true,reserved:true}},
            digitalFiles:{where:{retiredAt:null,asset:{private:true}},select:{id:true}},
            product:{select:{id:true,title:true,status:true,offersDigitalLicenses:true, offersFraming:true, offersGlazing:true,listings:{
              where:{organizationId:store.organizationId,storeId:store.id,status:"PUBLISHED"},select:{status:true},
            }}},
          },
        });
        if (!variant && !(args.mode === "set" && input.quantity === 0)) throw new CartSafetyError(404,"Purchasable variant not found");
        const existing = cart ? await tx.cartItem.findUnique({
          where:{organizationId_cartId_variantId:{
            organizationId:store.organizationId,cartId:cart.id,variantId:input.variantId,
          }}, select:{id:true,quantity:true},
        }) : null;
        const quantity = args.mode === "add" ? (existing?.quantity ?? 0) + input.quantity : input.quantity;
        if (!Number.isSafeInteger(quantity) || quantity > 20) throw new CartSafetyError(409,"Maximum 20 units per variant");
        if (quantity > 0) {
          const unavailable = assessVariant(variant!,quantity);
          if (unavailable) throw new CartSafetyError(409,`Variant unavailable: ${unavailable}`);
        }
        if (!cart && quantity > 0) {
          cart = await tx.cart.create({
            data:{organizationId:store.organizationId,storeId:store.id,guestTokenHash:candidateHash},
            select:{id:true},
          });
        }
        if (!cart) return {id:null,issued:false};
        if (quantity === 0) {
          await tx.cartItem.deleteMany({where:{
            organizationId:store.organizationId,cartId:cart.id,variantId:input.variantId,
          }});
        } else if (existing) {
          await tx.cartItem.update({where:{id:existing.id},data:{quantity}});
        } else {
          await tx.cartItem.create({data:{
            organizationId:store.organizationId,cartId:cart.id,variantId:input.variantId,quantity,
          }});
        }
        return {id:cart.id,issued:!incoming || !(await tx.cart.findFirst({
          where:{organizationId:store.organizationId,storeId:store.id,guestTokenHash:incoming ?? ""},select:{id:true},
        }))};
      },{isolationLevel:"Serializable"});
      cartId = result.id ?? "";
      issuedNewToken = result.issued;
      break;
    } catch (error) {
      // Retry only serialization conflicts, never validation/authorization failures.
      if ((error as {code?:string}).code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  // A cart can be empty after removing an item; return current safe reprice.
  const token = issuedNewToken ? candidateToken : args.rawToken;
  const cart = await getGuestCart({storeId:store.id,rawToken:token});
  return {cart, newToken:issuedNewToken ? candidateToken : undefined, cartId:cartId || null};
}
