export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          AI Tender Bot
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Загружаем рабочее пространство
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Получаем ключевые слова, тендеры и историю диалогов.
        </p>
      </section>
    </main>
  );
}
