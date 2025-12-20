// import "./types";
// export * from "./auth/auth";
// export { TestBlock } from "./components/TestBlock";
export { auth, handlers } from "./lib/auth";
export { authOptions } from "./authOptions";
export {getOrCreateGuestId, getGuestId, clearGuestId} from "./lib/guest";
export type { NextAuthOptions } from "next-auth";
