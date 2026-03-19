import type { IEmailService, EmailOptions } from '../../../src/domain/services/IEmailService.js';

/**
 * Email service that captures sent emails in-memory for test assertions.
 * Inject via createTestApp({ emailService: captureEmailService }).
 */
export class CaptureEmailService implements IEmailService {
  readonly sent: EmailOptions[] = [];

  async send(options: EmailOptions): Promise<void> {
    this.sent.push(options);
  }

  /** Extract the verification token from the most recently sent verification email. */
  getLastVerificationToken(): string | null {
    const last = [...this.sent].reverse().find((e) => e.subject.includes('Verify'));
    if (!last) return null;
    const match = last.text.match(/token=([a-f0-9]{64})/);
    return match ? match[1] : null;
  }

  /** Extract the reset token from the most recently sent reset email. */
  getLastResetToken(): string | null {
    const last = [...this.sent].reverse().find((e) => e.subject.includes('Reset'));
    if (!last) return null;
    const match = last.text.match(/token=([a-f0-9]{64})/);
    return match ? match[1] : null;
  }

  clear(): void {
    this.sent.length = 0;
  }
}
