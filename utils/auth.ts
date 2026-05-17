import { auth } from "@/auth";
import { NextResponse } from "next/server";

export interface CurrentUser {
  id: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
  };
}

export function createUnauthorizedResponseBody() {
  return {
    error: {
      message: "Требуется авторизация",
    },
  };
}

export function createUnauthorizedResponse() {
  return NextResponse.json(createUnauthorizedResponseBody(), {
    status: 401,
  });
}
