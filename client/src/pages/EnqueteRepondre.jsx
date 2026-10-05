// ══════════════════════════════════════════════════════════
// Parcours répondant — /enquetes/:slug/repondre
//
// Une question par écran plutôt qu'un long formulaire déroulant :
// plus facile sur mobile, et une seule décision à la fois plutôt
// qu'une page qui donne le vertige. La barre de progression en
// haut montre où on en est, comme sur un formulaire d'inscription
// en plusieurs étapes.
//
// L'accès est protégé par <ProtectedRoute> (voir App.jsx) — pas
// besoin de re-vérifier isLogged ici. Seule la vérification email
// (UC-02, même règle que le vote) est à la charge de cette page.
//
// Analogie : c'est un questionnaire papier qu'on remplirait une
// page à la fois plutôt que tout d'un bloc — on avance, on peut
// revenir en arrière, et rien n'est "posté" avant la toute
// dernière page (Terminer = un seul envoi groupé, jamais un envoi
// par question).
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';
import Confetti from '../components/Confetti/Confetti.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { visibleQuestionIds, chosenFromAnswers } from '../utils/surveyFlow.js';

// Une réponse est-elle "remplie" pour CETTE question ? Dépend du
// type — un CHOIX_MULTIPLE vide (aucune case cochée) n'est pas
// répondu, un NOMBRE à 0 l'est (0 est une vraie réponse, pas une
// absence de réponse).
function isAnswered(question, answer) {
  if (!answer) return false;
  switch (question.type) {
    case 'CHOIX_UNIQUE':
    case 'OUI_NON':
      return !!answer.optionId;
    case 'CHOIX_MULTIPLE':
      return !!answer.optionIds?.length;
    case 'NOMBRE':
      return typeof answer.valueNumber === 'number' && !Number.isNaN(answer.valueNumber);
    case 'TEXTE_LIBRE':
      return !!answer.valueText?.trim();
    default:
      return false;
  }
}

// Phrasé spécifique par champ profil — plus naturel qu'une formule
// générique unique ("D'après votre profil : ...") pour chacun de ces
// quatre champs bien identifiés.
/**
 * S5R-05 : message si un nombre sort des bornes fixées par
 * l'administratrice (null si tout va bien ou si rien n'est saisi).
 */
export function numberRangeError(question, answer) {
  const value = answer?.valueNumber;
  if (question.type !== 'NOMBRE' || typeof value !== 'number' || Number.isNaN(value)) return null;
  if (question.minValue !== null && question.minValue !== undefined && value < question.minValue) {
    return `La valeur doit être au moins ${question.minValue}.`;
  }
  if (question.maxValue !== null && question.maxValue !== undefined && value > question.maxValue) {
    return `La valeur doit être au plus ${question.maxValue}.`;
  }
  return null;
}

/**
 * Profil → option à présélectionner.
 *  - OUI_NON synchronisée avec travailleQuartier (ancien format) : un
 *    champ renseigné veut dire « Oui » ; un champ VIDE ne prouve pas
 *    « Non » (seulement « jamais demandé ») → on ne préremplit jamais
 *    « Non » dans ce cas ;
 *  - S5R-05 : « travaille à Senlis » est un vrai oui/non : true → « Oui »,
 *    false → « Non », null (jamais renseigné) → rien.
 */
export function prefilledOptionFor(question, user) {
  if (!question.syncsToProfile || !user) return null;
  const value = user[question.syncsToProfile];
  if (value === null || value === undefined || value === '') return null;
  if (question.syncsToProfile === 'travailleASenlis') {
    return question.options?.find((o) => o.syncValue === String(value)) ?? null;
  }
  if (question.type === 'OUI_NON') return question.options[0]; // « Oui » toujours en premier
  return question.options?.find((o) => o.syncValue === value) ?? null;
}

const PROFILE_PREFILL_LABELS = {
  travailleASenlis: 'Vous travaillez à Senlis :',
  situation: 'Vous résidez :',
  quartier: 'Votre quartier :',
  travailleQuartier: 'Vous travaillez dans :',
  travailType: 'À ce titre, vous êtes :',
};

