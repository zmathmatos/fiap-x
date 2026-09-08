import { escapeHtml } from './escape';
import { renderLayout } from './layout';
import type { EmailContent } from '../../domain/ports/mailer';

export interface SuccessEmailInput {
  originalName: string;
  frameCount: number;
  appUrl: string;
  videoId: string;
}

export function renderSuccessEmail(input: SuccessEmailInput): EmailContent {
  const url = `${input.appUrl}/videos/${input.videoId}`;
  const frames = `${input.frameCount} ${input.frameCount === 1 ? 'frame' : 'frames'}`;

  return {
    subject: `"${input.originalName}" está pronto`,
    text: [
      `O vídeo "${input.originalName}" foi processado.`,
      '',
      `Extraímos ${frames} e o arquivo .zip já está disponível.`,
      '',
      `Baixe em: ${url}`,
    ].join('\n'),
    html: renderLayout({
      heading: 'Seu vídeo está pronto',
      intro: `Terminamos de processar <strong>${escapeHtml(input.originalName)}</strong>. O arquivo .zip com os frames já está disponível para download.`,
      detailLabel: 'Frames extraídos',
      detailValue: frames,
      ctaLabel: 'Baixar o zip',
      ctaUrl: url,
      accent: '#1f6f4a',
    }),
  };
}
