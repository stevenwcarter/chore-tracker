-- Your SQL goes here
ALTER TABLE user_images ADD COLUMN uuid TEXT;
CREATE UNIQUE INDEX user_images_uuid_idx ON user_images(uuid);
