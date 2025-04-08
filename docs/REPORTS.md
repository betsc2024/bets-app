# Reports System Documentation

## Overview
The Reports system allows users to view and analyze evaluation data based on companies, employees, analysis types, and attribute banks. It provides various visualization options including tables, bar charts, and radar charts.

## Database Schema

### Key Tables
1. **evaluations**
   - Primary data for each evaluation
   - Fields: id, status, relationship_type, evaluation_assignment_id
   - Status can be 'completed' or other states

2. **attribute_banks**
   - Contains question banks
   - Fields: id, name, company_id, analysis_type_id
   - Directly linked to analysis_types via analysis_type_id
   - Each bank belongs to a company and has one analysis type

3. **analysis_types**
   - Defines different types of analysis (e.g., "Behaviour")
   - Fields: id, name

4. **evaluation_responses**
   - Stores actual responses for each evaluation
   - Links to attribute_statement_options for the selected responses

5. **attribute_statement_options**
   - Contains options for each statement
   - Fields: id, statement_id, weight, option_text

### Key Relationships
- Each evaluation belongs to one company through evaluation_assignments
- Each attribute_bank belongs to one company and one analysis_type
- Evaluation responses are linked to statements through attribute_statement_options

## Detailed Database Schema Specification

### Core Tables

#### 1. companies
```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Stores company information
- Each company can have multiple users and attribute banks

#### 2. users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    company_id UUID REFERENCES companies(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Stores user information
- Linked to companies through company_id

#### 3. analysis_types
```sql
CREATE TABLE analysis_types (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Defines types of analysis (e.g., "Behaviour")
- Used to categorize attribute banks

### Evaluation Structure

#### 4. attribute_banks
```sql
CREATE TABLE attribute_banks (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    company_id UUID REFERENCES companies(id),
    analysis_type_id UUID REFERENCES analysis_types(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Contains question banks
- Each bank belongs to a company and has one analysis type
- Used to group related attributes and statements

#### 5. attributes
```sql
CREATE TABLE attributes (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    company_id UUID REFERENCES companies(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Defines evaluation criteria
- Can be reused across different banks
- Belongs to a specific company

#### 6. attribute_statements
```sql
CREATE TABLE attribute_statements (
    id UUID PRIMARY KEY,
    statement TEXT NOT NULL,
    attribute_id UUID REFERENCES attributes(id),
    attribute_bank_id UUID REFERENCES attribute_banks(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Contains specific statements for evaluation
- Linked to both attributes and banks
- Forms the basis for evaluation questions

#### 7. attribute_statement_options
```sql
CREATE TABLE attribute_statement_options (
    id UUID PRIMARY KEY,
    statement_id UUID REFERENCES attribute_statements(id),
    option_text TEXT NOT NULL,
    weight INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Defines possible responses for each statement
- Includes weights for score calculation
- Used in evaluation responses

### Evaluation Process

#### 8. evaluation_assignments
```sql
CREATE TABLE evaluation_assignments (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id),
    user_to_evaluate_id UUID REFERENCES users(id),
    attribute_bank_id UUID REFERENCES attribute_banks(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Links users to their evaluations
- Specifies which bank to use
- Tracks evaluation assignments

#### 9. evaluations
```sql
CREATE TABLE evaluations (
    id UUID PRIMARY KEY,
    evaluation_assignment_id UUID REFERENCES evaluation_assignments(id),
    evaluator_id UUID REFERENCES users(id),
    relationship_type TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Tracks individual evaluation instances
- Records relationship between evaluator and evaluatee
- Maintains evaluation status and timing

#### 10. evaluation_responses
```sql
CREATE TABLE evaluation_responses (
    id UUID PRIMARY KEY,
    evaluation_id UUID REFERENCES evaluations(id),
    statement_id UUID REFERENCES attribute_statements(id),
    selected_option_id UUID REFERENCES attribute_statement_options(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Stores actual evaluation responses
- Links responses to specific statements and options
- Used for score calculation

### Key Relationships and Data Flow

1. **Evaluation Setup**:
   - Company has many attribute banks
   - Each bank has one analysis type
   - Banks contain multiple attributes
   - Attributes have multiple statements
   - Statements have multiple options

2. **Evaluation Process**:
   - Assignment created for user
   - Evaluation instances created for each evaluator
   - Responses recorded for each statement
   - Weights from options used for scoring

3. **Reporting Flow**:
   - Filter by company and user
   - Group by relationship type
   - Calculate scores using option weights
   - Aggregate across attributes

### Important Indexes

```sql
-- Performance optimization indexes
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_banks_company ON attribute_banks(company_id);
CREATE INDEX idx_banks_analysis ON attribute_banks(analysis_type_id);
CREATE INDEX idx_evaluations_assignment ON evaluations(evaluation_assignment_id);
CREATE INDEX idx_responses_evaluation ON evaluation_responses(evaluation_id);
CREATE INDEX idx_statements_bank ON attribute_statements(attribute_bank_id);
```

### Constraints and Validations

1. **Relationship Types**:
   - Valid values: 'self', 'peer', 'top_boss', 'reporting_boss', 'subordinate', 'hr'
   - Enforced at application level

2. **Status Values**:
   - Valid values: 'pending', 'in_progress', 'completed'
   - Enforced at application level

3. **Weights**:
   - Must be positive integers
   - Typically range from 1 to 5
   - Enforced by database constraint

### Data Integrity Rules

1. **Cascading Deletes**:
   - Disabled for safety
   - All deletions must be handled at application level

2. **Soft Deletes**:
   - Not implemented currently
   - Consider adding deleted_at timestamp

3. **Timestamps**:
   - All tables include created_at and updated_at
   - Automatically managed by triggers

## UI Components

### Selection Hierarchy
1. Company Selection
   - Shows all available companies
   - Triggers user list update

2. Employee Selection
   - Shows users from selected company
   - Filtered by company_id

3. Analysis Type Selection
   - Shows available analysis types
   - Used to filter banks and evaluations

4. Bank Selection
   - Shows banks for selected company
   - Filtered by:
     - Company ID
     - Analysis Type

### Data Flow
1. When company is selected:
   - Fetches users for that company
   - Fetches banks for that company

2. When analysis type is selected:
   - Filters banks to show only those matching the analysis type
   - Updates evaluation display

3. When bank is selected:
   - Filters evaluations to show only those for the selected bank

## Key Functions

### Data Fetching
1. `fetchData(selectedCompany, selectedUser, selectedAnalysis, selectedBank)`
   - Main function for fetching evaluation data
   - Filters by company, user, analysis type, and bank
   - Processes data for visualization

2. `fetch_bank(selectedCompany, selectedAnalysis)`
   - Fetches banks for selected company
   - Filters by analysis type
   - Updates bank selection dropdown

### Data Processing
1. Relationship Count Mapping
   - Tracks number of evaluations by relationship type
   - Used for calculating averages and weights

2. Score Calculation
   - Processes weights from attribute_statement_options
   - Calculates averages for different relationship types

## Visualization Types

### 1. Table View
- Shows attribute-wise breakdown of scores
- Columns include:
  - Attribute name
  - Self evaluation score
  - Others' evaluation score
  - Gap analysis

### 2. Bar Chart
- Compares scores across attributes
- Color-coded by relationship type
- Shows:
  - Self evaluation
  - Peer evaluation
  - Top boss evaluation
  - Reporting boss evaluation
  - Subordinate evaluation

### 3. Radar Chart
- Spider/web visualization
- Shows multi-dimensional data
- Features:
  - Section-specific numbering
  - Progress tracking
  - Statement-focused view
  - Sticky section headers

### Data Processing for Visualizations

#### Score Calculation
1. **Self Scores**
   - Average of self-evaluation weights
   - Normalized to percentage

2. **Relationship Type Scores**
   - Calculated per relationship (peer, boss, etc.)
   - Weighted average based on response count

3. **Overall Score**
   - Combined score across all relationships
   - Weighted by number of evaluators

#### Progress Tracking
- Shows completion status
- Updates in real-time
- Section-wise progress indicators

## User Experience Enhancements

### Statement-Focused View
- One statement visible at a time
- Navigation buttons for movement
- Progress bar for section completion

### Sticky Headers
- Section headers remain visible while scrolling
- Shows current section context
- Includes section-specific numbering

### Color Coding
- Purple theme consistent with application
- Different colors for different relationship types
- Visual distinction between self and other evaluations

## Report Generation Process

### 1. Data Collection
- Fetch completed evaluations
- Group by relationship type
- Aggregate responses

### 2. Score Processing
- Calculate weighted averages
- Normalize scores
- Generate gap analysis

### 3. Visualization
- Generate appropriate charts
- Apply color schemes
- Add interactive elements

### 4. Export Options
- Table format
- Chart images
- Combined report PDF

## UI States

### Loading States
- Initial load: Shows company dropdown
- After company selection: Shows employee dropdown
- After analysis type selection: Shows filtered banks

### Error Handling
- Database errors show toast notifications
- Invalid selections are prevented through UI constraints

## Best Practices

### Data Fetching
1. Always filter data at the database level when possible
2. Use proper joins to minimize database calls
3. Cache results when appropriate

### UI Updates
1. Cascade updates properly (company → users → banks)
2. Clear irrelevant selections when parent selection changes
3. Show loading states during data fetches

### Performance Considerations
1. Use appropriate indexes on:
   - company_id in users table
   - analysis_type_id in attribute_banks
   - evaluation_assignment_id in evaluations
2. Batch related updates to minimize re-renders


