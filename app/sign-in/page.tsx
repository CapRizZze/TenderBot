import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signInSchema = z.object({
  email: z.string().email("Введите корректный email"),
});

interface SignInPageProps {
  searchParams?: {
    callbackUrl?: string;
    error?: string;
  };
}

export default function SignInPage({ searchParams }: SignInPageProps) {
  const hasError = Boolean(searchParams?.error);
  const redirectTo = getSafeRedirectTo(searchParams?.callbackUrl);

  async function requestEmailOtp(formData: FormData) {
    "use server";

    const parsedData = signInSchema.safeParse({
      email: formData.get("email"),
    });

    if (!parsedData.success) {
      redirect("/sign-in?error=invalid-email");
    }

    await signIn("nodemailer", {
      email: parsedData.data.email,
      redirectTo,
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          AI Tender Bot
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Вход по email
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Укажите рабочий email. Мы отправим одноразовую ссылку для входа без
          пароля.
        </p>

        <form action={requestEmailOtp} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              placeholder="name@company.ru"
              required
              type="email"
            />
          </div>

          {hasError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Проверьте email и попробуйте снова.
            </p>
          ) : null}

          <Button className="w-full" type="submit">
            Получить ссылку для входа
          </Button>
        </form>
      </section>
    </main>
  );
}

function getSafeRedirectTo(callbackUrl?: string): string {
  if (!callbackUrl) {
    return "/";
  }

  try {
    const url = new URL(callbackUrl);

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return callbackUrl.startsWith("/") ? callbackUrl : "/";
  }
}
