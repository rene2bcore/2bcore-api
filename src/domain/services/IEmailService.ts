export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface IEmailService {
  send(options: EmailOptions): Promise<void>;
}
