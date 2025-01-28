-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Core Tables

-- Industries Table
CREATE TABLE industries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Companies Table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    industry_id UUID REFERENCES industries(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Users Table (integrated with Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    company_id UUID REFERENCES companies(id),
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'company_admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Attributes Table
CREATE TABLE attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id), 
    name TEXT NOT NULL,
    description TEXT,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('behavior', 'leadership', 'both')),
    is_industry_standard BOOLEAN DEFAULT true, 
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT company_standard_check CHECK (
        (company_id IS NULL AND is_industry_standard = true) OR
        (company_id IS NOT NULL AND is_industry_standard = false)
    )
);

-- Attribute Industry Mapping Table
CREATE TABLE attribute_industry_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_id UUID REFERENCES attributes(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(attribute_id, industry_id)
);

-- Attribute Banks Table
CREATE TABLE attribute_banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Attribute Statements Table
CREATE TABLE attribute_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_bank_id UUID REFERENCES attribute_banks(id),
    attribute_id UUID REFERENCES attributes(id),
    statement TEXT NOT NULL,
    weight INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Statement Options Table
CREATE TABLE statement_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_id UUID REFERENCES attribute_statements(id),
    description TEXT NOT NULL,
    points INTEGER NOT NULL,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Evaluation Assignments Table
CREATE TABLE evaluation_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    user_id UUID REFERENCES users(id),
    attribute_bank_id UUID REFERENCES attribute_banks(id),
    include_self_evaluation BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    due_date TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Peer Evaluators Table
CREATE TABLE peer_evaluators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_assignment_id UUID REFERENCES evaluation_assignments(id),
    evaluator_id UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(evaluation_assignment_id, evaluator_id)
);

-- Evaluations Table
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_assignment_id UUID REFERENCES evaluation_assignments(id),
    evaluator_id UUID REFERENCES users(id),
    is_self_evaluation BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Evaluation Responses Table
CREATE TABLE evaluation_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID REFERENCES evaluations(id),
    statement_id UUID REFERENCES attribute_statements(id),
    selected_option_id UUID REFERENCES statement_options(id),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(evaluation_id, statement_id)
);

-- Helper Functions
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_company_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role = 'company_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT company_id FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_industry_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_evaluators ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Industries Policy
CREATE POLICY industries_access ON industries FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        ELSE EXISTS (
            SELECT 1 FROM companies c
            WHERE c.industry_id = industries.id
            AND c.id = get_user_company_id()
        )
    END
);

-- Companies Policy
CREATE POLICY companies_access ON companies FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN id = get_user_company_id()
        ELSE id = get_user_company_id()
    END
);

-- Users Policy
CREATE POLICY users_access ON users FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN company_id = get_user_company_id()
        ELSE id = auth.uid()
    END
);

-- Attributes Policy
CREATE POLICY attributes_access ON attributes FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN 
            company_id = get_user_company_id() OR 
            EXISTS ( 
                SELECT 1 FROM attribute_industry_mapping aim
                JOIN industries i ON aim.industry_id = i.id
                JOIN companies c ON i.id = c.industry_id
                WHERE aim.attribute_id = attributes.id
                AND c.id = get_user_company_id()
            )
        ELSE FALSE 
    END
);

-- Attribute Industry Mapping Policy
CREATE POLICY attribute_industry_mapping_access ON attribute_industry_mapping FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN 
            EXISTS ( 
                SELECT 1 FROM attributes a
                WHERE a.id = attribute_industry_mapping.attribute_id
                AND (a.company_id = get_user_company_id() OR 
                EXISTS ( 
                    SELECT 1 FROM industries i
                    JOIN companies c ON i.id = c.industry_id
                    WHERE i.id = attribute_industry_mapping.industry_id
                    AND c.id = get_user_company_id()
                ))
            )
        ELSE FALSE 
    END
);

-- Attribute Banks Policy
CREATE POLICY attribute_banks_access ON attribute_banks FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN company_id = get_user_company_id()
        ELSE EXISTS (
            SELECT 1 FROM evaluation_assignments ea
            WHERE ea.attribute_bank_id = attribute_banks.id
            AND ea.status = 'active'
            AND (ea.user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM peer_evaluators pe
                WHERE pe.evaluation_assignment_id = ea.id
                AND pe.evaluator_id = auth.uid()
            ))
        )
    END
);

-- Attribute Statements Policy
CREATE POLICY statements_access ON attribute_statements FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN EXISTS (
            SELECT 1 FROM attribute_banks ab
            WHERE ab.id = attribute_statements.attribute_bank_id
            AND ab.company_id = get_user_company_id()
        )
        ELSE EXISTS (
            SELECT 1 FROM attribute_banks ab
            JOIN evaluation_assignments ea ON ab.id = ea.attribute_bank_id
            WHERE ab.id = attribute_statements.attribute_bank_id
            AND ea.status = 'active'
            AND (ea.user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM peer_evaluators pe
                WHERE pe.evaluation_assignment_id = ea.id
                AND pe.evaluator_id = auth.uid()
            ))
        )
    END
);

