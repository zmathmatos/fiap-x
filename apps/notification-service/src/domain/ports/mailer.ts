/** Everything about an e-mail except who receives it. */
export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export type OutgoingMail = EmailContent & { to: string };

export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
}
