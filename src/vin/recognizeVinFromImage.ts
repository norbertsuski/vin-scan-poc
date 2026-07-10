import { cropImageForOcr } from './cropImageForOcr';
import { extractVinFromText } from './extractVinFromText';

export type VinRecognitionResult =
  | {
      status: 'found';
      vin: string;
      rawText: string;
    }
  | {
      status: 'not_found';
      rawText: string;
    };

export const recognizeVinFromPreparedImage = async (image: Blob): Promise<VinRecognitionResult> => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    const result = await worker.recognize(image);
    const rawText = result.data.text;
    const vin = extractVinFromText(rawText);

    if (!vin) {
      return {
        status: 'not_found',
        rawText
      };
    }

    return {
      status: 'found',
      vin,
      rawText
    };
  } finally {
    await worker.terminate();
  }
};

export const recognizeVinFromImage = async (file: File): Promise<VinRecognitionResult> => {
  const croppedImage = await cropImageForOcr(file);

  return recognizeVinFromPreparedImage(croppedImage);
};
