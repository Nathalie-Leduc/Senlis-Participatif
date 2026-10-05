-- ══════════════════════════════════════════════════════════════
-- S5R-07 — Public visé d'une enquête par critères de profil
--
-- Écrite à la main, comme survey_engine_v2 : elle TRADUIT l'ancien
-- choix unique (Survey.audience) dans les nouveaux critères AVANT de
-- supprimer l'ancienne colonne. Une migration générée aurait effacé
-- le public visé de toutes les enquêtes existantes.
--
--   TOUS        → aucun critère (tout le monde)
--   RESIDENTS   → habitants du centre historique
--   COMMERCANTS → personnes qui DIRIGENT une activité dans le centre
-- ══════════════════════════════════════════════════════════════

-- 1. Nouvelles colonnes ───────────────────────────────────────

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "audienceQuartiers" "Quartier"[] DEFAULT ARRAY[]::"Quartier"[],
ADD COLUMN     "audienceSituations" "Situation"[] DEFAULT ARRAY[]::"Situation"[],
ADD COLUMN     "audienceWorkQuartiers" "Quartier"[] DEFAULT ARRAY[]::"Quartier"[],
ADD COLUMN     "audienceWorkTypes" "TravailType"[] DEFAULT ARRAY[]::"TravailType"[];

-- 2. Reprise des données ──────────────────────────────────────

UPDATE "Survey" SET "audienceSituations" = ARRAY['CENTRE_RESIDENT']::"Situation"[]
WHERE "audience" = 'RESIDENTS';

UPDATE "Survey" SET "audienceWorkQuartiers" = ARRAY['CENTRE_HISTORIQUE']::"Quartier"[],
                    "audienceWorkTypes" = ARRAY['COMMERCANT']::"TravailType"[]
WHERE "audience" = 'COMMERCANTS';

-- 3. Suppression de l'ancien choix unique ─────────────────────

-- AlterTable
ALTER TABLE "Survey" DROP COLUMN "audience";

-- DropEnum
DROP TYPE "Audience";
