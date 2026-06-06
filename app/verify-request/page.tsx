import { readDevMagicLink } from "@/lib/devMagicLinkStore";

const isDevAuthEnabled = process.env.NODE_ENV !== "production";

export default async function VerifyRequestPage() {
  const devMagicLink = isDevAuthEnabled ? await readDevMagicLink() : null;

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
          Мы отправили одноразовую ссылку для входа. Если письма нет во
          входящих, проверьте папку спама или повторите вход через несколько
          минут.
        </p>

        {devMagicLink ? (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-950">
            <p className="font-semibold">
              Dev fallback: SMTP недоступен, ссылка сохранена локально
            </p>
            <p className="mt-2 break-all">
              Email: {devMagicLink.email}
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Создано: {new Date(devMagicLink.createdAt).toLocaleString("ru-RU")}
            </p>
            {devMagicLink.error ? (
              <p className="mt-1 text-xs text-amber-800">
                SMTP error: {devMagicLink.error}
              </p>
            ) : null}
            <a
              className="mt-3 inline-flex rounded-md bg-amber-600 px-3 py-2 font-medium text-white hover:bg-amber-700"
              href={devMagicLink.url}
            >
              Открыть magic link
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
