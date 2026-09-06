-- AlterEnum: add IMAGE mode for gambar hilang kecermatan
ALTER TABLE `CermatSession` MODIFY `mode` ENUM('NUMBER', 'LETTER', 'IMAGE') NOT NULL DEFAULT 'NUMBER';
ALTER TABLE `CermatAttempt` MODIFY `mode` ENUM('NUMBER', 'LETTER', 'IMAGE') NOT NULL DEFAULT 'NUMBER';
