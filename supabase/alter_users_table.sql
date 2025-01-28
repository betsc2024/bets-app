-- Add is_super_admin column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin 
ON public.users(is_super_admin) 
WHERE is_super_admin = true;
