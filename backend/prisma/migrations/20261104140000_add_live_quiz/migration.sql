-- CreateTable
CREATE TABLE `Quiz` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `subject` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `settings` JSON NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Quiz_createdById_updatedAt_idx`(`createdById`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuizQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `quizId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `type` ENUM('SINGLE', 'TRUE_FALSE', 'MULTIPLE') NOT NULL DEFAULT 'SINGLE',
    `prompt` LONGTEXT NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `timeLimitSec` INTEGER NULL,
    `weight` ENUM('NORMAL', 'DOUBLE', 'NONE') NOT NULL DEFAULT 'NORMAL',
    `sourceType` VARCHAR(191) NULL,
    `sourceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuizQuestion_quizId_order_idx`(`quizId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuizOption` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `label` LONGTEXT NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `isCorrect` BOOLEAN NOT NULL DEFAULT false,

    INDEX `QuizOption_questionId_order_idx`(`questionId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveSession` (
    `id` VARCHAR(191) NOT NULL,
    `quizId` VARCHAR(191) NOT NULL,
    `hostId` VARCHAR(191) NOT NULL,
    `pin` VARCHAR(191) NOT NULL,
    `activePin` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'LOBBY', 'COUNTDOWN', 'QUESTION_ACTIVE', 'QUESTION_RESULT', 'SCORE_RESULT', 'LEADERBOARD', 'FINISHED', 'CANCELLED') NOT NULL DEFAULT 'LOBBY',
    `settings` JSON NOT NULL,
    `snapshot` JSON NOT NULL,
    `lobbyLocked` BOOLEAN NOT NULL DEFAULT false,
    `paused` BOOLEAN NOT NULL DEFAULT false,
    `currentIndex` INTEGER NOT NULL DEFAULT -1,
    `stateVersion` INTEGER NOT NULL DEFAULT 0,
    `phaseStartedAt` DATETIME(3) NULL,
    `phaseDeadlineAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,

    UNIQUE INDEX `LiveSession_activePin_key`(`activePin`),
    INDEX `LiveSession_pin_idx`(`pin`),
    INDEX `LiveSession_hostId_createdAt_idx`(`hostId`, `createdAt`),
    INDEX `LiveSession_quizId_idx`(`quizId`),
    INDEX `LiveSession_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LivePlayer` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `isConnected` BOOLEAN NOT NULL DEFAULT true,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `kickedAt` DATETIME(3) NULL,
    `totalScore` INTEGER NOT NULL DEFAULT 0,
    `correctCount` INTEGER NOT NULL DEFAULT 0,
    `correctTimeMs` INTEGER NOT NULL DEFAULT 0,
    `rank` INTEGER NULL,

    INDEX `LivePlayer_sessionId_totalScore_idx`(`sessionId`, `totalScore`),
    UNIQUE INDEX `LivePlayer_sessionId_nameKey_key`(`sessionId`, `nameKey`),
    UNIQUE INDEX `LivePlayer_sessionId_userId_key`(`sessionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `questionIndex` INTEGER NOT NULL,
    `selectedOptionIds` JSON NOT NULL,
    `isCorrect` BOOLEAN NOT NULL,
    `responseMs` INTEGER NOT NULL,
    `scoreEarned` INTEGER NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL,

    INDEX `LiveAnswer_sessionId_questionIndex_idx`(`sessionId`, `questionIndex`),
    UNIQUE INDEX `LiveAnswer_playerId_questionIndex_key`(`playerId`, `questionIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveQuestionState` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `questionIndex` INTEGER NOT NULL,
    `openedAt` DATETIME(3) NOT NULL,
    `deadlineAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `answeredCount` INTEGER NOT NULL DEFAULT 0,
    `optionCounts` JSON NULL,

    UNIQUE INDEX `LiveQuestionState_sessionId_questionIndex_key`(`sessionId`, `questionIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveResult` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `finalRank` INTEGER NOT NULL,
    `totalPoints` INTEGER NOT NULL,
    `correctCount` INTEGER NOT NULL,
    `incorrectCount` INTEGER NOT NULL,
    `unansweredCount` INTEGER NOT NULL,
    `totalQuestions` INTEGER NOT NULL,
    `accuracy` DOUBLE NOT NULL,
    `finishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LiveResult_playerId_key`(`playerId`),
    INDEX `LiveResult_sessionId_finalRank_idx`(`sessionId`, `finalRank`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Quiz` ADD CONSTRAINT `Quiz_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizQuestion` ADD CONSTRAINT `QuizQuestion_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizOption` ADD CONSTRAINT `QuizOption_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `QuizQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveSession` ADD CONSTRAINT `LiveSession_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveSession` ADD CONSTRAINT `LiveSession_hostId_fkey` FOREIGN KEY (`hostId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LivePlayer` ADD CONSTRAINT `LivePlayer_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `LiveSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LivePlayer` ADD CONSTRAINT `LivePlayer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveAnswer` ADD CONSTRAINT `LiveAnswer_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `LiveSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveAnswer` ADD CONSTRAINT `LiveAnswer_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `LivePlayer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveQuestionState` ADD CONSTRAINT `LiveQuestionState_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `LiveSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveResult` ADD CONSTRAINT `LiveResult_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `LiveSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveResult` ADD CONSTRAINT `LiveResult_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `LivePlayer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

