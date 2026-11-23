// ══════════════════════════════════════════════════════════
// useApiQuery — charger des données de l'API dans une page
// (S5R2-08, BACKLOG-03)
//
// Avant, chaque page répétait le même motif :
//
//   useEffect(() => {
//     setLoading(true);           // ← setState SYNCHRONE dans l'effet
//     setError(null);
//     api.get(url).then(setData).catch(setError).finally(() => setLoading(false));
//   }, [url]);
//
// La règle react-hooks/set-state-in-effect (eslint-plugin-react-hooks 7)
// le signale : modifier l'état au début d'un effet force React à
// refaire un rendu immédiatement, pour rien — et 14 pages le faisaient
// chacune à leur manière (certaines oubliaient d'ignorer une réponse
// arrivée trop tard, d'autres de remettre l'erreur à zéro).
//
// Ici, l'état « chargement » n'est jamais STOCKÉ : il est DÉDUIT.
// Le hook garde la dernière réponse reçue avec la « question » à
// laquelle elle répond (l'adresse demandée). Si la question actuelle
// n'a pas encore sa réponse, c'est qu'on charge. L'état n'est modifié
// que dans les rappels de la requête, jamais au début de l'effet.
//
// Analogie : au lieu de lever la main « je cherche ! » avant de
// chercher, on regarde si la fiche posée sur le bureau répond bien à
// la question du moment. Sinon, c'est qu'on est encore en train de chercher.
//
// Usage :
//   const { data, error, loading, reload, setData } = useApiQuery(`/surveys/${slug}`);
//   const { data } = useApiQuery(isLogged ? '/me/votes' : null); // null = ne rien charger
//
// - data    : la dernière réponse reçue. Elle reste affichée pendant
//             qu'une nouvelle adresse se charge (pas de « clignotement »
//             quand on change un filtre) ; null avant la première réponse.
// - error   : l'erreur de l'API ({ status, code, message }) pour
//             l'adresse ACTUELLE, sinon null.
// - loading : vrai tant que l'adresse actuelle n'a pas sa réponse.
// - reload  : recharger la même adresse (après une action, par exemple).
// - setData : corriger la donnée sur place (après une action réussie,
//             sans tout recharger) ; accepte une valeur ou une fonction.
// ══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

/**
 * @param {string|null|undefined} path - adresse de l'API (ex. « /surveys?page=1 »), ou null pour ne rien charger
 */
export function useApiQuery(path) {
  // Numéro de rechargement : fait partie de la « question » posée
  const [version, setVersion] = useState(0);
  const key = path ? `${version}|${path}` : null;

  // La dernière réponse, avec la question à laquelle elle répond
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false; // réponse arrivée après un changement d'adresse : ignorée
    api.get(path)
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null });
      })
      .catch((error) => {
        // En cas d'erreur, on garde la donnée précédente (utile pour un
        // filtre qui échoue : la liste d'avant reste visible)
        if (!cancelled) setResult((prev) => ({ key, data: prev.data, error }));
      });
    return () => { cancelled = true; };
  }, [key, path]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((next) => {
    setResult((prev) => ({ ...prev, data: typeof next === 'function' ? next(prev.data) : next }));
  }, []);

  const answered = key !== null && result.key === key;
  return {
    data: result.data,
    error: answered ? result.error : null,
    loading: key !== null && !answered,
    reload,
    setData,
  };
}

// ══════════════════════════════════════════════════════════
// usePagedApiQuery — une liste paginée avec « Voir plus »
// (Propositions, Enquêtes)
//
// La première page est chargée par useApiQuery ; les pages suivantes
// s'ajoutent au clic sur « Voir plus » (dans un gestionnaire de clic,
// où modifier l'état est permis).
//
// Changer un filtre (statut, tri) change l'adresse de la première
// page : les pages ajoutées pour l'ANCIEN filtre sont alors oubliées
// d'elles-mêmes — elles sont rangées avec l'adresse à laquelle elles
// se rattachent, et ignorées si ce n'est plus la bonne. Pas d'effet
// « remettre à zéro quand le filtre change ».
// Analogie : des feuilles agrafées à leur couverture. On change de
// classeur, les feuilles de l'ancien ne suivent pas.
//
// Usage :
//   const list = usePagedApiQuery((page) => `/proposals?page=${page}&status=${status}`);
//   list.items, list.totalPages, list.page, list.loading, list.error,
//   list.moreError, list.loadMore()
// ══════════════════════════════════════════════════════════

const NO_MORE = { base: null, items: [], page: 1, loading: false, error: null };

/**
 * @param {(page: number) => string} makePath - l'adresse de la page demandée
 */
export function usePagedApiQuery(makePath) {
  const firstPath = makePath(1);
  const first = useApiQuery(firstPath);
  const [more, setMore] = useState(NO_MORE);
  // Les pages ajoutées ne valent que pour CETTE première page
  const extra = more.base === firstPath ? more : { ...NO_MORE, base: firstPath };

  const loadMore = async () => {
    const base = firstPath;
    const nextPage = extra.page + 1;
    setMore({ ...extra, loading: true, error: null });
    try {
      const data = await api.get(makePath(nextPage));
      // Le filtre a pu changer pendant la requête : on n'ajoute pas au mauvais classeur
      setMore((m) => (m.base !== base ? m : {
        base, items: [...m.items, ...data.items], page: nextPage, loading: false, error: null,
      }));
    } catch (error) {
      setMore((m) => (m.base !== base ? m : { ...m, loading: false, error }));
    }
  };

  return {
    items: first.data ? [...first.data.items, ...extra.items] : [],
    totalPages: first.data?.pagination?.totalPages ?? 1,
    page: extra.page,
    loading: first.loading || extra.loading,
    error: first.error, // la première page n'a pas pu être chargée
    moreError: extra.error, // « Voir plus » a échoué (la liste reste affichée)
    loadMore,
  };
}
