import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface DevMagicLinkPayload {
  email: string;
  url: string;
  createdAt: string;
  error?: string;
}

const STORE_DIR = path.join(process.cwd(), ".tmp");
const STORE_PATH = path.join(STORE_DIR, "dev-magic-link.json");

export async function saveDevMagicLink(payload: DevMagicLinkPayload) {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf-8");
}

export async function readDevMagicLink(): Promise<DevMagicLinkPayload | null> {
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as DevMagicLinkPayload;

    if (!parsed?.url || !parsed?.email) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
