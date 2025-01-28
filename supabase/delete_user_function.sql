-- Function to delete a user and their auth record
CREATE OR REPLACE FUNCTION delete_user(user_id UUID)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    -- Delete from public.users first
    DELETE FROM public.users
    WHERE id = user_id;

    -- Delete from auth.users
    DELETE FROM auth.users
    WHERE id = user_id;

    -- Return success response
    result := json_build_object(
        'success', true,
        'message', 'User deleted successfully'
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
