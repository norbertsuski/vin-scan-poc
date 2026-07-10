# VIN Scanner Standalone PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone mobile-first React PoC that lets a user take or select a VIN photo, review it with a crop guide, run client-side OCR, extract a valid VIN, and optionally fetch vehicle details from a decoder endpoint.

**Architecture:** Keep OCR, VIN extraction, image preprocessing, decoder API access, and UI orchestration in separate modules. The UI is intentionally simple: a vehicle information form with a VIN field, a Scan VIN action, a review sheet/modal, OCR status, detected VIN confirmation, and decoded detail autofill that only fills empty fields. The app should work over HTTPS on real mobile devices because camera capture/file input behavior depends on secure context.

**Tech Stack:** React 18, TypeScript, Vite, Tesseract.js, Vitest, React Testing Library, CSS modules or plain CSS, optional MSW for decoder API mocks.

---

## Product Behavior

- User sees a vehicle information form with a VIN input.
- User can manually type a VIN and run decoder.
- User can tap `Scan VIN`.
- Browser opens native image picker or camera prompt via `<input type="file" accept="image/*" capture="environment">`.
- After a photo is selected, user sees a review modal with the photo and a dashed crop guide.
- User taps `Scan photo`.
- App crops the likely VIN band, applies grayscale and contrast, runs Tesseract.js OCR, extracts the best 17-character VIN candidate, and shows it.
- User taps `Use this VIN`.
- App writes the VIN into the VIN field and runs decoder.
- Decoder fills empty vehicle fields only. It must not overwrite user-entered values.
- If OCR finds no VIN, show retry/manual-entry copy.
- If decoder fails, keep the VIN and show a recoverable error.

## Known PoC Constraints

- iOS Safari treats `capture="environment"` as a hint. It usually shows a native action sheet (`Take Photo`, `Photo Library`, `Browse`) instead of opening the camera directly.
- Desktop Chrome device emulation opens a file picker, not a real camera.
- OCR accuracy depends heavily on photo quality, crop alignment, lighting, and document layout.
- Tesseract.js is good enough for a PoC, not a production-grade automotive document scanner.
- A live camera viewfinder is out of scope for this plan. Use native file input capture first.

## Proposed File Structure

```text
src/
  app/
    App.tsx
    App.test.tsx
  features/vin-scanner/
    components/
      VinScannerButton.tsx
      VinReviewDialog.tsx
      VinReviewPreview.tsx
      VehicleInformationForm.tsx
    hooks/
      useVinOcr.ts
      useVehicleDecoder.ts
    services/
      vehicleDecoderApi.ts
    utils/
      cropImageForOcr.ts
      cropImageForOcr.test.ts
      extractVinFromText.ts
      extractVinFromText.test.ts
      shouldFillDecodedField.ts
      shouldFillDecodedField.test.ts
    types.ts
  test/
    fileMocks.ts
```

## Interfaces

Use these shared types before implementing UI:

```ts
export type CropRegion = {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
};

export type OcrErrorCode = 'no_vin_found' | 'ocr_failed';

export type VehicleFormValues = {
  vin: string;
  make: string;
  model: string;
  year: string;
  fuel: string;
  engineSize: string;
};

export type VehicleDecoderResult = {
  categoryId?: number | string;
  make?: string;
  model?: string;
  year?: string | number;
  fuel?: string;
  engineSize?: string | number;
};

export type DecoderStatus = 'initial' | 'loading' | 'success' | 'error';
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/app/App.tsx`
- Create: `src/main.tsx`

- [ ] **Step 1: Initialize the app**

Run:

```bash
npm create vite@latest vin-scanner-poc -- --template react-ts
cd vin-scanner-poc
npm install
npm install tesseract.js
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Configure Vitest**

Add this to `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setupTests.ts']
  }
});
```

- [ ] **Step 3: Add test setup**

Create `src/test/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Run the empty test suite**

Run:

```bash
npm test -- --run
```

Expected: Vitest starts successfully. It may report no tests until the next tasks are added.

