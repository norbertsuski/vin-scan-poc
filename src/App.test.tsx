import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the manual VIN form and scan action', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'VIN Scanner PoC' })).toBeInTheDocument();
    expect(screen.getByLabelText('VIN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan VIN' })).toBeInTheDocument();
    expect(screen.getByLabelText('Make')).toBeInTheDocument();
    expect(screen.getByLabelText('Model')).toBeInTheDocument();
    expect(screen.getByLabelText('Year')).toBeInTheDocument();
  });
});
