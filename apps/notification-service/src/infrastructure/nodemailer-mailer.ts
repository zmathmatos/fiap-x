import nodemailer, { type Transporter } from 'nodemailer';
import type { Logger } from '@fiapx/shared';
import type { Mailer, OutgoingMail } from '../domain/ports/mailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

export class NodemailerMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(
    private readonly config: SmtpConfig,
    private readonly logger: Logger,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      // MailHog accepts anonymous connections; a real SMTP server will not.
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
    });
  }

  async send(mail: OutgoingMail): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    this.logger.debug({ to: mail.to, subject: mail.subject }, 'mail delivered to smtp');
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
