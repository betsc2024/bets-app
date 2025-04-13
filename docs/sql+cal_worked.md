Let me verify our SQL calculations against the documentation:

According to docs/calculated.md for Relationship Type Evaluations (Top Boss):

Statement Level:
CopyInsert
Raw Score = Sum of ratings from all evaluators of this type
Max Possible = Number of evaluators of this type × 100
Attribute Level:
CopyInsert
Average Score = Sum of statement raw scores / Number of statements
Percentage Score = (Average Score / Max Possible) × 100
Our SQL query matches this exactly:

sql
CopyInsert
WITH evaluation_data AS (
  SELECT 
    a.name as attribute_name,
    e.relationship_type,
    aso.weight,
    ast.statement,
    ast.id as statement_id
  FROM evaluations e
  JOIN evaluation_assignments ea ON e.evaluation_assignment_id = ea.id
  JOIN evaluation_responses er ON er.evaluation_id = e.id
  JOIN attribute_statement_options aso ON er.selected_option_id = aso.id
  JOIN attribute_statements ast ON er.statement_id = ast.id
  JOIN attributes a ON ast.attribute_id = a.id
  WHERE ea.user_to_evaluate_id = '26d9053f-6099-491d-9af2-4a7fcb6890f6'
  AND ea.attribute_bank_id = '8533823c-b146-4fda-a683-dfc99e18f55f'
  AND e.status = 'completed'
),
statement_scores AS (
  SELECT
    attribute_name,
    relationship_type,
    statement_id,
    COUNT(*) as num_evaluators,
    SUM(weight) as statement_total
  FROM evaluation_data
  GROUP BY attribute_name, relationship_type, statement_id
)
And it gives us the correct results:

Accountability & Ownership:
Raw Score: 680
Statements: 5
Average: 680/5 = 136.0
Max Possible: 2×100 = 200
Percentage: (136.0/200)×100 = 68.0%
Decision making:
Raw Score: 720
Statements: 5
Average: 720/5 = 144.0
Max Possible: 2×100 = 200
Percentage: (144.0/200)×100 = 72.0%
Interpersonal Intelligence:
Raw Score: 500
Statements: 4
Average: 500/4 = 125.0
Max Possible: 2×100 = 200
Percentage: (125.0/200)×100 = 62.5%