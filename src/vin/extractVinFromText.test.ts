import { describe, expect, it } from 'vitest';
import { extractVinFromText, isValidVin } from './extractVinFromText';

describe('extractVinFromText', () => {
  it('extracts a valid VIN from plain OCR text', () => {
    expect(extractVinFromText('VIN: 1HGCM82633A123456')).toBe('1HGCM82633A123456');
  });

  it('extracts a VIN split by spaces on one OCR line', () => {
    expect(extractVinFromText('1 H G C M 8 2 6 3 3 A 1 2 3 4 5 6')).toBe('1HGCM82633A123456');
  });

  it('extracts a valid VIN from one line when OCR returns multiple lines', () => {
    expect(extractVinFromText('document id 1234\nVIN: 1HGCM82633A123456\nplate ABC123')).toBe('1HGCM82633A123456');
  });

  it('does not merge partial candidates across OCR lines', () => {
    expect(extractVinFromText('1HGCM826\n33A123456')).toBeNull();
  });

  it('extracts the standalone document VIN without merging nearby vehicle fields', () => {
    const ocrText = [
      'A FZ 0332S',
      'D.1 BMW',
      'D.2 G4C',
      '-71AV',
      '-IAW507B0',
      'D.3 430I XDRIVE',
      'E WBA71AV030FM69796',
      'B 29.03.2022 04.04.2022',
      'SERIA DR/BAS 1182228'
    ].join('\n');

    expect(extractVinFromText(ocrText)).toBe('WBA71AV030FM69796');
  });

  it('prefers a standalone VIN token over a window that includes the E field label', () => {
    expect(extractVinFromText('E WBA71AV030FM69796')).toBe('WBA71AV030FM69796');
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
