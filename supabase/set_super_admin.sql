-- After creating user in Supabase Dashboard, run this to set them as super admin
DO $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user's ID from auth.users
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = 'admin@bets.com';  -- Replace with the email you used in dashboard

    -- Update auth.users metadata
    UPDATE auth.users 
    SET raw_app_meta_data = raw_app_meta_data || 
        '{"is_super_admin": true}'::jsonb
    WHERE id = user_id;

    -- Insert into public.users
    INSERT INTO public.users (id, email, full_name, is_super_admin)
    SELECT 
        id,
        email,
        COALESCE((raw_user_meta_data->>'full_name'), 'Super Admin'),
        true
    FROM auth.users
    WHERE id = user_id;
END $$;
