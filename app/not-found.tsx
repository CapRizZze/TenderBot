import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          AI Tender Bot
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Страница не найдена
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Проверьте ссылку или вернитесь к списку тендеров.
        </p>
        <Button asChild className="mt-5">
          <Link href="/">К тендерам</Link>
        </Button>
      </section>
    </main>
  );
}
