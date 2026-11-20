import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Img } from '../Img';

// Mock getAsset to simulate Dexie lookup
vi.mock('@/data/repositories/assets', () => ({
  getAsset: vi.fn().mockResolvedValue(undefined),
  createAssetUrl: vi.fn(),
}));

describe('Img component', () => {
  it('does not display "Image unavailable" while loading asset URL', async () => {
    render(<Img paperId="jee-main-2026-apr-s2" src="q_691121151.png" />);

    // While resolving, it should NOT show "Image unavailable"
    expect(screen.queryByText(/Image unavailable/)).not.toBeInTheDocument();

    // Await state updates to finish cleanly
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  it('renders fallback static asset URL once resolved', async () => {
    render(<Img paperId="jee-main-2026-apr-s2" src="q_691121151.png" />);

    await waitFor(() => {
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/papers/assets/jee-main-2026-apr-s2/q_691121151.png');
    });
  });

  it('renders "Image unavailable" only when image element triggers error', async () => {
    render(<Img paperId="jee-main-2026-apr-s2" src="q_691121151.png" />);

    const img = await screen.findByRole('img');
    fireEvent.error(img);

    expect(screen.getByText(/Image unavailable \(q_691121151\.png\)/)).toBeInTheDocument();
  });

  it('renders direct URLs immediately without paper asset path prefix', () => {
    render(<Img paperId="jee-main-2026-apr-s2" src="https://example.com/test.png" />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/test.png');
    expect(screen.queryByText(/Image unavailable/)).not.toBeInTheDocument();
  });
});
