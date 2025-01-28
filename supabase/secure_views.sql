-- Create private schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app_private;

-- Revoke access to the private schema from public
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;

-- Grant usage to authenticated users only
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- Drop existing view from public schema
DROP VIEW IF EXISTS public.user_evaluation_scores;

-- Create view in private schema
CREATE VIEW app_private.user_evaluation_scores AS
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

-- Grant SELECT to authenticated users on the view
GRANT SELECT ON app_private.user_evaluation_scores TO authenticated;
