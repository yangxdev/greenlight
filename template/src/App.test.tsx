import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App.tsx';
import { renderWithStore } from './test/render.tsx';

describe('App', () => {
  it('renders the heading and reports API status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        ok: true,
        time: '2026-01-01T00:00:00.000Z',
        storage: false,
        database: false,
      }),
    );

    renderWithStore(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('API online')).toBeInTheDocument();
  });
});
