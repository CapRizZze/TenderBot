import nodemailer from "nodemailer";
import { existsSync, readFileSync } from "node:fs";

loadDotEnv();

const requiredEnvNames = [
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM",
];

for (const envName of requiredEnvNames) {
  if (!process.env[envName]) {
    console.error(`Missing ${envName}`);
    process.exit(1);
  }
}

const port = Number(process.env.EMAIL_SERVER_PORT);
const secure = process.env.EMAIL_SERVER_SECURE === "true";
const requireTLS = process.env.EMAIL_SERVER_REQUIRE_TLS !== "false";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port,
  secure,
  requireTLS,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

console.log("SMTP config:");
console.log({
  host: process.env.EMAIL_SERVER_HOST,
  port,
  secure,
  requireTLS,
  user: process.env.EMAIL_SERVER_USER,
  from: process.env.EMAIL_FROM,
  passwordLength: process.env.EMAIL_SERVER_PASSWORD.length,
});

try {
  await transporter.verify();
  console.log("SMTP authentication OK");
} catch (error) {
  console.error("SMTP authentication failed");
  console.error(error);
  process.exit(1);
}

function loadDotEnv() {
  if (!existsSync(".env")) {
    return;
  }

  const lines = readFileSync(".env", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
