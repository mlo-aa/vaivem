import "server-only"

import { Resend } from "resend"

const COPY = {
  en: (s: string, a: string) => ({
    subject: `${s} sent you ${a} USDC`,
    intro: `${s} sent you ${a} USDC with Vaivém.`,
    cta: "Claim your money",
    note: "If you were not expecting this, you can ignore this email. The link expires automatically.",
  }),
  es: (s: string, a: string) => ({
    subject: `${s} te envió ${a} USDC`,
    intro: `${s} te envió ${a} USDC con Vaivém.`,
    cta: "Cobrar mi dinero",
    note: "Si no esperabas este mensaje, puedes ignorarlo. El enlace vence automáticamente.",
  }),
  pt: (s: string, a: string) => ({
    subject: `${s} enviou ${a} USDC para você`,
    intro: `${s} enviou ${a} USDC para você com a Vaivém.`,
    cta: "Receber meu dinheiro",
    note: "Se você não esperava esta mensagem, pode ignorá-la. O link expira automaticamente.",
  }),
} as const

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Best-effort: never throws — a mail failure must not fail claim creation. */
export async function sendClaimEmail(input: {
  to: string
  senderName: string
  amount: number
  country: string
  claimUrl: string
  message?: string | null
  requiresCode: boolean
}): Promise<{ sent: boolean }> {
  try {
    const lang = input.country === "MX" ? "es" : input.country === "BR" ? "pt" : "en"
    const amount = input.amount.toFixed(2)
    const c = COPY[lang](input.senderName, amount)
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[claim-email] (dev) to=${input.to} link=${input.claimUrl}`)
      }
      return { sent: false }
    }
    const from = process.env.EMAIL_FROM || "Vaivém <onboarding@resend.dev>"
    const codeNote = input.requiresCode
      ? { en: "The sender will give you an access code separately.", es: "El remitente te dará un código de acceso por otra vía.", pt: "O remetente enviará um código de acesso separadamente." }[lang]
      : ""
    const msg = input.message ? `<blockquote>${esc(input.message)}</blockquote>` : ""
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: input.to,
      subject: c.subject,
      text: `${c.intro}\n\n${input.message ? input.message + "\n\n" : ""}${c.cta}: ${input.claimUrl}\n${codeNote}\n\n${c.note}`,
      html: `<p>${esc(c.intro)}</p>${msg}<p><a href="${esc(input.claimUrl)}">${esc(c.cta)}</a></p>${codeNote ? `<p>${esc(codeNote)}</p>` : ""}<p style="color:#666;font-size:12px">${esc(c.note)}</p>`,
    })
    if (error) {
      console.error("[claim-email] Resend failed:", error.message)
      return { sent: false }
    }
    return { sent: true }
  } catch (err) {
    console.error("[claim-email]", err instanceof Error ? err.message : err)
    return { sent: false }
  }
}
