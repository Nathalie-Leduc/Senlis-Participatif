// Tests — suggestions de ville (geo.api.gouv.fr) dans une réponse d'enquête
// (S5R2-08 : le clic sur une suggestion appelait une fonction disparue —
// ce test l'aurait vu)
import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { VilleAutocompleteInput } from './EnqueteRepondre.jsx';

function Harness({ onChange }) {
  const [value, setValue] = useState('');
  return (
    <VilleAutocompleteInput
      value={value}
      onChange={(v) => { setValue(v); onChange(v); }}
      a11y={{ 'aria-label': 'Votre ville' }}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [{ nom: 'Senlis', codesPostaux: ['60300'] }] }));
});
afterEach(() => vi.useRealTimers());

describe('VilleAutocompleteInput', () => {
  it('propose des villes après 2 lettres et une courte pause, puis remplit le champ au clic', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Votre ville');

    fireEvent.change(input, { target: { value: 'S' } });
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(globalThis.fetch).not.toHaveBeenCalled(); // une seule lettre : rien

    fireEvent.change(input, { target: { value: 'Sen' } });
    await act(async () => { vi.advanceTimersByTime(350); });
    const suggestion = screen.getByRole('button', { name: /Senlis/ });

    fireEvent.click(suggestion);
    expect(onChange).toHaveBeenLastCalledWith('Senlis (60300)');
    expect(screen.queryByRole('button', { name: /Senlis/ })).not.toBeInTheDocument();
  });

  it('en effaçant jusqu\'à moins de 2 lettres, les suggestions disparaissent', async () => {
    render(<Harness onChange={vi.fn()} />);
    const input = screen.getByLabelText('Votre ville');
    fireEvent.change(input, { target: { value: 'Sen' } });
    await act(async () => { vi.advanceTimersByTime(350); });
    expect(screen.getByRole('button', { name: /Senlis/ })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'S' } });
    expect(screen.queryByRole('button', { name: /Senlis/ })).not.toBeInTheDocument();
  });
});
