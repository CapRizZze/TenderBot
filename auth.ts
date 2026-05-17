import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";

import authConfig from "@/auth.config";
import { getAuthEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const authEnv = getAuthEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: {
        host: authEnv.EMAIL_SERVER_HOST,
        port: authEnv.EMAIL_SERVER_PORT,
        secure: authEnv.EMAIL_SERVER_SECURE,
        requireTLS: authEnv.EMAIL_SERVER_REQUIRE_TLS,
        auth: {
          user: authEnv.EMAIL_SERVER_USER,
          pass: authEnv.EMAIL_SERVER_PASSWORD,
        },
      },
      from: authEnv.EMAIL_FROM,
      maxAge: 10 * 60,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // В MVP доступ разрешен любому пользователю, подтвердившему email по OTP-ссылке.
    async signIn({ user }) {
      return Boolean(user.email);
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (typeof token.id === "string") {
        session.user.id = token.id;
      }

      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
