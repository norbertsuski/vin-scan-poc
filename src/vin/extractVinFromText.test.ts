import { describe, expect, it } from 'vitest';
import { extractVinFromText, isValidVin } from './extractVinFromText';

describe('extractVinFromText', () => {
  it('extracts a valid VIN from plain OCR text', () => {
    expect(extractVinFromText('VIN: 1HGCM82633A123456')).toBe('1HGCM82633A123456');
  });

  it('extracts a VIN split by spaces and newlines', () => {
    expect(extractVinFromText('1 H G C M 8 2 6 3 3 A 1 2 3 4 5 6')).toBe('1HGCM82633A123456');
  });

  it('extracts a valid VIN from one line when OCR returns multiple lines', () => {
    expect(extractVinFromText('document id 1234\nVIN: 1HGCM82633A123456\nplate ABC123')).toBe('1HGCM82633A123456');
  });

  it('can recover a VIN split across OCR lines', () => {
    expect(extractVinFromText('1HGCM826\n33A123456')).toBe('1HGCM82633A123456');
  });

  it('returns null when no valid VIN exists', () => {
    expect(extractVinFromText('registration number ABC123')).toBeNull();
  });

  it('rejects VIN candidates containing I, O, or Q', () => {
    expect(extractVinFromText('1HGCM82633A12345O')).toBeNull();
  });
});

describe('isValidVin', () => {
  it('validates allowed 17-character VINs', () => {
    expect(isValidVin('1HGCM82633A123456')).toBe(true);
    expect(isValidVin('1HGCM82633A12345O')).toBe(false);
  });
});