export default function EnqueteRepondre() {
  const { slug } = useParams();
  const { user } = useAuth();

  const [survey, setSurvey] = useState(null);
  // Titre de l'onglet (RGAA 8.6) — provisoire pendant le chargement
  usePageTitle(survey ? `Répondre — ${survey.title}` : 'Répondre à l’enquête');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({}); // { [questionId]: {optionId|optionIds|valueNumber|valueText} }
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Une question pré-remplie depuis le profil s'affiche en lecture
  // seule (voir plus bas) — ce drapeau permet de basculer vers le
  // champ interactif normal si la personne clique sur "Modifier".
  // Remis à false à chaque question pour ne pas rester "ouvert" en
  // avançant dans le parcours.
  const [overrideCurrentQuestion, setOverrideCurrentQuestion] = useState(false);
  useEffect(() => setOverrideCurrentQuestion(false), [step]);

  // S5A-07 : passer à la question suivante ne change pas de page, mais
  // pour un lecteur d'écran, rien ne se passerait. On place donc le
  // focus sur l'intitulé de la nouvelle question, qui est lu aussitôt
  // (« Question 2 sur 5 » y est inclus). Pas au premier affichage :
  // là, c'est le changement de page qui s'en occupe (routeAnnouncer).
  const questionHeadingRef = useRef(null);
  const isFirstStepRender = useRef(true);
  useEffect(() => {
    if (isFirstStepRender.current) {
      isFirstStepRender.current = false;
      return;
    }
    questionHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    api.get(`/surveys/${slug}`)
      .then((data) => {
        // On vérifie ICI, pas seulement au moment du POST final :
        // pas la peine de laisser quelqu'un remplir 8 questions pour
        // découvrir à la fin qu'il avait déjà répondu, ou que
        // l'enquête vient de fermer.
        if (data.survey.status !== 'OPEN') {
          setError("Cette enquête n'est plus ouverte aux réponses.");
          return;
        }
        if (data.hasResponded) {
          setError('Vous avez déjà répondu à cette enquête.');
          return;
        }
        setSurvey(data.survey);

        // Pré-remplissage depuis le profil (S5-XX) : si cette
        // question synchronise un champ dont on connaît DÉJÀ la
        // valeur pour ce citoyen (ex. sa situation, déjà déclarée),
        // pas la peine de la lui redemander — voir le rendu en lecture
        // seule plus bas, qui reprend cette réponse pré-remplie sauf
        // si la personne clique sur "Modifier".
        const prefilled = {};
        for (const q of data.survey.questions) {
          const option = prefilledOptionFor(q, user);
          if (option) prefilled[q.id] = { optionId: option.id };
        }
        if (Object.keys(prefilled).length) setAnswers(prefilled);
      })
      .catch((err) => setError(err.message || 'Impossible de charger cette enquête'))
      .finally(() => setLoading(false));
  }, [slug, user]);

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  if (loading) {
    return <div className="wrap" style={{ padding: '60px 20px' }}>Chargement…</div>;
  }

  if (error) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: '#6B6257', fontSize: 16 }}>{error}</p>
        <Link to={`/enquetes/${slug}`} className="btn btn-primary" style={{ marginTop: 20 }}>
          Retour à l'enquête
        </Link>
      </div>
    );
  }

  // Même règle que pour le vote (UC-02) : un compte non vérifié ne
  // peut pas peser dans les résultats.
  if (!user.emailVerified) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ color: '#6B6257', fontSize: 16 }}>
          Vérifiez votre adresse email avant de répondre à une enquête — un lien vous a été envoyé à l'inscription.
        </p>
        <Link to={`/enquetes/${slug}`} className="btn" style={{ background: '#EFEBE2', color: '#26333A', marginTop: 20 }}>
          Retour à l'enquête
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <Confetti trigger={1} />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, marginBottom: 12 }}>
          Merci pour votre participation !
        </h1>
        <p style={{ color: '#6B6257', marginBottom: 24 }}>
          Votre réponse a bien été enregistrée.
        </p>
        <Link to={`/enquetes/${slug}/resultats`} className="btn btn-primary">
          Voir les résultats
        </Link>
      </div>
    );
  }

  // Recalculée à chaque rendu (donc à chaque réponse donnée) : une
  // question dont aucune condition n'est remplie n'apparaît jamais dans
  // le parcours — absente dès le départ pour ce répondant précis.
  // S5R-05 : le parcours de CETTE personne, recalculé à chaque réponse
  // (même moteur que l'API, voir utils/surveyFlow.js). Le total
  // « Question 3 sur N » ne compte donc que les questions qu'elle
  // verra réellement — plus le questionnaire complet, décourageant.
  const visibleIds = visibleQuestionIds(survey.questions, chosenFromAnswers(answers));
  const visibleQuestions = visibleIds.map((id) => survey.questions.find((q) => q.id === id));

  const question = visibleQuestions[step];
  if (!question) {
    // Cas limite improbable (ex. la dernière question visible vient
    // de disparaître suite à un retour en arrière) — on ramène
    // simplement au début plutôt que de planter sur .label undefined.
    return <div className="wrap" style={{ padding: '60px 20px' }}>Chargement…</div>;
  }
  const total = visibleQuestions.length;
  const answer = answers[question.id];
  const answered = isAnswered(question, answer);
  const rangeError = numberRangeError(question, answer);
  // Limite de cases (S5R-05) : la réponse donnée à la question « Nombre »
  // de référence, si elle a été donnée
  const maxChoices = question.maxChoicesFromId
    ? answers[question.maxChoicesFromId]?.valueNumber
    : undefined;
  // Cas d'un retour en arrière : on a coché 3 lieux, puis corrigé le
  // nombre de véhicules à 2 → il faut décocher avant de continuer
  // (sinon l'API refuserait la réponse à l'envoi)
  const tooManyChoices = typeof maxChoices === 'number' && (answer?.optionIds?.length ?? 0) > maxChoices;
  const canAdvance = (!question.required || answered) && !rangeError && !tooManyChoices;
  const isLast = step === total - 1;

  const handleNext = async () => {
    if (!canAdvance) return;

    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }

    // Dernière question : un SEUL envoi groupé pour tout le
    // bulletin — jamais un envoi par question au fil de l'eau.
    // On ne soumet que les questions RÉELLEMENT visibles pour ce
    // répondant — une question masquée par branchement ne doit
    // jamais apparaître dans l'envoi, même si une réponse traîne
    // encore en mémoire (ex. donnée puis rendue invisible en
    // revenant modifier une réponse antérieure).
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: visibleQuestions
          .map((q) => {
            const a = answers[q.id];
            if (!isAnswered(q, a)) return null;
            return { questionId: q.id, ...a };
          })
          .filter(Boolean),
      };
      await api.post(`/surveys/${survey.id}/responses`, payload);
      setDone(true);
    } catch (err) {
      setError(err.message || "La réponse n'a pas pu être enregistrée");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrevious = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 640 }}>
      <Link to={`/enquetes/${slug}`} style={{ color: '#6B6257', fontSize: 14 }}>
        ← Annuler et revenir à l'enquête
      </Link>

      {/* ── Barre de progression ─────────────────────────── */}
      <div style={{ margin: '20px 0 8px' }}>
        <div style={{ height: 8, borderRadius: 999, background: '#EFEBE2', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 999, background: '#1E5F7C',
            width: `${((step + 1) / total) * 100}%`,
            transition: 'width .3s ease',
          }}
          />
        </div>
        <p style={{ color: '#6B6257', fontSize: 13, fontWeight: 600, marginTop: 6 }}>
          Question {step + 1} sur {total}
        </p>
      </div>

      {error && (
        <div role="alert" style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ── La question courante ─────────────────────────── */}
      <div className="card-joyful" style={{ padding: 24, marginTop: 14 }}>
        {/* id : étiquette des champs de réponse (aria-labelledby) —
            sans elle, un champ texte ou nombre n'avait AUCUN nom pour
            un lecteur d'écran (RGAA 11.1). */}
        <h2
          id="question-label" ref={questionHeadingRef} tabIndex={-1}
          style={{ fontFamily: "'Fraunces', serif", fontSize: 22, marginBottom: 6 }}
        >
          <span className="sr-only">Question {step + 1} sur {total} : </span>
          {question.label}
          {!question.required && (
            <span style={{ fontWeight: 400, fontSize: 14, color: '#6B6257' }}> (optionnel)</span>
          )}
        </h2>
        {question.helpText && (
          <p style={{ color: '#6B6257', fontSize: 14, marginBottom: 16 }}>{question.helpText}</p>
        )}

        {(() => {
          // Pré-rempli depuis le profil : la valeur est déjà connue,
          // pas la peine de la redemander — affichée en lecture seule,
          // avec la possibilité de revenir au champ normal si elle ne
          // correspond plus (ex. déménagement récent, profil pas à
          // jour).
          const prefilledOption = prefilledOptionFor(question, user);

          if (prefilledOption && !overrideCurrentQuestion) {
            return (
              <div>
                <p style={{ fontSize: 17 }}>
                  {question.type === 'OUI_NON' ? (
                    <>{question.label} <strong>{prefilledOption.label}</strong></>
                  ) : (
                    <>{PROFILE_PREFILL_LABELS[question.syncsToProfile] || 'D\'après votre profil :'} <strong>{prefilledOption.label}</strong></>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setOverrideCurrentQuestion(true)}
                  style={{
                    background: 'none', border: 'none', padding: 0, marginTop: 8,
                    color: '#1E5F7C', fontSize: 14, textDecoration: 'underline', cursor: 'pointer',
                  }}
                >
                  Ce n&apos;est plus exact ? Modifier
                </button>
              </div>
            );
          }

          return (
            <QuestionInput
              question={question}
              answer={answer}
              onChange={(value) => setAnswer(question.id, value)}
              labelledBy="question-label"
              maxChoices={maxChoices}
              rangeError={rangeError}
            />
          );
        })()}
      </div>

      {/* ── Navigation ────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button
          type="button" onClick={handlePrevious} disabled={step === 0}
          className="btn"
          style={{ background: '#EFEBE2', color: '#26333A', opacity: step === 0 ? 0.5 : 1 }}
        >
          ← Précédent
        </button>
        <button
          type="button" onClick={handleNext} disabled={!canAdvance || submitting}
          className="btn btn-primary"
          aria-describedby={!canAdvance && !rangeError && !tooManyChoices ? 'required-hint' : undefined}
        >
          {submitting ? 'Envoi…' : (isLast ? 'Terminer' : 'Suivant →')}
        </button>
      </div>
      {/* Un bouton désactivé SANS explication laisse la personne
          cliquer dans le vide (RGAA 11.10) : on dit pourquoi. */}
      {!canAdvance && !rangeError && !tooManyChoices && (
        <p id="required-hint" style={{ color: '#6B6257', fontSize: 14, marginTop: 10, textAlign: 'right' }}>
          Une réponse est nécessaire pour continuer.
        </p>
      )}
    </div>
  );
}

