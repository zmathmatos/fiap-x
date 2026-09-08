import { escapeHtml } from './escape';
import { renderLayout } from './layout';
import type { EmailContent } from '../../domain/ports/mailer';

export interface FailureEmailInput {
  originalName: string;
  reason: string;
  appUrl: string;
  videoId: string;
}

export function renderFailureEmail(input: FailureEmailInput): EmailContent {
  const url = `${input.appUrl}/videos/${input.videoId}`;

  return {
    subject: `Falha ao processar "${input.originalName}"`,
    text: [
      `Não conseguimos processar o vídeo "${input.originalName}".`,
      '',
      `Motivo: ${input.reason}`,
      '',
      `Você pode reenviar o arquivo ou ver os detalhes em: ${url}`,
    ].join('\n'),
    html: renderLayout({
      heading: 'Não conseguimos processar seu vídeo',
      intro: `O arquivo <strong>${escapeHtml(input.originalName)}</strong> não pôde ser processado. Você pode reenviá-lo a qualquer momento.`,
      detailLabel: 'Motivo',
      detailValue: escapeHtml(input.reason),
      ctaLabel: 'Ver detalhes',
      ctaUrl: url,
      accent: '#a3352b',
    }),
  };
}
