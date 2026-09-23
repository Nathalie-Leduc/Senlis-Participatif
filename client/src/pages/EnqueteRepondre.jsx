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

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';
import Confetti from '../components/Confetti/Confetti.jsx';

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
const PROFILE_PREFILL_LABELS = {
  situation: 'Vous résidez :',
  quartier: 'Votre quartier :',
  travailleQuartier: 'Vous travaillez dans :',
  travailType: 'À ce titre, vous êtes :',
};

export default function EnqueteRepondre() {
  const { slug } = useParams();
  const { user } = useAuth();

  const [survey, setSurvey] = useState(null);
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
          if (!q.syncsToProfile) continue;
          const currentValue = user[q.syncsToProfile];
          if (!currentValue) continue;

          if (q.type === 'OUI_NON') {
            // Cas particulier : les options Oui/Non n'ont jamais de
            // syncValue (rien à leur associer), donc pas de
            // correspondance à chercher — un champ profil renseigné
            // veut dire "Oui" avec certitude. L'inverse serait faux :
            // un champ VIDE ne prouve pas "Non", seulement "jamais
            // demandé" (voir le commentaire sur cette question dans
            // seed-prod.js) — on ne préremplit donc JAMAIS le "Non".
            prefilled[q.id] = { optionId: q.options[0].id }; // "Oui" toujours en premier
            continue;
          }

          const matchingOption = q.options?.find((o) => o.syncValue === currentValue);
          if (matchingOption) prefilled[q.id] = { optionId: matchingOption.id };
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
  // question dont le déclencheur (showIfOptionId) n'a pas été choisi
  // n'apparaît simplement jamais dans le parcours — pas ignorée en
  // fin de course, absente dès le départ pour ce répondant précis.
  const visibleQuestions = survey.questions.filter((q) => {
    if (!q.showIfOptionId) return true;
    return Object.values(answers).some(
      (a) => a.optionId === q.showIfOptionId || a.optionIds?.includes(q.showIfOptionId),
    );
  });

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
  const canAdvance = !question.required || answered;
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
        <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ── La question courante ─────────────────────────── */}
      <div className="card-joyful" style={{ padding: 24, marginTop: 14 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, marginBottom: 6 }}>
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
          const currentProfileValue = question.syncsToProfile ? user[question.syncsToProfile] : null;
          // OUI_NON : ses options n'ont jamais de syncValue (rien à
          // leur associer) — un champ profil renseigné veut dire
          // "Oui" avec certitude, sans avoir besoin de chercher une
          // correspondance. Jamais l'inverse : un champ VIDE ne
          // prouve pas "Non" (voir le commentaire dans seed-prod.js).
          const prefilledOption = !currentProfileValue
            ? null
            : question.type === 'OUI_NON'
              ? question.options[0] // "Oui" toujours en premier
              : question.options?.find((o) => o.syncValue === currentProfileValue);

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
        >
          {submitting ? 'Envoi…' : (isLast ? 'Terminer' : 'Suivant →')}
        </button>
      </div>
    </div>
  );
}

// ── Le champ de saisie, selon le type de question ────────
// Un seul composant qui bascule sur question.type plutôt que 5
// fichiers séparés : chaque branche est courte, et voir les 5 types
// côte à côte aide à vérifier qu'aucun n'a été oublié.
function QuestionInput({ question, answer, onChange }) {
  switch (question.type) {
    case 'CHOIX_UNIQUE':
    case 'OUI_NON':
      return (
        <div role="radiogroup" aria-label={question.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
      const toggle = (optionId) => {
        const next = selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId];
        onChange({ optionIds: next });
      };
      return (
        <div role="group" aria-label={question.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {question.options.map((option) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id} type="button" aria-pressed={active}
                onClick={() => toggle(option.id)}
                style={optionButtonStyle(active)}
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
        <input
          type="number"
          value={answer?.valueNumber ?? ''}
          onChange={(e) => onChange({
            valueNumber: e.target.value === '' ? undefined : Number(e.target.value),
          })}
          style={fieldStyle}
        />
      );

    case 'TEXTE_LIBRE':
      if (question.uiHint === 'VILLE_FR') {
        return (
          <VilleAutocompleteInput
            value={answer?.valueText || ''}
            onChange={(valueText) => onChange({ valueText })}
          />
        );
      }
      return (
        <textarea
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
function VilleAutocompleteInput({ value, onChange }) {
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
