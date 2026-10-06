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

import { useState, useEffect, useId, isValidElement, cloneElement } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import {
  STATUS_OPTIONS, QUESTION_TYPE_OPTIONS, QUESTION_TYPE_META,
} from '../constants/surveyStatus.js';
import { QUARTIER_OPTIONS, TRAVAIL_QUARTIER_OPTIONS, TRAVAIL_TYPE_OPTIONS } from '../constants/situation.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import AudiencePicker from '../components/AudiencePicker/AudiencePicker.jsx';
import { SURVEY_TEMPLATES, PROFILE_QUESTIONS, instantiateQuestions } from '../constants/surveyTemplates.js';
import { EMPTY_AUDIENCE } from '../utils/audience.js';

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
// Nom lisible de chaque champ du profil (S5R-09 v2 : message de
// confirmation) — « travaille à Senlis » ne se règle que sur une Oui/Non
const PROFILE_FIELD_NAMES = {
  situation: 'lieu de résidence',
  quartier: 'quartier de résidence',
  travailleQuartier: 'quartier de travail',
  travailType: 'rôle au travail',
  travailleASenlis: 'travaille à Senlis',
};

// Intitulé d'une question qui demande une ville (S5R-09 v4)
const CITY_KEYWORDS = /ville|commune|localité|habitez|résidez|venez/i;

// Mots qu'on s'attend à trouver dans l'intitulé d'une question reliée à
// tel champ du profil. Pas une interdiction : un simple garde-fou contre
// la case cochée par erreur sur une question sans rapport (recette du
// 03/10 : « Connaissiez-vous ce projet ? » reliée à « travaille à Senlis »).
const PROFILE_FIELD_KEYWORDS = {
  situation: /résid|habit|vivez|logez|domicile/i,
  quartier: /quartier/i,
  travailleQuartier: /travail|activité|emploi/i,
  travailType: /titre|dirig|gér|salari|rôle|statut/i,
  travailleASenlis: /travail|activité|emploi/i,
};

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
  // endsSurvey (S5R-05) : choisir cette option termine l'enquête
  return { key: crypto.randomUUID(), label: '', syncValue: null, endsSurvey: false };
}

/**
 * Les options « réelles » d'une question, telles qu'elles partiront vers
 * l'API (S5R-05). Une Oui/Non garde TOUJOURS ses 2 options, libellés par
 * défaut « Oui » / « Non » s'ils sont laissés vides : on peut ainsi s'y
 * référer dans une condition, ou cocher « Termine l'enquête » sur « Non »,
 * sans avoir à retaper les libellés. Les autres types ne gardent que les
 * options remplies.
 */
function effectiveOptions(q) {
  if (q.type === 'OUI_NON') {
    return q.options.slice(0, 2).map((o, i) => ({ ...o, label: o.label.trim() || (i === 0 ? 'Oui' : 'Non') }));
  }
  return q.options.map((o) => ({ ...o, label: o.label.trim() })).filter((o) => o.label !== '');
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
    // S5R-05 : clés des options qui font apparaître cette question —
    // il suffit que L'UNE soit choisie (OU). Tableau vide = toujours
    // affichée. Chaque clé doit appartenir à une question ANTÉRIEURE.
    conditions: [],
    // S5R-05 : bornes d'une réponse NOMBRE (texte du champ, '' = aucune)
    minValue: '',
    maxValue: '',
    // S5R-05 : CHOIX_MULTIPLE — clé de la question NOMBRE qui fixe le
    // nombre maximum de cases (null = pas de limite)
    maxChoicesFromKey: null,
    // 'VILLE_FR' | null — n'a de sens que pour une question
    // TEXTE_LIBRE (voir le rendu de QuestionEditor plus bas).
    uiHint: null,
    // 'situation' | 'quartier' | 'travailleQuartier' | 'travailType' | null
    // — n'a de sens que pour une question CHOIX_UNIQUE (voir le rendu
    // de QuestionEditor plus bas, et syncValue sur chaque option).
    syncsToProfile: null,
  };
}

/**
 * Positions où une question peut être DÉPLACÉE sans casser ses liens
 * (S5R-09 v3) : une question ne peut dépendre que de questions
 * ANTÉRIEURES (conditions d'affichage, limite de cases).
 *  - elle ne peut donc pas remonter AVANT une question dont elle dépend ;
 *  - ni descendre APRÈS une question qui dépend d'elle.
 * Analogie : dans une recette, on peut déplacer « ajouter le sel », mais
 * jamais avant « faire bouillir l'eau » s'il faut saler l'eau bouillante.
 *
 * @returns {{ min: number, max: number, after: number|null, before: number|null }}
 *   positions (index) permises, et les questions qui bornent le choix
 */
