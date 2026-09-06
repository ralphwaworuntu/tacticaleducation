-- AlterTable
ALTER TABLE `TryoutQuestion` MODIFY `prompt` LONGTEXT NOT NULL;
ALTER TABLE `TryoutQuestion` MODIFY `explanation` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `PracticeQuestion` MODIFY `prompt` LONGTEXT NOT NULL;
ALTER TABLE `PracticeQuestion` MODIFY `explanation` LONGTEXT NULL;
