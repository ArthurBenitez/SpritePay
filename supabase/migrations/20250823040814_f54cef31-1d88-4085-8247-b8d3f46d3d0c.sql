-- Remove unique constraint to allow multiple sprites of same type per user
-- This enables admin mode to purchase multiple quantities and users to reacquire sprites lost in lottery
ALTER TABLE user_sprites DROP CONSTRAINT IF EXISTS user_sprites_user_id_sprite_id_key;