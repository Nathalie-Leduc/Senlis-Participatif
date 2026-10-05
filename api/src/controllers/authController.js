// ══════════════════════════════════════════════════════════
// Contrôleur Auth — la logique métier de l'authentification
//
// Chaque fonction gère un cas d'utilisation complet :
// validation → action BDD → réponse. Les validations Zod
// sont faites AVANT par le middleware validate().
// ══════════════════════════════════════════════════════════

import argon2 from 'argon2';
import prisma from '../lib/prisma.js';
import {
  signToken, signTwoFactorChallenge, verifyTwoFactorChallenge,
  signTrustedDeviceToken, verifyTrustedDeviceToken,
} from '../lib/jwt.js';
import {
  createToken, verifyAndConsumeToken, findConsumedToken, createTwoFactorCode, verifyTwoFactorCode,
} from '../services/token.js';
import { sendVerificationEmail, sendResetPasswordEmail, sendTwoFactorCode } from '../services/email.js';
import { logAdminAction, AUDIT_ACTIONS } from '../services/audit.js';
import { assertEmailDomainCanReceive } from '../lib/emailDomain.js';

// ── Outils communs (S5A-06) ─────────────────────────────

/**
 * Empreinte Argon2 « bidon », calculée une seule fois à la première
 * utilisation. Sert à égaliser les temps de réponse du login : sans
 * elle, un email INCONNU répondait en quelques millisecondes (pas de
 * hachage), un email CONNU en ~100 ms (Argon2) — un chronomètre
 * suffisait à savoir si une adresse est inscrite (énumération).
 *
 * Analogie : le guichetier qui fait semblant de chercher dans ses
 * dossiers même quand le nom n'y est pas — pour que la durée de
 * l'attente ne révèle rien.
 */
let dummyHashPromise;
function getDummyHash() {
  dummyHashPromise ??= argon2.hash('pas-un-vrai-mot-de-passe-' + Math.random());
  return dummyHashPromise;
}

/**
 * Vérifie le mot de passe ACTUEL avant une action sensible
 * (changer d'email, supprimer son compte). Recommandation OWASP :
 * une session volée — ordinateur resté ouvert, jeton dérobé — ne
 * doit pas suffire à prendre ou à détruire le compte.
 *
 * @throws {Error} 401 INVALID_CREDENTIALS si le mot de passe est faux ou absent
 */
async function assertCurrentPassword(user, password) {
  const valid = password ? await argon2.verify(user.passwordHash, password) : false;
  if (!valid) {
    const error = new Error('Mot de passe actuel incorrect');
    error.status = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }
}

