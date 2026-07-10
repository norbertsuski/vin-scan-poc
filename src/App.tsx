import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { VIN_CROP_REGION } from './vin/cropImageForOcr';
import { isValidVin } from './vin/extractVinFromText';
import { recognizeVinFromImage } from './vin/recognizeVinFromImage';

type OcrState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'found'; vin: string; rawText: string }
  | { status: 'not_found'; rawText: string }
  | { status: 'failed'; message: string };

type VehicleFields = {
  vin: string;
  make: string;
  model: string;
  year: string;
};

const initialVehicleFields: VehicleFields = {
  vin: '',
  make: '',
  model: '',
  year: ''
};

const normalizeVinInput = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 17);

export const App = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState<VehicleFields>(initialVehicleFields);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrState, setOcrState] = useState<OcrState>({ status: 'idle' });

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const updateField = (field: keyof VehicleFields, value: string) => {
    setFields(current => ({
      ...current,
      [field]: field === 'vin' ? normalizeVinInput(value) : value
    }));
  };

  const openImagePicker = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);
    setOcrState({ status: 'idle' });
    event.target.value = '';
  };

  const closeReview = () => {
    setSelectedFile(null);
    setOcrState({ status: 'idle' });
  };

  const scanPhoto = async () => {
    if (!selectedFile || ocrState.status === 'scanning') {
      return;
    }

    setOcrState({ status: 'scanning' });

    try {
      const result = await recognizeVinFromImage(selectedFile);

      if (result.status === 'found') {
        setOcrState({ status: 'found', vin: result.vin, rawText: result.rawText });
        return;
      }

      setOcrState({ status: 'not_found', rawText: result.rawText });
    } catch (error) {
      setOcrState({
        status: 'failed',
        message: error instanceof Error ? error.message : 'The photo could not be scanned.'
      });
    }
  };

  const useDetectedVin = (vin: string) => {
    setFields(current => ({
      ...current,
      vin
    }));
    closeReview();
  };

  const vinStatus = fields.vin.length === 17 ? (isValidVin(fields.vin) ? 'valid' : 'invalid') : 'partial';

  return (
    <main className="app-shell">
      <section className="scanner-panel" aria-labelledby="page-title">
        <div className="panel-header">
          <div>
            <h1 id="page-title">VIN Scanner PoC</h1>
            <p>Take or choose a clear VIN photo, scan it on-device, and confirm the detected value.</p>
          </div>
        </div>

        <form className="vehicle-form">
          <label className="field field-vin">
            <span>VIN</span>
            <input
              value={fields.vin}
              onChange={event => updateField('vin', event.target.value)}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={17}
              placeholder="17-character VIN"
              aria-describedby="vin-help"
            />
          </label>

          <div id="vin-help" className={`vin-status vin-status-${vinStatus}`}>
            {vinStatus === 'valid' ? 'VIN format looks valid.' : null}
            {vinStatus === 'invalid' ? 'VIN cannot include I, O, or Q.' : null}
            {vinStatus === 'partial' ? `${fields.vin.length}/17 characters entered.` : null}
          </div>

          <button className="primary-action" type="button" onClick={openImagePicker}>
            Scan VIN
          </button>

          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelected}
            aria-label="Take or select VIN photo"
          />

          <div className="secondary-fields" aria-label="Vehicle details">
            <label className="field">
              <span>Make</span>
              <input value={fields.make} onChange={event => updateField('make', event.target.value)} />
            </label>
            <label className="field">
              <span>Model</span>
              <input value={fields.model} onChange={event => updateField('model', event.target.value)} />
            </label>
            <label className="field">
              <span>Year</span>
              <input inputMode="numeric" value={fields.year} onChange={event => updateField('year', event.target.value)} />
            </label>
          </div>
        </form>
      </section>

      {selectedFile && previewUrl ? (
        <ReviewPanel
          previewUrl={previewUrl}
          ocrState={ocrState}
          onCancel={closeReview}
          onScan={scanPhoto}
          onUseVin={useDetectedVin}
        />
      ) : null}
    </main>
  );
};

type ReviewPanelProps = {
  previewUrl: string;
  ocrState: OcrState;
  onCancel: () => void;
  onScan: () => void;
  onUseVin: (vin: string) => void;
};

const ReviewPanel = ({ previewUrl, ocrState, onCancel, onScan, onUseVin }: ReviewPanelProps) => (
  <div className="review-backdrop" role="presentation">
    <section className="review-panel" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="review-header">
        <div>
          <h2 id="review-title">Review photo</h2>
          <p>Place the VIN inside the guide when taking the photo. Use manual entry if OCR misses it.</p>
        </div>
        <button className="icon-button" type="button" onClick={onCancel} aria-label="Close review">
          x
        </button>
      </div>

      <div className="preview-frame">
        <img src={previewUrl} alt="Selected VIN source" />
        <div
          className="crop-guide"
          style={{
            left: `${VIN_CROP_REGION.xRatio * 100}%`,
            top: `${VIN_CROP_REGION.yRatio * 100}%`,
            width: `${VIN_CROP_REGION.widthRatio * 100}%`,
            height: `${VIN_CROP_REGION.heightRatio * 100}%`
          }}
        />
      </div>

      <OcrFeedback ocrState={ocrState} />

      <div className="review-actions">
        {ocrState.status === 'found' ? (
          <button className="primary-action" type="button" onClick={() => onUseVin(ocrState.vin)}>
            Use this VIN
          </button>
        ) : (
          <button className="primary-action" type="button" onClick={onScan} disabled={ocrState.status === 'scanning'}>
            {ocrState.status === 'scanning' ? 'Scanning...' : 'Scan photo'}
          </button>
        )}
        <button className="secondary-action" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  </div>
);

const OcrFeedback = ({ ocrState }: { ocrState: OcrState }) => {
  if (ocrState.status === 'idle') {
    return <p className="status-message">Ready to scan the highlighted band.</p>;
  }

  if (ocrState.status === 'scanning') {
    return <p className="status-message">Scanning on this device. First scan can take a moment.</p>;
  }

  if (ocrState.status === 'found') {
    return (
      <div className="result-box">
        <span>Detected VIN</span>
        <strong>{ocrState.vin}</strong>
      </div>
    );
  }

  if (ocrState.status === 'not_found') {
    return <p className="error-message">No valid VIN was found. Try a brighter, closer photo or enter it manually.</p>;
  }

  return <p className="error-message">{ocrState.message}</p>;
};
