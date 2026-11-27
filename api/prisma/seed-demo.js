// ══════════════════════════════════════════════════════════
// Seed DÉMO — des répondants fictifs aux profils variés
// (demande du 14/10 : « au moins 10 à 20 répondants » pour tester les
// résultats, les filtres par profil et les graphiques)
//
//   npm run seed:demo                      → 20 citoyens fictifs répondent à
//                                            toutes les enquêtes OUVERTES et
//                                            votent sur les propositions publiées
//   npm run seed:demo -- --enquete <slug>  → une seule enquête (même clôturée)
//   npm run seed:demo -- --nombre 12       → seulement les 12 premiers profils
//   npm run seed:demo -- --sans-votes      → pas de votes sur les propositions
//   npm run seed:demo -- --supprimer       → efface les comptes démo et TOUT
//                                            ce qu'ils ont fait (réponses, votes)
//
// Comment ça marche :
//  1. 20 profils écrits à la main (résidence, quartier, travail…), pour
//     couvrir tous les cas : centre, chaque autre quartier, autres villes,
//     travail dans le centre ou ailleurs, commerçant·e ou salarié·e ;
//  2. chaque profil REMPLIT l'enquête question par question, avec le MÊME
//     moteur que le questionnaire (lib/surveyFlow.js) : seules les
//     questions et options qui lui seraient affichées sont répondues, et
//     les questions de profil reçoivent la réponse qui correspond à SON
//     profil (un habitant de Brichebay répond « Brichebay ») ;
//  3. la réponse passe par la VRAIE route de l'API (POST
//     /surveys/:id/responses, appelée sans serveur grâce à supertest) :
//     mêmes contrôles qu'un vrai citoyen — si le script se trompait,
//     l'API le refuserait.
//
// Les choix « au hasard » sont DÉTERMINISTES (même graine → mêmes
// réponses) : relancer après --supprimer redonne les mêmes résultats,
// pratique pour comparer avant / après une modification.
//
// Analogie : des figurants pour une répétition. Chacun a sa fiche
// (« je vis à Villevert, je travaille au centre comme salariée ») et
// passe par la même porte que le public — pas par l'entrée des artistes.
//
// ⚠️ Développement uniquement : refusé si NODE_ENV=production.
// Comptes démo : adresse en @demo.senlis-participatif.test (le domaine
// .test est réservé, aucun e-mail ne peut y partir), mot de passe
// « DemoSenlis123! », pseudo « Demo-<prénom> ».
// ══════════════════════════════════════════════════════════

import argon2 from 'argon2';
import request from 'supertest';
import prisma from '../src/lib/prisma.js';
import app from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { surveyPath } from '../src/lib/surveyFlow.js';

const DEMO_DOMAIN = 'demo.senlis-participatif.test';
const DEMO_PASSWORD = 'DemoSenlis123!';
const API = '/api/v1';

