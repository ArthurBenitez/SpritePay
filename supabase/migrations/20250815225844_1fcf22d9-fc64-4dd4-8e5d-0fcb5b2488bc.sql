-- Update admin user to be confirmed
UPDATE auth.users 
SET email_confirmed_at = now(), 
    confirmed_at = now()
WHERE email = 'admin@imperium.com';

-- Insert admin user if it doesn't exist
INSERT INTO auth.users (
    id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    confirmed_at, 
    created_at, 
    updated_at,
    raw_user_meta_data
)
SELECT 
    gen_random_uuid(),
    'admin@imperium.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    now(),
    now(),
    now(),
    '{"name": "Admin"}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@imperium.com'
);