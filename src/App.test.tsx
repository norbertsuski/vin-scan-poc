import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined
    });
  });

  it('renders the manual VIN form and scan action', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'VIN Scanner PoC' })).toBeInTheDocument();
    expect(screen.getByLabelText('VIN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan VIN' })).toBeInTheDocument();
    expect(screen.getByLabelText('Make')).toBeInTheDocument();
    expect(screen.getByLabelText('Model')).toBeInTheDocument();
    expect(screen.getByLabelText('Year')).toBeInTheDocument();
  });

  it('opens a live camera overlay when browser camera access is available', async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop }]
    }));

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia }
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn(async () => undefined)
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Scan VIN' }));

    const cameraDialog = await screen.findByRole('dialog', { name: 'Align VIN' });

    expect(cameraDialog).toBeInTheDocument();
    expect(screen.getByLabelText('Live camera preview')).toBeInTheDocument();
    expect(screen.getByText('Scanning the highlighted band automatically...')).toBeInTheDocument();
    expect(within(cameraDialog).getByRole('button', { name: 'Choose photo' })).toBeEnabled();
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });
  });
});
