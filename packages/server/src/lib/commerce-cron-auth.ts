import {timingSafeEqual} from "node:crypto";
/** Constant-time validation shared by all private commerce maintenance routes. */
export function authorizedCommerceCron(authorization:string|null, secret:string|undefined):boolean {
  if(!secret || secret.length<32 || !authorization)return false;
  const expected=Buffer.from(`Bearer ${secret}`);
  const supplied=Buffer.from(authorization);
  return expected.length===supplied.length && timingSafeEqual(expected,supplied);
}
