# Database Schema Documentation

## Core Tables

### Industries Table
The base table for storing industry information.

```sql
CREATE TABLE industries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);
```

### Companies Table
Stores company information and their industry associations.

```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    industry_id UUID REFERENCES industries(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);
```

### Users Table
User information integrated with Supabase Auth.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    company_id UUID REFERENCES companies(id),
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'company_admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);
```

## Attribute Management

### Attributes Table
The core table for storing evaluation attributes. Attributes can be industry-standard or company-specific, and can be used for behavior analysis, leadership analysis, or both.

```sql
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
```

Key features:
- `analysis_type`: Specifies if the attribute is for behavior analysis, leadership analysis, or both
- `is_industry_standard`: Indicates if this is an industry-standard attribute
- `company_standard_check`: Ensures proper relationship between company-specific and industry-standard attributes

### Attribute Industry Mapping
Manages the many-to-many relationship between attributes and industries.

```sql
CREATE TABLE attribute_industry_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_id UUID REFERENCES attributes(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(attribute_id, industry_id)
);
```

Key features:
- Enables attributes to be associated with multiple industries
- Cascading deletes ensure data consistency
- Unique constraint prevents duplicate mappings

### Attribute Banks
Groups of attributes used for evaluations.

```sql
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
```

### Attribute Statements
Specific evaluation statements linked to attributes.

```sql
CREATE TABLE attribute_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_bank_id UUID REFERENCES attribute_banks(id),
    attribute_id UUID REFERENCES attributes(id),
    statement TEXT NOT NULL,
    weight INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);
```

## Security Policies

### Attribute Access Policy
```sql
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
```

### Attribute Industry Mapping Policy
```sql
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
```

## Performance Optimization

### Indexes
```sql
-- Attribute Management Indexes
CREATE INDEX idx_attributes_company ON attributes(company_id);
CREATE INDEX idx_attributes_analysis_type ON attributes(analysis_type);
CREATE INDEX idx_attribute_industry_mapping_attribute ON attribute_industry_mapping(attribute_id);
CREATE INDEX idx_attribute_industry_mapping_industry ON attribute_industry_mapping(industry_id);
CREATE INDEX idx_attribute_banks_company ON attribute_banks(company_id);
```

## Attribute Management Tables

### Attributes Table
The `attributes` table stores all attributes that can be used for evaluations. Attributes can be either industry-standard or company-specific.

```sql
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
```

### Attribute Industry Mapping Table
The `attribute_industry_mapping` table manages the many-to-many relationship between attributes and industries.

```sql
CREATE TABLE attribute_industry_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_id UUID REFERENCES attributes(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(attribute_id, industry_id)
);
```

-- Attribute Banks Table
CREATE TABLE attribute_banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    name TEXT NOT NULL,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('behavior', 'leadership', 'both')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    settings JSONB DEFAULT '{
        "minScore": 0,
        "maxScore": 100,
        "requireComments": false
    }',
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
    is_custom BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
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
    score INTEGER CHECK (score >= 0 AND score <= 100),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT valid_response UNIQUE(evaluation_id, statement_id)
);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    changes JSONB NOT NULL,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

## Indexes and Performance

```sql
-- JSONB Indexes
CREATE INDEX idx_companies_settings ON companies USING GIN (settings);
CREATE INDEX idx_users_settings ON users USING GIN (settings);
CREATE INDEX idx_attribute_banks_settings ON attribute_banks USING GIN (settings);

