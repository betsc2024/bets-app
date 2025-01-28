-- Drop existing view
DROP VIEW IF EXISTS user_evaluation_scores;

-- Recreate view with SECURITY INVOKER (default)
CREATE VIEW user_evaluation_scores AS
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
