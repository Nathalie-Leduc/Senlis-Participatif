// ══════════════════════════════════════════════════════════
// useFormDraft — sauvegarde automatique d'un formulaire (S5R2-13)
//
// Partagé par les formulaires d'administration (enquête, proposition).
// Trois règles, et c'est tout :
//  1. on n'enregistre RIEN tant que la personne n'a rien modifié
//     (sinon ouvrir puis quitter un formulaire vide laisserait un
//     « brouillon » vide, et un bandeau « Reprendre ? » absurde) ;
//  2. ensuite, CHAQUE modification est enregistrée aussitôt (pas de
//     délai : quitter la page juste après une frappe ne perd rien) ;
//  3. tant qu'un brouillon retrouvé attend la décision « Reprendre /
//     Repartir de zéro », on n'enregistre rien (on l'écraserait).
//
// Analogie : un enregistreur qui ne démarre qu'au premier mot, et qui
// se met en pause pendant qu'on décide quoi faire de l'ancienne bande.
//
// Usage :
//   const snapshot = useMemo(() => ({ form, appliedTemplateId }), [form, appliedTemplateId]);
//   const draft = useFormDraft({ userId, scope: 'survey-form:new', ready: !loading, snapshot, checkOnMount: !isEdit });
//   draft.pending  → { savedAt, data } à proposer, ou null
//   draft.check()  → cherche un brouillon (ex. après le chargement en modification)
//   draft.restore()→ renvoie les données retrouvées et ferme la question
//   draft.discard()→ efface le brouillon retrouvé
//   draft.clear()  → après un enregistrement réussi
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { saveDraft, loadDraft, clearDraft } from '../utils/draftStorage.js';

export function useFormDraft({ userId, scope, ready, snapshot, checkOnMount = false }) {
  // Initialisation « paresseuse » : en création, on cherche le brouillon
  // dès le premier rendu (pas d'effet → pas de rendu en double)
  const [pending, setPending] = useState(() => (checkOnMount ? loadDraft(userId, scope) : null));
  // Le formulaire « tel qu'il était » au départ : tant que snapshot est
  // le MÊME objet, rien n'a été modifié (règle 1)
  const baselineRef = useRef(null);

  useEffect(() => {
    if (!ready || pending) return; // règle 3
    if (baselineRef.current === null) {
      baselineRef.current = snapshot; // point de départ, rien à enregistrer
      return;
    }
    if (snapshot === baselineRef.current) return;
    saveDraft(userId, scope, snapshot); // règle 2
  }, [ready, pending, snapshot, userId, scope]);

  const check = useCallback(() => setPending(loadDraft(userId, scope)), [userId, scope]);

  const restore = useCallback(() => {
    const data = pending?.data ?? null;
    baselineRef.current = null; // le formulaire restauré devient le point de départ
    setPending(null);
    return data;
  }, [pending]);

  const discard = useCallback(() => {
    clearDraft(userId, scope);
    baselineRef.current = null;
    setPending(null);
  }, [userId, scope]);

  const clear = useCallback(() => clearDraft(userId, scope), [userId, scope]);

  return { pending, check, restore, discard, clear };
}