// ── POST /auth/register ─────────────────────────────────
export async function register(req, res, next) {
  try {
    const {
      email, password, pseudo, situation, quartier, travailleQuartier, travailType, travailleASenlis,
    } = req.body;

    // Vérifie si l'email est déjà pris. Ce n'est qu'un PREMIER filtre,
    // pour un message clair dans le cas courant : deux inscriptions
    // simultanées peuvent passer ce contrôle ensemble. C'est alors la
    // contrainte @unique de la base qui tranche (P2002), traduite en
    // même 409 EMAIL_TAKEN par errorHandler.js. Idem pour le pseudo,
    // qu'on ne vérifie même pas ici : la base le fait mieux que nous.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const error = new Error('Cette adresse email est déjà utilisée');
      error.status = 409; // Conflict
      error.code = 'EMAIL_TAKEN';
      throw error;
    }

    // S5R-02b : le domaine peut-il recevoir du courrier ? Refus
    // seulement si c'est CERTAIN (domaine inexistant, « null MX ») ;
    // en cas de panne DNS, on accepte — voir lib/emailDomain.js.
    await assertEmailDomainCanReceive(email);

    // Hash du mot de passe avec Argon2id (état de l'art 2026)
    // Argon2id combine résistance aux attaques GPU (Argon2d)
    // et aux attaques par canaux auxiliaires (Argon2i).
    const passwordHash = await argon2.hash(password);

    // Crée l'utilisateur (emailVerified = false par défaut).
    //
    // S5A-02 : travailleQuartier/travailType étaient validés par Zod…
    // puis silencieusement oubliés ici — le profil « travail » saisi
    // à l'inscription n'arrivait jamais en base.
    //
    // On n'enregistre que les données qui ont un sens ensemble (même
    // règle que dans le dictionnaire de données, doc 03) :
    //  - un quartier de résidence, seulement pour AUTRE_QUARTIER
    //    (le centre et « hors Senlis » n'en ont pas) ;
    //  - un rôle de travail, seulement s'il y a un quartier de travail.
    const user = await prisma.user.create({
      data: {
        email,
        pseudo,
        passwordHash,
        situation,
        quartier: situation === 'AUTRE_QUARTIER' ? quartier : null,
        travailleQuartier: travailleQuartier ?? null,
        travailType: travailleQuartier ? travailType : null,
        // S5R-05 : oui / non / non renseigné. Un quartier de travail
        // donné vaut « oui », quoi qu'indique la case.
        travailleASenlis: travailleQuartier ? true : (travailleASenlis ?? null),
      },
    });

    // Génère et envoie le jeton de vérification par email
    const token = await createToken(user.id, 'VERIFY_EMAIL');
    await sendVerificationEmail(email, token);

    res.status(201).json({
      message: 'Compte créé ! Vérifiez votre boîte mail pour activer votre compte.',
      user: { id: user.id, email: user.email, pseudo: user.pseudo },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/verify-email ─────────────────────────────
export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;

    // Vérifie le jeton (hash, expiration, usage unique)
    try {
      // Transaction : « jeton consommé » et « email vérifié » sont
      // enregistrés ENSEMBLE. Sans elle, une seconde requête arrivant
      // entre les deux écritures verrait un jeton utilisé… sur un
      // compte pas encore vérifié, et répondrait à tort par une erreur.
      await prisma.$transaction(async (tx) => {
        const authToken = await verifyAndConsumeToken(token, 'VERIFY_EMAIL', tx);
        await tx.user.update({
          where: { id: authToken.userId },
          data: { emailVerified: true },
        });
      });
    } catch (err) {
      // S5R-01 — le lien a déjà servi. Si le compte est bien vérifié,
      // c'est un SUCCÈS, pas une erreur : la personne a cliqué deux
      // fois, ou React a envoyé la requête deux fois en développement.
      // Analogie : le ticket de vestiaire poinçonné une seconde fois
      // — le manteau a déjà été rendu, inutile de crier « ticket
      // invalide ». (Compte NON vérifié : le lien a été remplacé par
      // un plus récent, par exemple après un changement d'email →
      // l'erreur d'origine reste la bonne réponse.)
      if (err.code === 'INVALID_TOKEN') {
        const consumed = await findConsumedToken(token, 'VERIFY_EMAIL');
        if (consumed?.user.emailVerified) {
          return res.json({
            message: 'Votre adresse email est déjà vérifiée. Vous pouvez vous connecter.',
            alreadyVerified: true,
          });
        }
      }
      throw err;
    }

    res.json({ message: 'Email vérifié avec succès ! Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    next(err);
  }
}

// ── Suivi de la dernière connexion (S5A-05) ─────────────
//
// Appelé UNIQUEMENT quand une session est réellement ouverte : après
// le mot de passe pour un citoyen, après le code 2FA pour un admin
// (un admin qui s'arrête au mot de passe n'est pas « connecté »).
// Remet aussi à zéro un éventuel avertissement d'inactivité : se
// reconnecter, c'est répondre « je suis toujours là ».
// S5A-06 : une connexion ADMIN est en plus inscrite au journal.
async function recordLogin(user) {
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), inactivityWarnedAt: null },
  });
  if (user.role === 'ADMIN') {
    await logAdminAction({ actorId: user.id, action: AUDIT_ACTIONS.ADMIN_LOGIN });
  }
}

