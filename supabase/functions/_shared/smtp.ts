import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

function required(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function envNum(name: string, fallback: number) {
  const v = Deno.env.get(name);
  const n = v ? Number(v) : fallback;
  return Number.isFinite(n) ? n : fallback;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  text?: string;
};

export async function sendMail({ to, subject, html, replyTo, text }: SendMailInput) {
  const host = required("SMTP_HOST");
  const port = envNum("SMTP_PORT", 587);
  const user = required("SMTP_USER");
  const pass = required("SMTP_PASS");
  const from = required("SMTP_FROM");

  // 465 geralmente é SSL direto; 587 é STARTTLS
  const useTlsDirect = String(Deno.env.get("SMTP_TLS") || "").toLowerCase() === "true";

  const client = new SmtpClient();

  await client.connect({
    hostname: host,
    port,
    username: user,
    password: pass,
    tls: useTlsDirect || port === 465,
  });

  const headers: Record<string, string> = {};
  if (replyTo) headers["Reply-To"] = replyTo;

  await client.send({
    from,
    to,
    subject,
    content: text || "",
    html,
    headers,
  });

  await client.close();
}
