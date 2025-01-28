-- Function to create super admin
CREATE OR REPLACE FUNCTION create_super_admin(
    email TEXT,
    password TEXT,
    full_name TEXT
) RETURNS json AS $$
DECLARE
    new_user_id UUID;
    result json;
BEGIN
    -- Create user in auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        email,
        crypt(password, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"], "is_super_admin": true}'::jsonb,
        format('{"full_name": "%s"}', full_name)::jsonb,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ) RETURNING id INTO new_user_id;

    -- Insert into users table
    INSERT INTO public.users (
        id,
        email,
        full_name,
        is_super_admin
    ) VALUES (
        new_user_id,
        email,
        full_name,
        true
    );

    -- Create result JSON
    SELECT json_build_object(
        'user_id', new_user_id,
        'email', email,
        'full_name', full_name,
        'is_super_admin', true
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service_role only
REVOKE ALL ON FUNCTION create_super_admin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_super_admin TO service_role;

-- Example usage (uncomment and modify to create your super admin):
/*
SELECT create_super_admin(
    'your.email@example.com',
    'your-secure-password',
    'Super Admin Name'
);
*/
