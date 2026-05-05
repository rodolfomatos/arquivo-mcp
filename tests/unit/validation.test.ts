import { describe, it, expect } from 'vitest';
import { isValidDateRange } from 'src/utils/validation';

describe('isValidDateRange', () => {
  it('should accept empty string', () => {
    expect(isValidDateRange('')).toBe(true);
    expect(isValidDateRange(undefined)).toBe(true);
  });

  it('should accept YYYY', () => {
    expect(isValidDateRange('2024')).toBe(true);
    expect(isValidDateRange('1996')).toBe(true);
  });

  it('should accept YYYYMMDDHHMMSS', () => {
    expect(isValidDateRange('20240101120000')).toBe(true);
    expect(isValidDateRange('19960101000000')).toBe(true);
  });

  it('should accept partial dates (4-14 digits)', () => {
    expect(isValidDateRange('2024')).toBe(true); // YYYY
    expect(isValidDateRange('202401')).toBe(true); // YYYYMM
    expect(isValidDateRange('20240101')).toBe(true); // YYYYMMDD
    expect(isValidDateRange('202401011200')).toBe(true); // YYYYMMDDHHMM
    expect(isValidDateRange('20240101120000')).toBe(true); // YYYYMMDDHHMMSS (14)
  });

  it('should reject too short (<4 digits) or too long (>14 digits)', () => {
    expect(isValidDateRange('202')).toBe(false); // 3 digits
    expect(isValidDateRange('202401011200000')).toBe(false); // 15 digits
    expect(isValidDateRange('abc')).toBe(false); // non-digits
  });

  it('should reject non-numeric strings', () => {
    expect(isValidDateRange('abcd')).toBe(false);
    expect(isValidDateRange('2024-01-01')).toBe(false);
  });
});
