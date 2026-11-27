-- S5R2-06 : le centre en deux quartiers — ajout de « Quartier Saint-Vincent »
-- CENTRE_HISTORIQUE désigne désormais le seul Centre historique.
-- Aucune ligne existante n'est modifiée : un profil « centre historique »
-- reste tel quel (on ne peut pas deviner qui habite Saint-Vincent) ;
-- l'enquête fera confirmer la situation, préremplie et modifiable.
-- AFTER : même ordre que dans schema.prisma
-- AlterEnum
ALTER TYPE "Quartier" ADD VALUE 'SAINT_VINCENT' AFTER 'CENTRE_HISTORIQUE';
