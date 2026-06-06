import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";
import nodemailer from "nodemailer";
import { z } from "zod";

import authConfig from "@/auth.config";
import { saveDevMagicLink } from "@/lib/devMagicLinkStore";
import { getAuthEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const authEnv = getAuthEnv();
const isDevAuthEnabled = process.env.NODE_ENV !== "production";
const shouldBypassSmtpInDev =
  isDevAuthEnabled && process.env.DEV_AUTH_BYPASS_SMTP !== "false";

const devCredentialsSchema = z.object({
  email: z.string().email(),
});

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
      async sendVerificationRequest(params) {
        const { identifier, url, provider } = params;

        if (shouldBypassSmtpInDev) {
          await saveDevMagicLink({
            email: identifier,
            url,
            createdAt: new Date().toISOString(),
            error: "SMTP bypassed in local development mode",
          });

          console.warn("[auth][dev-fallback] Magic link saved locally", {
            email: identifier,
            url,
            error: "SMTP bypassed in local development mode",
          });

          return;
        }

        const transport = nodemailer.createTransport({
          ...provider.server,
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000,
        });

        try {
          await transport.sendMail({
            to: identifier,
            from: provider.from ?? authEnv.EMAIL_FROM,
            subject: "Вход в AI Tender Bot",
            text: `Войдите в AI Tender Bot по ссылке: ${url}`,
            html: `<p>Войдите в AI Tender Bot по ссылке:</p><p><a href="${url}">${url}</a></p>`,
          });
        } catch (error) {
          if (!isDevAuthEnabled) {
            throw error;
          }

          const message =
            error instanceof Error ? error.message : "SMTP send failed";

          await saveDevMagicLink({
            email: identifier,
            url,
            createdAt: new Date().toISOString(),
            error: message,
          });

          console.warn("[auth][dev-fallback] Magic link saved locally", {
            email: identifier,
            url,
            error: message,
          });
        }
      },
    }),
    ...(isDevAuthEnabled
      ? [
          Credentials({
            id: "dev-credentials",
            name: "Dev login",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              const parsed = devCredentialsSchema.safeParse(credentials);

              if (!parsed.success) {
                return null;
              }

              const email = parsed.data.email.toLowerCase().trim();
              const user = await prisma.user.upsert({
                where: {
                  email,
                },
                update: {
                  emailVerified: new Date(),
                },
                create: {
                  email,
                  emailVerified: new Date(),
                  name: email.split("@")[0],
                },
              });

              return {
                id: user.id,
                email: user.email,
                name: user.name,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
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
