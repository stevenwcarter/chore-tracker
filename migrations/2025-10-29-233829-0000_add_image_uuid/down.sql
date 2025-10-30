-- This file should undo anything in `up.sql`
DROP INDEX user_images_uuid_idx;
ALTER TABLE user_images DROP COLUMN uuid;
