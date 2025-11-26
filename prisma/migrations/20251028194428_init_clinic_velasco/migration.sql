/*
  Warnings:

  - You are about to drop the column `effectiveFrom` on the `Fee` table. All the data in the column will be lost.
  - You are about to drop the column `effectiveTo` on the `Fee` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fee" DROP COLUMN "effectiveFrom",
DROP COLUMN "effectiveTo";
