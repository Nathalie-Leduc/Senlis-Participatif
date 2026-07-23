// ══════════════════════════════════════════════════════════
// Service Email — Nodemailer
//
// Ce fichier ne connaît NI Mailtrap NI Brevo. Il lit les
// variables SMTP_* depuis l'environnement. La bascule
// dev → prod = changer le .env, zéro ligne de code.
//
// Mailtrap (dev) : boîte aux lettres de test, rien ne part
// vers de vrais destinataires → on teste le rendu sans risque.
// Brevo (prod) : envoi réel, SPF/DKIM à configurer.
// ══════════════════════════════════════════════════════════

import nodemailer from 'nodemailer';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Senlis Participatif <no-reply@senlis-participatif.fr>';

// Crée le transporteur SMTP une seule fois (connexion réutilisée)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '2525', 10),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Envoie un email. Logue en dev, lève une erreur si ça échoue.
 */
async function sendEmail({ to, subject, html }) {
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`📧 Email envoyé à ${to} (${info.messageId})`);
  } catch (err) {
    console.error(`❌ Échec envoi email à ${to}:`, err.message);
    // On ne bloque pas l'inscription si l'email échoue,
    // mais on logue l'erreur pour investigation
  }
}

// ── Gabarits d'emails ───────────────────────────────────

/**
 * Email de vérification d'adresse (inscription)
 */
export async function sendVerificationEmail(email, token) {
  const link = `${CLIENT_URL}/verification-email?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'Confirmez votre inscription — Senlis Participatif',
    html: `
      <div style="font-family: 'Public Sans', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h1 style="font-family: Georgia, serif; color: #26333A; font-size: 24px;">
          Bienvenue sur Senlis Participatif ! 🦌
        </h1>
        <p style="color: #6B6257; font-size: 16px; line-height: 1.6;">
          Pour activer votre compte et commencer à participer,
          cliquez sur le bouton ci-dessous :
        </p>
        <a href="${link}" style="
          display: inline-block;
          background: #1E5F7C;
          color: #fff;
          padding: 14px 28px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          margin: 16px 0;
        ">Vérifier mon email</a>
        <p style="color: #6B6257; font-size: 14px;">
          Ce lien expire dans 1 heure. Si vous n'avez pas créé de
          compte, ignorez simplement cet email.
        </p>
        <hr style="border: none; border-top: 1px solid #e3dcce; margin: 24px 0;" />
        <p style="color: #B9B2A4; font-size: 12px;">
          Senlis Participatif — Plateforme citoyenne indépendante
        </p>
      </div>
    `,
  });
}

/**
 * Email de réinitialisation de mot de passe
 */
export async function sendResetPasswordEmail(email, token) {
  const link = `${CLIENT_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'Réinitialisez votre mot de passe — Senlis Participatif',
    html: `
      <div style="font-family: 'Public Sans', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h1 style="font-family: Georgia, serif; color: #26333A; font-size: 24px;">
          Mot de passe oublié ? 🔑
        </h1>
        <p style="color: #6B6257; font-size: 16px; line-height: 1.6;">
          Cliquez sur le bouton ci-dessous pour choisir un
          nouveau mot de passe :
        </p>
        <a href="${link}" style="
          display: inline-block;
          background: #1E5F7C;
          color: #fff;
          padding: 14px 28px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          margin: 16px 0;
        ">Réinitialiser mon mot de passe</a>
        <p style="color: #6B6257; font-size: 14px;">
          Ce lien expire dans 1 heure. Si vous n'avez pas demandé
          de réinitialisation, ignorez cet email — votre mot de
          passe actuel reste inchangé.
        </p>
        <hr style="border: none; border-top: 1px solid #e3dcce; margin: 24px 0;" />
        <p style="color: #B9B2A4; font-size: 12px;">
          Senlis Participatif — Plateforme citoyenne indépendante
        </p>
      </div>
    `,
  });
}

/**
 * Code de connexion à 6 chiffres (double authentification admin).
 * Le code est affiché en GROS et espacé (letter-spacing) : il doit
 * être lisible d'un coup d'œil pour être retapé, contrairement aux
 * autres emails qui portent un lien cliquable.
 */
export async function sendTwoFactorCode(email, code) {
  await sendEmail({
    to: email,
    subject: `${code} — votre code de connexion Senlis Participatif`,
    html: `
      <div style="font-family: 'Public Sans', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h1 style="font-family: Georgia, serif; color: #26333A; font-size: 24px;">
          Code de connexion 🔐
        </h1>
        <p style="color: #6B6257; font-size: 16px; line-height: 1.6;">
          Voici votre code à saisir pour terminer la connexion à votre compte administrateur :
        </p>
        <p style="
          font-family: 'Courier New', monospace;
          font-size: 36px;
          font-weight: 700;
          letter-spacing: 8px;
          color: #1E5F7C;
          background: #E3EEF3;
          padding: 16px 24px;
          border-radius: 12px;
          text-align: center;
          margin: 20px 0;
        ">${code}</p>
        <p style="color: #6B6257; font-size: 14px;">
          Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette
          tentative de connexion, changez votre mot de passe sans attendre.
        </p>
        <hr style="border: none; border-top: 1px solid #e3dcce; margin: 24px 0;" />
        <p style="color: #B9B2A4; font-size: 12px;">
          Senlis Participatif — Plateforme citoyenne indépendante
        </p>
      </div>
    `,
  });
}
