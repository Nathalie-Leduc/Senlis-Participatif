// ══════════════════════════════════════════════════════════
// Construction d'une enquête en base (S5R-05)
//
// Avant, la même logique (« transformer la liste de questions reçue en
// lignes Prisma, puis brancher les conditions ») existait en DEUX
// exemplaires : dans surveysController.js et dans prisma/seed-prod.js.
// Deux copies finissent toujours par diverger. Elle vit maintenant ici,
// et les deux l'utilisent.
//
// Format d'entrée = celui de l'API (validé par Zod, voir
// validators/surveys.js). Les références entre questions se font par
// POSITION (questionOrder / optionOrder), car au moment de l'envoi les
// questions n'ont pas encore d'id :
//   showIf: { questionOrder: 0, optionOrder: 1 }          (une condition)
//   showIfAny: [{ questionOrder: 0, optionOrder: 1 }, …]  (plusieurs, OU)
//   maxChoicesFrom: { questionOrder: 2 }                  (limite de cases)
//
// Analogie : un plan de montage de meuble. Les pièces sont désignées
// par leur numéro sur le plan (« vis B dans le trou 3 ») ; on ne peut
// les relier qu'une fois toutes sorties du carton.
// ══════════════════════════════════════════════════════════

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'VALIDATION_ERROR';
  return error;
}

/** Les conditions d'une question, quel que soit le format reçu. */
export function conditionsOf(question) {
  return [...(question.showIfAny ?? []), ...(question.showIf ? [question.showIf] : [])];
}

/**
 * Options d'une question. Une OUI_NON sans options explicites reçoit
 * « Oui » / « Non » ; si elle alimente le champ « travaille à Senlis »
 * du profil, ces options portent aussi la valeur à écrire.
 */
function optionsOf(question) {
  if (question.options) return question.options;
  if (question.type !== 'OUI_NON') return undefined;
  if (question.syncsToProfile === 'travailleASenlis') {
    return [{ label: 'Oui', syncValue: 'true' }, { label: 'Non', syncValue: 'false' }];
  }
  return [{ label: 'Oui' }, { label: 'Non' }];
}

/**
 * Liste de questions (format API) → « nested create » Prisma.
 * order = index dans le tableau, jamais une valeur envoyée par le client.
 */
export function toNestedQuestionsCreate(questions) {
  return questions.map((q, index) => {
    const options = optionsOf(q);
    return {
      label: q.label,
      helpText: q.helpText,
      type: q.type,
      required: q.required ?? true,
      order: index,
      uiHint: q.uiHint,
      syncsToProfile: q.syncsToProfile,
      minValue: q.minValue,
      maxValue: q.maxValue,
      options: options
        ? {
          create: options.map((o, optionIndex) => ({
            label: o.label,
            order: optionIndex,
            syncValue: o.syncValue,
            endsSurvey: o.endsSurvey ?? false,
          })),
        }
        : undefined,
    };
  });
}

/**
 * Second passage, une fois les questions créées (et leurs id connus) :
 * pose les conditions d'affichage et les limites de cases.
 *
 * @param {object} tx - client Prisma de la transaction en cours
 * @param {string} surveyId
 * @param {object[]} inputQuestions - la liste reçue (format API)
 */
export async function resolveReferences(tx, surveyId, inputQuestions) {
  const needsWork = inputQuestions.some((q) => conditionsOf(q).length || q.maxChoicesFrom);
  if (!needsWork) return;

  const created = await tx.question.findMany({
    where: { surveyId },
    include: { options: true },
    orderBy: { order: 'asc' },
  });

  const conditionRows = [];

  for (const [index, input] of inputQuestions.entries()) {
    const thisQuestion = created[index];

    // ── Conditions d'affichage (OU) ──
    for (const condition of conditionsOf(input)) {
      // Une question ne dépend que d'une question qui la PRÉCÈDE : la
      // personne doit avoir déjà répondu à celle-ci.
      if (condition.questionOrder >= index) {
        throw badRequest(`La question ${index + 1} ne peut dépendre que d'une question qui la précède`);
      }
      const target = created[condition.questionOrder];
      const option = target?.options.find((o) => o.order === condition.optionOrder);
      if (!option) throw badRequest(`Référence de condition invalide pour la question ${index + 1}`);
      conditionRows.push({ questionId: thisQuestion.id, optionId: option.id });
    }

    // ── Limite de cases cochées ──
    if (input.maxChoicesFrom) {
      const { questionOrder } = input.maxChoicesFrom;
      const target = created[questionOrder];
      if (questionOrder >= index || target?.type !== 'NOMBRE') {
        throw badRequest(`La question ${index + 1} ne peut limiter ses cases qu'à partir d'une question « Nombre » qui la précède`);
      }
      await tx.question.update({ where: { id: thisQuestion.id }, data: { maxChoicesFromId: target.id } });
    }
  }

  if (conditionRows.length) {
    // skipDuplicates : la même condition donnée deux fois n'en fait qu'une
    await tx.questionCondition.createMany({ data: conditionRows, skipDuplicates: true });
  }
}

/**
 * « Empreinte » d'une question : tout ce qui change son comportement.
 * Deux listes aux empreintes identiques = questionnaire inchangé.
 *
 * Avant S5R-05, seuls les libellés, le type et le caractère obligatoire
 * étaient comparés : changer un branchement sans toucher aux libellés
 * était IGNORÉ en silence. Toute règle compte désormais.
 */
function signature({ label, helpText, type, required, uiHint, syncsToProfile, minValue, maxValue,
  options, conditions, maxChoicesFrom }) {
  return JSON.stringify({
    label, helpText: helpText || '', type, required, uiHint: uiHint ?? null, syncsToProfile: syncsToProfile ?? null,
    minValue: minValue ?? null, maxValue: maxValue ?? null,
    options: (options ?? []).map((o) => [o.label, o.syncValue ?? null, Boolean(o.endsSurvey)]),
    conditions: [...conditions].sort(),
    maxChoicesFrom: maxChoicesFrom ?? null,
  });
}

/**
 * Le questionnaire reçu est-il identique à celui en base ?
 * @param {object[]} existing - questions en base, avec options et conditions
 * @param {object[]} incoming - questions reçues (format API)
 */
export function questionsUnchanged(existing, incoming) {
  if (existing.length !== incoming.length) return false;

  // Position (« question.option ») de chaque option existante, pour
  // comparer des conditions exprimées en id avec d'autres en positions
  const positionOfOption = new Map();
  for (const q of existing) for (const o of q.options) positionOfOption.set(o.id, `${q.order}.${o.order}`);
  const orderOfQuestion = new Map(existing.map((q) => [q.id, q.order]));

  return existing.every((q, index) => {
    const inc = incoming[index];
    const fromDb = signature({
      ...q,
      conditions: (q.conditions ?? []).map((c) => positionOfOption.get(c.optionId)),
      maxChoicesFrom: q.maxChoicesFromId ? orderOfQuestion.get(q.maxChoicesFromId) : null,
    });
    const fromInput = signature({
      ...inc,
      required: inc.required ?? true,
      options: optionsOf(inc) ?? [],
      conditions: conditionsOf(inc).map((c) => `${c.questionOrder}.${c.optionOrder}`),
      maxChoicesFrom: inc.maxChoicesFrom?.questionOrder ?? null,
    });
    return fromDb === fromInput;
  });
}
