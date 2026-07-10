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

export const recognizeVinFromImage = async (file: File): Promise<VinRecognitionResult> => {
  const croppedImage = await cropImageForOcr(file);
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
    });

    const result = await worker.recognize(croppedImage);
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