---

## Task 2: VIN Extraction Utility

**Files:**
- Create: `src/features/vin-scanner/utils/extractVinFromText.ts`
- Create: `src/features/vin-scanner/utils/extractVinFromText.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { extractVinFromText } from './extractVinFromText';

describe('extractVinFromText', () => {
  it('extracts a valid VIN from plain OCR text', () => {
    expect(extractVinFromText('VIN: 1HGCM82633A123456')).toBe('1HGCM82633A123456');
  });

  it('extracts a VIN split by spaces and newlines', () => {
    expect(extractVinFromText('1 H G C M 8 2 6 3 3 A 1 2 3 4 5 6')).toBe('1HGCM82633A123456');
  });

  it('returns null when no valid VIN exists', () => {
    expect(extractVinFromText('registration number ABC123')).toBeNull();
  });

  it('rejects VIN candidates containing I, O, or Q', () => {
    expect(extractVinFromText('1HGCM82633A12345O')).toBeNull();
  });
});
```

- [ ] **Step 2: Implement VIN extraction**

```ts
const VIN_CANDIDATE_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const VIN_MATCH_PATTERN = /[A-HJ-NPR-Z0-9]{17}/g;
const SPACED_VIN_PATTERN = /(?:[A-HJ-NPR-Z0-9]\s*){17}/g;

const normalizeOcrText = (text: string): string =>
  text.toUpperCase().replace(/[^A-Z0-9]/g, '');

const getVinDigitCount = (candidate: string): number =>
  candidate.replace(/[^0-9]/g, '').length;

const pickBestVinCandidate = (candidates: string[]): string | null => {
  const validCandidates = candidates.filter(candidate => VIN_CANDIDATE_PATTERN.test(candidate));

  if (!validCandidates.length) {
    return null;
  }

  return validCandidates.sort((left, right) => getVinDigitCount(right) - getVinDigitCount(left))[0];
};

const getCompactVinCandidates = (text: string): string[] => {
  const compactText = normalizeOcrText(text);
  const candidates: string[] = [];

  for (let index = 0; index <= compactText.length - 17; index += 1) {
    candidates.push(compactText.slice(index, index + 17));
  }

  return candidates;
};

export const extractVinFromText = (text: string): string | null => {
  const normalizedText = text.toUpperCase();
  const spacedMatches = normalizedText.match(SPACED_VIN_PATTERN) ?? [];
  const directMatches = normalizedText.match(VIN_MATCH_PATTERN) ?? [];
  const candidates = [
    ...spacedMatches.map(match => match.replace(/\s/g, '')),
    ...directMatches,
    ...getCompactVinCandidates(text)
  ];

  return pickBestVinCandidate(candidates);
};
```

- [ ] **Step 3: Verify**

Run:

```bash
npm test -- --run extractVinFromText
```

Expected: all extraction tests pass.

---

## Task 3: Image Crop And Preprocessing

**Files:**
- Create: `src/features/vin-scanner/utils/cropImageForOcr.ts`
- Create: `src/features/vin-scanner/utils/cropImageForOcr.test.ts`

- [ ] **Step 1: Implement crop utility**

```ts
export type CropRegion = {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
};

export const DEFAULT_VIN_CROP_REGION: CropRegion = {
  xRatio: 0.05,
  yRatio: 0.35,
  widthRatio: 0.9,
  heightRatio: 0.2
};

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for OCR'));
    };

    image.src = objectUrl;
  });

const applyGrayscaleContrast = (context: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const grayscale = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const contrast = Math.min(255, Math.max(0, (grayscale - 128) * 1.4 + 128));

    data[index] = contrast;
    data[index + 1] = contrast;
    data[index + 2] = contrast;
  }

  context.putImageData(imageData, 0, 0);
};

export const cropImageForOcr = async (
  file: File,
  cropRegion: CropRegion = DEFAULT_VIN_CROP_REGION
): Promise<Blob> => {
  const image = await loadImageFromFile(file);
  const sourceX = Math.round(image.width * cropRegion.xRatio);
  const sourceY = Math.round(image.height * cropRegion.yRatio);
  const sourceWidth = Math.round(image.width * cropRegion.widthRatio);
  const sourceHeight = Math.round(image.height * cropRegion.heightRatio);

  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas context is not available');
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  applyGrayscaleContrast(context, sourceWidth, sourceHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Failed to create cropped image blob'));
        return;
      }

      resolve(blob);
    }, 'image/png');
  });
};
```

