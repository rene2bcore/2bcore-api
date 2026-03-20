import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';
import { cleanupIntegrationData } from './helpers/db.helper.js';
import { CaptureEmailService } from './helpers/email.helper.js';

describe('Email verification and password reset routes', () => {
  let app: TestApp;
  let emailService: CaptureEmailService;

  const testEmail = `inttest+emailverify@2bcore.test`;
  const testPassword = 'Integration@Pass1!';

  async function register(email: string, password = testPassword) {
    return app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: { email, password },
    });
  }

  async function login(email: string, password = testPassword) {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    return res.json().accessToken as string;
  }

  beforeAll(async () => {
    emailService = new CaptureEmailService();
    app = await createTestApp({ emailService });
  });

  afterAll(async () => {
    await closeTestApp(app);
    await cleanupIntegrationData();
  });

  // ── POST /v1/users — registration sends verification email ────────

  describe('Registration', () => {
    it('sends a verification email after successful registration', async () => {
      emailService.clear();
      const res = await register(testEmail);
      expect(res.statusCode).toBe(201);
      // Fire-and-forget — allow async to settle
      await new Promise((r) => setTimeout(r, 100));
      const sent = emailService.sent.find((e) => e.to === testEmail);
      expect(sent).toBeDefined();
      expect(sent?.subject).toContain('Verify');
    });

    it('returns emailVerified: false in registration response', async () => {
      const uniqueEmail = `inttest+emailverify2@2bcore.test`;
      emailService.clear();
      const res = await register(uniqueEmail);
      expect(res.statusCode).toBe(201);
      expect(res.json().emailVerified).toBe(false);
    });
  });

  // ── POST /v1/auth/verify-email ────────────────────────────────────

  describe('POST /v1/auth/verify-email', () => {
    it('returns 204 on valid token', async () => {
      // Register fresh user to get a verification token
      const email = `inttest+verify1@2bcore.test`;
      emailService.clear();
      await register(email);
      await new Promise((r) => setTimeout(r, 100));
      const token = emailService.getLastVerificationToken();
      expect(token).toBeTruthy();

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/verify-email',
        payload: { token },
      });
      expect(res.statusCode).toBe(204);
    });

    it('returns 400 AUTH_008 on invalid token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/verify-email',
        payload: { token: 'a'.repeat(64) },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('AUTH_008');
    });

    it('returns 400 AUTH_008 on already-used token', async () => {
      const email = `inttest+verify2@2bcore.test`;
      emailService.clear();
      await register(email);
      await new Promise((r) => setTimeout(r, 100));
      const token = emailService.getLastVerificationToken();

      // Use it once
      await app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { token } });
      // Use it again
      const res = await app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { token } });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('AUTH_008');
    });

    it('returns 422 VAL_001 when token is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/verify-email',
        payload: {},
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('user profile shows emailVerified: true after verification', async () => {
      const email = `inttest+verify3@2bcore.test`;
      emailService.clear();
      await register(email);
      await new Promise((r) => setTimeout(r, 100));
      const token = emailService.getLastVerificationToken();
      await app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { token } });

      const accessToken = await login(email);
      const profileRes = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(profileRes.json().emailVerified).toBe(true);
    });
  });

  // ── POST /v1/auth/resend-verification ─────────────────────────────

  describe('POST /v1/auth/resend-verification', () => {
    it('returns 204 and sends a new email for unverified user', async () => {
      emailService.clear();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/resend-verification',
        payload: { email: testEmail },
      });
      expect(res.statusCode).toBe(204);
      await new Promise((r) => setTimeout(r, 100));
      expect(emailService.sent.length).toBeGreaterThan(0);
    });

    it('returns 204 silently for unknown email (prevents enumeration)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/resend-verification',
        payload: { email: 'unknown@example.com' },
      });
      expect(res.statusCode).toBe(204);
    });

    it('returns 422 VAL_001 for invalid email format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/resend-verification',
        payload: { email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });
  });

  // ── POST /v1/auth/forgot-password ─────────────────────────────────

  describe('POST /v1/auth/forgot-password', () => {
    it('returns 204 and sends reset email for existing user', async () => {
      emailService.clear();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password',
        payload: { email: testEmail },
      });
      expect(res.statusCode).toBe(204);
      expect(emailService.sent.some((e) => e.subject.includes('Reset'))).toBe(true);
    });

    it('returns 204 silently for unknown email (prevents enumeration)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password',
        payload: { email: 'nosuchuser@example.com' },
      });
      expect(res.statusCode).toBe(204);
    });

    it('returns 422 VAL_001 for invalid email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password',
        payload: { email: 'bad' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });
  });

  // ── POST /v1/auth/reset-password ──────────────────────────────────

  describe('POST /v1/auth/reset-password', () => {
    it('resets password with valid token and allows login with new password', async () => {
      const email = `inttest+reset1@2bcore.test`;
      await register(email);

      emailService.clear();
      await app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email } });
      const resetToken = emailService.getLastResetToken();
      expect(resetToken).toBeTruthy();

      const newPassword = 'NewPass1!';
      const resetRes = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        payload: { token: resetToken, password: newPassword },
      });
      expect(resetRes.statusCode).toBe(204);

      // Can now login with new password
      const loginRes = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password: newPassword },
      });
      expect(loginRes.statusCode).toBe(200);
    });

    it('returns 400 AUTH_008 on invalid reset token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        payload: { token: 'b'.repeat(64), password: 'NewPass1!' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('AUTH_008');
    });

    it('returns 400 AUTH_008 when token is used twice', async () => {
      const email = `inttest+reset2@2bcore.test`;
      await register(email);

      emailService.clear();
      await app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email } });
      const resetToken = emailService.getLastResetToken();

      await app.inject({ method: 'POST', url: '/v1/auth/reset-password', payload: { token: resetToken, password: 'NewPass1!' } });
      const res = await app.inject({ method: 'POST', url: '/v1/auth/reset-password', payload: { token: resetToken, password: 'NewPass2!' } });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('AUTH_008');
    });

    it('returns 422 VAL_001 when password does not meet complexity requirements', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        payload: { token: 'c'.repeat(64), password: 'weakpassword' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('old password no longer works after reset', async () => {
      const email = `inttest+reset3@2bcore.test`;
      await register(email);

      emailService.clear();
      await app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email } });
      const resetToken = emailService.getLastResetToken();

      await app.inject({ method: 'POST', url: '/v1/auth/reset-password', payload: { token: resetToken, password: 'NewPass1!' } });

      // Old password should no longer work
      const loginRes = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password: testPassword },
      });
      expect(loginRes.statusCode).toBe(401);
    });
  });
});
