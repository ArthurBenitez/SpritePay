-- Add tutorial_views column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN tutorial_views integer NOT NULL DEFAULT 0;