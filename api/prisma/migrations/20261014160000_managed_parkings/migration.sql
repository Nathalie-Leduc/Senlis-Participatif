-- S5R2-05 : parkings gérés par l'administration (remplace l'extraction
-- OpenStreetMap). Table vide à la création : les données initiales
-- (plan 2023 + guide 2025) sont insérées par le seed (seed-prod.js,
-- seed.js), seulement si la table est encore vide.

-- CreateEnum
CREATE TYPE "ParkingRegime" AS ENUM ('GRATUIT', 'ZONE_ROUGE', 'ZONE_VERTE', 'GARE', 'DUREE_LIMITEE', 'PARC_PAYANT');

-- CreateEnum
CREATE TYPE "ParkingCharging" AS ENUM ('AUCUNE', 'EXISTANTE', 'EN_PROJET');

-- CreateTable
CREATE TABLE "Parking" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "places" INTEGER,
    "regime" "ParkingRegime",
    "charging" "ParkingCharging" NOT NULL DEFAULT 'AUCUNE',
    "chargingPoints" INTEGER,
    "pmrPlaces" INTEGER,
    "note" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Parking_name_key" ON "Parking"("name");
