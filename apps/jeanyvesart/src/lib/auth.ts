import { createAuthOptions } from "@acme/auth";

export const authOptions = createAuthOptions({
  enableGoogle: true,
  enableKeycloak: true,
  enableCredentials: false,
  signInPage: "/authenticate",
});
