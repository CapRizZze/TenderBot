import type { NextAuthConfig } from "next-auth";

export const publicRoutes = ["/sign-in", "/verify-request"];

const authConfig = {
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/verify-request",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublicRoute = publicRoutes.some((route) =>
        pathname.startsWith(route),
      );

      return Boolean(auth) || isPublicRoute;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
