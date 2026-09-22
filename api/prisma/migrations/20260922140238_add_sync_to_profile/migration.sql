-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "syncsToProfile" TEXT;

-- AlterTable
ALTER TABLE "QuestionOption" ADD COLUMN     "syncValue" TEXT;
