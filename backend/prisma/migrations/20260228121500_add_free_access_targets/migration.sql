ALTER TABLE `PracticeSet`
  ADD COLUMN `freeForNewMembers` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `freePackageIds` JSON NOT NULL DEFAULT ('[]');

ALTER TABLE `Tryout`
  ADD COLUMN `freeForNewMembers` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `freePackageIds` JSON NOT NULL DEFAULT ('[]');
