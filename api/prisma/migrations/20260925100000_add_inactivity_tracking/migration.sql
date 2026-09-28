-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inactivityWarnedAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);