// ── 1. Les profils ───────────────────────────────────────
// situation : CENTRE_RESIDENT | AUTRE_QUARTIER | HORS_SENLIS
// travail   : null = ne travaille pas à Senlis ; sinon { quartier, type }
const PERSONAS = [
  // Centre historique
  { prenom: 'Camille', situation: 'CENTRE_RESIDENT', travail: { quartier: 'CENTRE_HISTORIQUE', type: 'COMMERCANT' } },
  { prenom: 'Louis', situation: 'CENTRE_RESIDENT', travail: null },
  { prenom: 'Inès', situation: 'CENTRE_RESIDENT', travail: { quartier: 'CENTRE_HISTORIQUE', type: 'SALARIE' } },
  { prenom: 'Gabriel', situation: 'CENTRE_RESIDENT', travail: { quartier: 'ZONE_INDUSTRIELLE', type: 'SALARIE' } },
  // Autres quartiers de Senlis
  { prenom: 'Léa', situation: 'AUTRE_QUARTIER', quartier: 'SAINT_VINCENT', travail: { quartier: 'CENTRE_HISTORIQUE', type: 'COMMERCANT' } },
  { prenom: 'Hugo', situation: 'AUTRE_QUARTIER', quartier: 'BRICHEBAY', travail: null },
  { prenom: 'Chloé', situation: 'AUTRE_QUARTIER', quartier: 'BON_SECOURS', travail: { quartier: 'CENTRE_HISTORIQUE', type: 'SALARIE' } },
  { prenom: 'Nathan', situation: 'AUTRE_QUARTIER', quartier: 'VAL_AUNETTE_GATELIERE', travail: null },
  { prenom: 'Manon', situation: 'AUTRE_QUARTIER', quartier: 'VILLEVERT', travail: { quartier: 'VILLEVERT', type: 'SALARIE' } },
  { prenom: 'Jules', situation: 'AUTRE_QUARTIER', quartier: 'JARDINIERS', travail: { quartier: 'CENTRE_HISTORIQUE', type: 'SALARIE' } },
  { prenom: 'Sarah', situation: 'AUTRE_QUARTIER', quartier: 'ZONE_INDUSTRIELLE', travail: null },
  { prenom: 'Arthur', situation: 'AUTRE_QUARTIER', quartier: 'SAINT_VINCENT', travail: null },
  // Autres villes
  { prenom: 'Emma', situation: 'HORS_SENLIS', ville: 'Chantilly', travail: { quartier: 'CENTRE_HISTORIQUE', type: 'SALARIE' } },
  { prenom: 'Lucas', situation: 'HORS_SENLIS', ville: 'Creil', travail: { quartier: 'CENTRE_HISTORIQUE', type: 'COMMERCANT' } },
  { prenom: 'Jade', situation: 'HORS_SENLIS', ville: 'Compiègne', travail: null },
  { prenom: 'Raphaël', situation: 'HORS_SENLIS', ville: 'Chamant', travail: { quartier: 'BRICHEBAY', type: 'SALARIE' } },
  { prenom: 'Zoé', situation: 'HORS_SENLIS', ville: 'Crépy-en-Valois', travail: null },
  { prenom: 'Adam', situation: 'HORS_SENLIS', ville: 'Pont-Sainte-Maxence', travail: { quartier: 'CENTRE_HISTORIQUE', type: 'SALARIE' } },
  { prenom: 'Lina', situation: 'HORS_SENLIS', ville: 'Fleurines', travail: null },
  { prenom: 'Paul', situation: 'CENTRE_RESIDENT', travail: null },
];

/** Ce que chaque question « de profil » doit recevoir pour ce profil */
function profileValues(persona) {
  return {
    situation: persona.situation,
    quartier: persona.quartier ?? null,
    travailleASenlis: persona.travail ? 'true' : 'false',
    travailleQuartier: persona.travail?.quartier ?? null,
    travailType: persona.travail?.type ?? null,
  };
}

