-- Direct insert of super admin
INSERT INTO public.users (
    id, 
    email, 
    full_name, 
    role, 
    is_super_admin
) VALUES (
    '3c1593c0-6ead-42f1-9db7-4f1193fbbacd',
    'admin@bets.com',
    'Super Admin',
    'super_admin',
    true
);