// ── Le champ de saisie, selon le type de question ────────
// Un seul composant qui bascule sur question.type plutôt que 5
// fichiers séparés : chaque branche est courte, et voir les 5 types
// côte à côte aide à vérifier qu'aucun n'a été oublié.
function QuestionInput({ question, answer, onChange, labelledBy, maxChoices, rangeError }) {
  // Étiquette + caractère obligatoire, communs à tous les types de champ
  const a11y = { 'aria-labelledby': labelledBy, 'aria-required': question.required || undefined };
  switch (question.type) {
    case 'CHOIX_UNIQUE':
    case 'OUI_NON':
      return (
        <div role="radiogroup" {...a11y} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {question.options.map((option) => {
            const active = answer?.optionId === option.id;
            return (
              <button
                key={option.id} type="button" role="radio" aria-checked={active}
                onClick={() => onChange({ optionId: option.id })}
                style={optionButtonStyle(active)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );

    case 'CHOIX_MULTIPLE': {
      const selected = answer?.optionIds || [];
      // S5R-05 : limite = réponse à une question « Nombre » précédente
      // (ex. pas plus de lieux de stationnement que de véhicules)
      const hasLimit = typeof maxChoices === 'number';
      const limitReached = hasLimit && selected.length >= maxChoices;
      const toggle = (optionId) => {
        const next = selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId];
        onChange({ optionIds: next });
      };
      return (
        <div role="group" aria-labelledby={labelledBy} aria-describedby={hasLimit ? 'choices-limit' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hasLimit && (
            // aria-live : « 2 sur 2 » est annoncé quand la limite est atteinte
            <p id="choices-limit" aria-live="polite" style={{ fontSize: 14, color: '#6B6257', margin: 0 }}>
              {maxChoices <= 1
                ? `Une seule réponse possible (${selected.length} sur 1).`
                : `Jusqu'à ${maxChoices} réponses (${selected.length} sur ${maxChoices}).`}
            </p>
          )}
          {question.options.map((option) => {
            const active = selected.includes(option.id);
            // Une fois la limite atteinte, les cases NON cochées sont
            // désactivées ; on peut toujours décocher pour changer d'avis
            const blocked = limitReached && !active;
            return (
              <button
                key={option.id} type="button" aria-pressed={active}
                onClick={() => toggle(option.id)}
                disabled={blocked}
                style={{ ...optionButtonStyle(active), ...(blocked && { opacity: 0.45, cursor: 'not-allowed' }) }}
              >
                {active ? '☑ ' : '☐ '}{option.label}
              </button>
            );
          })}
        </div>
      );
    }

    case 'NOMBRE':
      return (
        <div>
          <input
            type="number"
            {...a11y}
            // Bornes S5R-05 : les flèches du champ les respectent, et la
            // saisie au clavier est vérifiée (message ci-dessous)
            min={question.minValue ?? undefined}
            max={question.maxValue ?? undefined}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? 'number-range-error' : undefined}
            value={answer?.valueNumber ?? ''}
            onChange={(e) => onChange({
              valueNumber: e.target.value === '' ? undefined : Number(e.target.value),
            })}
            style={fieldStyle}
          />
          <p id="number-range-error" aria-live="polite" style={{ color: '#A8442F', fontSize: 14, fontWeight: 600, margin: rangeError ? '6px 0 0' : 0 }}>
            {rangeError}
          </p>
        </div>
      );

    case 'TEXTE_LIBRE':
      if (question.uiHint === 'VILLE_FR') {
        return (
          <VilleAutocompleteInput
            value={answer?.valueText || ''}
            onChange={(valueText) => onChange({ valueText })}
            a11y={a11y}
          />
        );
      }
      return (
        <textarea
          {...a11y}
          value={answer?.valueText || ''}
          onChange={(e) => onChange({ valueText: e.target.value })}
          rows={4}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      );

    default:
      return null;
  }
}

// ── Suggestions de ville (France) — API officielle geo.api.gouv.fr ──
//
// Reste un simple TEXTE_LIBRE derrière le rideau : la valeur envoyée
// est du texte normal, jamais un id ou une structure particulière —
// si l'API est indisponible ou que la ville cherchée n'apparaît pas
// dans les suggestions, la personne peut toujours taper librement,
// rien ne bloque la saisie.
function VilleAutocompleteInput({ value, onChange, a11y }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Moins de 2 caractères : pas la peine d'interroger l'API pour
    // une lettre isolée, trop de résultats pour être utiles.
    if (value.trim().length < 2) {
      setSuggestions([]);
      return undefined;
    }

    // Anti-rebond : une seule requête une fois que la personne s'est
    // arrêtée de taper depuis 300ms, pas une par lettre tapée.
    const timeout = setTimeout(() => {
      fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(value.trim())}&boost=population&limit=8&fields=nom,codesPostaux`)
        .then((res) => (res.ok ? res.json() : []))
        .then(setSuggestions)
        .catch(() => setSuggestions([])); // API indisponible : la saisie libre reste toujours possible
    }, 300);

    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        {...a11y}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        // Délai avant de fermer : laisse le temps au clic sur une
        // suggestion d'être traité avant que la liste ne disparaisse.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Commencez à taper le nom de la ville..."
        style={fieldStyle}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          background: '#fff', border: '2px solid #e3dcce', borderRadius: 12,
          marginTop: 4, padding: 4, listStyle: 'none', maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,.1)',
        }}
        >
          {suggestions.map((commune) => (
            <li key={`${commune.nom}-${commune.codesPostaux?.[0] || ''}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(`${commune.nom} (${commune.codesPostaux?.[0] || ''})`);
                  setSuggestions([]);
                  setOpen(false);
                }}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none',
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15,
                }}
              >
                {commune.nom} <span style={{ color: '#6B6257', fontSize: 13 }}>{commune.codesPostaux?.[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function optionButtonStyle(active) {
  return {
    textAlign: 'left', padding: '14px 18px', borderRadius: 14, fontSize: 16, fontWeight: 600,
    border: `2px solid ${active ? '#1E5F7C' : '#e3dcce'}`,
    background: active ? '#E3EEF3' : '#fff',
    color: active ? '#1E5F7C' : '#26333A',
    cursor: 'pointer', minHeight: 48,
  };
}

const fieldStyle = {
  padding: '12px 14px', borderRadius: 12, border: '2px solid #e3dcce',
  fontSize: 15, fontFamily: 'inherit', minHeight: 48, width: '100%',
};
