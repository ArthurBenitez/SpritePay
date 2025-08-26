-- Fix ad_progress table: add unique constraint on user_id
ALTER TABLE ad_progress ADD CONSTRAINT ad_progress_user_id_unique UNIQUE (user_id);

-- Fix ad_statistics table: add unique constraint on user_id, placement_id, date
ALTER TABLE ad_statistics ADD CONSTRAINT ad_statistics_user_placement_date_unique UNIQUE (user_id, placement_id, date);

-- Ensure placement_id has a default value for existing records
UPDATE ad_statistics SET placement_id = 'default' WHERE placement_id IS NULL;