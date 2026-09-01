export interface EmailBlock {
  heading: string;
  intro: string;
  detailLabel: string;
  detailValue: string;
  ctaLabel: string;
  ctaUrl: string;
  accent: string;
}

/**
 * One table-based shell for every message.
 *
 * Inline styles and a table layout are not a stylistic choice — Outlook and
 * Gmail strip <style> blocks and ignore flexbox.
 */
export function renderLayout(block: EmailBlock): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b19;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e2df;border-radius:10px;">
      <tr>
        <td style="padding:24px 28px 8px;">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6f6d68;">FIAP X</p>
          <h1 style="margin:0;font-size:20px;line-height:1.3;color:${block.accent};">${block.heading}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 0;font-size:15px;line-height:1.6;color:#3d3b37;">
          <p style="margin:0 0 16px;">${block.intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;border:1px solid #eceae6;border-radius:6px;">
            <tr>
              <td style="padding:12px 16px;">
                <p style="margin:0 0 2px;font-size:12px;color:#6f6d68;">${block.detailLabel}</p>
                <p style="margin:0;font-size:14px;color:#1c1b19;">${block.detailValue}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 28px;">
          <a href="${block.ctaUrl}" style="display:inline-block;padding:10px 18px;background:${block.accent};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;">${block.ctaLabel}</a>
        </td>
      </tr>
    </table>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#8a8880;text-align:center;">Você recebeu este e-mail porque enviou um vídeo para processamento na FIAP X.</p>
  </body>
</html>`;
}
