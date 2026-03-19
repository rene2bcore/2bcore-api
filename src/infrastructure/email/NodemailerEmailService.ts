import nodemailer, { type Transporter } from 'nodemailer';
import type { IEmailService, EmailOptions } from '../../domain/services/IEmailService.js';
import { logger } from '../observability/logger.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string | undefined;
  pass?: string | undefined;
  from: string;
}

export class NodemailerEmailService implements IEmailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth:
        config.user && config.pass
          ? { user: config.user, pass: config.pass }
          : undefined,
    });
  }

  async send(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      logger.info({ to: options.to, subject: options.subject }, '[Email:SMTP] Email sent');
    } catch (err) {
      logger.error({ err, to: options.to, subject: options.subject }, '[Email:SMTP] Failed to send email');
      throw err;
    }
  }
}
