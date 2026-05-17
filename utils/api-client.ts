import { z } from "zod";

const apiErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export async function getErrorMessageFromResponse(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const data: unknown = await response.json();
    const parsedData = apiErrorResponseSchema.safeParse(data);

    if (parsedData.success) {
      return parsedData.data.error.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}
