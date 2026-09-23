// ══════════════════════════════════════════════════════════
// Constructeur d'enquête admin — créer OU éditer
//
// Même principe que AdminPropositionForm.jsx (un seul composant
// pour les deux cas, selon la présence de :slug dans l'URL), mais
// avec un niveau d'imbrication en plus : ici, on édite un tableau
// de QUESTIONS, chacune pouvant elle-même contenir un tableau
// d'OPTIONS. Deux formulaires imbriqués dans un formulaire.
//
// Analogie : AdminPropositionForm, c'est remplir UNE fiche.
// Ce constructeur-ci, c'est composer un menu à plusieurs plats,
// où chaque plat peut lui-même avoir une liste d'accompagnements
// au choix — ajouter/retirer un plat ou un accompagnement ne doit
// jamais mélanger les autres.
// ══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import {
  STATUS_OPTIONS, AUDIENCE_OPTIONS, QUESTION_TYPE_OPTIONS, QUESTION_TYPE_META,
} from '../constants/surveyStatus.js';
import { QUARTIER_OPTIONS, TRAVAIL_QUARTIER_OPTIONS, TRAVAIL_TYPE_OPTIONS } from '../constants/situation.js';

// Menu "cette question met à jour...", et la liste de valeurs
// possibles pour CHAQUE option une fois un champ choisi — mêmes
// valeurs que côté validateur API (SYNC_VALID_VALUES), gardées ici en
// clair pour l'affichage plutôt qu'un enum brut.
const SYNC_FIELD_OPTIONS = [
  { value: 'situation', label: 'Situation (résidence)' },
  { value: 'quartier', label: 'Quartier de résidence' },
  { value: 'travailleQuartier', label: 'Quartier de travail' },
  { value: 'travailType', label: 'Type de travail' },
];
const SYNC_VALUE_OPTIONS = {
  situation: [
    { value: 'CENTRE_RESIDENT', label: 'Résident du centre' },
    { value: 'AUTRE_QUARTIER', label: 'Autre quartier de Senlis' },
    { value: 'HORS_SENLIS', label: 'Hors Senlis' },
  ],
  quartier: QUARTIER_OPTIONS,
  travailleQuartier: TRAVAIL_QUARTIER_OPTIONS,
  travailType: TRAVAIL_TYPE_OPTIONS,
};

// crypto.randomUUID() : une clé React STABLE pour chaque question/
// option, y compris celles pas encore enregistrées côté API (donc
// sans id de base de données). Sans clé stable, ajouter/retirer une
// question au milieu de la liste ferait perdre le texte déjà tapé
// dans les questions suivantes (React réutiliserait les inputs par
// position d'index plutôt que par identité).
function emptyOption() {
  return { key: crypto.randomUUID(), label: '', syncValue: null };
}

function emptyQuestion() {
  return {
    key: crypto.randomUUID(),
    label: '',
    helpText: '',
    type: 'CHOIX_UNIQUE',
    required: true,
    options: [emptyOption(), emptyOption()],
    // { optionKey } | null — optionKey seul suffit à retrouver la
    // question ET l'option visées (clés UUID globalement uniques) ;
    // référence par clé stable, jamais par position, pour survivre à
    // l'ajout/suppression d'une autre question ailleurs dans le
    // formulaire. Doit correspondre à une option d'une question
    // ANTÉRIEURE au moment de l'envoi (voir buildPayload).
    showIf: null,
    // 'VILLE_FR' | null — n'a de sens que pour une question
    // TEXTE_LIBRE (voir le rendu de QuestionEditor plus bas).
    uiHint: null,
    // 'situation' | 'quartier' | 'travailleQuartier' | 'travailType' | null
    // — n'a de sens que pour une question CHOIX_UNIQUE (voir le rendu
    // de QuestionEditor plus bas, et syncValue sur chaque option).
    syncsToProfile: null,
  };
}

const EMPTY_FORM = {
  title: '',
  description: '',
  audience: 'TOUS',
  status: 'DRAFT',
  opensAt: '',
  closesAt: '',
  questions: [emptyQuestion()],
};

