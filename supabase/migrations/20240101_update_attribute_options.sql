-- Drop existing foreign key constraints
ALTER TABLE IF EXISTS attribute_statement_options 
    DROP CONSTRAINT IF EXISTS attribute_statement_options_statement_id_fkey;

-- Rename table to match the schema
ALTER TABLE IF EXISTS statement_options 
    RENAME TO attribute_statement_options;

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS attribute_statement_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_id UUID NOT NULL,
    option_text TEXT NOT NULL,
    weight INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Add foreign key with cascade delete
ALTER TABLE attribute_statement_options 
    ADD CONSTRAINT attribute_statement_options_statement_id_fkey 
    FOREIGN KEY (statement_id) 
    REFERENCES attribute_statements(id) 
    ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_attribute_statement_options_statement 
    ON attribute_statement_options(statement_id);

-- Enable RLS
ALTER TABLE attribute_statement_options ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS attribute_statement_options_access ON attribute_statement_options;

-- Create RLS policy
CREATE POLICY attribute_statement_options_access 
    ON attribute_statement_options 
    FOR ALL USING (
        CASE
            WHEN is_super_admin() THEN TRUE
            WHEN is_company_admin() THEN 
                -- Allow access if the statement belongs to company's attribute
                EXISTS (
                    SELECT 1 FROM attribute_statements s
                    JOIN attributes a ON a.id = s.attribute_id
                    WHERE s.id = attribute_statement_options.statement_id
                    AND (
                        a.company_id = get_user_company_id()
                        OR a.is_industry_standard = true
                    )
                )
            ELSE FALSE
        END
    );
