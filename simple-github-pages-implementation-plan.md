# Simple VIN Scanner PoC Implementation Plan

## Goal

Build the smallest useful static web app for testing VIN photo capture and client-side OCR on a real mobile device. The app should deploy cleanly to GitHub Pages and require no backend for the first validation pass.

## Scope

### In Scope

- Mobile-first single-page web app.
- VIN text input with manual entry.
- `Scan VIN` button using native file/camera picker:
  - `<input type="file" accept="image/*" capture="environment">`
- Image review screen with a fixed VIN crop guide.
- Client-side image crop and preprocessing with Canvas.
- Client-side OCR with `tesseract.js`.
- VIN extraction and validation from OCR text.
- Confirmation flow that writes the detected VIN into the form.
- Static deployment to GitHub Pages.
- Real-device HTTPS testing through GitHub Pages.

### Out Of Scope For The First PoC

- Live camera viewfinder.
- Draggable crop box.
- User accounts.
- Backend service.
- Private decoder token in the browser.
- Production-grade OCR accuracy.
- Native app OCR libraries.

## Technology Choice

Use Vite with React and TypeScript.

Reason: it is still simple, but gives enough structure for stateful UI, async OCR status, and future expansion. GitHub Pages can host the built static files.

Required dependencies:

- `react`
- `react-dom`
- `vite`
- `typescript`
- `tesseract.js`

Optional but recommended:

- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`

## Proposed Minimal File Structure

```text
src/
  App.tsx
  main.tsx
  styles.css
  vin/
    extractVinFromText.ts
    cropImageForOcr.ts
    recognizeVinFromImage.ts
```

Avoid deeper feature folders until the PoC proves useful.

## User Flow

1. User opens the GitHub Pages URL on a phone.
2. User sees a small vehicle form with a VIN field.
3. User taps `Scan VIN`.
4. Browser opens the native camera/photo picker.
5. User takes or selects a photo.
6. App shows the selected photo in a review panel with a dashed horizontal crop guide.
7. User taps `Scan photo`.
8. App crops the guide region, preprocesses it, and runs OCR.
9. App extracts the best valid 17-character VIN candidate.
10. User confirms the VIN.
11. App fills the VIN field.

## Implementation Steps

### 1. Create The App

- Initialize Vite React TypeScript in this repo.
- Add `tesseract.js`.
- Add a GitHub Pages compatible Vite `base` setting if deploying under a repo path.
- Add scripts:
  - `dev`
  - `build`
  - `preview`
  - `test` if tests are added.

### 2. Build The Minimal Form UI

- Create one page with:
  - VIN input.
  - `Scan VIN` button.
  - optional make/model/year fields as plain manual fields.
- Keep the first screen form-first, not a landing page.
- Use mobile-friendly controls:
  - 16px input font size.
  - 44px minimum touch targets.
  - single-column layout.

### 3. Add Native Photo Capture

- Add hidden file input:

```tsx
<input type="file" accept="image/*" capture="environment" />
```

- Trigger it from the `Scan VIN` button.
- Store the selected `File`.
- Create an object URL for preview.
- Revoke object URLs on cleanup.

### 4. Add Review Panel

- Show the selected image.
- Overlay a fixed dashed crop guide.
- Use one default crop region:

```ts
const VIN_CROP_REGION = {
  xRatio: 0.05,
  yRatio: 0.35,
  widthRatio: 0.9,
  heightRatio: 0.2
};
```

- Add buttons:
  - `Scan photo`
  - `Cancel`
  - `Use this VIN` after a candidate is found.

### 5. Implement Image Crop And Preprocessing

- Load the selected image into an `Image`.
- Draw the crop region into a Canvas.
- Apply basic grayscale and contrast.
- Export the cropped image as PNG `Blob`.

Keep this simple first. Do not add rotation correction or draggable crop until real test photos show it is needed.

### 6. Implement OCR

- Lazy-load Tesseract only when scanning starts:

```ts
const { createWorker } = await import('tesseract.js');
```

- Create an English worker.
- Run OCR on the cropped image.
- Terminate the worker after recognition.
- Show states:
  - idle
  - scanning
  - VIN found
  - no VIN found
  - OCR failed

### 7. Implement VIN Extraction

- Normalize OCR text to uppercase.
- Search for 17-character candidates using VIN-safe characters:

```ts
/^[A-HJ-NPR-Z0-9]{17}$/
```

- Reject `I`, `O`, and `Q`.
- Support spaced OCR output by removing whitespace.
- Return `null` if no valid VIN is found.

### 8. Add Optional Decoder Later

For the GitHub Pages version, do not ship private decoder tokens in client code.

Start with one of these safer options:

- No decoder in v1: only prove scan-to-VIN works.
- Public decoder only if CORS and usage terms allow it.
- Later add a tiny proxy on Cloudflare Workers, Vercel, or similar for authenticated decoder access.

### 9. Add GitHub Pages Deployment

Use a GitHub Actions workflow that:

- installs dependencies,
- runs tests if present,
- builds the Vite app,
- uploads `dist`,
- deploys to Pages.

Vite config needs:

```ts
base: '/vin-scan-poc/'
```

if the Pages URL is `https://<user>.github.io/vin-scan-poc/`.

### 10. Test On Real Device

Desktop checks:

- App loads.
- File picker fallback works.
- Existing VIN photo can be selected.
- Review panel appears.
- OCR status is visible.
- VIN fills the input after confirmation.

Mobile Safari / Chrome checks:

- GitHub Pages URL opens over HTTPS.
- `Scan VIN` opens native action sheet or camera picker.
- Photo preview renders.
- Crop guide is visible and aligned.
- OCR completes without crashing.
- Clear VIN photo produces a candidate.
- Bad photo shows a retry/manual-entry message.

## Suggested First Milestone

Ship only this:

- Form
- Native photo picker
- Review panel
- Crop guide
- Tesseract OCR
- VIN extraction
- GitHub Pages deployment

Do not add decoder integration until real-device scan quality is understood.

## Main Risks

- OCR may be slow on older phones.
- Tesseract bundle size may make first scan noticeably delayed.
- Fixed crop may miss VINs on different document layouts.
- Mobile browser capture behavior differs by OS and browser.
- GitHub Pages cannot protect API secrets.

## Acceptance Criteria

- Static app deploys to GitHub Pages.
- App works over HTTPS on a real phone.
- User can take or select a photo.
- User can review the selected photo.
- App attempts client-side OCR.
- App extracts and confirms a valid VIN from at least one clear test photo.
- App fails gracefully when OCR cannot find a VIN.