- [ ] **Step 2: Add focused tests**

Use a mocked canvas/image environment rather than real browser rendering. Test these behaviors:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_VIN_CROP_REGION } from './cropImageForOcr';

describe('DEFAULT_VIN_CROP_REGION', () => {
  it('targets a centered horizontal VIN band', () => {
    expect(DEFAULT_VIN_CROP_REGION).toEqual({
      xRatio: 0.05,
      yRatio: 0.35,
      widthRatio: 0.9,
      heightRatio: 0.2
    });
  });
});
```

- [ ] **Step 3: Verify**

Run:

```bash
npm test -- --run cropImageForOcr
```

Expected: crop region test passes.

---

## Task 4: OCR Hook

**Files:**
- Create: `src/features/vin-scanner/hooks/useVinOcr.ts`
- Create: `src/features/vin-scanner/hooks/useVinOcr.test.tsx`

- [ ] **Step 1: Implement OCR hook**

```ts
import { useCallback, useState } from 'react';
import { cropImageForOcr } from '../utils/cropImageForOcr';
import { extractVinFromText } from '../utils/extractVinFromText';

type OcrErrorCode = 'no_vin_found' | 'ocr_failed';

type UseVinOcrResult = {
  isProcessing: boolean;
  errorMessage: OcrErrorCode | null;
  vinCandidate: string | null;
  recognizeVinFromImage: (file: File) => Promise<string | null>;
  resetVinOcr: () => void;
};

export const useVinOcr = (): UseVinOcrResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<OcrErrorCode | null>(null);
  const [vinCandidate, setVinCandidate] = useState<string | null>(null);

  const resetVinOcr = useCallback(() => {
    setIsProcessing(false);
    setErrorMessage(null);
    setVinCandidate(null);
  }, []);

  const recognizeVinFromImage = useCallback(async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setVinCandidate(null);

    try {
      const croppedImage = await cropImageForOcr(file);
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data } = await worker.recognize(croppedImage);
      await worker.terminate();

      const extractedVin = extractVinFromText(data.text);

      if (!extractedVin) {
        setErrorMessage('no_vin_found');
        return null;
      }

      setVinCandidate(extractedVin);
      return extractedVin;
    } catch {
      setErrorMessage('ocr_failed');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    isProcessing,
    errorMessage,
    vinCandidate,
    recognizeVinFromImage,
    resetVinOcr
  };
};
```

- [ ] **Step 2: Add tests**

Mock `tesseract.js`, `cropImageForOcr`, and verify:

```ts
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVinOcr } from './useVinOcr';

vi.mock('../utils/cropImageForOcr', () => ({
  cropImageForOcr: vi.fn(async () => new Blob(['image'], { type: 'image/png' }))
}));

const recognize = vi.fn(async () => ({ data: { text: 'VIN 1HGCM82633A123456' } }));
const terminate = vi.fn(async () => undefined);

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({ recognize, terminate }))
}));

describe('useVinOcr', () => {
  it('detects VIN from OCR text', async () => {
    const { result } = renderHook(() => useVinOcr());
    const file = new File(['content'], 'vin.png', { type: 'image/png' });

    await act(async () => {
      await result.current.recognizeVinFromImage(file);
    });

    expect(result.current.vinCandidate).toBe('1HGCM82633A123456');
    expect(result.current.errorMessage).toBeNull();
  });
});
```

- [ ] **Step 3: Verify**

Run:

```bash
npm test -- --run useVinOcr
```

Expected: OCR hook tests pass.

---

## Task 5: Review UI

**Files:**
- Create: `src/features/vin-scanner/components/VinReviewPreview.tsx`
- Create: `src/features/vin-scanner/components/VinReviewDialog.tsx`
- Create: `src/features/vin-scanner/components/VinScannerButton.tsx`

- [ ] **Step 1: Implement `VinReviewPreview`**

```tsx
import { DEFAULT_VIN_CROP_REGION } from '../utils/cropImageForOcr';