// ── Hasard reproductible ─────────────────────────────────
// mulberry32 : un petit générateur pseudo-aléatoire. Même graine →
// même suite de nombres (Math.random(), lui, change à chaque lancement).
function seededRandom(text) {
  let seed = 0;
  for (const char of text) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0;
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
function pickSome(rand, list, max) {
  const shuffled = [...list].sort(() => rand() - 0.5);
  return shuffled.slice(0, 1 + Math.floor(rand() * Math.min(max, list.length)));
}

const SAMPLE_TEXTS = [
  'Plus de places pour les vélos près de la cathédrale.',
  'Les week-ends, trouver une place est très difficile.',
  'Un parking relais avec navette serait une bonne idée.',
  'Mieux indiquer les parkings à l’entrée de la ville.',
  'Rendre la rue de la République plus agréable à pied.',
  'Des horaires de bus plus fréquents le samedi.',
  'Je suis satisfait·e de la situation actuelle.',
  'Penser aux personnes à mobilité réduite.',
];

// ── 2. Remplir une enquête comme le ferait ce profil ─────
/**
 * Avance question par question : à chaque tour, le moteur dit quelles
 * questions sont affichées (avec les réponses déjà données) ; on répond
 * à la première qui ne l'est pas encore. Comme un vrai citoyen qui
 * clique sur « Suivant ».
 */
function fillSurvey(survey, persona) {
  const profile = profileValues(persona);
  const answers = new Map(); // questionId → réponse (format de l'API)
  const chosen = (qid) => {
    const a = answers.get(qid);
    return a?.optionIds ?? (a?.optionId ? [a.optionId] : []);
  };
  const questionsById = new Map(survey.questions.map((q) => [q.id, q]));

  for (let guard = 0; guard < survey.questions.length + 1; guard += 1) {
    const { questionIds, offeredOptions } = surveyPath(survey.questions, chosen);
    const next = questionIds.find((id) => !answers.has(id));
    if (!next) break;
    const question = questionsById.get(next);
    const offered = question.options.filter((o) => offeredOptions.get(next)?.includes(o.id));
    const rand = seededRandom(`${persona.prenom}|${survey.slug}|${question.order}`);
    const answer = answerQuestion(question, offered, profile, persona, rand, answers);
    // Une question facultative peut rester sans réponse : on la marque
    // quand même comme « vue » pour passer à la suivante
    answers.set(next, answer ?? { skipped: true });
  }

  return [...answers.entries()]
    .filter(([, a]) => !a.skipped)
    .map(([questionId, a]) => ({ questionId, ...a }));
}

function answerQuestion(question, offered, profile, persona, rand, answers) {
  // Question de profil : la réponse qui correspond au profil
  if (question.syncsToProfile) {
    const wanted = profile[question.syncsToProfile];
    const match = offered.find((o) => o.syncValue === wanted);
    if (match) return { optionId: match.id };
  }

  switch (question.type) {
    case 'OUI_NON':
    case 'CHOIX_UNIQUE': {
      if (!offered.length) return null;
      if (!question.required && rand() < 0.1) return null; // quelques abstentions
      // Une fin anticipée (« je n'ai pas de véhicule »…) est choisie
      // moins souvent : sinon trop de parcours s'arrêteraient tôt
      const pool = offered.filter((o) => !o.endsSurvey || rand() < 0.35);
      return { optionId: pick(rand, pool.length ? pool : offered).id };
    }
    case 'CHOIX_MULTIPLE': {
      if (!offered.length) return null;
      let max = 3;
      if (question.maxChoicesFromId) {
        const limit = answers.get(question.maxChoicesFromId)?.valueNumber;
        if (typeof limit === 'number') max = Math.max(1, Math.min(max, limit));
      }
      const pool = offered.filter((o) => !o.endsSurvey);
      return { optionIds: pickSome(rand, pool.length ? pool : offered, max).map((o) => o.id) };
    }
    case 'NOMBRE': {
      const min = question.minValue ?? 0;
      const max = question.maxValue ?? min + 3;
      return { valueNumber: min + Math.floor(rand() * (Math.min(max, min + 3) - min + 1)) };
    }
    case 'TEXTE_LIBRE': {
      // « Dans quelle ville résidez-vous ? » → la ville du profil
      if (/ville|commune/i.test(question.label) && persona.ville) return { valueText: persona.ville };
      if (!question.required && rand() < 0.6) return null;
      return { valueText: pick(rand, SAMPLE_TEXTS) };
    }
    default:
      return null;
  }
}

// ── 3. Le script ─────────────────────────────────────────
function parseArgs(argv) {
  const value = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    enquete: value('--enquete'),
    nombre: Number(value('--nombre')) || PERSONAS.length,
    sansVotes: argv.includes('--sans-votes'),
    supprimer: argv.includes('--supprimer'),
  };
}

const emailOf = (persona) => `${persona.prenom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}@${DEMO_DOMAIN}`;

async function upsertPersona(persona, passwordHash) {
  const profile = {
    situation: persona.situation,
    quartier: persona.quartier ?? null,
    travailleASenlis: Boolean(persona.travail),
    travailleQuartier: persona.travail?.quartier ?? null,
    travailType: persona.travail?.type ?? null,
  };
  return prisma.user.upsert({
    where: { email: emailOf(persona) },
    // Profil remis à l'état de la fiche à chaque lancement (une enquête
    // précédente a pu le modifier par synchronisation)
    update: profile,
    create: {
      email: emailOf(persona),
      pseudo: `Demo-${persona.prenom}`,
      passwordHash,
      emailVerified: true,
      role: 'CITIZEN',
      ...profile,
    },
  });
}

