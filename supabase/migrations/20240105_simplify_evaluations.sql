-- Step 1: Drop existing views and tables
DROP VIEW IF EXISTS app_private.user_evaluation_scores CASCADE;
DROP TABLE IF EXISTS evaluation_responses CASCADE;
DROP TABLE IF EXISTS evaluations CASCADE;
DROP TABLE IF EXISTS evaluation_assignments CASCADE;

-- Step 2: Create tables with proper relationships
CREATE TABLE evaluation_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    evaluation_name TEXT NOT NULL,
    attribute_bank_id UUID REFERENCES attribute_banks(id),
    user_to_evaluate_id UUID REFERENCES users(id),
    requires_peer_evaluation BOOLEAN DEFAULT false,
    requires_self_evaluation BOOLEAN DEFAULT true,
    due_date TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

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

CREATE TABLE evaluation_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID REFERENCES evaluations(id),
    statement_id UUID REFERENCES attribute_statements(id),
    selected_option_id UUID REFERENCES statement_options(id),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(evaluation_id, statement_id)
);

-- Step 3: Add indexes for better query performance
CREATE INDEX idx_eval_assignments_company ON evaluation_assignments(company_id);
CREATE INDEX idx_eval_assignments_bank ON evaluation_assignments(attribute_bank_id);
CREATE INDEX idx_eval_assignments_user ON evaluation_assignments(user_to_evaluate_id);
CREATE INDEX idx_evaluations_assignment ON evaluations(evaluation_assignment_id);
CREATE INDEX idx_evaluations_evaluator ON evaluations(evaluator_id);
CREATE INDEX idx_eval_responses_evaluation ON evaluation_responses(evaluation_id);
CREATE INDEX idx_eval_responses_statement ON evaluation_responses(statement_id);
CREATE INDEX idx_eval_responses_option ON evaluation_responses(selected_option_id);

-- Step 4: Add RLS policies
ALTER TABLE evaluation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY eval_assignments_access ON evaluation_assignments 
    FOR ALL USING (
        is_super_admin() OR 
        (is_company_admin() AND company_id = get_user_company_id()) OR
        user_to_evaluate_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM evaluations e 
            WHERE e.evaluation_assignment_id = evaluation_assignments.id 
            AND e.evaluator_id = auth.uid()
        )
    );

CREATE POLICY evaluations_access ON evaluations 
    FOR ALL USING (
        is_super_admin() OR
        (is_company_admin() AND EXISTS (
            SELECT 1 FROM evaluation_assignments ea 
            WHERE ea.id = evaluation_assignment_id 
            AND ea.company_id = get_user_company_id()
        )) OR
        evaluator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM evaluation_assignments ea 
            WHERE ea.id = evaluation_assignment_id 
            AND ea.user_to_evaluate_id = auth.uid()
        )
    );

CREATE POLICY eval_responses_access ON evaluation_responses 
    FOR ALL USING (
        is_super_admin() OR
        EXISTS (
            SELECT 1 FROM evaluations e
            JOIN evaluation_assignments ea ON ea.id = e.evaluation_assignment_id
            WHERE e.id = evaluation_id
            AND (
                (is_company_admin() AND ea.company_id = get_user_company_id()) OR
                e.evaluator_id = auth.uid() OR
                ea.user_to_evaluate_id = auth.uid()
            )
        )
    );

-- Step 5: Create helper view for scores
CREATE VIEW app_private.user_evaluation_scores AS
SELECT 
    e.id as evaluation_id,
    ea.user_to_evaluate_id,
    e.evaluator_id,
    ea.company_id,
    ea.attribute_bank_id,
    COUNT(DISTINCT er.statement_id) as completed_statements,
    COALESCE(SUM(so.points), 0) as total_points,
    e.status,
    e.completed_at
FROM evaluations e
JOIN evaluation_assignments ea ON ea.id = e.evaluation_assignment_id
LEFT JOIN evaluation_responses er ON e.id = er.evaluation_id
LEFT JOIN statement_options so ON er.selected_option_id = so.id
GROUP BY 
    e.id,
    ea.user_to_evaluate_id,
    e.evaluator_id,
    ea.company_id,
    ea.attribute_bank_id,
    e.status,
    e.completed_at;

-- Step 6: Create helper function
CREATE OR REPLACE FUNCTION get_evaluation_details(evaluation_id UUID)
RETURNS TABLE (
    evaluation_data JSONB,
    statements_data JSONB,
    responses_data JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH eval_data AS (
        SELECT 
            e.id,
            e.status,
            e.is_self_evaluation,
            e.started_at,
            e.completed_at,
            ea.evaluation_name,
            ea.attribute_bank_id,
            ab.name as bank_name,
            ab.description as bank_description
        FROM evaluations e
        JOIN evaluation_assignments ea ON ea.id = e.evaluation_assignment_id
        JOIN attribute_banks ab ON ab.id = ea.attribute_bank_id
        WHERE e.id = evaluation_id
    ),
    stmt_data AS (
        SELECT 
            ast.id,
            ast.statement,
            jsonb_agg(
                jsonb_build_object(
                    'id', so.id,
                    'description', so.description,
                    'points', so.points,
                    'display_order', so.display_order
                ) ORDER BY so.display_order
            ) as options
        FROM eval_data ed
        JOIN attribute_statements ast ON ast.attribute_bank_id = ed.attribute_bank_id
        JOIN statement_options so ON so.statement_id = ast.id
        GROUP BY ast.id, ast.statement
    ),
    resp_data AS (
        SELECT 
            jsonb_object_agg(
                er.statement_id::text,
                er.selected_option_id
            ) as responses
        FROM evaluation_responses er
        WHERE er.evaluation_id = evaluation_id
    )
    SELECT 
        row_to_json(eval_data)::jsonb as evaluation_data,
        jsonb_agg(stmt_data)::jsonb as statements_data,
        (SELECT responses FROM resp_data)::jsonb as responses_data
    FROM eval_data, stmt_data
    GROUP BY eval_data;
END;
$$;
