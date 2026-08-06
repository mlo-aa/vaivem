import { MarketingHeader } from "@/components/marketing/marketing-header"
import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { DevelopersView } from "@/components/developers/developers-view"
import { LanguageSwitcher } from "@/components/language-switcher"
import { getTranslations, setRequestLocale } from "next-intl/server"

export default async function DevelopersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("developers")

  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.14),_transparent_55%)]" />
      <MarketingHeader />
      <main className="flex-1">
        <section className="border-b border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-16 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-sm text-primary">{t("title")}</p>
              <LanguageSwitcher compact />
            </div>
            <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              {t("headline")}
            </h1>
            <p className="max-w-xl text-pretty text-muted-foreground">
              {t("body")}
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <DevelopersView />
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
