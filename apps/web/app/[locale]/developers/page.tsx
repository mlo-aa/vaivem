import { MarketingHeader } from "@/components/marketing/marketing-header"
import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { DevelopersView } from "@/components/developers/developers-view"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
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
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <MarketingHeader />
      <main className="flex-1">
        <section className="border-b border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-16 sm:px-8">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-sm text-muted-foreground">{t("title")}</p>
              <div className="flex items-center gap-2">
                <LanguageSwitcher compact />
                <ThemeToggle />
              </div>
            </div>
            <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-[-0.02em] text-foreground md:text-5xl">
              {t("headline")}
            </h1>
            <p className="max-w-xl text-pretty text-[15px] text-muted-foreground md:text-base">
              {t("body")}
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
          <DevelopersView />
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
