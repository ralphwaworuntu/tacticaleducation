-- Live Quiz 2.0: avatar pemain. Aditif & nullable; baris lama tetap valid (avatar default dihitung di aplikasi).
ALTER TABLE `LivePlayer` ADD COLUMN `avatarId` VARCHAR(32) NULL;
