// ══════════════════════════════════════════════════════════
// Contrôleur Auth — la logique métier de l'authentification
//
// Chaque fonction gère un cas d'utilisation complet :
// validation → action BDD → réponse. Les validations Zod
// sont faites AVANT par le middleware validate().
// ══════════════════════════════════════════════════════════

import argon2 from 'argon2';
import prisma from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { createToken, verifyAndConsumeToken } from '../services/token.js';
import { sendVerificationEmail, sendResetPasswordEmail } from '../services/email.js';

// ── POST /auth/register ─────────────────────────────────
export async function register(req, res, next) {
  try {
    const { email, password, pseudo } = req.body;

    // Vérifie si l'email est déjà pris
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const error = new Error('Cette adresse email est déjà utilisée');
      error.status = 409; // Conflict
      error.code = 'EMAIL_TAKEN';
      throw error;
    }

    // Hash du mot de passe avec Argon2id (état de l'art 2026)
    // Argon2id combine résistance aux attaques GPU (Argon2d)
    // et aux attaques par canaux auxiliaires (Argon2i).
    const passwordHash = await argon2.hash(password);

    // Crée l'utilisateur (emailVerified = false par défaut)
    const user = await prisma.user.create({
      data: { email, pseudo, passwordHash },
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
    const authToken = await verifyAndConsumeToken(token, 'VERIFY_EMAIL');

    // Active le compte
    await prisma.user.update({
      where: { id: authToken.userId },
      data: { emailVerified: true },
    });

    res.json({ message: 'Email vérifié avec succès ! Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/login ────────────────────────────────────
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

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

    if (!user) throw genericError();

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

    // Tout est bon → JWT
    const jwt = signToken(user);

    res.json({
      token: jwt,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        role: user.role,
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
        notificationPref: true,
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

// ── PATCH /auth/me ──────────────────────────────────────
export async function updateProfile(req, res, next) {
  try {
    const { pseudo, email } = req.body;
    const userId = req.user.userId;

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
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(pseudo && { pseudo }),
        ...(email && { email, emailVerified: false }),
      },
      select: { id: true, email: true, pseudo: true, role: true, emailVerified: true },
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

    const passwordHash = await argon2.hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ message: 'Mot de passe modifié avec succès.' });
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
    await prisma.user.update({
      where: { id: authToken.userId },
      data: { passwordHash },
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

    // La suppression cascade les votes (onDelete: Cascade)
    // et anonymise les réponses d'enquête (onDelete: SetNull)
    // — configuré dans schema.prisma
    await prisma.user.delete({ where: { id: userId } });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