export default function AdminSurveyForm() {
  const { slug } = useParams(); // undefined en mode création
  const isEdit = !!slug;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [surveyId, setSurveyId] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // ── En mode édition, charger l'enquête existante ─────────
  useEffect(() => {
    if (!isEdit) return;

    api.get(`/surveys/${slug}`)
      .then((data) => {
        const s = data.survey;
        setSurveyId(s.id);
        setForm({
          title: s.title,
          description: s.description,
          audience: s.audience,
          status: s.status,
          opensAt: s.opensAt ? s.opensAt.slice(0, 10) : '',
          closesAt: s.closesAt ? s.closesAt.slice(0, 10) : '',
          questions: s.questions.map((q) => ({
            // q.id existe déjà en base : on le réutilise tel quel comme
            // clé React, pas besoin d'en fabriquer une nouvelle.
            key: q.id,
            label: q.label,
            helpText: q.helpText || '',
            type: q.type,
            required: q.required,
            options: q.options.length
              ? q.options.map((o) => ({ key: o.id, label: o.label, syncValue: o.syncValue || null }))
              : [emptyOption(), emptyOption()],
            // showIfOptionId est un vrai id de base — comme les
            // options réutilisent justement leur id comme clé React
            // (juste au-dessus), la conversion est directe : pas
            // besoin de chercher à quelle question cette option
            // appartient, optionKey === showIfOptionId suffit.
            showIf: q.showIfOptionId ? { optionKey: q.showIfOptionId } : null,
            uiHint: q.uiHint || null,
            syncsToProfile: q.syncsToProfile || null,
          })),
        });
      })
      .catch((err) => setError(err.message || 'Impossible de charger cette enquête'))
      .finally(() => setLoading(false));
  }, [slug, isEdit]);

  // ── Champs "de l'enquête" (niveau racine) ────────────────
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
  };

  // ── Questions ─────────────────────────────────────────
  const updateQuestion = (questionKey, patch) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.key === questionKey ? { ...q, ...patch } : q)),
    }));
  };

  // showIf est { optionKey } | null — jamais { optionKey: '' }, sinon
  // buildPayload chercherait une option dont la clé est une chaîne
  // vide et ne la trouverait jamais.
  const setQuestionShowIf = (questionKey, optionKey) => {
    updateQuestion(questionKey, { showIf: optionKey ? { optionKey } : null });
  };

  const handleQuestionTypeChange = (questionKey, newType) => {
    const meta = QUESTION_TYPE_META[newType];
    setForm((prev) => {
      const target = prev.questions.find((q) => q.key === questionKey);
      const oldOptionKeys = new Set((target?.options || []).map((o) => o.key));

      return {
        ...prev,
        questions: prev.questions.map((q) => {
          if (q.key === questionKey) {
            return {
              ...q,
              type: newType,
              // En passant à un type qui a besoin d'options mais qui
              // n'en a pas encore assez (ex. venait de TEXTE_LIBRE),
              // on repart d'un couple d'options vides plutôt que de
              // forcer l'admin à en ajouter à la main — même logique
              // que côté API (défauts "Oui"/"Non" pour OUI_NON).
              options: (meta.needsOptions === true) ? [emptyOption(), emptyOption()] : [],
              // uiHint n'a de sens que pour TEXTE_LIBRE (voir le
              // validateur API) — en changer de type doit l'effacer,
              // sinon l'envoi serait rejeté.
              uiHint: newType === 'TEXTE_LIBRE' ? q.uiHint : null,
              // syncsToProfile n'a de sens que pour CHOIX_UNIQUE (voir
              // le validateur API) — en changer de type doit l'effacer,
              // sinon l'envoi serait rejeté.
              syncsToProfile: newType === 'CHOIX_UNIQUE' ? q.syncsToProfile : null,
            };
          }
          // Une AUTRE question pouvait dépendre d'une option qui
          // vient d'être remplacée par le changement de type ci-dessus.
          if (q.showIf && oldOptionKeys.has(q.showIf.optionKey)) {
            return { ...q, showIf: null };
          }
          return q;
        }),
      };
    });
  };

  const addQuestion = () => {
    setForm((prev) => ({ ...prev, questions: [...prev.questions, emptyQuestion()] }));
  };

  const removeQuestion = (questionKey) => {
    setForm((prev) => {
      const removed = prev.questions.find((q) => q.key === questionKey);
      const removedOptionKeys = new Set((removed?.options || []).map((o) => o.key));

      return {
        ...prev,
        questions: prev.questions
          .filter((q) => q.key !== questionKey)
          // Une AUTRE question pouvait dépendre d'une option de celle
          // qu'on retire — sans ce nettoyage, elle garderait une
          // référence à une option qui n'existe plus.
          .map((q) => (q.showIf && removedOptionKeys.has(q.showIf.optionKey)
            ? { ...q, showIf: null }
            : q)),
      };
    });
  };

  // ── Options (imbriquées dans une question) ───────────────
  // patch plutôt qu'un simple label : cette fonction sert maintenant
  // aussi à poser syncValue (voir le menu "Cette réponse correspond
  // à..." dans QuestionEditor), pas seulement le texte de l'option.
  const updateOption = (questionKey, optionKey, patch) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.key !== questionKey ? q : {
        ...q,
        options: q.options.map((o) => (o.key === optionKey ? { ...o, ...patch } : o)),
      })),
    }));
  };

  const addOption = (questionKey) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.key !== questionKey ? q : {
        ...q,
        options: [...q.options, emptyOption()],
      })),
    }));
  };

  const removeOption = (questionKey, optionKey) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions
        .map((q) => (q.key !== questionKey ? q : {
          ...q,
          options: q.options.filter((o) => o.key !== optionKey),
        }))
        // Même nettoyage que removeQuestion, mais pour une option
        // isolée plutôt que toute la question.
        .map((q) => (q.showIf?.optionKey === optionKey ? { ...q, showIf: null } : q)),
    }));
  };

  // ── Construction du payload envoyé à l'API ───────────────
  // C'est ici, et SEULEMENT ici, qu'on transforme l'état "confortable
  // pour l'UI" (avec les clés React, les options vides pas encore
  // remplies) en payload strict attendu par createSurveySchema/
  // updateSurveySchema côté API.
  function buildPayload() {
    // Même filtrage que celui appliqué plus bas à chaque question —
    // recalculé ici pour que la résolution de showIf (question
    // antérieure i, option à quel index) pointe vers le MÊME tableau
    // que celui réellement envoyé pour la question i, jamais le
    // tableau brut de l'UI (qui peut contenir une option vide au
    // milieu, pas encore remplie).
    const getFilledOptions = (q) => q.options
      .map((o) => ({ key: o.key, label: o.label.trim(), syncValue: o.syncValue }))
      .filter((o) => o.label !== '');

    return {
      title: form.title.trim(),
      description: form.description.trim(),
      audience: form.audience,
      status: form.status,
      opensAt: form.opensAt || undefined,
      closesAt: form.closesAt || undefined,
      questions: form.questions.map((q, questionIndex) => {
        const meta = QUESTION_TYPE_META[q.type];
        const filledOptions = getFilledOptions(q);

        const base = {
          label: q.label.trim(),
          helpText: q.helpText.trim() || undefined,
          type: q.type,
          required: q.required,
          uiHint: q.type === 'TEXTE_LIBRE' ? (q.uiHint || undefined) : undefined,
          syncsToProfile: q.type === 'CHOIX_UNIQUE' ? (q.syncsToProfile || undefined) : undefined,
        };

        // Résolution de la clé stable (optionKey) vers la POSITION
        // attendue par l'API (questionOrder/optionOrder) — les vrais
        // id n'existent pas encore pour une question tout juste créée
        // dans ce formulaire, donc l'API ne peut raisonner que par
        // position (voir resolveBranching côté contrôleur). On ne
        // cherche que parmi les questions ANTÉRIEURES : le nettoyage
        // fait par removeQuestion/removeOption/handleQuestionTypeChange
        // garantit déjà qu'une référence encore présente ici est valide.
        if (q.showIf) {
          for (let i = 0; i < questionIndex; i += 1) {
            const optionIndex = getFilledOptions(form.questions[i]).findIndex((o) => o.key === q.showIf.optionKey);
            if (optionIndex !== -1) {
              base.showIf = { questionOrder: i, optionOrder: optionIndex };
              break;
            }
          }
        }

        if (meta.needsOptions === true) {
          return { ...base, options: filledOptions.map(({ label, syncValue }) => ({ label, syncValue: syncValue || undefined })) };
        }

        if (meta.needsOptions === 'optional') {
          // OUI_NON : si l'admin a personnalisé les 2 libellés, on les
          // envoie ; sinon on omet complètement le champ pour laisser
          // l'API générer "Oui"/"Non" par défaut (voir toNestedQuestionsCreate
          // côté contrôleur) plutôt que d'envoyer un tableau à moitié rempli.
          return filledOptions.length === 2 ? { ...base, options: filledOptions.map(({ label, syncValue }) => ({ label, syncValue: syncValue || undefined })) } : base;
        }

        return base; // NOMBRE, TEXTE_LIBRE : jamais d'options
      }),
    };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = buildPayload();

      if (isEdit) {
        await api.patch(`/surveys/${surveyId}`, payload);
      } else {
        await api.post('/surveys', payload);
      }

      navigate('/admin/enquetes');
    } catch (err) {
      // Même convention que AdminPropositionForm : premier détail Zod
      // s'il y en a, sinon le message générique (ex. 409 SURVEY_HAS_RESPONSES).
      if (err.details) {
        setError(Object.values(err.details)[0]);
      } else {
        setError(err.message || 'Une erreur est survenue');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="wrap" style={{ padding: '60px 20px' }}>Chargement…</div>;
  }

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 720 }}>
      <Link to="/admin/enquetes" style={{ color: '#6B6257', fontSize: 14 }}>← Retour à la liste</Link>

      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 24px' }}>
        {isEdit ? "Modifier l'enquête" : 'Nouvelle enquête'}
      </h1>

      {error && (
        <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Titre">
          <input
            type="text" name="title" value={form.title} onChange={handleChange} required
            minLength={5} maxLength={200} style={inputStyle}
          />
        </Field>

        <Field label="Description">
          <textarea
            name="description" value={form.description} onChange={handleChange} required
            minLength={10} rows={4} style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <div style={{ display: 'flex', gap: 14 }}>
          <Field label="Public visé">
            <select name="audience" value={form.audience} onChange={handleChange} style={inputStyle}>
              {AUDIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Statut">
            <select name="status" value={form.status} onChange={handleChange} style={inputStyle}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          <Field label="Ouverture (optionnel)">
            <input
              type="date" name="opensAt" value={form.opensAt} onChange={handleChange}
              style={inputStyle}
            />
          </Field>
          <Field label="Clôture (optionnel)">
            <input
              type="date" name="closesAt" value={form.closesAt} onChange={handleChange}
              style={inputStyle}
            />
          </Field>
        </div>

        {/* ── Questions ─────────────────────────────────── */}
        <div style={{ marginTop: 10 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 12 }}>
            Questions
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {form.questions.map((question, index) => (
              <QuestionEditor
                key={question.key}
                question={question}
                index={index}
                canRemove={form.questions.length > 1}
                // Une question ne peut dépendre QUE d'une question qui
                // la précède (le répondant n'aurait pas encore répondu
                // à une question plus tardive) — aplati en une seule
                // liste "Q{n} : {libellé}" plutôt qu'un double menu en
                // cascade, plus simple à utiliser pour choisir parmi
                // une poignée d'options en tout et pour tout.
                priorOptions={form.questions.slice(0, index).flatMap((q, i) => q.options
                  .filter((o) => o.label.trim() !== '')
                  .map((o) => ({ key: o.key, label: `Q${i + 1} : ${o.label.trim()}` })))}
                onChange={(patch) => updateQuestion(question.key, patch)}
                onTypeChange={(newType) => handleQuestionTypeChange(question.key, newType)}
                onRemove={() => removeQuestion(question.key)}
                onShowIfChange={(optionKey) => setQuestionShowIf(question.key, optionKey)}
                onOptionChange={(optionKey, label) => updateOption(question.key, optionKey, { label })}
                onOptionSyncValueChange={(optionKey, syncValue) => updateOption(question.key, optionKey, { syncValue: syncValue || null })}
                onAddOption={() => addOption(question.key)}
                onRemoveOption={(optionKey) => removeOption(question.key, optionKey)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addQuestion}
            className="btn"
            style={{ background: '#EFEBE2', color: '#26333A', marginTop: 14, padding: '10px 18px', minHeight: 44 }}
          >
            + Ajouter une question
          </button>
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 10 }}>
          {saving ? 'Enregistrement…' : (isEdit ? 'Enregistrer les modifications' : "Créer l'enquête")}
        </button>
      </form>
    </div>
  );
}

// ── Une question, avec ses options si son type en a besoin ────
// Composant à part (plutôt qu'inline dans le .map ci-dessus) : la
// logique d'affichage conditionnel des options selon le type devient
// vite illisible mélangée avec le reste du formulaire parent.
function QuestionEditor({
  question, index, canRemove, priorOptions, onChange, onTypeChange, onRemove,
  onShowIfChange, onOptionChange, onOptionSyncValueChange, onAddOption, onRemoveOption,
}) {
  const meta = QUESTION_TYPE_META[question.type];
  const showOptions = meta.needsOptions === true || meta.needsOptions === 'optional';

  return (
    <div className="card-joyful" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: '#6B6257', fontSize: 13 }}>Question {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{ background: 'none', border: 'none', color: '#A8442F', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Retirer cette question
          </button>
        )}
      </div>

      <Field label="Intitulé">
        <input
          type="text" value={question.label} required minLength={5} maxLength={300}
          onChange={(e) => onChange({ label: e.target.value })}
          style={inputStyle}
        />
      </Field>

      <Field label="Aide (optionnel)">
        <input
          type="text" value={question.helpText} maxLength={300}
          onChange={(e) => onChange({ helpText: e.target.value })}
          style={inputStyle}
        />
      </Field>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
        <Field label="Type de réponse">
          <select
            value={question.type}
            onChange={(e) => onTypeChange(e.target.value)}
            style={inputStyle}
          >
            {QUESTION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#26333A', paddingBottom: 12 }}>
          <input
            type="checkbox" checked={question.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            style={{ width: 20, height: 20 }}
          />
          Obligatoire
        </label>
      </div>

      {question.type === 'TEXTE_LIBRE' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#26333A' }}>
          <input
            type="checkbox" checked={question.uiHint === 'VILLE_FR'}
            onChange={(e) => onChange({ uiHint: e.target.checked ? 'VILLE_FR' : null })}
            style={{ width: 20, height: 20 }}
          />
          Suggestions de ville (France) pendant la saisie
        </label>
      )}

      {question.type === 'CHOIX_UNIQUE' && (
        <Field label="Cette question met à jour...">
          <select
            value={question.syncsToProfile || ''}
            onChange={(e) => onChange({ syncsToProfile: e.target.value || null })}
            style={inputStyle}
          >
            <option value="">Rien (aucune synchronisation)</option>
            {SYNC_FIELD_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </Field>
      )}

      {priorOptions.length > 0 && (
        <Field label="Afficher cette question seulement si...">
          <select
            value={question.showIf?.optionKey || ''}
            onChange={(e) => onShowIfChange(e.target.value)}
            style={inputStyle}
          >
            <option value="">Toujours affichée</option>
            {priorOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </Field>
      )}

      {showOptions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#26333A' }}>
            Options
            {meta.needsOptions === 'optional' && (
              <span style={{ fontWeight: 400, color: '#6B6257' }}> — laissez vide pour "Oui"/"Non" par défaut</span>
            )}
          </span>

          {question.options.map((option) => (
            <div key={option.key} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text" value={option.label}
                placeholder={meta.needsOptions === 'optional' ? 'Oui' : ''}
                onChange={(e) => onOptionChange(option.key, e.target.value)}
                style={{ ...inputStyle, flex: 1, minHeight: 42, padding: '9px 12px' }}
              />
              {/* Quelle valeur EXACTE écrire dans le profil quand
                  cette option précise est choisie — ex. l'option
                  "Je réside dans le centre historique" correspond à
                  la valeur CENTRE_RESIDENT, pas au texte lui-même. */}
              {question.syncsToProfile && (
                <select
                  value={option.syncValue || ''}
                  onChange={(e) => onOptionSyncValueChange(option.key, e.target.value)}
                  style={{ ...inputStyle, flex: 1, minHeight: 42, padding: '9px 12px' }}
                >
                  <option value="">Ne correspond à rien</option>
                  {SYNC_VALUE_OPTIONS[question.syncsToProfile].map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              )}
              {/* CHOIX_UNIQUE/CHOIX_MULTIPLE : jamais moins de 2 options
                  (contrainte de l'API) — bouton masqué en dessous de 3. */}
              {meta.needsOptions === true && question.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => onRemoveOption(option.key)}
                  style={{ background: '#FCEAE6', color: '#A8442F', border: 'none', borderRadius: 10, padding: '0 14px', cursor: 'pointer', fontWeight: 600 }}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {meta.needsOptions === true && (
            <button
              type="button"
              onClick={onAddOption}
              style={{ background: 'none', border: 'none', color: '#1E5F7C', cursor: 'pointer', fontSize: 13, fontWeight: 600, alignSelf: 'flex-start', padding: '4px 0' }}
            >
              + Ajouter une option
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Petit composant local : un label + son champ ─────────
// Identique à celui d'AdminPropositionForm.jsx — dupliqué plutôt que
// partagé pour l'instant (2 formulaires seulement) ; si un 3ᵉ
// formulaire admin apparaît, ce sera le bon moment pour l'extraire
// dans components/.
function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, fontWeight: 600, fontSize: 14, color: '#26333A' }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  padding: '12px 14px',
  borderRadius: 12,
  border: '2px solid #e3dcce',
  fontSize: 15,
  fontFamily: 'inherit',
  minHeight: 48,
};
