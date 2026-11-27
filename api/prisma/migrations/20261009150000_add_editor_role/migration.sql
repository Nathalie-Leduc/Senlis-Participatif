-- S5R2-11 : rôle « Admin-test » (EDITOR)
-- Ajouter une valeur à un enum PostgreSQL ne touche à aucune ligne
-- existante : les comptes CITIZEN et ADMIN restent ce qu'ils sont.
-- AlterEnum
-- BEFORE 'ADMIN' : même ordre que dans schema.prisma (CITIZEN, EDITOR, ADMIN)
ALTER TYPE "Role" ADD VALUE 'EDITOR' BEFORE 'ADMIN';
