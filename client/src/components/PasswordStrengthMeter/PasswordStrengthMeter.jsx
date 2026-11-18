// ══════════════════════════════════════════════════════════
// Jauge de solidité du mot de passe — fondée sur la LONGUEUR (S5R-13b)
//
// Avant : 5 critères (12 caractères, minuscule, majuscule, chiffre,
// caractère spécial). Depuis la politique CNIL + NIST (document 21,
// § 8.5), seule la longueur est exigée : 15 caractères minimum, et
// plus c'est long, mieux c'est. La jauge suit donc la longueur, et
// l'astuce de la phrase de passe est affichée dès l'arrivée sur le
// champ (avant même la première lettre).
//
// Analogie : la CNIL et le NIST ont remplacé « une clé avec des dents
// de quatre formes » par « une clé longue ». La jauge mesure la
// longueur de la clé, plus la forme de ses dents.
//
// Elle ne bloque rien : le formulaire refuse un mot de passe trop
// court (validateNewPassword), l'API refuse les mots de passe courants.
// ══════════════════════════════════════════════════════════

import { PASSWORD_MIN_LENGTH, passwordLength } from '../../utils/formValidation.js';

const COLORS = { weak: '#A8442F', fair: '#C97A2E', good: '#8AA84A', strong: '#3A7A4D' };

/**
 * Le niveau affiché — fonction pure, testée.
 * @returns {{ label: string, color: string, percent: number }}
 */
export function strengthLevel(password) {
  const length = passwordLength(password);
  // « aaaaaaaaaaaaaaaa » est long… et refusé par l'API : on ne le
  // présente pas comme solide (moins de 5 caractères différents)
  const distinct = new Set([...String(password).toLowerCase()]).size;

  if (length < PASSWORD_MIN_LENGTH) {
    const missing = PASSWORD_MIN_LENGTH - length;
    return {
      label: `Trop court — encore ${missing} caractère${missing > 1 ? 's' : ''}`,
      color: COLORS.weak,
      percent: 8 + (length / PASSWORD_MIN_LENGTH) * 40,
    };
  }
  if (distinct < 5) return { label: 'Trop prévisible — variez les caractères', color: COLORS.weak, percent: 48 };
  if (length < 20) return { label: 'Correct', color: COLORS.fair, percent: 60 };
  if (length < 30) return { label: 'Bon', color: COLORS.good, percent: 80 };
  return { label: 'Excellent', color: COLORS.strong, percent: 100 };
}

/**
 * @param {{ password: string }} props
 */
export default function PasswordStrengthMeter({ password }) {
  const level = password ? strengthLevel(password) : null;

  return (
    <div style={{ marginTop: 8 }}>
      {level && (
        <div aria-live="polite">
          <div style={{ height: 6, borderRadius: 999, background: '#EFEBE2', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', borderRadius: 999, background: level.color,
                width: `${level.percent}%`, transition: 'width .2s ease, background-color .2s ease',
              }}
            />
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, color: level.color, margin: '4px 0 0' }}>
            {level.label}
          </p>
        </div>
      )}
      <p style={{ fontSize: 13, color: '#6B6257', margin: '6px 0 0', lineHeight: 1.5 }}>
        <span aria-hidden="true">💡 </span>
        Astuce : une <strong>phrase de passe</strong>, par exemple 4 ou 5 mots pris au hasard
        (« pivoine lanterne orage remparts »). Les espaces sont permis ; majuscules, chiffres
        et symboles aussi, mais rien n’est obligatoire : c’est la longueur qui compte.
      </p>
    </div>
  );
}
