-- ══════════════════════════════════════════════════════════════
-- S5R-05 — Moteur d'enquête v2
--
-- Migration écrite à la main (et non générée) parce qu'elle doit
-- DÉPLACER des données : chaque ancien branchement (showIfOptionId)
-- devient une ligne de la nouvelle table QuestionCondition AVANT que
-- l'ancienne colonne soit supprimée. Une migration générée aurait
-- supprimé la colonne… et perdu tous les branchements existants.
--
-- Ordre : 1. créer → 2. recopier les données → 3. supprimer l'ancien.
-- ══════════════════════════════════════════════════════════════

-- 1. Nouvelles colonnes ───────────────────────────────────────

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "travailleASenlis" BOOLEAN;

-- AlterTable
ALTER TABLE "QuestionOption" ADD COLUMN     "endsSurvey" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "maxChoicesFromId" TEXT,
ADD COLUMN     "maxValue" DOUBLE PRECISION,
ADD COLUMN     "minValue" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "QuestionCondition" (
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "QuestionCondition_pkey" PRIMARY KEY ("questionId","optionId")
);

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_maxChoicesFromId_fkey" FOREIGN KEY ("maxChoicesFromId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionCondition" ADD CONSTRAINT "QuestionCondition_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionCondition" ADD CONSTRAINT "QuestionCondition_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuestionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Reprise des données ──────────────────────────────────────

-- Chaque ancien branchement devient une condition (aucune perte)
INSERT INTO "QuestionCondition" ("questionId", "optionId")
SELECT "id", "showIfOptionId" FROM "Question" WHERE "showIfOptionId" IS NOT NULL;

-- Un quartier de travail renseigné voulait forcément dire « travaille à
-- Senlis ». Un quartier vide reste NULL (« on ne sait pas ») : on ne
-- transforme JAMAIS une absence d'information en « non ».
UPDATE "User" SET "travailleASenlis" = true WHERE "travailleQuartier" IS NOT NULL;

-- 3. Suppression de l'ancien branchement ──────────────────────

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_showIfOptionId_fkey";

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "showIfOptionId";