-- Standard Indexes
CREATE INDEX idx_industries_name ON industries(name);
CREATE INDEX idx_companies_industry ON companies(industry_id);
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_attributes_company ON attributes(company_id);
CREATE INDEX idx_attributes_analysis_type ON attributes(analysis_type);
CREATE INDEX idx_attribute_banks_company ON attribute_banks(company_id);
CREATE INDEX idx_attribute_banks_status ON attribute_banks(status);
CREATE INDEX idx_statements_bank ON attribute_statements(attribute_bank_id);
CREATE INDEX idx_statements_attribute ON attribute_statements(attribute_id);
CREATE INDEX idx_evaluations_bank ON evaluations(evaluation_assignment_id);
CREATE INDEX idx_evaluations_evaluated ON evaluations(evaluator_id);
CREATE INDEX idx_evaluations_evaluator ON evaluations(evaluator_id);
CREATE INDEX idx_evaluations_status ON evaluations(status);
CREATE INDEX idx_responses_evaluation ON evaluation_responses(evaluation_id);
CREATE INDEX idx_responses_statement ON evaluation_responses(statement_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE INDEX idx_attribute_industry_mapping_attribute ON attribute_industry_mapping(attribute_id);
CREATE INDEX idx_attribute_industry_mapping_industry ON attribute_industry_mapping(industry_id);
```

## Helper Functions

```sql
-- Check if user is super admin
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

-- Check if user is company admin
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

-- Get user's company id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT company_id FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get evaluation summary
CREATE OR REPLACE FUNCTION get_evaluation_summary(eval_id UUID)
RETURNS TABLE (
    total_statements BIGINT,
    completed_responses BIGINT,
    average_score NUMERIC,
    completion_percentage NUMERIC
) SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(DISTINCT as.id) as total_stmts,
            COUNT(DISTINCT er.id) as completed_resp,
            AVG(er.score)::NUMERIC(5,2) as avg_score
        FROM evaluations e
        JOIN attribute_banks ab ON e.evaluation_assignment_id = ab.id
        JOIN attribute_statements as ON as.attribute_bank_id = ab.id
        LEFT JOIN evaluation_responses er ON er.evaluation_id = e.id
        WHERE e.id = eval_id
    )
    SELECT 
        total_stmts,
        completed_resp,
        avg_score,
        (completed_resp::NUMERIC / NULLIF(total_stmts, 0) * 100)::NUMERIC(5,2)
    FROM stats;
END;
$$ LANGUAGE plpgsql;

## RLS Policies

```sql
-- Enable RLS on all tables
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
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users Table Policy
CREATE POLICY users_access ON users FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN company_id = get_user_company_id()
        ELSE id = auth.uid()
    END
);

-- Companies Table Policy
CREATE POLICY companies_access ON companies FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN id = get_user_company_id()
        ELSE id = get_user_company_id()
    END
);

-- Industries Table Policy
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

-- Attributes Table Policy
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
        ELSE EXISTS ( -- Regular users can see attribute banks for their active evaluations
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
        ELSE EXISTS ( -- Regular users can see statements for their active evaluations
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
        ELSE EXISTS ( -- Regular users can see options for their active evaluations
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
        ELSE user_id = auth.uid() -- Users can see their own assignments
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
        ELSE evaluator_id = auth.uid() -- Evaluators can see their assignments
    END
);

-- Evaluations Policy
CREATE POLICY evaluations_access_policy ON evaluations FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN EXISTS (
            SELECT 1 FROM evaluation_assignments ea
            WHERE ea.id = evaluation_assignment_id
            AND ea.company_id = get_user_company_id()
        )
        ELSE evaluation_assignment_id IN (
            SELECT id FROM evaluation_assignments
            WHERE user_id = auth.uid()
        ) OR evaluator_id = auth.uid() -- Regular users only see their evaluations
    END
);

-- Evaluation Responses Policy
CREATE POLICY responses_access_policy ON evaluation_responses FOR ALL USING (
    CASE
        WHEN is_super_admin() THEN TRUE
        WHEN is_company_admin() THEN EXISTS (
            SELECT 1 FROM evaluation_assignments ea
            JOIN evaluations e ON e.evaluation_assignment_id = ea.id
            WHERE e.id = evaluation_id
            AND ea.company_id = get_user_company_id()
        )
        ELSE EXISTS ( -- Regular users only see their own responses
            SELECT 1 FROM evaluation_assignments ea
            JOIN evaluations e ON e.evaluation_assignment_id = ea.id
            WHERE e.id = evaluation_id
            AND (ea.user_id = auth.uid() OR e.evaluator_id = auth.uid())
        )
    END
);

-- Add a view for user dashboard scores
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
    COALESCE(AVG(er.score), 0) as average_score,
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
WHERE u.id = auth.uid() -- Only show current user's scores
GROUP BY u.id, u.full_name, ea.id, ab.name, ea.status, ea.due_date;

## Common Queries

```sql
-- Get attribute hierarchy
WITH RECURSIVE attribute_tree AS (
    -- Base case: top-level attributes
    SELECT 
        id, 
        name,
        parent_id,
        type,
        1 as level,
        ARRAY[name] as path
    FROM attributes
    WHERE parent_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child attributes
    SELECT 
        a.id,
        a.name,
        a.parent_id,
        a.type,
        at.level + 1,
        at.path || a.name
    FROM attributes a
    JOIN attribute_tree at ON a.parent_id = at.id
)
SELECT * FROM attribute_tree
ORDER BY path;

