-- Add missing created_at column to device_sessions table
ALTER TABLE device_sessions ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();