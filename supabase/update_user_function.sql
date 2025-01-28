-- Function to update a user
CREATE OR REPLACE FUNCTION update_user_secure(
    p_user_id UUID,
    p_email TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_company_id UUID DEFAULT NULL
) RETURNS json AS $$
DECLARE
    v_user_role TEXT;
    v_user_company_id UUID;
    result json;
BEGIN
    -- Get current user's role and company_id
    SELECT role, company_id INTO v_user_role, v_user_company_id
    FROM public.users
    WHERE id = auth.uid();

    -- Check permissions
    IF v_user_role NOT IN ('super_admin', 'company_admin') THEN
        RAISE EXCEPTION 'Insufficient permissions to update users';
    END IF;

    -- For company_admin, ensure they can only update users in their company
    IF v_user_role = 'company_admin' AND (
        -- Check if target user is in same company
        NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_user_id AND company_id = v_user_company_id
        )
        -- Prevent company_admin from creating super_admins
        OR p_role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Company admin can only update users in their own company and cannot create super admins';
    END IF;

    -- Validate role
    IF p_role NOT IN ('super_admin', 'company_admin', 'user') THEN
        RAISE EXCEPTION 'Invalid role. Must be super_admin, company_admin, or user';
    END IF;

    -- Update auth.users
    UPDATE auth.users
    SET 
        email = p_email,
        raw_app_meta_data = raw_app_meta_data || 
            jsonb_build_object('role', p_role),
        raw_user_meta_data = raw_user_meta_data || 
            jsonb_build_object(
                'full_name', p_full_name,
                'role', p_role
            ),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Update public.users
    UPDATE public.users
    SET 
        email = p_email,
        full_name = p_full_name,
        role = p_role,
        company_id = CASE 
            WHEN v_user_role = 'super_admin' THEN p_company_id 
            ELSE v_user_company_id 
        END,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Return success response
    result := json_build_object(
        'success', true,
        'user_id', p_user_id,
        'message', 'User updated successfully'
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
