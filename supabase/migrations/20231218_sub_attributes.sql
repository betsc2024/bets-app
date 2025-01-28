-- Drop existing policy
DROP POLICY IF EXISTS statement_options_access ON attribute_statement_options;

-- Create attribute statement options table
CREATE TABLE IF NOT EXISTS attribute_statement_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_id UUID REFERENCES attribute_statements(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    weight INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE attribute_statement_options ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_statement_options_statement ON attribute_statement_options(statement_id);

-- Create RLS policy
CREATE POLICY statement_options_access ON attribute_statement_options FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN 
            EXISTS (
                SELECT 1 FROM attribute_statements ast
                JOIN attributes a ON ast.attribute_id = a.id
                WHERE ast.id = attribute_statement_options.statement_id
                AND (a.company_id = get_user_company_id() OR a.is_industry_standard = true)
            )
        ELSE FALSE
    END
);
