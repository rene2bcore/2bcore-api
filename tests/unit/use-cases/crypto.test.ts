import { describe, it, expect } from 'vitest';
import { sha256, randomHex, generateApiKey, safeCompare } from '../../../src/shared/utils/crypto.js';

describe('sha256', () => {
  it('produces a 64-char hex string', () => {
    expect(sha256('hello')).toHaveLength(64);
    expect(sha256('hello')).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
  });

  it('different inputs produce different outputs', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

describe('randomHex', () => {
  it('returns expected byte length * 2 chars', () => {
    expect(randomHex(32)).toHaveLength(64);
    expect(randomHex(16)).toHaveLength(32);
  });

  it('generates unique values', () => {
    expect(randomHex()).not.toBe(randomHex());
  });
});

describe('generateApiKey', () => {
  it('raw key starts with prefix', () => {
    const { raw } = generateApiKey('sk-live-');
    expect(raw.startsWith('sk-live-')).toBe(true);
  });

  it('hashed key is SHA-256 of raw key', () => {
    const { raw, hashed } = generateApiKey('sk-test-');
    expect(hashed).toBe(sha256(raw));
  });

  it('raw key is never returned in hashed', () => {
    const { raw, hashed } = generateApiKey('sk-live-');
    expect(hashed).not.toBe(raw);
    expect(hashed).not.toContain('sk-live-');
  });
});

describe('safeCompare', () => {
  it('returns true for equal strings', () => {
    expect(safeCompare('abc', 'abc')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(safeCompare('abc', 'abd')).toBe(false);
  });

  it('returns false for strings of different length', () => {
    expect(safeCompare('abc', 'abcd')).toBe(false);
  });
});
