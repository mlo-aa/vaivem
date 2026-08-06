import "server-only"

import { Resend } from "resend"

export async function sendLoginCode(
  email: string,
  code: string,
): Promise<{ devMode: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || "Vaivém <onboarding@resend.dev>"

  if (!apiKey) {
    console.log(
      `\n========== VAIVÉM DEV LOGIN CODE ==========\n` +
        `email: ${email}\n` +
        `code:  ${code}\n` +
        `==========================================\n`,
    )
    return { devMode: true }
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `${code} is your Vaivém sign-in code`,
    text: `Your Vaivém sign-in code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Your Vaivém sign-in code is <strong style="font-size:24px;letter-spacing:0.15em">${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
  })

  if (error) {
    console.error("[auth/email] Resend failed:", error)
    throw new Error(error.message || "Failed to send email")
  }

  return { devMode: false }
}
