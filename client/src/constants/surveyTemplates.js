// ══════════════════════════════════════════════════════════
// Modèles d'enquête prêts à l'emploi (S5R-09)
//
// Recette du 30/09 : « Qu'est-ce qui est prévu dans l'aide ? Des
// exemples ? Simplifier la création. » Partir d'un modèle, c'est
// partir d'un questionnaire qui FONCTIONNE déjà — conditions, fin
// anticipée, synchronisation avec le profil — puis l'adapter.
//
// Analogie : un patron de couture. On ne dessine pas la veste à partir
// de rien ; on part d'un patron éprouvé, et on ajuste les mesures.
//
// Format : celui du constructeur, mais les liens entre questions se font
// par des NOMS (`ref`) plutôt que par des clés techniques :
//   { ref: 'oui', label: 'Oui' }            ← une option nommée
//   { …, showIf: ['oui'] }                  ← affichée si « oui » choisie
//   { ref: 'nb', …, type: 'NOMBRE' }        ← une question nommée
//   { …, maxChoicesFrom: 'nb' }             ← cases limitées par « nb »
// instantiateQuestions() remplace ces noms par de vraies clés.
// ══════════════════════════════════════════════════════════

const MOBILITES = ['À pied', 'Vélo', 'Bus (TUS ou régional)', 'Voiture', 'Scooter ou moto', 'Autre'];

/**
 * Questions de profil, insérables en tête de n'importe quelle enquête.
 * Elles préremplissent les réponses depuis le profil, le mettent à jour,
 * et rendent possibles l'analyse par public (S5R-08) ou les parcours
 * par situation.
 */
export const PROFILE_QUESTIONS = [
  {
    label: 'Où résidez-vous ?', type: 'CHOIX_UNIQUE', syncsToProfile: 'situation',
    options: [
      { ref: 'p_centre', label: 'Le centre historique', syncValue: 'CENTRE_RESIDENT' },
      { ref: 'p_autre', label: 'Un autre quartier de Senlis', syncValue: 'AUTRE_QUARTIER' },
      { ref: 'p_hors', label: 'Une autre ville', syncValue: 'HORS_SENLIS' },
    ],
  },
  {
    label: 'Dans quel quartier ?', type: 'CHOIX_UNIQUE', syncsToProfile: 'quartier', showIf: ['p_autre'],
    options: [
      { label: 'Brichebay', syncValue: 'BRICHEBAY' },
      { label: 'Bon Secours', syncValue: 'BON_SECOURS' },
      { label: "Val d'Aunette - La Gâtelière", syncValue: 'VAL_AUNETTE_GATELIERE' },
      { label: 'Zone industrielle', syncValue: 'ZONE_INDUSTRIELLE' },
      { label: 'Villevert', syncValue: 'VILLEVERT' },
      { label: 'Jardiniers', syncValue: 'JARDINIERS' },
    ],
  },
  {
    label: 'Travaillez-vous ou dirigez-vous une activité à Senlis ?', type: 'OUI_NON', syncsToProfile: 'travailleASenlis',
    options: [{ ref: 'p_travaille', label: 'Oui' }, { label: 'Non' }],
  },
  {
    label: 'Dans quel quartier travaillez-vous ?', type: 'CHOIX_UNIQUE', syncsToProfile: 'travailleQuartier', showIf: ['p_travaille'],
    options: [
      { label: 'Centre historique', syncValue: 'CENTRE_HISTORIQUE' },
      { label: 'Brichebay', syncValue: 'BRICHEBAY' },
      { label: 'Bon Secours', syncValue: 'BON_SECOURS' },
      { label: "Val d'Aunette - La Gâtelière", syncValue: 'VAL_AUNETTE_GATELIERE' },
      { label: 'Zone industrielle', syncValue: 'ZONE_INDUSTRIELLE' },
      { label: 'Villevert', syncValue: 'VILLEVERT' },
      { label: 'Jardiniers', syncValue: 'JARDINIERS' },
    ],
  },
  {
    label: 'À ce titre…', type: 'CHOIX_UNIQUE', syncsToProfile: 'travailType', showIf: ['p_travaille'],
    options: [
      { label: 'Je dirige ou gère cette activité', syncValue: 'COMMERCANT' },
      { label: "J'y suis salarié·e", syncValue: 'SALARIE' },
    ],
  },
];

