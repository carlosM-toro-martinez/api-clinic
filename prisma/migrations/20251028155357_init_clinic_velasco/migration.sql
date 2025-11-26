/*
  Warnings:

  - The `remainingAmount` column on the `Appointment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `reservationAmount` column on the `Appointment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `totalAmount` column on the `Appointment` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "remainingAmount",
ADD COLUMN     "remainingAmount" DECIMAL(65,30),
DROP COLUMN "reservationAmount",
ADD COLUMN     "reservationAmount" DECIMAL(65,30),
DROP COLUMN "totalAmount",
ADD COLUMN     "totalAmount" DECIMAL(65,30);
