CREATE TABLE `TryoutSubCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `TryoutSubCategory_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PracticeSubCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `PracticeSubCategory_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PracticeSubSubCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `subCategoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `PracticeSubSubCategory_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Tryout` ADD COLUMN `subCategoryId` VARCHAR(191) NULL;

ALTER TABLE `PracticeSet`
    ADD COLUMN `subSubCategoryId` VARCHAR(191) NULL,
    ADD COLUMN `durationMinutes` INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN `totalQuestions` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `openAt` DATETIME(3) NULL,
    ADD COLUMN `closeAt` DATETIME(3) NULL;

INSERT INTO `TryoutSubCategory` (`id`, `name`, `slug`, `categoryId`, `createdAt`, `updatedAt`)
SELECT UUID(), CONCAT(`name`, ' Default'), CONCAT(`slug`, '-default'), `id`, NOW(), NOW()
FROM `TryoutCategory`;

INSERT INTO `PracticeSubCategory` (`id`, `name`, `slug`, `categoryId`, `createdAt`, `updatedAt`)
SELECT UUID(), CONCAT(`name`, ' Default'), CONCAT(`slug`, '-default'), `id`, NOW(), NOW()
FROM `PracticeCategory`;

INSERT INTO `PracticeSubSubCategory` (`id`, `name`, `slug`, `subCategoryId`, `createdAt`, `updatedAt`)
SELECT UUID(), CONCAT(`name`, ' Default'), CONCAT(`slug`, '-default'), `id`, NOW(), NOW()
FROM `PracticeSubCategory`;

UPDATE `Tryout` t
JOIN `TryoutSubCategory` sc ON sc.`categoryId` = t.`categoryId`
SET t.`subCategoryId` = sc.`id`
WHERE t.`subCategoryId` IS NULL;

UPDATE `PracticeSet` ps
JOIN `PracticeCategory` pc ON pc.`id` = ps.`categoryId`
JOIN `PracticeSubCategory` psc ON psc.`categoryId` = pc.`id`
JOIN `PracticeSubSubCategory` pssc ON pssc.`subCategoryId` = psc.`id`
SET ps.`subSubCategoryId` = pssc.`id`
WHERE ps.`subSubCategoryId` IS NULL;

ALTER TABLE `Tryout` MODIFY `subCategoryId` VARCHAR(191) NOT NULL;
ALTER TABLE `PracticeSet` MODIFY `subSubCategoryId` VARCHAR(191) NOT NULL;

ALTER TABLE `TryoutSubCategory`
    ADD CONSTRAINT `TryoutSubCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `TryoutCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PracticeSubCategory`
    ADD CONSTRAINT `PracticeSubCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `PracticeCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PracticeSubSubCategory`
    ADD CONSTRAINT `PracticeSubSubCategory_subCategoryId_fkey` FOREIGN KEY (`subCategoryId`) REFERENCES `PracticeSubCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Tryout`
    ADD CONSTRAINT `Tryout_subCategoryId_fkey` FOREIGN KEY (`subCategoryId`) REFERENCES `TryoutSubCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PracticeSet`
    ADD CONSTRAINT `PracticeSet_subSubCategoryId_fkey` FOREIGN KEY (`subSubCategoryId`) REFERENCES `PracticeSubSubCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Tryout` DROP FOREIGN KEY `Tryout_categoryId_fkey`;
ALTER TABLE `PracticeSet` DROP FOREIGN KEY `PracticeSet_categoryId_fkey`;

ALTER TABLE `Tryout` DROP COLUMN `categoryId`;
ALTER TABLE `PracticeSet` DROP COLUMN `categoryId`;
