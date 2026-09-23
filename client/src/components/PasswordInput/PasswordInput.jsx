import { useState } from 'react';

// Réutilisé partout où un mot de passe se saisit (inscription,
// changement de mot de passe) — un seul endroit à corriger si le
// style doit changer, plutôt que la même logique recopiée 3 ou 4 fois.
export default function PasswordInput({
  name, value, onChange, placeholder, autoComplete, required, minLength, pattern, title, style,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        pattern={pattern}
        title={title}
        style={{ ...style, paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 20,
          padding: 4, lineHeight: 1, color: '#6B6257',
        }}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
