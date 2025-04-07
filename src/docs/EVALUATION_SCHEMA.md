# Evaluation System Database Schema Guide

This document outlines the database structure for the evaluation system implemented in Supabase.

## Core Tables Overview

### 1. Attribute Banks (`attribute_banks`)
Primary container for evaluation templates.
```sql
CREATE TABLE attribute_banks (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    analysis_type_id UUID REFERENCES analysis_types(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```
- Each company can have multiple attribute banks
- Status tracks whether the bank is active/draft
- Analysis type determines how responses are analyzed

### 2. Attributes and Statements
#### Attributes
Defines evaluation categories/competencies
```sql
CREATE TABLE attributes (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
);
```

#### Attribute Statements (`attribute_statements`)
Individual evaluation questions
```sql
CREATE TABLE attribute_statements (
    id UUID PRIMARY KEY,
    attribute_bank_id UUID REFERENCES attribute_banks(id),
    attribute_id UUID REFERENCES attributes(id),
    statement TEXT NOT NULL
);
```

#### Statement Options (`attribute_statement_options`)
Possible responses for each statement
```sql
CREATE TABLE attribute_statement_options (
    id UUID PRIMARY KEY,
    statement_id UUID REFERENCES attribute_statements(id),
    option_text TEXT NOT NULL,
    weight INTEGER NOT NULL
);
```

### 3. Evaluation Process Tables

#### Evaluation Assignments (`evaluation_assignments`)
Master record for an evaluation process
```sql
CREATE TABLE evaluation_assignments (
    id UUID PRIMARY KEY,
    evaluation_name TEXT NOT NULL,
    company_id UUID REFERENCES companies(id),
    user_to_evaluate_id UUID REFERENCES users(id),
    attribute_bank_id UUID REFERENCES attribute_banks(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

#### Evaluations (`evaluations`)
Individual evaluation instances
```sql
CREATE TABLE evaluations (
    id UUID PRIMARY KEY,
    evaluation_assignment_id UUID REFERENCES evaluation_assignments(id),
    evaluator_id UUID REFERENCES users(id),
    status TEXT NOT NULL,
    is_self_evaluator BOOLEAN,
    relationship_type TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

#### Evaluation Responses (`evaluation_responses`)
Stores actual responses from evaluators
```sql
CREATE TABLE evaluation_responses (
    id UUID PRIMARY KEY,
    evaluation_id UUID REFERENCES evaluations(id),
    statement_id UUID REFERENCES attribute_statements(id),
    selected_option_id UUID REFERENCES attribute_statement_options(id),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

## Key Relationships and Data Flow

1. **Company Level**
   - Companies own attribute banks
   - Companies manage evaluation assignments

2. **Attribute Bank Structure**
   - Attribute Bank → Attributes → Statements → Statement Options
   - Each level adds more detail to the evaluation structure

3. **Evaluation Process**
   ```
   Evaluation Assignment
        ↓
   Multiple Evaluations (one per evaluator)
        ↓
   Evaluation Responses
   ```

4. **Response Collection**
   - Each evaluation response links:
     - Which evaluation it belongs to
     - Which statement was answered
     - Which option was selected

## Important Fields

1. **Status Tracking**
   - Attribute Banks: status (draft/active)
   - Evaluations: status (tracks completion)
   - Timestamps: created_at, updated_at, started_at, completed_at

2. **Relationship Types**
   - top_boss
   - hr
   - reporting_boss
   - peer
   - subordinate

3. **Weights**
   - Statement options include weights for scoring
   - Used in analysis calculations

## Common Queries

1. **Get Active Evaluations for User**
```sql
SELECT e.*
FROM evaluations e
WHERE e.evaluator_id = [user_id]
AND e.status = 'active';
```

2. **Get Evaluation Progress**
```sql
SELECT 
    e.id,
    COUNT(er.id) as completed_responses,
    COUNT(DISTINCT as.id) as total_statements
FROM evaluations e
LEFT JOIN evaluation_responses er ON e.id = er.evaluation_id
JOIN evaluation_assignments ea ON e.evaluation_assignment_id = ea.id
JOIN attribute_banks ab ON ea.attribute_bank_id = ab.id
JOIN attribute_statements as ON ab.id = as.attribute_bank_id
WHERE e.id = [evaluation_id]
GROUP BY e.id;
```

## Best Practices

1. **Data Integrity**
   - Always use transactions when creating evaluations
   - Ensure all required relationships exist before creating records

2. **Performance**
   - Index frequently queried fields
   - Use appropriate joins when querying related data

3. **Status Management**
   - Maintain clear status transitions
   - Update timestamps appropriately

4. **Security**
   - Implement row-level security
   - Verify user permissions before operations
