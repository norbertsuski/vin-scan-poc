import { describe, expect, it } from 'vitest';
import { VIN_CROP_REGION } from './cropImageForOcr';

describe('VIN_CROP_REGION', () => {
  it('targets a centered horizontal band where VINs are commonly visible', () => {
    expect(VIN_CROP_REGION).toEqual({
      xRatio: 0.05,
      yRatio: 0.35,
      widthRatio: 0.9,
      heightRatio: 0.1
    });
  });
});
