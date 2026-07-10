const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const VIN_WINDOW_LENGTH = 17;
const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9
};
const VIN_CHECK_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

const normalizeVinCandidate = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, '');

const digitCount = (candidate: string) => candidate.replace(/\D/g, '').length;

const isValidVinCandidate = (candidate: string) => VIN_PATTERN.test(candidate);

const getVinCharacterValue = (character: string) => {
  if (/\d/.test(character)) {
    return Number(character);
  }

  return VIN_TRANSLITERATION[character];
};

const hasValidCheckDigit = (candidate: string) => {
  if (!isValidVinCandidate(candidate)) {
    return false;
  }

  const sum = candidate
    .split('')
    .reduce((total, character, index) => total + getVinCharacterValue(character) * VIN_CHECK_WEIGHTS[index], 0);
  const remainder = sum % 11;
  const expectedCheckDigit = remainder === 10 ? 'X' : String(remainder);

  return candidate[8] === expectedCheckDigit;
};

const collectLineWindows = (line: string) => {
  const compactText = normalizeVinCandidate(line);
  const candidates: string[] = [];

  for (let index = 0; index <= compactText.length - VIN_WINDOW_LENGTH; index += 1) {
    candidates.push(compactText.slice(index, index + VIN_WINDOW_LENGTH));
  }

  return candidates;
};

export const isValidVin = (vin: string) => isValidVinCandidate(vin.trim().toUpperCase());

export const extractVinFromText = (text: string): string | null => {
  const candidates = text
    .split(/\r?\n/)
    .flatMap(collectLineWindows)
    .filter(isValidVinCandidate);

  if (!candidates.length) {
    return null;
  }

  return candidates.sort((left, right) => {
    const checkDigitDifference = Number(hasValidCheckDigit(right)) - Number(hasValidCheckDigit(left));

    if (checkDigitDifference !== 0) {
      return checkDigitDifference;
    }

    return digitCount(right) - digitCount(left);
  })[0];
};
