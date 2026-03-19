import type { IEmailService, EmailOptions } from '../../domain/services/IEmailService.js';
import { logger } from '../observability/logger.js';

/**
 * Development email service — logs emails to console instead of sending them.
 * Used when SMTP_HOST is not configured or NODE_ENV !== 'production'.
 */
export class ConsoleEmailService implements IEmailService {
  async send(options: EmailOptions): Promise<void> {
    logger.info(
      {
        to: options.to,
        subject: options.subject,
        text: options.text,
      },
      '[Email:Console] Would send email (set SMTP_HOST to use real SMTP)',
    );
  }
}