type VinReviewPreviewProps = {
  imageUrl: string;
};

export const VinReviewPreview = ({ imageUrl }: VinReviewPreviewProps) => (
  <div className="vin-review-preview" data-testid="vin-review-preview">
    <img className="vin-review-preview__image" alt="" src={imageUrl} />
    <div
      className="vin-review-preview__crop-guide"
      style={{
        left: `${DEFAULT_VIN_CROP_REGION.xRatio * 100}%`,
        top: `${DEFAULT_VIN_CROP_REGION.yRatio * 100}%`,
        width: `${DEFAULT_VIN_CROP_REGION.widthRatio * 100}%`,
        height: `${DEFAULT_VIN_CROP_REGION.heightRatio * 100}%`
      }}
      data-testid="vin-crop-guide"
    />
  </div>
);
```

- [ ] **Step 2: Implement `VinReviewDialog`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { VinReviewPreview } from './VinReviewPreview';

type VinReviewDialogProps = {
  isOpen: boolean;
  imageFile: File | null;
  isProcessing: boolean;
  errorMessage: string | null;
  vinCandidate: string | null;
  onClose: () => void;
  onConfirm: (vin: string) => void;
  onRetry: () => void;
};

export const VinReviewDialog = ({
  isOpen,
  imageFile,
  isProcessing,
  errorMessage,
  vinCandidate,
  onClose,
  onConfirm,
  onRetry
}: VinReviewDialogProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!imageFile) {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
      setImageUrl(null);
      return undefined;
    }

    const nextImageUrl = URL.createObjectURL(imageFile);
    imageUrlRef.current = nextImageUrl;
    setImageUrl(nextImageUrl);

    return () => {
      URL.revokeObjectURL(nextImageUrl);
      imageUrlRef.current = null;
    };
  }, [imageFile]);

  if (!isOpen) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="vin-review-title" className="vin-review-dialog">
      <h2 id="vin-review-title">Review VIN photo</h2>
      <p>Align the VIN inside the highlighted area, then scan the photo.</p>
      {imageUrl ? <VinReviewPreview imageUrl={imageUrl} /> : null}
      {isProcessing ? <p data-testid="vin-ocr-loader">Scanning photo...</p> : null}
      {errorMessage ? <p data-testid="vin-error-message">{getErrorCopy(errorMessage)}</p> : null}
      {vinCandidate ? <p data-testid="vin-candidate">Detected VIN: {vinCandidate}</p> : null}
      {vinCandidate ? (
        <button type="button" onClick={() => onConfirm(vinCandidate)} data-testid="vin-confirm-button">
          Use this VIN
        </button>
      ) : (
        <button type="button" onClick={onRetry} disabled={isProcessing || !imageFile} data-testid="vin-scan-photo-button">
          Scan photo
        </button>
      )}
      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
};

const getErrorCopy = (errorMessage: string) => {
  if (errorMessage === 'no_vin_found') {
    return 'We could not find a valid VIN in this photo. Try again with better lighting or enter it manually.';
  }

  return 'We could not read the photo. Try again or enter your VIN manually.';
};
```

- [ ] **Step 3: Implement `VinScannerButton`**