// ── POST /auth/resend-verification — S5R-01 ─────────────
//
// Avant : un lien de vérification perdu, expiré (60 min) ou supprimé
// par erreur obligeait à… rien du tout — il n'existait aucun moyen
// d'en recevoir un autre, et « réessayer l'inscription » se heurtait
// à « adresse déjà utilisée ». Compte bloqué pour toujours.
//
// Réponse IDENTIQUE que le compte existe ou non, qu'il soit vérifié
// ou non (anti-énumération, comme « mot de passe oublié ») : sinon ce
// formulaire permettrait de tester quelles adresses sont inscrites.
export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;
    // S5R-02b : un domaine qui ne reçoit pas de courrier ne recevra pas
    // plus le nouveau lien — autant le dire. Cette réponse ne révèle
    // rien sur l'existence d'un compte : elle porte sur le DOMAINE.
    await assertEmailDomainCanReceive(email);
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && !user.emailVerified) {
      // createToken invalide les liens précédents : seul le dernier
      // email reçu fonctionne (pas de liens valides qui s'empilent).
      const token = await createToken(user.id, 'VERIFY_EMAIL');
      await sendVerificationEmail(user.email, token);
    }

    res.json({
      message: 'Si un compte en attente de vérification correspond à cette adresse, un nouveau lien vient de lui être envoyé.',
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/login ────────────────────────────────────
export async function login(req, res, next) {
  try {
    const { email, password, trustedDeviceToken } = req.body;

    // Cherche l'utilisateur — on n'indique PAS si c'est
    // l'email ou le mot de passe qui est faux (anti-bruteforce :
    // ne pas révéler si un email est inscrit ou non).
    const user = await prisma.user.findUnique({ where: { email } });
    const genericError = () => {
      const e = new Error('Email ou mot de passe incorrect');
      e.status = 401;
      e.code = 'INVALID_CREDENTIALS';
      return e;
    };

    if (!user) {
      // Même travail que pour un vrai compte, puis même refus
      await argon2.verify(await getDummyHash(), password);
      throw genericError();
    }

    // Vérifie le mot de passe avec Argon2
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw genericError();

    // Vérifie que l'email a été confirmé
    if (!user.emailVerified) {
      const error = new Error(
        'Veuillez d\'abord vérifier votre email — un lien vous a été envoyé à l\'inscription'
      );
      error.status = 403;
      error.code = 'EMAIL_NOT_VERIFIED';
      throw error;
    }

    // Tout est bon → mais un compte ADMIN ne reçoit pas son JWT
    // tout de suite : on envoie d'abord un code par email, et on ne
    // renvoie qu'un jeton de DÉFI (10 min, sans le rôle) — la vraie
    // connexion n'a lieu qu'après /auth/2fa/verify. Un citoyen normal
    // continue comme avant, sans cette étape.
    //
    // Exception : un jeton "appareil de confiance" valide (ce
    // navigateur a déjà passé le 2FA il y a moins d'1h, voir
    // verifyTwoFactor ci-dessous) dispense de repasser par le défi
    // email — le mot de passe reste toujours requis, seul le CODE
    // est sauté.
    if (user.role === 'ADMIN') {
      let trustedDevice = false;
      if (trustedDeviceToken) {
        try {
          const payload = verifyTrustedDeviceToken(trustedDeviceToken);
          trustedDevice = payload.userId === user.id;
        } catch {
          trustedDevice = false; // expiré, falsifié, ou absent : on retombe simplement sur le 2FA normal
        }
      }

      if (!trustedDevice) {
        const code = await createTwoFactorCode(user.id);
        await sendTwoFactorCode(user.email, code);

        const challengeToken = signTwoFactorChallenge(user);

        return res.json({
          twoFactorRequired: true,
          challengeToken,
        });
      }
    }

    // Tout est bon → JWT
    await recordLogin(user);
    const jwt = signToken(user);

    res.json({
      token: jwt,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        role: user.role,
        emailVerified: user.emailVerified,
        situation: user.situation,
        quartier: user.quartier,
        travailleQuartier: user.travailleQuartier,
        travailType: user.travailType,
        travailleASenlis: user.travailleASenlis,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/2fa/verify ────────────────────────────────
//
// Deuxième étape de la connexion admin : le jeton de défi prouve
// que le mot de passe était déjà correct (on ne redemande pas
// email+password ici) ; le code prouve l'accès à la boîte mail.
export async function verifyTwoFactor(req, res, next) {
  try {
    const { challengeToken, code } = req.body;

    // Un jeton de défi invalide/expiré = 401 générique, sans
    // détailler pourquoi — même logique anti-énumération que
    // genericError() dans login().
    let payload;
    try {
      payload = verifyTwoFactorChallenge(challengeToken);
    } catch {
      const error = new Error('Session de connexion expirée — reconnectez-vous');
      error.status = 401;
      error.code = 'CHALLENGE_EXPIRED';
      throw error;
    }

    await verifyTwoFactorCode(payload.userId, code);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      const error = new Error('Compte introuvable');
      error.status = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    await recordLogin(user);
    const jwt = signToken(user);
    // Émis EN PLUS du jeton de session, jamais à sa place — voir le
    // commentaire dans login() pour ce qu'il permet exactement (sauter
    // le CODE, jamais le mot de passe) et sa durée de vie volontairement
    // courte (1h par défaut).
    const trustedDeviceToken = signTrustedDeviceToken(user);

    res.json({
      trustedDeviceToken,
      token: jwt,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        role: user.role,
        emailVerified: user.emailVerified,
        situation: user.situation,
        quartier: user.quartier,
        travailleQuartier: user.travailleQuartier,
        travailType: user.travailType,
        travailleASenlis: user.travailleASenlis,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /auth/me ────────────────────────────────────────
export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        pseudo: true,
        role: true,
        emailVerified: true,
        situation: true,
        quartier: true,
        travailleQuartier: true,
        travailType: true,
        travailleASenlis: true,
        notifyNewProposal: true,
        notifySurveyClosed: true,
        createdAt: true,
      },
    });

    if (!user) {
      const error = new Error('Utilisateur introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// ── GET /auth/me/export — télécharger mes données (S5A-05) ──
//
// Droit d'accès (RGPD art. 15) et droit à la portabilité (art. 20) :
// la personne récupère TOUT ce qui la concerne, dans un format
// structuré et lisible par une machine (JSON).
//
// Analogie : demander à sa banque le relevé complet de son compte —
// pas un résumé, pas une capture d'écran : toutes les lignes, dans
// un format qu'un autre logiciel sait relire.
//
// Ce qui n'y figure PAS, volontairement :
//  - l'empreinte du mot de passe et les jetons : ce sont des secrets
//    de sécurité, pas des informations sur la personne — les
//    exporter n'apporterait rien et exposerait inutilement ;
//  - les données des AUTRES (totaux des votes, réponses d'autrui).
export async function exportMyData(req, res, next) {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true, pseudo: true, role: true, emailVerified: true,
        situation: true, quartier: true, travailleQuartier: true, travailType: true, travailleASenlis: true,
        notifyNewProposal: true, notifySurveyClosed: true,
        createdAt: true, updatedAt: true, lastLoginAt: true,
        votes: {
          select: {
            value: true, createdAt: true, updatedAt: true,
            proposal: { select: { title: true, slug: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        responses: {
          select: {
            submittedAt: true,
            survey: { select: { title: true, slug: true } },
            answers: {
              select: {
                valueText: true, valueNumber: true,
                question: { select: { label: true, order: true } },
                option: { select: { label: true } },
              },
            },
          },
          orderBy: { submittedAt: 'asc' },
        },
        proposals: {
          select: { title: true, slug: true, status: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      const error = new Error('Compte introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const { votes, responses, proposals, ...account } = user;

    const data = {
      // En-tête lisible : un humain qui ouvre le fichier doit
      // comprendre ce qu'il a entre les mains.
      about: 'Export de vos données personnelles — Senlis Participatif (RGPD, art. 15 et 20)',
      exportedAt: new Date().toISOString(),
      account,
      votes: votes.map((v) => ({
        proposal: v.proposal.title,
        proposalSlug: v.proposal.slug,
        vote: v.value,
        votedAt: v.createdAt,
        lastChangedAt: v.updatedAt,
      })),
      surveyResponses: responses.map((r) => ({
        survey: r.survey.title,
        surveySlug: r.survey.slug,
        submittedAt: r.submittedAt,
        // Dans l'ordre du questionnaire ; une question à choix
        // multiple apparaît une fois par option cochée.
        answers: r.answers
          .sort((a, b) => a.question.order - b.question.order)
          .map((a) => ({
            question: a.question.label,
            answer: a.option?.label ?? a.valueText ?? a.valueNumber,
          })),
      })),
      proposals,
    };

    const date = new Date().toISOString().slice(0, 10); // AAAA-MM-JJ
    // attachment : le navigateur propose d'ENREGISTRER le fichier
    // plutôt que d'afficher le JSON brut dans l'onglet.
    res.set('Content-Disposition', `attachment; filename="senlis-participatif-mes-donnees-${date}.json"`);
    // Données personnelles : aucun cache intermédiaire ne doit les garder
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ── PATCH /auth/me ──────────────────────────────────────
export async function updateProfile(req, res, next) {
  try {
    const {
      pseudo, situation, quartier, travailleQuartier, travailType, travailleASenlis, currentPassword,
    } = req.body;
    const userId = req.user.userId;

    // S5A-06 : changer d'email exige le mot de passe actuel. Sinon,
    // une session volée suffirait à détourner le compte : l'attaquant
    // mettrait SON adresse, puis ferait « mot de passe oublié ».
    // Un email identique à l'actuel n'est pas un changement → ignoré.
    const current = await prisma.user.findUnique({ where: { id: userId } });
    const email = req.body.email && req.body.email !== current.email ? req.body.email : undefined;
    if (email) {
      await assertCurrentPassword(current, currentPassword);
    }

    // Si l'email change, vérifier qu'il n'est pas déjà pris
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: userId } },
      });
      if (existing) {
        const error = new Error('Cette adresse email est déjà utilisée');
        error.status = 409;
        error.code = 'EMAIL_TAKEN';
        throw error;
      }
      // S5R-02b : même contrôle du domaine qu'à l'inscription
      await assertEmailDomainCanReceive(email);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(pseudo && { pseudo }),
        ...(email && { email, emailVerified: false }),
        ...(situation && { situation }),
        ...(quartier && { quartier }),
        // Si on bascule vers une situation autre que AUTRE_QUARTIER,
        // le quartier précédemment choisi n'a plus de sens — effacé
        // plutôt que laissé à traîner avec une valeur périmée.
        ...(situation && situation !== 'AUTRE_QUARTIER' && { quartier: null }),
        // travailleQuartier/travailType : axe indépendant, sans
        // "situation parente" à surveiller — le CLIENT doit donc
        // explicitement envoyer null pour effacer (ex. la personne
        // décoche "je travaille à Senlis"), distinct d'un champ tout
        // simplement absent du corps de la requête (ne rien changer).
        // `!== undefined` plutôt qu'un simple `truthy` : un null
        // explicite doit passer, contrairement à un champ jamais
        // envoyé.
        ...(travailleQuartier !== undefined && { travailleQuartier }),
        ...(travailType !== undefined && { travailType }),
        // S5R-05 : même cohérence qu'à l'inscription et qu'en enquête —
        // « non » efface le volet travail, un quartier vaut « oui »
        ...(travailleASenlis !== undefined && { travailleASenlis }),
        ...(travailleASenlis === false && { travailleQuartier: null, travailType: null }),
        ...(travailleQuartier && { travailleASenlis: true }),
      },
      select: {
        id: true, email: true, pseudo: true, role: true, emailVerified: true,
        situation: true, quartier: true, travailleQuartier: true, travailType: true, travailleASenlis: true,
      },
    });

    // Si l'email a changé, renvoyer un jeton de vérification
    if (email) {
      const token = await createToken(userId, 'VERIFY_EMAIL');
      await sendVerificationEmail(email, token);
    }

    res.json({
      user,
      ...(email && { message: 'Un email de vérification a été envoyé à votre nouvelle adresse.' }),
    });
  } catch (err) {
    next(err);
  }
}

// ── PUT /auth/me/password ───────────────────────────────
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      const error = new Error('Mot de passe actuel incorrect');
      error.status = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Le nouveau mot de passe doit être DIFFÉRENT de l'actuel —
    // "changer" son mot de passe pour le même ne sert à rien, et
    // pourrait laisser croire, à tort, qu'une compromission a été
    // traitée. Vérifié ICI (pas seulement côté client, facilement
    // contournable) puisque c'est une vraie règle de sécurité.
    const sameAsBefore = await argon2.verify(user.passwordHash, newPassword);
    if (sameAsBefore) {
      const error = new Error('Le nouveau mot de passe doit être différent de l\'actuel');
      error.status = 400;
      error.code = 'PASSWORD_UNCHANGED';
      throw error;
    }

    const passwordHash = await argon2.hash(newPassword);
    // S5A-06 : tokenVersion + 1 = toutes les sessions ouvertes
    // AILLEURS sont révoquées (si on change son mot de passe, c'est
    // souvent qu'on le croit compromis : les sessions de l'intrus
    // doivent tomber avec). On renvoie un NOUVEAU jeton pour que la
    // session actuelle, elle, continue sans reconnexion.
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    res.json({
      message: 'Mot de passe modifié avec succès. Vos autres sessions ont été déconnectées.',
      token: signToken(updated),
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/forgot-password ──────────────────────────
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    // On répond TOUJOURS la même chose, que l'email existe
    // ou non — ne pas révéler si un email est inscrit.
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = await createToken(user.id, 'RESET_PASSWORD');
      await sendResetPasswordEmail(email, token);
    }

    // Même réponse dans les deux cas (anti-énumération)
    res.json({
      message: 'Si cette adresse est associée à un compte, un email de réinitialisation a été envoyé.',
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/reset-password ───────────────────────────
export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    const authToken = await verifyAndConsumeToken(token, 'RESET_PASSWORD');

    const passwordHash = await argon2.hash(password);
    // S5A-06 : réinitialiser = toutes les sessions existantes sont
    // révoquées, sans exception (la personne n'est connectée nulle
    // part de légitime : elle avait perdu son mot de passe).
    await prisma.user.update({
      where: { id: authToken.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    res.json({ message: 'Mot de passe réinitialisé avec succès ! Vous pouvez vous connecter.' });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /auth/me ─────────────────────────────────────
// Effacement RGPD : supprime le compte et ses données
export async function deleteAccount(req, res, next) {
  try {
    const userId = req.user.userId;

    // S5A-06 : action irréversible → mot de passe exigé (un ordinateur
    // resté ouvert ne doit pas suffire à effacer un compte).
    const user = await prisma.user.findUnique({ where: { id: userId } });
    await assertCurrentPassword(user, req.body?.password);

    // La suppression cascade les votes (onDelete: Cascade)
    // et anonymise les réponses d'enquête (onDelete: SetNull)
    // — configuré dans schema.prisma
    await prisma.user.delete({ where: { id: userId } });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
