import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../../../src/application/services/ModelRouter.js';
import { MODEL_TIERS } from '../../../src/shared/constants/index.js';

describe('ModelRouter', () => {
  const router = new ModelRouter();

  describe('resolve()', () => {
    it('defaults to standard when no model is given', () => {
      expect(router.resolve()).toBe(MODEL_TIERS.standard);
      expect(router.resolve(undefined)).toBe(MODEL_TIERS.standard);
    });

    it('maps "fast" tier to haiku model ID', () => {
      expect(router.resolve('fast')).toBe(MODEL_TIERS.fast);
    });

    it('maps "standard" tier to sonnet model ID', () => {
      expect(router.resolve('standard')).toBe(MODEL_TIERS.standard);
    });

    it('maps "powerful" tier to opus model ID', () => {
      expect(router.resolve('powerful')).toBe(MODEL_TIERS.powerful);
    });

    it('accepts exact model IDs', () => {
      expect(router.resolve('claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
      expect(router.resolve('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5-20251001');
      expect(router.resolve('claude-opus-4-6')).toBe('claude-opus-4-6');
    });

    it('falls back to standard for unknown values', () => {
      expect(router.resolve('gpt-4')).toBe(MODEL_TIERS.standard);
      expect(router.resolve('unknown-model')).toBe(MODEL_TIERS.standard);
      expect(router.resolve('')).toBe(MODEL_TIERS.standard);
    });
  });

  describe('isKnown()', () => {
    it('returns true for known model IDs', () => {
      expect(router.isKnown('claude-sonnet-4-6')).toBe(true);
      expect(router.isKnown('claude-haiku-4-5-20251001')).toBe(true);
    });

    it('returns false for unknown model IDs', () => {
      expect(router.isKnown('gpt-4')).toBe(false);
      expect(router.isKnown('fast')).toBe(false); // tier names are not model IDs
    });
  });
});
