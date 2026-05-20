import { describe, it, expect } from 'vitest';
import { generateCode } from '../../utils/generateCode';

describe('generateCode', () => {
  it('returns a string', () => {
    expect(typeof generateCode()).toBe('string');
  });

  it('defaults to length 7', () => {
    expect(generateCode()).toHaveLength(7);
  });

  it('respects a custom length', () => {
    expect(generateCode(6)).toHaveLength(6);
    expect(generateCode(8)).toHaveLength(8);
  });

  it('contains only alphanumeric characters (a-z, A-Z, 0-9)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^[a-zA-Z0-9]+$/);
    }
  });

  it('includes uppercase characters in the output over many samples', () => {
    const joined = Array.from({ length: 500 }, () => generateCode()).join('');
    expect(/[A-Z]/.test(joined)).toBe(true);
  });

  it('generates different codes on consecutive calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
