-- Drop existing policies first
DROP POLICY IF EXISTS attributes_access ON attributes;
DROP POLICY IF EXISTS attribute_industry_mapping_access ON attribute_industry_mapping;

-- Drop existing constraints and indexes
ALTER TABLE attributes 
    DROP CONSTRAINT IF EXISTS company_or_industry,
    DROP CONSTRAINT IF EXISTS analysis_type_check,
    DROP CONSTRAINT IF EXISTS company_standard_check;
DROP INDEX IF EXISTS idx_attributes_industry;
DROP INDEX IF EXISTS idx_attributes_type;

-- Drop existing foreign key constraints
ALTER TABLE attribute_statements 
    DROP CONSTRAINT IF EXISTS attribute_statements_attribute_id_fkey;

-- Modify attributes table
ALTER TABLE attributes 
    DROP COLUMN IF EXISTS industry_id,
    DROP COLUMN IF EXISTS type,
    ADD COLUMN IF NOT EXISTS analysis_type TEXT,
    ADD CONSTRAINT analysis_type_check 
        CHECK (analysis_type IN ('behavior', 'leadership', 'both'));

-- Add company standard constraint
ALTER TABLE attributes 
    ADD CONSTRAINT company_standard_check CHECK (
        (company_id IS NULL AND is_industry_standard = true) OR
        (company_id IS NOT NULL AND is_industry_standard = false)
    );

-- Create attribute industry mapping table
CREATE TABLE IF NOT EXISTS attribute_industry_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_id UUID REFERENCES attributes(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(attribute_id, industry_id)
);

-- Add foreign key with cascade delete to attribute_statements
ALTER TABLE attribute_statements 
    ADD CONSTRAINT attribute_statements_attribute_id_fkey 
    FOREIGN KEY (attribute_id) 
    REFERENCES attributes(id) 
    ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE attribute_industry_mapping ENABLE ROW LEVEL SECURITY;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_attributes_company ON attributes(company_id);
CREATE INDEX IF NOT EXISTS idx_attributes_analysis_type ON attributes(analysis_type);
CREATE INDEX IF NOT EXISTS idx_attribute_industry_mapping_attribute ON attribute_industry_mapping(attribute_id);
CREATE INDEX IF NOT EXISTS idx_attribute_industry_mapping_industry ON attribute_industry_mapping(industry_id);

-- Simplified RLS policies to avoid recursion
CREATE POLICY attribute_industry_mapping_access 
    ON attribute_industry_mapping 
    FOR ALL USING (
        CASE
            WHEN is_super_admin() THEN TRUE
            WHEN is_company_admin() THEN 
                -- Allow access if the industry matches the company's industry
                EXISTS (
                    SELECT 1 FROM companies c
                    WHERE c.id = get_user_company_id()
                    AND c.industry_id = attribute_industry_mapping.industry_id
                )
            ELSE FALSE
        END
    );

CREATE POLICY attributes_access ON attributes FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN 
            -- Allow access to company's own attributes
            company_id = get_user_company_id()
            OR
            -- Allow access to industry standard attributes
            is_industry_standard = true
        ELSE FALSE
    END
);
