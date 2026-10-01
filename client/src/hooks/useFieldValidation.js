// ══════════════════════════════════════════════════════════
// Validation champ par champ (S5R-02)
//
// Le comportement suit une règle d'ergonomie bien établie :
// « signaler tard, récompenser tôt ».
//  - SIGNALER TARD : on ne crie pas « adresse invalide » pendant que la
//    personne est en train de taper la 3e lettre — l'erreur n'apparaît
//    qu'en QUITTANT le champ (blur), ou à l'envoi du formulaire ;
//  - RÉCOMPENSER TÔT : une fois l'erreur affichée, le champ est revérifié
//    à CHAQUE frappe, et le message disparaît dès que c'est corrigé.
//
// Analogie : un correcteur qui attend la fin de la phrase pour souligner
// une faute — mais qui efface son trait dès qu'on l'a corrigée.
//
// Usage :
//   const v = useFieldValidation('register', {
//     email: (value) => validateEmail(value),
//     passwordConfirm: (value, all) => validatePasswordConfirm(value, all.password),
//   });
//   <input {...v.fieldProps('email', form)} … />
//   <FieldError id={v.errorId('email')}>{v.errors.email}</FieldError>
// ══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { errorProps } from '../components/FormError/FormError.jsx';

/**
 * @param {string} formId - préfixe des id d'erreur (unique dans la page)
 * @param {Record<string, (value: any, values: object) => string|null>} rules
 */
export function useFieldValidation(formId, rules) {
  const [errors, setErrors] = useState({});

  const errorId = useCallback((name) => `${formId}-${name}-error`, [formId]);

  /** Vérifie un champ et met à jour son message. Renvoie le message. */
  const validateField = (name, values) => {
    const message = rules[name] ? rules[name](values[name], values) : null;
    setErrors((prev) => ({ ...prev, [name]: message }));
    return message;
  };

  /**
   * Vérifie TOUS les champs (à l'envoi).
   * @returns {string[]} les noms des champs en erreur, dans l'ordre des règles
   */
  const validateAll = (values) => {
    const next = {};
    for (const name of Object.keys(rules)) next[name] = rules[name](values[name], values);
    setErrors(next);
    return Object.keys(next).filter((name) => next[name]);
  };

  /** Erreur venue d'ailleurs (ex. l'API : « ce pseudo est déjà pris ») */
  const setFieldError = (name, message) => setErrors((prev) => ({ ...prev, [name]: message }));

  /**
   * Attributs à poser sur un champ : ARIA + vérification en quittant le
   * champ. `values` = l'état complet du formulaire au moment du rendu.
   */
  const fieldProps = (name, values) => ({
    ...errorProps(Boolean(errors[name]), errorId(name)),
    onBlur: () => validateField(name, values),
  });

  /**
   * À appeler après un changement de valeur : ne revérifie QUE si le
   * champ est déjà signalé en erreur (récompenser tôt). `values` = le
   * NOUVEL état du formulaire.
   */
  const revalidateIfInvalid = (name, values) => {
    if (errors[name]) validateField(name, values);
  };

  return { errors, errorId, validateField, validateAll, setFieldError, fieldProps, revalidateIfInvalid };
}

/**
 * Place le focus sur le premier champ en erreur d'un formulaire.
 * requestAnimationFrame : on attend que React ait affiché les messages
 * (et posé aria-invalid) avant de déplacer le focus, pour que le lecteur
 * d'écran annonce le champ AVEC son erreur.
 */
export function focusField(formElement, name) {
  requestAnimationFrame(() => formElement?.querySelector(`[name="${name}"]`)?.focus());
}