```tsx
import { useRef, useState } from 'react';
import { useVinOcr } from '../hooks/useVinOcr';
import { VinReviewDialog } from './VinReviewDialog';

type VinScannerButtonProps = {
  onVinConfirmed: (vin: string) => void;
};

export const VinScannerButton = ({ onVinConfirmed }: VinScannerButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const { isProcessing, errorMessage, vinCandidate, recognizeVinFromImage, resetVinOcr } = useVinOcr();

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    resetVinOcr();
    setSelectedFile(file);
    setIsReviewOpen(true);
    event.target.value = '';
  };

  const handleCloseReview = () => {
    setIsReviewOpen(false);
    setSelectedFile(null);
    resetVinOcr();
  };

  const handleScanPhoto = async () => {
    if (!selectedFile) {
      return;
    }

    await recognizeVinFromImage(selectedFile);
  };

  const handleConfirmVin = (vin: string) => {
    onVinConfirmed(vin);
    handleCloseReview();
  };

  return (
    <>
      <button type="button" onClick={handleOpenFilePicker} data-testid="vin-scan-button">
        Scan VIN
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleFileSelected}
        aria-label="Select VIN photo"
        data-testid="vin-file-input"
      />
      <VinReviewDialog
        isOpen={isReviewOpen}
        imageFile={selectedFile}
        isProcessing={isProcessing}
        errorMessage={errorMessage}
        vinCandidate={vinCandidate}
        onClose={handleCloseReview}
        onConfirm={handleConfirmVin}
        onRetry={handleScanPhoto}
      />
    </>
  );
};
```

---

## Task 6: Vehicle Decoder API

**Files:**
- Create: `src/features/vin-scanner/services/vehicleDecoderApi.ts`
- Create: `src/features/vin-scanner/hooks/useVehicleDecoder.ts`
- Create: `.env.example`

- [ ] **Step 1: Add environment contract**

Create `.env.example`:

```bash
VITE_VEHICLE_DECODER_BASE_URL=https://api.shared.stg.eu-west-1.verticals.olx.org/olx/v1
VITE_VEHICLE_DECODER_AUTH_TOKEN=
```

- [ ] **Step 2: Implement decoder API service**

```ts
import type { VehicleDecoderResult } from '../types';

type DecodeVehicleParams = {
  vin: string;
  signal?: AbortSignal;
};

export const decodeVehicleByVin = async ({ vin, signal }: DecodeVehicleParams): Promise<VehicleDecoderResult> => {
  const baseUrl = import.meta.env.VITE_VEHICLE_DECODER_BASE_URL;
  const token = import.meta.env.VITE_VEHICLE_DECODER_AUTH_TOKEN;

  if (!baseUrl) {
    throw new Error('Vehicle decoder base URL is missing');
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/cars/decoder/${vin}`, {
    method: 'GET',
    headers: token ? { Authorization: token } : undefined,
    signal
  });

  if (!response.ok) {
    throw new Error(`Vehicle decoder failed with ${response.status}`);
  }

  const payload = await response.json();
  return payload.data ?? payload;
};
```

- [ ] **Step 3: Implement decoder hook**

```ts
import { useCallback, useRef, useState } from 'react';
import type { VehicleDecoderResult } from '../types';
import { decodeVehicleByVin } from '../services/vehicleDecoderApi';

type DecoderStatus = 'initial' | 'loading' | 'success' | 'error';

export const useVehicleDecoder = () => {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<DecoderStatus>('initial');
  const [result, setResult] = useState<VehicleDecoderResult | null>(null);

  const decode = useCallback(async (vin: string) => {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStatus('loading');
    setResult(null);

    try {
      const decoderResult = await decodeVehicleByVin({
        vin,
        signal: abortController.signal
      });

      setResult(decoderResult);
      setStatus('success');
      return decoderResult;
    } catch (error) {
      if (abortController.signal.aborted) {
        return null;
      }

      setStatus('error');
      return null;
    }
  }, []);

  return {
    status,
    result,
    decode
  };
};
```

---

## Task 7: Form Integration

**Files:**
- Create: `src/features/vin-scanner/components/VehicleInformationForm.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Add decoded field fill guard**

Create `src/features/vin-scanner/utils/shouldFillDecodedField.ts`:

```ts
export const shouldFillDecodedField = (currentValue: unknown): boolean => {
  if (Array.isArray(currentValue)) {
    return currentValue.length === 0;
  }

  if (typeof currentValue === 'string') {
    return currentValue.trim() === '';
  }

  return currentValue === null || currentValue === undefined;
};
```

