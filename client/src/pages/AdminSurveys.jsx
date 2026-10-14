// ══════════════════════════════════════════════════════════
// Page Admin — liste des enquêtes (tous statuts)
//
// Même structure que AdminPropositions.jsx — même principe de
// "cahier de cuisine" : on y voit aussi les brouillons, pas
// seulement les enquêtes déjà ouvertes.
//
// S5R2-11 : un compte Admin-test (EDITOR) voit la même liste ;
// « Modifier » et « Supprimer » n'apparaissent que sur les brouillons,
// « Résultats détaillés » et « Publier les résultats » jamais (réservés
// à l'administration — l'API répondrait 403). « Tester » est proposé
// sur TOUTES les lignes : le mode test n'enregistre rien (09/10).
//
// Recette du 13/10 :
//  - « Clôturer… » propose deux choix : MAINTENANT (arrêter ou annuler
//    l'enquête) ou À UNE DATE PRÉCISE (fin programmée : l'enquête reste
//    ouverte, puis se ferme d'elle-même le soir de ce jour) ;
//  - supprimer une enquête qui a des réponses : refusé en production
//    (on la clôture), possible en développement après avoir tapé
//    SUPPRIMER — pour nettoyer les enquêtes de test sans Prisma Studio.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { STATUS_META } from '../constants/surveyStatus.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import EditorBanner from '../components/EditorBanner/EditorBanner.jsx';
import { endOfDayIso, todayInput, isPast, formatDay } from '../utils/surveyDates.js';

// Le mot à taper pour supprimer une enquête AVEC ses réponses : un
// simple « OK » se clique par réflexe, un mot tapé, non.
const FORCE_DELETE_WORD = 'SUPPRIMER';

const FILTERS = [
  { value: undefined, label: 'Toutes' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'CLOSED', label: 'Clôturées' },
];

