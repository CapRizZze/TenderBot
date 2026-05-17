"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          AI Tender Bot
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Не удалось загрузить приложение
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Произошла неизвестная ошибка. Повторите попытку."}
        </p>
        <Button className="mt-5 gap-2" onClick={reset} type="button">
          <RotateCcw className="h-4 w-4" />
          <span>Повторить</span>
        </Button>
      </section>
    </main>
  );
}
