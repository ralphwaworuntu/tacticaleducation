-- Ensure FK on ExamBlock.userId still has a supporting index before dropping composite index
CREATE INDEX `ExamBlock_userId_idx` ON `examblock`(`userId`);

-- DropIndex
DROP INDEX `ExamBlock_userId_type_idx` ON `examblock`;

-- AlterTable
ALTER TABLE `announcement` ADD COLUMN `targetAll` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `targetPackageIds` JSON NULL,
    MODIFY `imageUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `cermatsession` ADD COLUMN `attemptId` VARCHAR(191) NULL,
    ADD COLUMN `score` DOUBLE NULL,
    ADD COLUMN `sessionIndex` INTEGER NOT NULL DEFAULT 1,
    MODIFY `baseSet` VARCHAR(191) NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE `practiceoption` ADD COLUMN `imageUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `practicequestion` ADD COLUMN `imageUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tryoutoption` ADD COLUMN `imageUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tryoutquestion` ADD COLUMN `imageUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `healthIssues` VARCHAR(191) NULL,
    ADD COLUMN `heightCm` INTEGER NULL,
    ADD COLUMN `nationalId` VARCHAR(191) NULL,
    ADD COLUMN `parentAddress` VARCHAR(191) NULL,
    ADD COLUMN `parentName` VARCHAR(191) NULL,
    ADD COLUMN `parentOccupation` VARCHAR(191) NULL,
    ADD COLUMN `parentPhone` VARCHAR(191) NULL,
    ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `weightKg` INTEGER NULL;

-- CreateTable
CREATE TABLE `CermatAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `mode` ENUM('NUMBER', 'LETTER') NOT NULL DEFAULT 'NUMBER',
    `totalSessions` INTEGER NOT NULL,
    `questionCount` INTEGER NOT NULL,
    `durationSeconds` INTEGER NOT NULL,
    `breakSeconds` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `averageScore` DOUBLE NULL,
    `totalAnswered` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CermatSession` ADD CONSTRAINT `CermatSession_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `CermatAttempt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CermatAttempt` ADD CONSTRAINT `CermatAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