-- Get evaluation progress
SELECT 
    ea.id as evaluation_id,
    u.full_name as evaluated_user,
    ab.name as attribute_bank,
    COUNT(DISTINCT as.id) as total_statements,
    COUNT(DISTINCT er.id) as completed_responses,
    ROUND(AVG(er.score)::NUMERIC, 2) as average_score,
    ea.status as assignment_status
FROM evaluation_assignments ea
JOIN users u ON ea.user_id = u.id
JOIN attribute_banks ab ON ea.attribute_bank_id = ab.id
JOIN attribute_statements as ON as.attribute_bank_id = ab.id
LEFT JOIN evaluations e ON e.evaluation_assignment_id = ea.id
LEFT JOIN evaluation_responses er ON e.id = er.evaluation_id
GROUP BY ea.id, u.full_name, ab.name, ea.status;

-- Get user evaluation summary
SELECT 
    u.full_name,
    COUNT(DISTINCT ea.id) as total_evaluations,
    COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END) as completed_evaluations,
    ROUND(AVG(er.score)::NUMERIC, 2) as average_score
FROM users u
LEFT JOIN evaluation_assignments ea ON u.id = ea.user_id
LEFT JOIN evaluations e ON e.evaluation_assignment_id = ea.id
LEFT JOIN evaluation_responses er ON e.id = er.evaluation_id
WHERE u.company_id = get_user_company_id()
GROUP BY u.id, u.full_name;

-- Helper view for evaluation assignment management
CREATE OR REPLACE VIEW evaluation_assignment_summary AS
SELECT 
    ea.id as assignment_id,
    ea.user_id as evaluated_user_id,
    u.full_name as evaluated_user_name,
    ea.attribute_bank_id,
    ab.name as attribute_bank_name,
    ea.include_self_evaluation,
    ea.status as assignment_status,
    ea.due_date,
    COUNT(pe.id) as total_peer_evaluators,
    SUM(CASE WHEN pe.status = 'completed' THEN 1 ELSE 0 END) as completed_evaluations,
    CASE 
        WHEN ea.include_self_evaluation THEN
            EXISTS(
                SELECT 1 FROM evaluations e 
                WHERE e.evaluation_assignment_id = ea.id 
                AND e.is_self_evaluation 
                AND e.status = 'completed'
            )
        ELSE TRUE
    END as self_evaluation_completed
FROM evaluation_assignments ea
JOIN users u ON ea.user_id = u.id
JOIN attribute_banks ab ON ea.attribute_bank_id = ab.id
LEFT JOIN peer_evaluators pe ON ea.id = pe.evaluation_assignment_id
GROUP BY ea.id, ea.user_id, u.full_name, ea.attribute_bank_id, ab.name, ea.include_self_evaluation, 
         ea.status, ea.due_date;

-- Helper view for user's evaluation tasks
CREATE OR REPLACE VIEW user_evaluation_tasks AS
SELECT 
    ea.id as assignment_id,
    u.full_name as evaluated_user_name,
    ab.name as attribute_bank_name,
    CASE 
        WHEN pe.evaluator_id IS NOT NULL THEN 'peer'
        ELSE 'self'
    END as evaluation_type,
    COALESCE(e.status, 'pending') as evaluation_status,
    ea.due_date
FROM evaluation_assignments ea
JOIN users u ON ea.user_id = u.id
JOIN attribute_banks ab ON ea.attribute_bank_id = ab.id
LEFT JOIN peer_evaluators pe ON ea.id = pe.evaluation_assignment_id AND pe.evaluator_id = auth.uid()
LEFT JOIN evaluations e ON ea.id = e.evaluation_assignment_id 
    AND ((pe.evaluator_id IS NOT NULL AND e.evaluator_id = pe.evaluator_id)
         OR (pe.evaluator_id IS NULL AND e.is_self_evaluation AND e.evaluator_id = ea.user_id))
WHERE (pe.evaluator_id = auth.uid() OR (ea.include_self_evaluation AND ea.user_id = auth.uid()))
AND ea.status = 'active';
