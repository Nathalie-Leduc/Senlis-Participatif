-- CreateEnum
CREATE TYPE "Situation" AS ENUM ('CENTRE_RESIDENT', 'CENTRE_COMMERCANT', 'AUTRE_QUARTIER', 'HORS_SENLIS');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "showIfOptionId" TEXT;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "resultsPublished" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "situation" "Situation";

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_showIfOptionId_fkey" FOREIGN KEY ("showIfOptionId") REFERENCES "QuestionOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
