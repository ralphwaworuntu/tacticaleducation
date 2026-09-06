-- AlterTable
ALTER TABLE `membershippackage` ADD COLUMN `moduleQuota` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `tryoutQuota` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `transaction` ADD COLUMN `addonId` VARCHAR(191) NULL,
    ADD COLUMN `moduleQuota` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `moduleUsed` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `targetTransactionId` VARCHAR(191) NULL,
    ADD COLUMN `tryoutQuota` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `tryoutUsed` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `type` ENUM('MEMBERSHIP', 'ADDON') NOT NULL DEFAULT 'MEMBERSHIP';

-- CreateTable
CREATE TABLE `PackageMaterial` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `materialId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `PackageMaterial_packageId_materialId_key`(`packageId`, `materialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AddonPackage` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `price` INTEGER NOT NULL,
    `tryoutBonus` INTEGER NOT NULL DEFAULT 0,
    `moduleBonus` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `AddonPackage_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AddonPackageMaterial` (
    `id` VARCHAR(191) NOT NULL,
    `addonId` VARCHAR(191) NOT NULL,
    `materialId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `AddonPackageMaterial_addonId_materialId_key`(`addonId`, `materialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentSetting` (
    `id` VARCHAR(191) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `accountNumber` VARCHAR(191) NOT NULL,
    `accountHolder` VARCHAR(191) NOT NULL DEFAULT '',
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteSetting` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SiteSetting_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_addonId_fkey` FOREIGN KEY (`addonId`) REFERENCES `AddonPackage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_targetTransactionId_fkey` FOREIGN KEY (`targetTransactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackageMaterial` ADD CONSTRAINT `PackageMaterial_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `MembershipPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackageMaterial` ADD CONSTRAINT `PackageMaterial_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `Material`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AddonPackageMaterial` ADD CONSTRAINT `AddonPackageMaterial_addonId_fkey` FOREIGN KEY (`addonId`) REFERENCES `AddonPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AddonPackageMaterial` ADD CONSTRAINT `AddonPackageMaterial_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `Material`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
