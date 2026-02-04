import { z } from "zod";

/**
 * Keep PATCH contract:
 * { productId, digitalVariantId?, printVariantId?, updates }
 *
 * updates is flexible because your old service supports variant-style updates.
 * Adjust the updates schema if you want stricter rules.
 */
export const CartPatchBodySchema = z.object({
  productId: z.string().min(1),
  digitalVariantId: z.string().min(1).optional(),
  printVariantId: z.string().min(1).optional(),
  updates: z.record(z.string(), z.unknown()),
});

export type CartPatchBody = z.infer<typeof CartPatchBodySchema>;

export const CartDeleteBodySchema = z.object({
  productId: z.string().min(1),
});

export type CartDeleteBody = z.infer<typeof CartDeleteBodySchema>;

export const CartPostBodySchema = z.object({
  productId: z.string().min(1),
  digitalType: z.string().nullable().optional(),
  printType: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(99).default(1),
  format: z.string().min(1),
  size: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  frame: z.string().nullable().optional(),
  license: z.string().min(1),

  // optional design payload
  design: z.any().optional(),
  snapshot: z.boolean().optional(),
});

export type CartPostBody = z.infer<typeof CartPostBodySchema>;
