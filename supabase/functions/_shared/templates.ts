export function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function contactEmailHtml(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const name = escapeHtml(input.name);
  const email = escapeHtml(input.email);
  const subject = escapeHtml(input.subject);
  const message = escapeHtml(input.message).replaceAll("\n", "<br/>");

  return `
  <div style="font-family: Arial, sans-serif; max-width: 720px; margin:0 auto; padding: 16px;">
    <h2 style="margin:0 0 12px;">Novo contato via site</h2>
    <p style="margin:0 0 6px;"><b>Nome:</b> ${name}</p>
    <p style="margin:0 0 6px;"><b>Email:</b> ${email}</p>
    <p style="margin:0 0 12px;"><b>Assunto:</b> ${subject}</p>
    <div style="padding:12px; border:1px solid #e5e5e5; border-radius: 10px;">
      <div style="font-size:14px; color:#111;">${message}</div>
    </div>
    <p style="margin-top:12px; font-size:12px; color:#666;">
      Enviado automaticamente pelo formulário de contato do site.
    </p>
  </div>
  `;
}

export function welcomeNewsletterHtml(name?: string) {
  const n = name ? escapeHtml(name) : "Olá";
  return `
  <div style="font-family: Arial, sans-serif; max-width: 640px; margin:0 auto; padding: 16px;">
    <h2 style="margin:0 0 12px;">${n}! 🎉</h2>
    <p style="margin:0 0 12px;">Sua inscrição na Newsletter da Rede Kalunga Comunicações foi confirmada.</p>
    <p style="margin:0 0 12px;">Você vai receber histórias, projetos e novidades do Território Kalunga no seu email.</p>
    <p style="font-size:12px; color:#666;">Se você não se inscreveu, ignore esta mensagem.</p>
  </div>
  `;
}
