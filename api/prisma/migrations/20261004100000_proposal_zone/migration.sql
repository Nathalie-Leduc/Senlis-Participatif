-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "zoneQuartiers" "Quartier"[] DEFAULT ARRAY[]::"Quartier"[],
ADD COLUMN     "zoneWholeCity" BOOLEAN NOT NULL DEFAULT false;