- [ ] **Step 2: Implement form**

```tsx
import { useState } from 'react';
import { VinScannerButton } from './VinScannerButton';
import { useVehicleDecoder } from '../hooks/useVehicleDecoder';
import { shouldFillDecodedField } from '../utils/shouldFillDecodedField';
import type { VehicleFormValues, VehicleDecoderResult } from '../types';

const initialValues: VehicleFormValues = {
  vin: '',
  make: '',
  model: '',
  year: '',
  fuel: '',
  engineSize: ''
};

const isValidVin = (vin: string) => /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase());

export const VehicleInformationForm = () => {
  const [values, setValues] = useState<VehicleFormValues>(initialValues);
  const { status, decode } = useVehicleDecoder();

  const updateField = (field: keyof VehicleFormValues, value: string) => {
    setValues(current => ({ ...current, [field]: value }));
  };

  const applyDecodedValues = (decoderResult: VehicleDecoderResult | null) => {
    if (!decoderResult) {
      return;
    }

    setValues(current => ({
      ...current,
      make: shouldFillDecodedField(current.make) ? String(decoderResult.make ?? '') : current.make,
      model: shouldFillDecodedField(current.model) ? String(decoderResult.model ?? '') : current.model,
      year: shouldFillDecodedField(current.year) ? String(decoderResult.year ?? '') : current.year,
      fuel: shouldFillDecodedField(current.fuel) ? String(decoderResult.fuel ?? '') : current.fuel,
      engineSize: shouldFillDecodedField(current.engineSize) ? String(decoderResult.engineSize ?? '') : current.engineSize
    }));
  };

  const runDecode = async (vin: string) => {
    const normalizedVin = vin.toUpperCase();

    if (!isValidVin(normalizedVin)) {
      return;
    }

    const decoderResult = await decode(normalizedVin);
    applyDecodedValues(decoderResult);
  };

  const handleVinConfirmed = async (vin: string) => {
    const normalizedVin = vin.toUpperCase();
    updateField('vin', normalizedVin);
    await runDecode(normalizedVin);
  };

  return (
    <form className="vehicle-form">
      <section>
        <p className="vehicle-form__tip">Add your VIN and we will fill in car details whenever possible.</p>
        <label>
          VIN
          <input
            value={values.vin}
            onChange={event => updateField('vin', event.target.value.toUpperCase())}
            onBlur={() => runDecode(values.vin)}
            maxLength={17}
            data-testid="vin-input"
          />
        </label>
        <VinScannerButton onVinConfirmed={handleVinConfirmed} />
        {status === 'loading' ? <p>Loading vehicle details...</p> : null}
        {status === 'error' ? <p>We could not retrieve your car details. Check your VIN or fill in the details yourself.</p> : null}
      </section>
      <label>
        Make
        <input value={values.make} onChange={event => updateField('make', event.target.value)} />
      </label>
      <label>
        Model
        <input value={values.model} onChange={event => updateField('model', event.target.value)} />
      </label>
      <label>
        Year
        <input value={values.year} onChange={event => updateField('year', event.target.value)} />
      </label>
      <label>
        Fuel
        <input value={values.fuel} onChange={event => updateField('fuel', event.target.value)} />
      </label>
      <label>
        Engine size
        <input value={values.engineSize} onChange={event => updateField('engineSize', event.target.value)} />
      </label>
    </form>
  );
};
```

- [ ] **Step 3: Render form in app**

```tsx
import { VehicleInformationForm } from '../features/vin-scanner/components/VehicleInformationForm';
import './app.css';

export const App = () => (
  <main className="app">
    <h1>VIN Scanner PoC</h1>
    <VehicleInformationForm />
  </main>
);
```

---

## Task 8: Styling And Mobile UX

**Files:**
- Create: `src/app/app.css`

- [ ] **Step 1: Add practical mobile CSS**

