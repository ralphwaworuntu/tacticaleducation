-- AlterTable
ALTER TABLE `CermatSession`
  ADD COLUMN `mode` ENUM('NUMBER', 'LETTER') NOT NULL DEFAULT 'NUMBER',
  CHANGE `baseDigits` `baseSet` TEXT NOT NULL DEFAULT '[]';

ALTER TABLE `CermatAnswer`
  MODIFY `userAnswer` VARCHAR(191) NULL,
  MODIFY `correctAnswer` VARCHAR(191) NOT NULL;
