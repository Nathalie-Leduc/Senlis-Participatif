// Tests — choix de la zone d'une proposition (S5R-10)
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ZonePicker from './ZonePicker.jsx';

function Harness() {
  const [zone, setZone] = useState({ mode: 'none', quartiers: [] });
  return <ZonePicker mode={zone.mode} quartiers={zone.quartiers} onChange={setZone} />;
}
const summary = () => screen.getByText('Concerne :').parentElement;

describe('ZonePicker', () => {
  it('pas de zone → toute la ville → quartiers, avec une synthèse à chaque étape', () => {
    render(<Harness />);
    expect(summary()).toHaveTextContent('pas de zone particulière');

    fireEvent.click(screen.getByRole('radio', { name: 'Toute la ville' }));
    expect(summary()).toHaveTextContent('Toute la ville');
    expect(screen.queryByRole('group', { name: 'Quartiers concernés' })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Un ou plusieurs quartiers' }));
    expect(summary()).toHaveTextContent('cochez au moins un quartier');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Centre historique' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Villevert' }));
    expect(summary()).toHaveTextContent('Centre historique et Villevert');
  });
});
