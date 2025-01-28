-- After creating user in Auth dashboard, run this to add them to public.users
INSERT INTO public.users (id, email, full_name, role, is_super_admin)
SELECT 
    id,
    email,
    COALESCE((raw_user_meta_data->>'full_name'), 'Super Admin'),
    'SUPER_ADMIN',  -- Setting the role explicitly
    true
FROM auth.users
WHERE email = 'admin@bets.com';  -- Replace with the email you used in dashboard
