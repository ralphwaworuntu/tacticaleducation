ALTER TABLE \\PracticeSet\\ ADD COLUMN \\reeForNewMembers\\ BOOLEAN NOT NULL DEFAULT true, ADD COLUMN \\reePackageIds\\ JSON NOT NULL DEFAULT ('[]');
ALTER TABLE \\Tryout\\ ADD COLUMN \\reeForNewMembers\\ BOOLEAN NOT NULL DEFAULT true, ADD COLUMN \\reePackageIds\\ JSON NOT NULL DEFAULT ('[]');
