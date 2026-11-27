-- S5R2-09 : second email (« dernier rappel ») 7 jours avant la
-- suppression d'un compte inactif. Aucune donnée existante modifiée.
ALTER TABLE "User" ADD COLUMN "inactivityFinalWarnedAt" TIMESTAMP(3);
