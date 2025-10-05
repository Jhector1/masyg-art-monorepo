-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" VARCHAR(255),
ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0;