export default function AdminSurveys() {
  usePageTitle('Administration — Enquêtes');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Recette du 14/10 : l'erreur d'une action (clôturer, rouvrir,
  // supprimer…) s'affiche DANS la ligne de l'enquête concernée, là où
  // l'on vient de cliquer — en haut de la page, elle passait inaperçue.
  const [rowError, setRowErrorState] = useState(null); // { id, message }
  const setRowError = (id, message) => setRowErrorState(message ? { id, message } : null);
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  // Enquête dont le panneau « Clôturer… » est ouvert (une à la fois)
  const [closing, setClosing] = useState(null); // { id, mode: 'now' | 'date', day }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (status) params.set('status', status);
      const data = await api.get(`/surveys/admin?${params.toString()}`);
      setItems(data.items);
    } catch (err) {
      setError(err.message || 'Impossible de charger les enquêtes');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (survey) => {
    if (!window.confirm(`Supprimer définitivement « ${survey.title} » ?`)) return;
    setRowError(null);

    try {
      await api.delete(`/surveys/${survey.id}`);
      setItems((prev) => prev.filter((s) => s.id !== survey.id));
      showToast(`« ${survey.title} » a été supprimée`);
    } catch (err) {
      // 409 SURVEY_HAS_RESPONSES : l'enquête a déjà des réponses.
      // details.canForce n'est vrai qu'en développement, pour un ADMIN :
      // on propose alors de tout effacer, après une vraie confirmation.
      if (err.code === 'SURVEY_HAS_RESPONSES' && err.details?.canForce) {
        await forceDelete(survey, err.details.responses);
        return;
      }
      // Sinon (production…) : le message de l'API est déjà explicite
      setRowError(survey.id, err.message || 'La suppression a échoué');
    }
  };

  const forceDelete = async (survey, responses) => {
    const typed = window.prompt(
      `« ${survey.title} » a ${responses} réponse(s).\n\n`
      + 'En développement, vous pouvez la supprimer AVEC ses réponses (impossible en production).\n'
      + `Pour confirmer, tapez ${FORCE_DELETE_WORD} :`,
    );
    if (typed === null) return; // « Annuler »
    if (typed.trim().toUpperCase() !== FORCE_DELETE_WORD) {
      setRowError(survey.id, `Suppression annulée : il fallait taper ${FORCE_DELETE_WORD}.`);
      return;
    }
    try {
      await api.delete(`/surveys/${survey.id}?avecReponses=1`);
      setItems((prev) => prev.filter((s) => s.id !== survey.id));
      showToast(`« ${survey.title} » et ses ${responses} réponse(s) ont été supprimées`);
    } catch (err) {
      setRowError(survey.id, err.message || 'La suppression a échoué');
    }
  };

  // Distinct du statut ouvert/clos : une enquête peut être clôturée
  // sans que ses résultats soient déjà publics — l'admin choisit
  // séparément le moment où les rendre visibles à tous.
  // Recette du 13/10 : clôturer (ou rouvrir) sans ouvrir tout le
  // formulaire — on n'envoie que ce qui change, quelques octets.
  const patchSurvey = async (survey, changes, message) => {
    setRowError(null);
    try {
      const data = await api.patch(`/surveys/${survey.id}`, changes);
      setItems((prev) => prev.map((s) => (s.id === survey.id
        ? { ...s, status: data.survey.status, closesAt: data.survey.closesAt ?? null }
        : s)));
      showToast(message);
      return true;
    } catch (err) {
      setRowError(survey.id, err.message || 'La mise à jour a échoué');
      return false;
    }
  };

  // Le panneau « Clôturer… » : maintenant, ou à une date précise
  const openClosing = (survey) => setClosing({ id: survey.id, mode: 'now', day: '' });

  const confirmClosing = async (survey) => {
    if (closing.mode === 'now') {
      // Arrêt immédiat (fin anticipée ou annulation)
      if (await patchSurvey(survey, { status: 'CLOSED' }, `« ${survey.title} » est clôturée`)) setClosing(null);
      return;
    }
    // Fin programmée : l'enquête RESTE ouverte jusqu'au soir de ce jour
    if (!closing.day) {
      setRowError(survey.id, 'Choisissez la date de clôture.');
      return;
    }
    const closesAt = endOfDayIso(closing.day);
    if (await patchSurvey(survey, { closesAt }, `« ${survey.title} » se clôturera le ${formatDay(closesAt)}`)) setClosing(null);
  };

  const handleReopen = async (survey) => {
    if (!window.confirm(`Rouvrir « ${survey.title} » aux réponses ?`)) return;
    // Une date de clôture déjà passée la refermerait aussitôt : on l'efface
    const changes = isPast(survey.closesAt) ? { status: 'OPEN', closesAt: null } : { status: 'OPEN' };
    await patchSurvey(survey, changes, `« ${survey.title} » est rouverte`);
  };

  // Retirer une fin programmée (l'enquête reste ouverte, sans date)
  const cancelScheduledClosing = (survey) => patchSurvey(
    survey, { closesAt: null }, `« ${survey.title} » n'a plus de date de clôture`,
  );

  const handleToggleResults = async (survey) => {
    try {
      const data = await api.patch(`/surveys/${survey.id}`, { resultsPublished: !survey.resultsPublished });
      setItems((prev) => prev.map((s) => (s.id === survey.id ? { ...s, resultsPublished: data.survey.resultsPublished } : s)));
      showToast(data.survey.resultsPublished ? 'Résultats publiés' : 'Résultats dépubliés');
    } catch (err) {
      setRowError(survey.id, err.message || 'La mise à jour a échoué');
    }
  };

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28 }}>
          Administration — Enquêtes
        </h1>
        <Link to="/admin/enquetes/nouvelle" className="btn btn-primary">
          + Nouvelle enquête
        </Link>
      </div>

      <EditorBanner />

      {/* ── Filtres par statut ───────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setStatus(f.value)}
            aria-pressed={status === f.value}
            style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
              border: `2px solid ${status === f.value ? '#1E5F7C' : '#e3dcce'}`,
              background: status === f.value ? '#1E5F7C' : '#fff',
              color: status === f.value ? '#fff' : '#26333A',
              cursor: 'pointer', minHeight: 36,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B6257' }}>Chargement…</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#6B6257' }}>Aucune enquête pour ce filtre.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((s) => {
            const meta = STATUS_META[s.status];
            const canEdit = isAdmin || s.status === 'DRAFT';
            return (
              <div
                key={s.id}
                className="card-joyful"
                style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
              >
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  color: meta.color, background: meta.bg, whiteSpace: 'nowrap',
                }}>
                  {meta.label}
                </span>

                <span style={{ flex: 1, minWidth: 200 }}>
                  <span style={{ fontWeight: 600 }}>{s.title}</span>
                  {/* Recette du 13/10 : deux enquêtes au même titre se
                      distinguent par leur adresse et leur date */}
                  <span style={{ display: 'block', fontSize: 13, color: '#6B6257' }}>
                    /enquetes/{s.slug}
                    {s.createdAt && ` · créée le ${new Date(s.createdAt).toLocaleDateString('fr-FR')}`}
                  </span>
                  {/* Fin programmée (recette du 13/10) */}
                  {s.status === 'OPEN' && s.closesAt && (
                    <span style={{ display: 'block', fontSize: 13, color: '#8A5A00', fontWeight: 600 }}>
                      ⏳ Clôture programmée le {formatDay(s.closesAt)}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => cancelScheduledClosing(s)}
                          style={{ marginLeft: 8, background: 'none', border: 'none', padding: 0, color: '#1E5F7C', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}
                        >
                          retirer la date
                        </button>
                      )}
                    </span>
                  )}
                </span>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {/* S5R-12 : la page telle que les citoyens la voient */}
                  <Link
                    to={`/enquetes/${s.slug}`}
                    state={{ from: '/admin/enquetes', fromLabel: 'Administration — Enquêtes' }}
                    className="btn"
                    aria-label={`Voir « ${s.title} » comme les citoyens`}
                    style={{ background: '#fff', color: '#1E5F7C', border: '2px solid #E3EEF3', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
                  >
                    Voir
                  </Link>
                  {canEdit && (
                    <>
                      <Link
                        to={`/admin/enquetes/${s.slug}/modifier`}
                        className="btn"
                        style={{ background: '#EFEBE2', color: '#26333A', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
                      >
                        Modifier
                      </Link>
                    </>
                  )}
                  {/* S5R2-01/11 : le mode test, directement depuis la liste,
                      quel que soit le statut (rien n'est enregistré) */}
                  <Link
                    to={`/enquetes/${s.slug}/repondre`}
                    className="btn"
                    aria-label={`Tester « ${s.title} » (rien n'est enregistré)`}
                    style={{ background: '#FFF4D6', color: '#5C4510', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
                  >
                    🧪 Tester
                  </Link>
                  {isAdmin && (
                    <>
                      <Link
                        to={`/admin/enquetes/${s.id}/stats`}
                        className="btn"
                        style={{ background: '#E3EEF3', color: '#1E5F7C', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
                      >
                        Résultats détaillés
                      </Link>
                      <button
                        onClick={() => handleToggleResults(s)}
                        className="btn"
                        style={{
                          background: s.resultsPublished ? '#E0F2E5' : '#EFEBE2',
                          color: s.resultsPublished ? '#377349' : '#26333A',
                          padding: '8px 16px', minHeight: 40, fontSize: 14,
                        }}
                      >
                        {s.resultsPublished ? '✓ Résultats publiés' : 'Publier les résultats'}
                      </button>
                      {s.status === 'OPEN' && (
                        <button
                          onClick={() => (closing?.id === s.id ? setClosing(null) : openClosing(s))}
                          aria-expanded={closing?.id === s.id}
                          className="btn"
                          style={{ background: '#EFEBE2', color: '#26333A', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
                        >
                          Clôturer…
                        </button>
                      )}
                      {s.status === 'CLOSED' && (
                        <button
                          onClick={() => handleReopen(s)}
                          className="btn"
                          style={{ background: '#EFEBE2', color: '#26333A', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
                        >
                          Rouvrir
                        </button>
                      )}
                    </>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(s)}
                      className="btn"
                      style={{ background: '#FCEAE6', color: '#A8442F', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
                    >
                      Supprimer
                    </button>
                  )}
                </div>

                {rowError?.id === s.id && (
                  <div role="alert" style={{ flexBasis: '100%', background: '#FCEAE6', color: '#A8442F', padding: '10px 14px', borderRadius: 10, fontSize: 14 }}>
                    {rowError.message}
                  </div>
                )}

                {closing?.id === s.id && (
                  <ClosingPanel
                    survey={s}
                    closing={closing}
                    onChange={setClosing}
                    onConfirm={() => confirmClosing(s)}
                    onCancel={() => setClosing(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Panneau « Clôturer… » ───────────────────────────────────
// Deux situations bien différentes, d'où deux choix :
//  - « Maintenant » : on arrête tout de suite (fin anticipée, ou
//    annulation d'une enquête lancée par erreur) ;
//  - « À une date précise » : la fin normale, programmée à l'avance.
function ClosingPanel({ survey, closing, onChange, onConfirm, onCancel }) {
  const name = `closing-${survey.id}`;
  return (
    <fieldset
      style={{ flexBasis: '100%', border: '2px solid #E3EEF3', borderRadius: 12, padding: 14, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <legend style={{ fontWeight: 700, padding: '0 6px' }}>Clôturer « {survey.title} »</legend>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input
          type="radio" name={name} checked={closing.mode === 'now'}
          onChange={() => onChange({ ...closing, mode: 'now' })}
        />
        <span>
          <strong>Maintenant</strong> — arrêter ou annuler l&apos;enquête.
          <span style={{ display: 'block', fontSize: 13, color: '#6B6257' }}>Plus personne ne peut y répondre, dès maintenant.</span>
        </span>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input
          type="radio" name={name} checked={closing.mode === 'date'}
          onChange={() => onChange({ ...closing, mode: 'date' })}
        />
        <span>
          <strong>À une date précise</strong> — fin programmée.
          <span style={{ display: 'block', fontSize: 13, color: '#6B6257' }}>L&apos;enquête reste ouverte et se ferme d&apos;elle-même le soir de ce jour (23 h 59).</span>
        </span>
      </label>

      {closing.mode === 'date' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 600, fontSize: 14, marginLeft: 24, maxWidth: 220 }}>
          Date de clôture
          <input
            type="date" min={todayInput()} value={closing.day}
            onChange={(e) => onChange({ ...closing, day: e.target.value })}
            style={{ padding: '8px 10px', borderRadius: 8, border: '2px solid #e3dcce', fontSize: 14 }}
          />
        </label>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button" onClick={onConfirm} className="btn btn-primary"
          disabled={closing.mode === 'date' && !closing.day}
          style={{ padding: '8px 16px', minHeight: 40, fontSize: 14 }}
        >
          {closing.mode === 'now' ? 'Clôturer maintenant' : 'Programmer la clôture'}
        </button>
        <button
          type="button" onClick={onCancel} className="btn"
          style={{ background: '#fff', color: '#26333A', border: '2px solid #e3dcce', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
        >
          Annuler
        </button>
      </div>
    </fieldset>
  );
}
