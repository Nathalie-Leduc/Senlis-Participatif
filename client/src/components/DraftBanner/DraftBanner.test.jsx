import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DraftBanner from './DraftBanner.jsx';

describe('DraftBanner', () => {
  it("signale l'aperçu d'un brouillon, et rien d'autre", () => {
    const { rerender } = render(<DraftBanner status="DRAFT" />);
    expect(screen.getByRole('status')).toHaveTextContent("Aperçu d'un brouillon");
    rerender(<DraftBanner status="PUBLISHED" />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
