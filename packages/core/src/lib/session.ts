// // src/lib/session.ts
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";

// /**
//  * Returns the authenticated user from NextAuth, or null.
//  */
// export async function getCurrentUser() {
//   const session = await getServerSession(authOptions);
//   // session?.user has { id, email, name } per our jwt/session callback
//   return session?.user ?? null;
// }
