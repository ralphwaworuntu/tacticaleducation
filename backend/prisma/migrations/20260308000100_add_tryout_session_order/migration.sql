ALTER TABLE `Tryout`
  ADD COLUMN `sessionOrder` INTEGER NULL;

CREATE UNIQUE INDEX `Tryout_subCategoryId_sessionOrder_key`
  ON `Tryout`(`subCategoryId`, `sessionOrder`);
