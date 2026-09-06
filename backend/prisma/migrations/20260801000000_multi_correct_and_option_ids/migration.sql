-- Multi-jawaban benar + simpan banyak opsi terpilih per soal
ALTER TABLE `PracticeQuestion` ADD COLUMN `multipleCorrect` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `TryoutQuestion` ADD COLUMN `multipleCorrect` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `PracticeAnswer` ADD COLUMN `selectedOptionIds` JSON NULL;
ALTER TABLE `TryoutAnswer` ADD COLUMN `selectedOptionIds` JSON NULL;
