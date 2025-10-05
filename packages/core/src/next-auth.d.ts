// next-auth.d.ts
import { DefaultSession, DefaultUser, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface JWT extends DefaultJWT {
    id: string;
  }

  interface User extends DefaultUser {
    id: string;
  }
}