export const SURVEY_TEMPLATES = [
  {
    id: 'blank',
    name: 'Page blanche',
    summary: 'Une première question vide, à construire vous-même.',
    questions: [],
  },
  {
    id: 'avis-projet',
    name: 'Avis sur un projet',
    summary: 'Connaissance du projet, adhésion sur 4 niveaux, inquiétudes (si défavorable) et suggestions.',
    title: 'Votre avis sur le projet…',
    description: "La mairie envisage … Avant toute décision, votre avis compte : il faut environ 2 minutes pour répondre.",
    questions: [
      { label: 'Connaissiez-vous ce projet avant cette enquête ?', type: 'OUI_NON', options: [{ label: 'Oui' }, { label: 'Non' }] },
      {
        label: 'Êtes-vous favorable à ce projet ?', type: 'CHOIX_UNIQUE',
        options: [
          { label: 'Tout à fait favorable' },
          { label: 'Plutôt favorable' },
          { ref: 'plutot_contre', label: 'Plutôt défavorable' },
          { ref: 'contre', label: 'Tout à fait défavorable' },
        ],
      },
      {
        label: "Qu'est-ce qui vous inquiète ou vous gêne dans ce projet ?", type: 'TEXTE_LIBRE',
        // OU : posée à qui est « plutôt » OU « tout à fait » défavorable
        showIf: ['plutot_contre', 'contre'],
      },
      { label: 'Une suggestion pour améliorer ce projet ?', type: 'TEXTE_LIBRE', required: false },
    ],
  },
  {
    id: 'sondage-rapide',
    name: 'Sondage rapide',
    summary: 'Une question Oui / Non et un commentaire facultatif — 30 secondes pour répondre.',
    title: 'Êtes-vous pour … ?',
    description: 'Une seule question, 30 secondes pour répondre.',
    questions: [
      { label: 'Êtes-vous pour … ?', type: 'OUI_NON', options: [{ label: 'Oui' }, { label: 'Non' }] },
      { label: 'Un commentaire ?', type: 'TEXTE_LIBRE', required: false },
    ],
  },
  {
    id: 'deplacements',
    name: 'Habitudes de déplacement',
    summary: "Montre les réglages avancés : fin d'enquête sans véhicule, nombre minimum, cases limitées au nombre de véhicules.",
    title: 'Vos déplacements à Senlis',
    description: 'Comment vous déplacez-vous au quotidien ? Vos réponses aideront à mieux organiser la circulation et le stationnement.',
    questions: [
      {
        label: 'Le plus souvent, comment vous déplacez-vous dans Senlis ?', type: 'CHOIX_UNIQUE',
        options: MOBILITES.map((label) => ({ label })),
      },
      {
        label: 'Votre foyer possède-t-il un véhicule motorisé ?', type: 'OUI_NON',
        // « Non » termine l'enquête : les questions suivantes ne concernent
        // que les foyers motorisés (sauf la suggestion, déjà sautée)
        options: [{ ref: 'vehicule', label: 'Oui' }, { label: 'Non', endsSurvey: true }],
      },
      { ref: 'nb', label: 'Combien de véhicules ?', type: 'NOMBRE', minValue: '1', maxValue: '20', showIf: ['vehicule'] },
      {
        label: 'Où sont-ils garés ?', helpText: "Cochez tout ce qui s'applique — au plus une case par véhicule.",
        type: 'CHOIX_MULTIPLE', showIf: ['vehicule'], maxChoicesFrom: 'nb',
        options: [{ label: 'Garage ou place privée' }, { label: 'Dans la rue' }, { label: 'Parking public' }],
      },
      { label: 'Une suggestion ?', type: 'TEXTE_LIBRE', required: false },
    ],
  },
];

/**
 * Transforme des questions « avec noms » en questions du constructeur :
 * clés fraîches, et conditions / limites reliées aux bonnes clés.
 * Appelée à CHAQUE insertion : insérer deux fois le même modèle ne
 * crée jamais deux questions qui partagent la même clé.
 *
 * @param {object[]} templateQuestions
 * @param {() => object} emptyQuestion - fabrique de question vide du constructeur
 */
export function instantiateQuestions(templateQuestions, emptyQuestion) {
  const keyOfRef = new Map(); // nom → clé (options ET questions)
  const newKey = () => crypto.randomUUID();

  // 1er passage : toutes les clés existent avant qu'on les relie
  const drafts = templateQuestions.map((tq) => {
    const questionKey = newKey();
    if (tq.ref) keyOfRef.set(tq.ref, questionKey);
    const options = (tq.options ?? []).map((o) => {
      const key = newKey();
      if (o.ref) keyOfRef.set(o.ref, key);
      return { key, label: o.label, syncValue: o.syncValue ?? null, endsSurvey: Boolean(o.endsSurvey) };
    });
    return { tq, questionKey, options };
  });

  // 2e passage : conditions et limites
  return drafts.map(({ tq, questionKey, options }) => ({
    ...emptyQuestion(),
    key: questionKey,
    label: tq.label,
    helpText: tq.helpText ?? '',
    type: tq.type,
    required: tq.required ?? true,
    syncsToProfile: tq.syncsToProfile ?? null,
    minValue: tq.minValue ?? '',
    maxValue: tq.maxValue ?? '',
    options,
    conditions: (tq.showIf ?? []).map((ref) => keyOfRef.get(ref)).filter(Boolean),
    maxChoicesFromKey: tq.maxChoicesFrom ? keyOfRef.get(tq.maxChoicesFrom) ?? null : null,
  }));
}
