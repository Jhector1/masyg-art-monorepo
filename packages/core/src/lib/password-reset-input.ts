import { z } from "zod";

/** Browser-independent validation shared by the reset UI and token-consumption route. */
export const passwordResetInput = z.object({
  token: z.string().min(16).max(512),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).strict().refine(value => value.newPassword === value.confirmPassword, {
  message: "Passwords do not match", path: ["confirmPassword"],
});
