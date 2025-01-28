-- Drop existing policies
DROP POLICY IF EXISTS "Enable update for admins" ON public.users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Super admin can update any role" ON public.users;
DROP POLICY IF EXISTS "Company admin can update company users" ON public.users;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow admins to update users
CREATE POLICY "Enable update for admins"
ON public.users
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'company_admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'company_admin')
    )
);

-- Allow all authenticated users to view users
CREATE POLICY "Enable read access for authenticated users"
ON public.users
FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow super_admin to update any role
CREATE POLICY "Super admin can update any role"
ON public.users
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'super_admin'
    )
);

-- Allow company_admin to update only non-admin users in their company
CREATE POLICY "Company admin can update company users"
ON public.users
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.role = 'company_admin'
        AND u.company_id = public.users.company_id
        AND public.users.role NOT IN ('super_admin', 'company_admin')
    )
);
