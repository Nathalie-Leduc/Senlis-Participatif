// Tests — choix du public visé (S5R-07)
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AudiencePicker from './AudiencePicker.jsx';
import { EMPTY_AUDIENCE } from '../../utils/audience.js';

function Harness({ onChange }) {
  const [value, setValue] = useState(EMPTY_AUDIENCE);
  return <AudiencePicker value={value} onChange={(v) => { setValue(v); onChange(v); }} />;
}

describe('AudiencePicker', () => {
  it('rien de coché : « tout le monde » ; la synthèse suit chaque case cochée', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByText(/S'adresse à/).parentElement).toHaveTextContent('tout le monde');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Habitants du centre historique' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Centre historique' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Qui dirigent ou gèrent une activité' }));

    expect(onChange).toHaveBeenLastCalledWith({
      situations: ['CENTRE_RESIDENT'], quartiers: [], workQuartiers: ['CENTRE_HISTORIQUE'], workTypes: ['COMMERCANT'],
    });
    expect(screen.getByText(/S'adresse à/).parentElement)
      .toHaveTextContent('habitants du centre historique et personnes qui dirigent une activité dans le centre historique');
  });

  it("les quartiers de résidence n'apparaissent qu'avec « autres quartiers », et s'effacent si on le décoche", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.queryByRole('group', { name: 'Quels quartiers ?' })).toBeNull();

    const autres = screen.getByRole('checkbox', { name: 'Habitants des autres quartiers de Senlis' });
    fireEvent.click(autres);
    const group = screen.getByRole('group', { name: 'Quels quartiers ?' });
    fireEvent.click(group.querySelector('input'));
    expect(onChange.mock.lastCall[0].quartiers).toHaveLength(1);

    fireEvent.click(autres);
    expect(onChange.mock.lastCall[0]).toMatchObject({ situations: [], quartiers: [] });
  });
});
