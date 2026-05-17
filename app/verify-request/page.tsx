export default function VerifyRequestPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          AI Tender Bot
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Проверьте почту
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Мы отправили одноразовую ссылку для входа. Если письма нет во входящих,
          проверьте папку спама или повторите вход через несколько минут.
        </p>
      </section>
    </main>
  );
}