-- Statement Options Policy
CREATE POLICY options_access ON statement_options FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN EXISTS (
            SELECT 1 FROM attribute_statements ast
            JOIN attribute_banks ab ON ab.id = ast.attribute_bank_id
            WHERE ast.id = statement_options.statement_id
            AND ab.company_id = get_user_company_id()
        )
        ELSE EXISTS (
            SELECT 1 FROM attribute_statements ast
            JOIN attribute_banks ab ON ab.id = ast.attribute_bank_id
            JOIN evaluation_assignments ea ON ab.id = ea.attribute_bank_id
            WHERE ast.id = statement_options.statement_id
            AND ea.status = 'active'
            AND (ea.user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM peer_evaluators pe
                WHERE pe.evaluation_assignment_id = ea.id
                AND pe.evaluator_id = auth.uid()
            ))
        )
    END
);

-- Evaluation Assignments Policy
CREATE POLICY assignments_access ON evaluation_assignments FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN company_id = get_user_company_id()
        ELSE user_id = auth.uid()
    END
);

-- Peer Evaluators Policy
CREATE POLICY peer_evaluators_access ON peer_evaluators FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN EXISTS (
            SELECT 1 FROM evaluation_assignments ea 
            WHERE ea.id = evaluation_assignment_id 
            AND ea.company_id = get_user_company_id()
        )
        ELSE evaluator_id = auth.uid()
    END
);

-- Evaluations Policy
CREATE POLICY evaluations_access ON evaluations FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN EXISTS (
            SELECT 1 FROM evaluation_assignments ea
            WHERE ea.id = evaluation_assignment_id
            AND ea.company_id = get_user_company_id()
        )
        ELSE evaluator_id = auth.uid()
    END
);

-- Evaluation Responses Policy
CREATE POLICY responses_access ON evaluation_responses FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN EXISTS (
            SELECT 1 FROM evaluations e
            JOIN evaluation_assignments ea ON ea.id = e.evaluation_assignment_id
            WHERE e.id = evaluation_id
            AND ea.company_id = get_user_company_id()
        )
        ELSE EXISTS (
            SELECT 1 FROM evaluations e
            WHERE e.id = evaluation_id
            AND e.evaluator_id = auth.uid()
        )
    END
);

-- Helper Views
CREATE OR REPLACE VIEW user_evaluation_scores AS
SELECT 
    u.id as user_id,
    u.full_name,
    ea.id as evaluation_id,
    ab.name as attribute_bank_name,
    CASE 
        WHEN e.evaluator_id = u.id THEN 'Evaluator'
        ELSE 'Evaluated'
    END as role,
    COUNT(er.id) as responses_count,
    COALESCE(AVG(so.points), 0) as average_score,
    ea.status as assignment_status,
    ea.due_date
FROM users u
JOIN evaluation_assignments ea ON (ea.user_id = u.id OR EXISTS (
    SELECT 1 FROM peer_evaluators pe
    WHERE pe.evaluation_assignment_id = ea.id
    AND pe.evaluator_id = u.id
))
JOIN attribute_banks ab ON ea.attribute_bank_id = ab.id
LEFT JOIN evaluations e ON e.evaluation_assignment_id = ea.id
LEFT JOIN evaluation_responses er ON e.id = er.evaluation_id
LEFT JOIN statement_options so ON er.selected_option_id = so.id
WHERE u.id = auth.uid()
GROUP BY u.id, u.full_name, ea.id, ab.name, ea.status, ea.due_date, e.evaluator_id;

-- Indexes
CREATE INDEX idx_companies_industry ON companies(industry_id);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_attributes_company ON attributes(company_id);
CREATE INDEX idx_attributes_analysis_type ON attributes(analysis_type);
CREATE INDEX idx_attribute_industry_mapping_attribute ON attribute_industry_mapping(attribute_id);
CREATE INDEX idx_attribute_industry_mapping_industry ON attribute_industry_mapping(industry_id);
CREATE INDEX idx_attribute_banks_company ON attribute_banks(company_id);
CREATE INDEX idx_attribute_banks_status ON attribute_banks(status);
CREATE INDEX idx_statements_bank ON attribute_statements(attribute_bank_id);
CREATE INDEX idx_statements_attribute ON attribute_statements(attribute_id);
CREATE INDEX idx_options_statement ON statement_options(statement_id);
CREATE INDEX idx_assignments_company ON evaluation_assignments(company_id);
CREATE INDEX idx_assignments_user ON evaluation_assignments(user_id);
CREATE INDEX idx_assignments_bank ON evaluation_assignments(attribute_bank_id);
CREATE INDEX idx_assignments_status ON evaluation_assignments(status);
CREATE INDEX idx_peer_evaluators_assignment ON peer_evaluators(evaluation_assignment_id);
CREATE INDEX idx_peer_evaluators_evaluator ON peer_evaluators(evaluator_id);
CREATE INDEX idx_evaluations_assignment ON evaluations(evaluation_assignment_id);
CREATE INDEX idx_evaluations_evaluator ON evaluations(evaluator_id);
CREATE INDEX idx_evaluations_status ON evaluations(status);
CREATE INDEX idx_responses_evaluation ON evaluation_responses(evaluation_id);
CREATE INDEX idx_responses_statement ON evaluation_responses(statement_id);
CREATE INDEX idx_responses_option ON evaluation_responses(selected_option_id);
