const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const VIN_WINDOW_LENGTH = 17;

const normalizeVinCandidate = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, '');

const digitCount = (candidate: string) => candidate.replace(/\D/g, '').length;

const isValidVinCandidate = (candidate: string) => VIN_PATTERN.test(candidate);

const collectCompactWindows = (text: string) => {
  const compactText = normalizeVinCandidate(text);
  const candidates: string[] = [];

  for (let index = 0; index <= compactText.length - VIN_WINDOW_LENGTH; index += 1) {
    candidates.push(compactText.slice(index, index + VIN_WINDOW_LENGTH));
  }

  return candidates;
};

export const isValidVin = (vin: string) => isValidVinCandidate(vin.trim().toUpperCase());

export const extractVinFromText = (text: string): string | null => {
  const candidates = collectCompactWindows(text).filter(isValidVinCandidate);

  if (!candidates.length) {
    return null;
  }

  return candidates.sort((left, right) => digitCount(right) - digitCount(left))[0];
};
