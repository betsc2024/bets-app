-- Function to create a user with auth
CREATE OR REPLACE FUNCTION create_user_with_auth(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_company_id UUID DEFAULT NULL
) RETURNS json AS $$
DECLARE
    new_user_id UUID;
    result json;
BEGIN
    -- Validate role
    IF p_role NOT IN ('super_admin', 'company_admin', 'user') THEN
        RAISE EXCEPTION 'Invalid role. Must be super_admin, company_admin, or user';
    END IF;

    -- Create user in auth.users
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
        p_email,
        crypt(p_password, gen_salt('bf')),
        NOW(),
        jsonb_build_object(
            'provider', 'email',
            'providers', ARRAY['email'],
            'role', p_role
        ),
        jsonb_build_object(
            'full_name', p_full_name,
            'role', p_role
        ),
        NOW(),
        NOW()
    ) RETURNING id INTO new_user_id;

    -- Create user profile in public.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        company_id,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        p_email,
        p_full_name,
        p_role,
        p_company_id,
        NOW(),
        NOW()
    );

    -- Return success response
    result := json_build_object(
        'success', true,
        'user_id', new_user_id,
        'message', 'User created successfully'
    );

    RETURN result;
EXCEPTION WHEN OTHERS THEN
    -- Return error response
    result := json_build_object(
        'success', false,
        'message', SQLERRM
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
