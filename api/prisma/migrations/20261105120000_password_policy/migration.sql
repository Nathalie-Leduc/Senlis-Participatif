-- S5R-13b : politique des mots de passe CNIL + NIST combinée
-- (document 21, § 8.5). Aucune donnée existante n'est modifiée :
-- les comptes gardent leur mot de passe actuel.

-- Date du dernier choix de mot de passe (rappel annuel des comptes
-- de l'équipe). Null pour les comptes existants : on compte alors
-- depuis la création du compte.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- Limite de 10 essais par heure et par compte (clé = empreinte HMAC
-- de l'adresse email, jamais l'adresse en clair)
CREATE TABLE "LoginThrottle" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "LoginThrottle_windowStart_idx" ON "LoginThrottle"("windowStart");