async function removeDemo() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  // Réponses (et leurs Answer, en cascade) puis votes, puis les comptes
  const responses = await prisma.surveyResponse.deleteMany({ where: { userId: { in: ids } } });
  const votes = await prisma.vote.deleteMany({ where: { userId: { in: ids } } });
  const accounts = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`🧹 Supprimé : ${accounts.count} compte(s) démo, ${responses.count} réponse(s), ${votes.count} vote(s).`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:demo est réservé au développement (NODE_ENV=production détecté).');
  }
  const args = parseArgs(process.argv.slice(2));
  if (args.supprimer) return removeDemo();

  // Le script envoie des centaines de requêtes depuis la même adresse :
  // sans cet interrupteur, le limiteur général (100 / minute) le bloque
  // en route (429 constaté le 14/10). Voir app.js.
  app.locals.bypassRateLimit = true;

  const personas = PERSONAS.slice(0, Math.max(1, Math.min(args.nombre, PERSONAS.length)));
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const users = [];
  for (const persona of personas) users.push({ persona, user: await upsertPersona(persona, passwordHash) });
  console.log(`👥 ${users.length} citoyen·nes démo prêt·es (mot de passe : ${DEMO_PASSWORD}).`);

  // Les enquêtes visées : celle demandée, sinon toutes les ouvertes
  const surveys = await prisma.survey.findMany({
    where: args.enquete ? { slug: args.enquete } : { status: 'OPEN' },
    select: { id: true, slug: true, title: true, status: true },
  });
  if (args.enquete && !surveys.length) throw new Error(`Aucune enquête avec l'adresse « ${args.enquete} ».`);

  for (const meta of surveys) {
    // Une enquête close n'accepte pas de réponse : on la rouvre le temps
    // du script (seulement si on l'a demandée explicitement), puis on
    // remet son statut et sa date d'origine
    const original = await prisma.survey.findUnique({ where: { id: meta.id }, select: { status: true, closesAt: true } });
    const reopened = original.status !== 'OPEN';
    if (reopened) await prisma.survey.update({ where: { id: meta.id }, data: { status: 'OPEN', closesAt: null } });

    try {
      // Le questionnaire tel que le navigateur le reçoit (conditions comprises)
      const { body } = await request(app).get(`${API}/surveys/${meta.slug}`);
      const survey = body.survey;
      let added = 0;
      let already = 0;
      for (const { persona, user } of users) {
        const res = await request(app)
          .post(`${API}/surveys/${survey.id}/responses`)
          .set('Authorization', `Bearer ${signToken(user)}`)
          .send({ answers: fillSurvey(survey, persona) });
        if (res.status === 201) added += 1;
        else if (res.status === 409) already += 1;
        else throw new Error(`Réponse refusée pour ${persona.prenom} : ${res.status} ${JSON.stringify(res.body.error)}`);
      }
      console.log(`📋 « ${meta.title} » (${meta.slug}) : ${added} réponse(s) ajoutée(s)${already ? `, ${already} déjà présente(s)` : ''}.`);
    } finally {
      if (reopened) await prisma.survey.update({ where: { id: meta.id }, data: { status: original.status, closesAt: original.closesAt } });
    }

    // La synchronisation du profil a pu modifier les fiches : on les remet
    for (const entry of users) entry.user = await upsertPersona(entry.persona, passwordHash);
  }

  if (!args.sansVotes) {
    // Des avis variés sur chaque proposition publiée : environ 55 % pour,
    // 30 % contre, 15 % neutres — tirés au hasard (reproductible)
    const proposals = await prisma.proposal.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, slug: true } });
    let votes = 0;
    for (const proposal of proposals) {
      for (const { persona, user } of users) {
        const r = seededRandom(`${persona.prenom}|${proposal.slug}`)();
        const value = r < 0.55 ? 'POUR' : r < 0.85 ? 'CONTRE' : 'NEUTRE';
        const res = await request(app)
          .put(`${API}/proposals/${proposal.id}/vote`)
          .set('Authorization', `Bearer ${signToken(user)}`)
          .send({ value });
        if (res.status >= 400) throw new Error(`Vote refusé pour ${persona.prenom} : ${res.status} ${JSON.stringify(res.body.error)}`);
        votes += 1;
      }
    }
    console.log(`🗳️  ${votes} vote(s) sur ${proposals.length} proposition(s) publiée(s).`);
  }
  console.log('✅ Terminé. Pour tout effacer : npm run seed:demo -- --supprimer');
}

// Exportés pour les tests (tests/seed-demo.test.js)
export { PERSONAS, fillSurvey, profileValues, DEMO_DOMAIN };

// Lancé directement (npm run seed:demo) — pas quand un test l'importe
if (process.argv[1]?.endsWith('seed-demo.js')) {
  main()
    .catch((err) => {
      console.error('❌', err.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
