-- Create the first super admin user
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@bets.com',  -- Replace with your desired email
    crypt('Admin@123', gen_salt('bf')),  -- Replace with your desired password
    NOW(),
    '{"is_super_admin": true}'::jsonb,
    '{"full_name": "Super Admin"}'::jsonb,  -- Replace with desired name
    NOW(),
    NOW()
) RETURNING id, email;
