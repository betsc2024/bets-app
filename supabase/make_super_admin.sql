-- Make a user super admin by their email
UPDATE auth.users 
SET raw_app_meta_data = raw_app_meta_data || 
    '{"is_super_admin": true}'::jsonb
WHERE email = 'your.email@example.com';

-- Update the public users table as well
UPDATE public.users
SET is_super_admin = true
WHERE email = 'your.email@example.com';
