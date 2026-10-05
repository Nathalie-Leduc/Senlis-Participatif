-- CreateEnum
CREATE TYPE "TravailType" AS ENUM ('COMMERCANT', 'SALARIE');

-- AlterEnum
ALTER TYPE "Quartier" ADD VALUE 'CENTRE_HISTORIQUE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "travailType" "TravailType",
ADD COLUMN     "travailleQuartier" "Quartier";
