import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  updateSearchProfile,
} from "@/lib/services/searchProfileService";
import { searchProfileUpdateDtoSchema } from "@/types/search-profile-update.dto";

interface RouteContext {
  params: {
    profileId: string;
  };
}

export async function PUT(request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  try {
    const payload = searchProfileUpdateDtoSchema.parse(await request.json());
    const profile = await updateSearchProfile(
      session.user.id,
      params.profileId,
      payload,
    );

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Не удалось обновить профиль поиска." },
      { status: 500 },
    );
  }
}