```css
.app {
  max-width: 640px;
  margin: 0 auto;
  padding: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.vehicle-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.vehicle-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
}

.vehicle-form input {
  min-height: 44px;
  border: 1px solid #d8dfe0;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 16px;
}

.vehicle-form__tip {
  border-radius: 8px;
  background: #eef6ff;
  padding: 12px;
}

.vin-review-dialog {
  position: fixed;
  inset: auto 0 0;
  z-index: 10;
  max-height: 90vh;
  overflow: auto;
  border-radius: 16px 16px 0 0;
  background: white;
  padding: 16px;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.2);
}

.vin-review-preview {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
  background: #f2f4f5;
}

.vin-review-preview__image {
  display: block;
  width: 100%;
  height: auto;
}

.vin-review-preview__crop-guide {
  position: absolute;
  pointer-events: none;
  border: 2px dashed #0066ff;
  border-radius: 6px;
}

button {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  padding: 0 14px;
  font-weight: 700;
}
```

---

## Task 9: End-To-End Manual Testing

**Files:**
- No code changes.

- [ ] **Step 1: Run locally over HTTPS**

For real iPhone camera testing, use HTTPS:

```bash
npm run dev -- --host 0.0.0.0
```

Then expose through one of:

- A staging deployment.
- `mkcert` plus local LAN DNS.
- Cloudflare Tunnel or ngrok.

- [ ] **Step 2: Test desktop fallback**

In desktop Chrome:

1. Open the app.
2. Click `Scan VIN`.
3. Select a VIN image from disk.
4. Confirm review dialog appears.
5. Click `Scan photo`.
6. Confirm detected VIN appears.
7. Click `Use this VIN`.
8. Confirm VIN input updates and decoder is called.

- [ ] **Step 3: Test iPhone Safari**

In mobile Safari:

1. Open HTTPS app URL.
2. Tap `Scan VIN`.
3. Choose `Take Photo` or `Photo Library`.
4. Use a clear VIN photo with the VIN centered in the guide.
5. Tap `Scan photo`.
6. Confirm detected VIN or retry message.

- [ ] **Step 4: Validate error paths**

Use:

- A non-VIN image: expect `We could not find a valid VIN...`.
- A dark/blurry image: expect retry path.
- Network failure: expect decoder error while preserving VIN.
- Existing make/model values before decode: expect no overwrite.

---

## Task 10: Readiness Checklist

- [ ] VIN extraction tests pass.
- [ ] OCR hook tests pass with mocked Tesseract.
- [ ] Form integration tests cover scan confirmation and empty-field autofill.
- [ ] App runs on desktop with file picker fallback.
- [ ] App runs on mobile Safari over HTTPS.
- [ ] Decoder endpoint is configurable through environment variables.
- [ ] No user-entered vehicle details are overwritten by decoder response.
- [ ] OCR worker terminates after each recognition attempt.
- [ ] Object URLs are revoked when review dialog closes or image changes.

## Suggested Implementation Order

1. Build VIN extraction first.
2. Build crop/preprocess utility.
3. Build OCR hook with Tesseract mocked in tests.
4. Build scan button and review dialog without decoder.
5. Integrate confirmed VIN into form.
6. Add decoder API and empty-field autofill.
7. Test on real mobile HTTPS.

## Risks And Follow-Ups

- OCR accuracy is the main risk. If Tesseract.js is too weak, test Google ML Kit or native app OCR for production.
- Fixed crop region may not fit all documents. A draggable crop box is the next improvement.
- Large Tesseract worker bundle can affect first scan time. Lazy import is required.
- Production should add feature flags, analytics, privacy review, and a server-side decoder authentication strategy.
- If using a real OLX decoder endpoint, avoid shipping static auth tokens in client code.

## Self-Review

- The plan covers camera/file input, crop guide, OCR, VIN extraction, decoder handoff, empty-field autofill, error states, and mobile HTTPS testing.
- The plan avoids production-specific OLX module federation details so another agent can implement it in a standalone app.
- The main production concerns are documented as follow-ups, not required for this PoC.
