-- Create schema for admin functions
CREATE SCHEMA IF NOT EXISTS admin_functions;

-- Function to create a company with its admin
CREATE OR REPLACE FUNCTION admin_functions.create_company(
    company_name TEXT,
    industry_id UUID,
    admin_email TEXT,
    admin_password TEXT,
    admin_full_name TEXT
) RETURNS json AS $$
DECLARE
    new_company_id UUID;
    new_user_id UUID;
    result json;
BEGIN
    -- Check if caller is super admin
    IF NOT (SELECT is_super_admin FROM public.users WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Only super admins can create companies';
    END IF;

    -- Create company
    INSERT INTO public.companies (name, industry_id)
    VALUES (company_name, industry_id)
    RETURNING id INTO new_company_id;

    -- Create admin user in auth.users
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
        admin_email,
        crypt(admin_password, gen_salt('bf')),
        NOW(),
        jsonb_build_object(
            'company_id', new_company_id,
            'is_admin', true
        ),
        jsonb_build_object('full_name', admin_full_name),
        NOW(),
        NOW()
    ) RETURNING id INTO new_user_id;

    -- Create admin in public.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        company_id,
        is_admin
    ) VALUES (
        new_user_id,
        admin_email,
        admin_full_name,
        new_company_id,
        true
    );

    -- Create result JSON
    SELECT json_build_object(
        'company_id', new_company_id,
        'company_name', company_name,
        'admin_id', new_user_id,
        'admin_email', admin_email
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a regular user for a company
CREATE OR REPLACE FUNCTION admin_functions.create_company_user(
    company_id UUID,
    user_email TEXT,
    user_password TEXT,
    user_full_name TEXT,
    is_admin BOOLEAN DEFAULT false
) RETURNS json AS $$
DECLARE
    new_user_id UUID;
    result json;
    caller_company_id UUID;
    caller_is_admin BOOLEAN;
    caller_is_super_admin BOOLEAN;
BEGIN
    -- Get caller's permissions
    SELECT 
        company_id, 
        is_admin,
        is_super_admin
    INTO 
        caller_company_id,
        caller_is_admin,
        caller_is_super_admin
    FROM public.users 
    WHERE id = auth.uid();

    -- Check permissions
    IF NOT (
        caller_is_super_admin OR 
        (caller_is_admin AND caller_company_id = company_id)
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to create users';
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
        user_email,
        crypt(user_password, gen_salt('bf')),
        NOW(),
        jsonb_build_object(
            'company_id', company_id,
            'is_admin', is_admin
        ),
        jsonb_build_object('full_name', user_full_name),
        NOW(),
        NOW()
    ) RETURNING id INTO new_user_id;

    -- Create user in public.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        company_id,
        is_admin
    ) VALUES (
        new_user_id,
        user_email,
        user_full_name,
        company_id,
        is_admin
    );

    -- Create result JSON
    SELECT json_build_object(
        'user_id', new_user_id,
        'email', user_email,
        'full_name', user_full_name,
        'company_id', company_id,
        'is_admin', is_admin
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT USAGE ON SCHEMA admin_functions TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA admin_functions TO authenticated;

-- Example usage:
/*
-- First, create a company with its admin:
SELECT admin_functions.create_company(
    'Example Company',
    '12345678-1234-1234-1234-123456789012', -- industry_id
    'admin@example.com',
    'secure-password',
    'Company Admin'
);

-- Then create users for that company:
SELECT admin_functions.create_company_user(
    '12345678-1234-1234-1234-123456789012', -- company_id
    'user@example.com',
    'user-password',
    'Regular User',
    false -- is_admin
);
*/
