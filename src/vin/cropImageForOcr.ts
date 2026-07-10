export type CropRegion = {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
};

export const VIN_CROP_REGION: CropRegion = {
  xRatio: 0.05,
  yRatio: 0.35,
  widthRatio: 0.9,
  heightRatio: 0.1
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load selected image'));
    };

    image.src = objectUrl;
  });

const applyGrayscaleContrast = (context: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const grayscale = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const contrast = Math.min(255, Math.max(0, (grayscale - 128) * 1.55 + 128));

    data[index] = contrast;
    data[index + 1] = contrast;
    data[index + 2] = contrast;
  }

  context.putImageData(imageData, 0, 0);
};

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Could not prepare image for OCR'));
        return;
      }

      resolve(blob);
    }, 'image/png');
  });

export const cropImageForOcr = async (
  file: File,
  cropRegion: CropRegion = VIN_CROP_REGION
): Promise<Blob> => {
  const image = await loadImage(file);
  const sourceX = Math.round(image.naturalWidth * cropRegion.xRatio);
  const sourceY = Math.round(image.naturalHeight * cropRegion.yRatio);
  const sourceWidth = Math.round(image.naturalWidth * cropRegion.widthRatio);
  const sourceHeight = Math.round(image.naturalHeight * cropRegion.heightRatio);

  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available in this browser');
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  applyGrayscaleContrast(context, sourceWidth, sourceHeight);

  return canvasToPngBlob(canvas);
};

export const cropVideoFrameForOcr = (
  video: HTMLVideoElement,
  cropRegion: CropRegion = VIN_CROP_REGION
): Promise<Blob> => {
  const sourceX = Math.round(video.videoWidth * cropRegion.xRatio);
  const sourceY = Math.round(video.videoHeight * cropRegion.yRatio);
  const sourceWidth = Math.round(video.videoWidth * cropRegion.widthRatio);
  const sourceHeight = Math.round(video.videoHeight * cropRegion.heightRatio);

  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available in this browser');
  }

  context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  applyGrayscaleContrast(context, sourceWidth, sourceHeight);

  return canvasToPngBlob(canvas);
};