export function allowedPositions(questions, index) {
  const q = questions[index];
  const ownOptionKeys = new Set(q.options.map((o) => o.key));
  let after = null; // dernière question dont elle dépend
  let before = null; // première question qui dépend d'elle

  questions.forEach((other, i) => {
    if (i === index) return;
    const isSource = q.conditions.some((key) => other.options.some((o) => o.key === key))
      || q.maxChoicesFromKey === other.key;
    const isDependent = other.conditions.some((key) => ownOptionKeys.has(key))
      || other.maxChoicesFromKey === q.key;
    if (isSource) after = after === null ? i : Math.max(after, i);
    if (isDependent) before = before === null ? i : Math.min(before, i);
  });

  return {
    min: after === null ? 0 : after + 1,
    max: before === null ? questions.length - 1 : before - 1,
    after,
    before,
  };
}

const EMPTY_FORM = {
  title: '',
  description: '',
  // S5R-07 : critères de profil (vides = tout le monde)
  audience: EMPTY_AUDIENCE,
  status: 'DRAFT',
  opensAt: '',
  closesAt: '',
  questions: [emptyQuestion()],
};

export default function AdminSurveyForm() {
  const { slug } = useParams(); // undefined en mode création
  const isEdit = !!slug;
  // Titre de l'onglet (RGAA 8.6) — provisoire pendant le chargement
  usePageTitle(isEdit ? 'Modifier une enquête' : 'Nouvelle enquête');
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
          audience: { ...EMPTY_AUDIENCE, ...s.audience },
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
              ? q.options.map((o) => ({
                key: o.id, label: o.label, syncValue: o.syncValue || null, endsSurvey: Boolean(o.endsSurvey),
              }))
              : [emptyOption(), emptyOption()],
            // Les id d'options en base servent de clés React (ci-dessus) :
            // les conditions (id d'options) se reprennent donc telles quelles
            conditions: q.conditionOptionIds || [],
            minValue: q.minValue ?? '',
            maxValue: q.maxValue ?? '',
            maxChoicesFromKey: q.maxChoicesFromId || null,
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

  // conditions : tableau de clés d'options (S5R-05, plusieurs = OU)
  const setQuestionConditions = (questionKey, conditions) => {
    updateQuestion(questionKey, { conditions });
  };

  /**
   * Nettoyage commun (S5R-05) : retire des AUTRES questions toute
   * référence devenue invalide — conditions vers des options disparues,
   * limite de cases vers une question disparue ou qui n'est plus un nombre.
   */
  const withoutStaleReferences = (q, removedOptionKeys, lostNumberQuestionKey) => ({
    ...q,
    conditions: q.conditions.filter((key) => !removedOptionKeys.has(key)),
    maxChoicesFromKey: q.maxChoicesFromKey === lostNumberQuestionKey ? null : q.maxChoicesFromKey,
  });

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
              // OUI_NON garde aussi 2 lignes d'options (libellés « Oui » /
              // « Non » par défaut), pour pouvoir y poser « Termine
              // l'enquête » ou s'y référer dans une condition (S5R-05)
              options: (meta.needsOptions === true || newType === 'OUI_NON') ? [emptyOption(), emptyOption()] : [],
              // Réglages propres à un type (S5R-05) : effacés au changement
              minValue: newType === 'NOMBRE' ? q.minValue : '',
              maxValue: newType === 'NOMBRE' ? q.maxValue : '',
              maxChoicesFromKey: newType === 'CHOIX_MULTIPLE' ? q.maxChoicesFromKey : null,
              // uiHint n'a de sens que pour TEXTE_LIBRE (voir le
              // validateur API) — en changer de type doit l'effacer,
              // sinon l'envoi serait rejeté.
              uiHint: newType === 'TEXTE_LIBRE' ? q.uiHint : null,
              // syncsToProfile n'a de sens que pour CHOIX_UNIQUE (voir
              // le validateur API) — en changer de type doit l'effacer,
              // sinon l'envoi serait rejeté.
              syncsToProfile: newType === 'CHOIX_UNIQUE' && q.syncsToProfile !== 'travailleASenlis' ? q.syncsToProfile : null,
            };
          }
          // Une AUTRE question pouvait dépendre d'une option qui
          // vient d'être remplacée par le changement de type ci-dessus.
          // Elle pouvait aussi limiter ses cases sur cette question, si
          // celle-ci cesse d'être un nombre (S5R-05).
          return withoutStaleReferences(q, oldOptionKeys, newType === 'NOMBRE' ? null : questionKey);
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
          .map((q) => withoutStaleReferences(q, removedOptionKeys, questionKey)),
      };
    });
  };

  // ── S5R-09 : dupliquer une question ──────────────────────
  // La copie est insérée JUSTE APRÈS l'original, avec de nouvelles clés
  // (question et options) : les conditions des AUTRES questions, qui
  // visent les options de l'original, ne sont pas détournées vers la
  // copie. La copie garde ses propres conditions et sa limite de cases
  // (elles visent des questions antérieures, toujours antérieures).
  // Analogie : photocopier une fiche — la copie est neuve, l'original
  // reste celui que les autres fiches citent.
  const duplicateQuestion = (questionKey) => {
    setForm((prev) => {
      const index = prev.questions.findIndex((q) => q.key === questionKey);
      const original = prev.questions[index];
      const copy = {
        ...original,
        key: crypto.randomUUID(),
        label: `${original.label} (copie)`,
        options: original.options.map((o) => ({ ...o, key: crypto.randomUUID() })),
      };
      const questions = [...prev.questions];
      questions.splice(index + 1, 0, copy);
      return { ...prev, questions };
    });
  };

  // ── S5R-09 v3 : déplacer une question ───────────────────
  // (recette du 03/10 : « la copie arrive toujours en position 2, il
  // faut pouvoir la mettre en 3, 4… »). Seules les positions qui
  // respectent les dépendances sont proposées (allowedPositions).
  const moveQuestion = (questionKey, toIndex) => {
    setForm((prev) => {
      const from = prev.questions.findIndex((q) => q.key === questionKey);
      const { min, max } = allowedPositions(prev.questions, from);
      if (toIndex < min || toIndex > max || toIndex === from) return prev;
      const questions = [...prev.questions];
      const [moved] = questions.splice(from, 1);
      questions.splice(toIndex, 0, moved);
      return { ...prev, questions };
    });
  };

  // ── S5R-09 : partir d'un modèle ──────────────────────────
  // Modèle appliqué en dernier (retour du 03/10 : « on ne voit pas le
  // modèle choisi quand on clique dessus ») — sert à le mettre en valeur
  const [appliedTemplateId, setAppliedTemplateId] = useState(null);

  const applyTemplate = (template) => {
    const hasContent = form.questions.some((q) => q.label.trim());
    if (hasContent && !window.confirm('Remplacer les questions actuelles par celles du modèle ?')) return;
    setAppliedTemplateId(template.id);
    setForm((prev) => ({
      ...prev,
      // Le titre et la description du modèle ne remplacent qu'un champ VIDE
      title: prev.title.trim() ? prev.title : (template.title ?? ''),
      description: prev.description.trim() ? prev.description : (template.description ?? ''),
      questions: template.questions.length ? instantiateQuestions(template.questions, emptyQuestion) : [emptyQuestion()],
    }));
  };

  // ── S5R-09 : questions de profil, insérées EN TÊTE ───────
  // En tête, parce que les questions suivantes pourront ainsi dépendre
  // d'elles (une condition ne vise qu'une question antérieure).
  const hasProfileQuestions = form.questions.some((q) => q.syncsToProfile === 'situation');
  const insertProfileQuestions = () => {
    setForm((prev) => {
      // Une question vide laissée par défaut est remplacée, pas conservée
      const rest = prev.questions.filter((q) => q.label.trim() || prev.questions.length > 1);
      // fromProfileBlock : marque les questions insérées par CE bouton,
      // pour pouvoir annuler l'insertion d'un coup (jamais envoyé à l'API)
      const inserted = instantiateQuestions(PROFILE_QUESTIONS, emptyQuestion).map((q) => ({ ...q, fromProfileBlock: true }));
      return { ...prev, questions: [...inserted, ...rest] };
    });
  };

  // ── Annuler l'insertion (retour du 03/10) ────────────────
  // Retire d'un coup les questions ajoutées par « Insérer les questions
  // de profil », même si on les a modifiées depuis. Les conditions des
  // AUTRES questions qui en dépendaient sont nettoyées, comme lorsqu'on
  // retire une question une par une — et la confirmation le dit.
  const profileBlockKeys = form.questions.filter((q) => q.fromProfileBlock).map((q) => q.key);
  const removeProfileQuestions = () => {
    const blockKeys = new Set(profileBlockKeys);
    const blockOptionKeys = new Set(form.questions.filter((q) => blockKeys.has(q.key)).flatMap((q) => q.options.map((o) => o.key)));
    const dependents = form.questions.filter((q) => !blockKeys.has(q.key)
      && (q.conditions.some((key) => blockOptionKeys.has(key)) || blockKeys.has(q.maxChoicesFromKey)));
    const message = `Retirer les ${blockKeys.size} questions de profil ?`
      + (dependents.length
        ? ` ${dependents.length} autre${dependents.length > 1 ? 's questions en dépendent' : ' question en dépend'} : ${dependents.length > 1 ? 'leurs conditions' : 'sa condition'} sur ces questions ser${dependents.length > 1 ? 'ont' : 'a'} supprimée${dependents.length > 1 ? 's' : ''}.`
        : '');
    if (!window.confirm(message)) return;

    setForm((prev) => {
      let questions = prev.questions.filter((q) => !blockKeys.has(q.key));
      for (const key of blockKeys) questions = questions.map((q) => withoutStaleReferences(q, blockOptionKeys, key));
      // Jamais de formulaire sans aucune question
      return { ...prev, questions: questions.length ? questions : [emptyQuestion()] };
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
        .map((q) => withoutStaleReferences(q, new Set([optionKey]), null)),
    }));
  };

  // ── Construction du payload envoyé à l'API ───────────────
  // C'est ici, et SEULEMENT ici, qu'on transforme l'état "confortable
  // pour l'UI" (avec les clés React, les options vides pas encore
  // remplies) en payload strict attendu par createSurveySchema/
  // updateSurveySchema côté API.
  function buildPayload() {
    // Position (questionOrder, optionOrder) de chaque option, calculée
    // sur les options RÉELLEMENT envoyées (effectiveOptions) : l'API ne
    // connaît pas les clés de l'interface, seulement les positions.
    const positionOfOption = new Map();
    form.questions.forEach((q, questionOrder) => {
      effectiveOptions(q).forEach((o, optionOrder) => positionOfOption.set(o.key, { questionOrder, optionOrder }));
    });
    const orderOfQuestion = new Map(form.questions.map((q, i) => [q.key, i]));
    const toNumber = (text) => (text === '' || text === null || text === undefined ? undefined : Number(text));

    return {
      title: form.title.trim(),
      description: form.description.trim(),
      audience: form.audience,
      status: form.status,
      opensAt: form.opensAt || undefined,
      closesAt: form.closesAt || undefined,
      questions: form.questions.map((q, questionIndex) => {
        const meta = QUESTION_TYPE_META[q.type];
        const options = effectiveOptions(q);
        const syncsToProfile = (q.type === 'CHOIX_UNIQUE' || q.type === 'OUI_NON') ? (q.syncsToProfile || undefined) : undefined;

        const base = {
          label: q.label.trim(),
          helpText: q.helpText.trim() || undefined,
          type: q.type,
          required: q.required,
          uiHint: q.type === 'TEXTE_LIBRE' ? (q.uiHint || undefined) : undefined,
          syncsToProfile,
        };

        // Conditions (OU) : uniquement vers des questions ANTÉRIEURES
        // (le nettoyage des références garantit déjà leur validité)
        const showIfAny = q.conditions
          .map((key) => positionOfOption.get(key))
          .filter((pos) => pos && pos.questionOrder < questionIndex);
        if (showIfAny.length) base.showIfAny = showIfAny;

        if (q.type === 'NOMBRE') {
          base.minValue = toNumber(q.minValue);
          base.maxValue = toNumber(q.maxValue);
        }
        if (q.type === 'CHOIX_MULTIPLE' && q.maxChoicesFromKey) {
          const questionOrder = orderOfQuestion.get(q.maxChoicesFromKey);
          if (questionOrder !== undefined && questionOrder < questionIndex) base.maxChoicesFrom = { questionOrder };
        }

        // Garde-fou : une Oui/Non sans ses 2 lignes d'options (cas qui ne
        // devrait plus arriver) part sans options — l'API pose Oui/Non
        if (q.type === 'OUI_NON' && options.length !== 2) return base;

        if (meta.needsOptions === true || q.type === 'OUI_NON') {
          return {
            ...base,
            options: options.map((o, i) => ({
              label: o.label,
              // « Travaille à Senlis » : Oui → 'true', Non → 'false', posés
              // automatiquement (S5R-05) ; sinon la valeur choisie
              syncValue: syncsToProfile === 'travailleASenlis' ? (i === 0 ? 'true' : 'false') : (o.syncValue || undefined),
              endsSurvey: (q.type === 'CHOIX_UNIQUE' || q.type === 'OUI_NON') ? Boolean(o.endsSurvey) : undefined,
            })),
          };
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
        <div role="alert" style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Titre" hint="Court et concret. Ex. : « Stationnement dans le centre historique ».">
          <input
            type="text" name="title" value={form.title} onChange={handleChange} required
            minLength={5} maxLength={200} style={inputStyle}
          />
        </Field>

        <Field label="Description" hint="Pourquoi cette enquête, ce qu'on fera des réponses, et le temps qu'il faut pour répondre.">
          <textarea
            name="description" value={form.description} onChange={handleChange} required
            minLength={10} rows={4} style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <AudiencePicker value={form.audience} onChange={(audience) => setForm((f) => ({ ...f, audience }))} />

        <div style={{ display: 'flex', gap: 14 }}>
          <Field label="Statut" hint="Brouillon : invisible des citoyens · Ouverte : on peut répondre · Clôturée : plus de nouvelles réponses.">
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

          {/* S5R-09 : partir d'un modèle (création uniquement) */}
          {!isEdit && (
            <section aria-labelledby="templates-title" style={{ marginBottom: 16 }}>
              <h3 id="templates-title" style={{ fontSize: 15, marginBottom: 8 }}>Partir d'un modèle</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                {SURVEY_TEMPLATES.map((template) => {
                  const applied = appliedTemplateId === template.id;
                  return (
                    <button
                      key={template.id} type="button" onClick={() => applyTemplate(template)}
                      // aria-pressed : un lecteur d'écran annonce « bouton, enfoncé »
                      aria-pressed={applied}
                      style={{
                        textAlign: 'left', borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                        // Sans « inherit », un <button> prend la police du système
                        // (Ubuntu, Segoe…) au lieu de celle du site
                        fontFamily: 'inherit',
                        // Mis en valeur : bordure ET fond ET coche — jamais la couleur seule (RGAA 3.1)
                        background: applied ? '#E3EEF3' : '#fff',
                        border: applied ? '3px solid #1E5F7C' : '2px solid #e3dcce',
                      }}
                    >
                      <strong style={{ display: 'block', fontSize: 15, color: '#26333A' }}>
                        {applied && <span aria-hidden="true">✓ </span>}{template.name}
                      </strong>
                      <span style={{ fontSize: 13, color: '#6B6257' }}>{template.summary}</span>
                      {applied && (
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1E5F7C', marginTop: 6 }}>
                          Modèle appliqué : questions ci-dessous
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Annonce aux lecteurs d'écran : le contenu a changé plus bas */}
              <p role="status" className="sr-only">
                {appliedTemplateId && `Modèle « ${SURVEY_TEMPLATES.find((t) => t.id === appliedTemplateId)?.name} » appliqué : ${form.questions.length} question${form.questions.length > 1 ? 's' : ''} ci-dessous.`}
              </p>
            </section>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button
              type="button" onClick={insertProfileQuestions} disabled={hasProfileQuestions} className="btn"
              style={{ background: '#E3EEF3', color: '#1E5F7C', padding: '8px 16px', minHeight: 44 }}
            >
              + Insérer les questions de profil
            </button>
            {profileBlockKeys.length > 0 && (
              <button
                type="button" onClick={removeProfileQuestions} className="btn"
                style={{ background: '#FCEAE6', color: '#A8442F', padding: '8px 16px', minHeight: 44 }}
              >
                Retirer les questions de profil
              </button>
            )}
            <span style={{ fontSize: 13, color: '#6B6257' }}>
              {hasProfileQuestions
                ? 'Déjà présentes.'
                : 'Résidence, quartier et travail, en tête de l’enquête : préremplies depuis le profil, elles permettent d’analyser les résultats par public.'}
            </span>
          </div>

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
                priorOptions={form.questions.slice(0, index).flatMap((q, i) => effectiveOptions(q)
                  .map((o) => ({ key: o.key, label: `Q${i + 1} : ${o.label}` })))}
                // S5R-05 : questions « Nombre » antérieures, pour limiter
                // le nombre de cases d'une question à choix multiple
                priorNumberQuestions={form.questions.slice(0, index)
                  .map((q, i) => ({ key: q.key, label: `Q${i + 1} : ${q.label.trim() || '(sans intitulé)'}`, type: q.type }))
                  .filter((q) => q.type === 'NOMBRE')}
                onChange={(patch) => updateQuestion(question.key, patch)}
                onTypeChange={(newType) => handleQuestionTypeChange(question.key, newType)}
                onRemove={() => removeQuestion(question.key)}
                onDuplicate={() => duplicateQuestion(question.key)}
                total={form.questions.length}
                positions={allowedPositions(form.questions, index)}
                onMove={(toIndex) => moveQuestion(question.key, toIndex)}
                onConditionsChange={(conditions) => setQuestionConditions(question.key, conditions)}
                onOptionChange={(optionKey, label) => updateOption(question.key, optionKey, { label })}
                onOptionSyncValueChange={(optionKey, syncValue) => updateOption(question.key, optionKey, { syncValue: syncValue || null })}
                onOptionEndsSurveyChange={(optionKey, endsSurvey) => updateOption(question.key, optionKey, { endsSurvey })}
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
  question, index, canRemove, priorOptions, priorNumberQuestions, onChange, onTypeChange, onRemove, onDuplicate,
  total, positions, onMove,
  onConditionsChange, onOptionChange, onOptionSyncValueChange, onOptionEndsSurveyChange, onAddOption, onRemoveOption,
}) {
  const canEndSurvey = question.type === 'CHOIX_UNIQUE' || question.type === 'OUI_NON';
  const availableConditions = priorOptions.filter((opt) => !question.conditions.includes(opt.key));
  const labelOfOption = (key) => priorOptions.find((o) => o.key === key)?.label ?? key;
  const meta = QUESTION_TYPE_META[question.type];
  const showOptions = meta.needsOptions === true || meta.needsOptions === 'optional';

  return (
    <div className="card-joyful" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: '#6B6257', fontSize: 13 }}>Question {index + 1}</span>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* S5R-09 v3 : déplacer, uniquement vers une position permise */}
          {total > 1 && (
            <select
              value={index}
              onChange={(e) => onMove(Number(e.target.value))}
              aria-label={`Position de la question ${index + 1}`}
              aria-describedby={positions.min > 0 || positions.max < total - 1 ? `move-hint-${question.key}` : undefined}
              style={{ padding: '6px 10px', borderRadius: 10, border: '2px solid #e3dcce', fontSize: 13, minHeight: 44 }}
            >
              {Array.from({ length: total }, (_, i) => i)
                .filter((i) => i >= positions.min && i <= positions.max)
                .map((i) => (
                  <option key={i} value={i}>{i === index ? `Position ${i + 1}` : `Déplacer en ${i + 1}`}</option>
                ))}
            </select>
          )}
          {/* S5R-09 : ex. « véhicules du foyer » → « véhicules professionnels » */}
          <button
            type="button" onClick={onDuplicate}
            aria-label={`Dupliquer la question ${index + 1}`}
            style={{ background: 'none', border: 'none', color: '#1E5F7C', cursor: 'pointer', fontSize: 13, fontWeight: 600, minHeight: 44 }}
          >
            Dupliquer
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              style={{ background: 'none', border: 'none', color: '#A8442F', cursor: 'pointer', fontSize: 13, fontWeight: 600, minHeight: 44 }}
            >
              Retirer cette question
            </button>
          )}
        </div>
      </div>

      {(positions && (positions.after !== null || positions.before !== null)) && (
        <p id={`move-hint-${question.key}`} style={{ fontSize: 12, color: '#6B6257', margin: '-6px 0 0' }}>
          Déplacement limité :
          {positions.after !== null && ` elle dépend de la question ${positions.after + 1} et doit rester après elle.`}
          {positions.before !== null && ` La question ${positions.before + 1} dépend d'elle : elle doit rester avant.`}
        </p>
      )}

      <Field label="Intitulé" hint="Une question claire, une seule idée. Ex. : « Combien de véhicules compte votre foyer ? »">
        <input
          type="text" value={question.label} required minLength={5} maxLength={300}
          onChange={(e) => onChange({ label: e.target.value })}
          style={inputStyle}
        />
      </Field>

      <Field label="Aide (optionnel)" hint="Affichée en petit sous la question. Ex. : « Cochez tout ce qui s'applique. »">
        <input
          type="text" value={question.helpText} maxLength={300}
          onChange={(e) => onChange({ helpText: e.target.value })}
          style={inputStyle}
        />
      </Field>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
        <Field label="Type de réponse" hint={TYPE_HELP[question.type]}>
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

      {/* ── Suggestions de villes — réglage AVANCÉ (S5R-09 v4) ──
          Même défaut que le lien avec le profil (recette du 03/10) : la
          case s'affichait sur TOUTES les questions en texte libre (« Qu'est-
          ce qui vous inquiète ? »…). Repliée par défaut, ouverte si déjà
          active, avec un avertissement si l'intitulé ne parle pas d'une ville. */}
      {question.type === 'TEXTE_LIBRE' && (
        <details open={question.uiHint === 'VILLE_FR'} style={{ border: '2px solid #EFEBE2', borderRadius: 12, padding: '10px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#26333A' }}>
            Réglage avancé : proposer des noms de villes pendant la saisie
            {question.uiHint === 'VILLE_FR' && <span style={{ color: '#377349' }}> — activé</span>}
          </summary>
          <p style={{ fontSize: 13, color: '#6B6257', margin: '8px 0' }}>
            Seulement pour une question qui demande <strong>une ville</strong> (ex. « Dans quelle ville résidez-vous ? ») :
            la personne voit des propositions de communes françaises en tapant.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#26333A' }}>
            <input
              type="checkbox" checked={question.uiHint === 'VILLE_FR'}
              onChange={(e) => onChange({ uiHint: e.target.checked ? 'VILLE_FR' : null })}
              style={{ width: 20, height: 20 }}
            />
            Proposer des villes françaises
          </label>
          {question.uiHint === 'VILLE_FR' && question.label.trim() && !CITY_KEYWORDS.test(question.label) && (
            <p role="alert" style={{ fontSize: 13, color: '#A8442F', fontWeight: 600, margin: '6px 0 0' }}>
              ⚠ L'intitulé ne semble pas demander une ville : les répondants verraient des noms de communes
              proposés pendant qu'ils écrivent leur réponse.
            </p>
          )}
        </details>
      )}

      {/* ── Relier la réponse au profil — réglage AVANCÉ (S5R-09 v2) ──
          Recette du 03/10 : la case « met à jour travaille à Senlis »
          apparaissait sur TOUTES les questions Oui/Non (« Connaissiez-
          vous ce projet ? »…), sans rapport, et cocher ne produisait
          aucun retour. Ce réglage est maintenant replié par défaut,
          expliqué, confirmé par un message, et signalé s'il ne semble
          pas correspondre à l'intitulé. Il reste ouvert pour une question
          déjà reliée, pour qu'on voie toujours ce qui est actif. */}
      {(question.type === 'OUI_NON' || question.type === 'CHOIX_UNIQUE') && (
        <details open={Boolean(question.syncsToProfile)} style={{ border: '2px solid #EFEBE2', borderRadius: 12, padding: '10px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#26333A' }}>
            Réglage avancé : relier la réponse au profil du répondant
            {question.syncsToProfile && <span style={{ color: '#377349' }}> — activé</span>}
          </summary>
          <p style={{ fontSize: 13, color: '#6B6257', margin: '8px 0' }}>
            À n'utiliser que si la question demande <strong>exactement</strong> une information du profil
            (lieu de résidence, quartier, travail à Senlis…). Le plus simple reste le bouton
            « Insérer les questions de profil », déjà réglé.
          </p>

          {question.type === 'OUI_NON' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#26333A' }}>
              <input
                type="checkbox" checked={question.syncsToProfile === 'travailleASenlis'}
                onChange={(e) => onChange({ syncsToProfile: e.target.checked ? 'travailleASenlis' : null })}
                style={{ width: 20, height: 20 }}
              />
              « Oui » / « Non » = la personne travaille, ou non, à Senlis
            </label>
          )}

          {question.type === 'CHOIX_UNIQUE' && (
            <Field label="La réponse correspond à…">
              <select
                value={question.syncsToProfile || ''}
                onChange={(e) => onChange({ syncsToProfile: e.target.value || null })}
                style={inputStyle}
              >
                <option value="">Rien (aucun lien avec le profil)</option>
                {SYNC_FIELD_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </Field>
          )}

          {question.syncsToProfile && (
            <>
              {/* Retour immédiat : rien ne se passe à l'enregistrement de
                  l'enquête — c'est chaque RÉPONSE qui mettra le profil à jour */}
              <p role="status" style={{ fontSize: 13, color: '#377349', margin: '8px 0 0' }}>
                ✔ Quand une personne répondra, sa réponse sera préremplie depuis son profil, puis mettra
                à jour son « {PROFILE_FIELD_NAMES[question.syncsToProfile]} ». Rien ne change au moment
                d'enregistrer l'enquête.
              </p>
              {question.label.trim() && !PROFILE_FIELD_KEYWORDS[question.syncsToProfile]?.test(question.label) && (
                <p role="alert" style={{ fontSize: 13, color: '#A8442F', fontWeight: 600, margin: '6px 0 0' }}>
                  ⚠ L'intitulé ne semble pas parler de « {PROFILE_FIELD_NAMES[question.syncsToProfile]} » :
                  vérifiez que ce lien est voulu — sinon, chaque réponse modifierait le profil à tort.
                </p>
              )}
            </>
          )}
        </details>
      )}

      {/* ── Conditions d'affichage (S5R-05 : plusieurs = OU) ── */}
      {priorOptions.length > 0 && (
        <fieldset style={{ border: '2px solid #EFEBE2', borderRadius: 12, padding: '10px 14px', margin: 0 }}>
          <legend style={{ fontSize: 14, fontWeight: 600, color: '#26333A', padding: '0 6px' }}>
            Afficher cette question seulement si… <span style={{ fontWeight: 400, color: '#6B6257' }}>(une seule condition remplie suffit)</span>
          </legend>
          {question.conditions.length === 0 && (
            <p style={{ fontSize: 14, color: '#6B6257', margin: '4px 0 8px' }}>Toujours affichée.</p>
          )}
          {question.conditions.map((key) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
              <span style={{ flex: 1, fontSize: 14 }}>{labelOfOption(key)}</span>
              <button
                type="button"
                onClick={() => onConditionsChange(question.conditions.filter((k) => k !== key))}
                aria-label={`Retirer la condition ${labelOfOption(key)}`}
                style={{ background: '#FCEAE6', color: '#A8442F', border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}
              >
                Retirer
              </button>
            </div>
          ))}
          {availableConditions.length > 0 && (
            <select
              value=""
              aria-label="Ajouter une condition"
              onChange={(e) => e.target.value && onConditionsChange([...question.conditions, e.target.value])}
              style={{ ...inputStyle, width: '100%', marginTop: 6 }}
            >
              <option value="">{question.conditions.length ? '+ Ajouter une autre condition (OU)…' : '+ Ajouter une condition…'}</option>
              {availableConditions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          )}
        </fieldset>
      )}

      {/* ── Bornes d'un nombre (S5R-05) ── */}
      {question.type === 'NOMBRE' && (
        <div style={{ display: 'flex', gap: 14 }}>
          <Field label="Valeur minimum (optionnel)">
            <input type="number" value={question.minValue} onChange={(e) => onChange({ minValue: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Valeur maximum (optionnel)">
            <input type="number" value={question.maxValue} onChange={(e) => onChange({ maxValue: e.target.value })} style={inputStyle} />
          </Field>
        </div>
      )}

      {/* ── Nombre maximum de cases (S5R-05) ── */}
      {question.type === 'CHOIX_MULTIPLE' && priorNumberQuestions.length > 0 && (
        <Field label="Nombre maximum de cases cochées">
          <select
            value={question.maxChoicesFromKey || ''}
            onChange={(e) => onChange({ maxChoicesFromKey: e.target.value || null })}
            style={inputStyle}
          >
            <option value="">Pas de limite</option>
            {priorNumberQuestions.map((q) => (
              <option key={q.key} value={q.key}>La réponse à {q.label}</option>
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
                placeholder={meta.needsOptions === 'optional' ? (question.options.indexOf(option) === 0 ? 'Oui' : 'Non') : ''}
                onChange={(e) => onOptionChange(option.key, e.target.value)}
                style={{ ...inputStyle, flex: 1, minHeight: 42, padding: '9px 12px' }}
              />
              {/* Quelle valeur EXACTE écrire dans le profil quand
                  cette option précise est choisie — ex. l'option
                  "Je réside dans le centre historique" correspond à
                  la valeur CENTRE_RESIDENT, pas au texte lui-même. */}
              {question.syncsToProfile && question.type === 'CHOIX_UNIQUE' && (
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
              {/* S5R-05 : « Termine l'enquête » — ex. « Aucun véhicule » */}
              {canEndSurvey && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox" checked={Boolean(option.endsSurvey)}
                    onChange={(e) => onOptionEndsSurveyChange(option.key, e.target.checked)}
                  />
                  Termine l'enquête
                </label>
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
// S5R-09 : `hint` = une aide sous le champ, reliée à lui par
// aria-describedby (un lecteur d'écran la lit avec le libellé). Placée
// HORS du <label> : sinon elle s'ajouterait au NOM du champ.
function Field({ label, hint, children }) {
  const hintId = useId();
  const field = hint && isValidElement(children) ? cloneElement(children, { 'aria-describedby': hintId }) : children;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 600, fontSize: 14, color: '#26333A' }}>
        {label}
        {field}
      </label>
      {hint && <span id={hintId} style={{ fontSize: 13, color: '#6B6257' }}>{hint}</span>}
    </div>
  );
}

// S5R-09 : ce que chaque type de réponse permet, en une phrase
const TYPE_HELP = {
  CHOIX_UNIQUE: 'Une seule réponse parmi une liste. Peut terminer l’enquête, ou faire apparaître d’autres questions.',
  CHOIX_MULTIPLE: 'Plusieurs réponses possibles. Le nombre de cases peut être limité par une question « Nombre » précédente.',
  OUI_NON: 'Deux réponses, libellés modifiables. « Non » (ou « Oui ») peut terminer l’enquête.',
  NOMBRE: 'Un nombre, avec un minimum et un maximum si besoin. Résultats : moyenne, minimum, maximum.',
  TEXTE_LIBRE: 'Une réponse rédigée. Lue par l’administration, jamais publiée ni exportée.',
};

const inputStyle = {
  padding: '12px 14px',
  borderRadius: 12,
  border: '2px solid #e3dcce',
  fontSize: 15,
  fontFamily: 'inherit',
  minHeight: 48,
};
