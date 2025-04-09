# BETS (Business Evaluation and Tracking System)

## Overview
BETS is a comprehensive evaluation and tracking system built with React + Vite that allows companies to conduct various types of evaluations (self, peer, supervisor, etc.) and generate detailed reports. The system uses Supabase for data management and features a modern UI with interactive visualizations.

## Tech Stack
- Frontend: React + Vite
- Database: Supabase
- Charts: Chart.js with react-chartjs-2
- UI Components: Custom components with Radix UI
- Styling: Tailwind CSS

## Project Structure

### Key Components

#### Reports System (`/src/pages/Reports.jsx`)
- Handles visualization of evaluation data
- Supports multiple view types:
  - Table view
  - Bar charts
  - Radar charts
- Features demographic analysis
- Allows data filtering by company, employee, analysis type, and bank

### Database Schema

#### Core Tables
1. **Users**
   - Stores user information
   - Fields: id, email, full_name, company_id, role
   - Relationships: belongs to companies

2. **Attribute Banks**
   - Collections of evaluation attributes
   - Fields: id, company_id, name, description, status
   - Relationships: belongs to companies, has analysis types

3. **Attributes**
   - Evaluation criteria
   - Relationships: belongs to attribute banks
   - Can be mapped to industries

4. **Attribute Statements**
   - Specific evaluation questions
   - Relationships: belongs to attributes
   - Connected to statement options

5. **Statement Options**
   - Possible responses for statements
   - Fields: description, points, display_order

#### Evaluation Flow Tables
1. **Evaluation Assignments**
   - Links evaluators to evaluatees
   - Manages evaluation assignments
   - Connected to companies and attribute banks

2. **Evaluations**
   - Records evaluation instances
   - Fields: status, relationship_type
   - Relationships: linked to assignments

3. **Evaluation Responses**
   - Stores actual responses
   - Contains weights and scores
   - Connected to statements and options

### Key Features

#### 1. Evaluation Management
- Multiple evaluation types support
- Customizable attributes and statements
- Flexible scoring system

#### 2. Reporting System
- Multi-view reporting (Table/Bar/Radar)
- Relationship-based comparisons
- Demographic analysis
- Score aggregation
- Chart export functionality

#### 3. Analysis System
- Analysis type categorization
- Bank-based filtering
- Company-specific configurations

## Data Flow

```
Companies
   └── Users
   └── Attribute Banks
        └── Attributes
             └── Attribute Statements
                  └── Statement Options
                  └── Statement Analysis Types
                       └── Analysis Types

Evaluation Flow:
Evaluation Assignments
   └── Evaluations
        └── Evaluation Responses
             └── Attribute Statement Options
```

## Getting Started

1. **Environment Setup**
   ```bash
   npm install
   ```

2. **Configuration**
   - Set up Supabase credentials
   - Configure environment variables

3. **Development**
   ```bash
   npm run dev
   ```

## Key Functions

### Reports
- `fetchData()`: Retrieves evaluation data
- `processDemographicData()`: Processes demographic information
- `specific_type_bar()`: Generates bar chart visualizations
- `fetch_radar()`: Handles radar chart data

### Data Management
- `deleteEvaluationResponses()`: Manages data deletion
- `fetch_spefifc_data()`: Retrieves filtered data
- `copyToClipboard()`: Handles chart exports

## UI Components

1. **Selection Controls**
   - Company selector
   - Employee selector
   - Analysis type selector
   - Bank selector

2. **Visualization Components**
   - Table view with sorting
   - Bar charts with labels
   - Radar charts with legends
   - Demographic analysis views

## Best Practices

1. **Data Loading**
   - Implement proper error handling
   - Show loading states
   - Cache frequently accessed data

2. **Performance**
   - Use proper indexing in database
   - Implement pagination where needed
   - Optimize chart rendering

3. **Security**
   - Implement proper access controls
   - Validate all inputs
   - Secure API endpoints

## Reports Generation Documentation

### Overview
The reports module processes evaluation data to generate various insights based on relationship types (self, top_boss, etc.) and attributes. Here's a detailed breakdown of how the calculations work.

### Data Flow
1. **Data Fetching**
   ```sql
   FROM evaluations
   JOIN evaluation_assignments
   JOIN evaluation_responses
   WHERE status = 'completed'
   ```
   - Filters by company_id and user_to_evaluate_id
   - Groups by relationship_type

2. **Calculation Types**

#### A. Basic Calculations
- **Average Weight**: `totalWeight / numberOfResponses`
  ```javascript
  average_weight = count > 0 ? totalWeight / count : 0
  ```
- **Score Percentage**: `average_weight / number_of_evaluations_of_type`
  ```javascript
  average_score_percentage = (totalWeight / count) / relation_count_map[relationship_type]
  ```

#### B. Relationship-Specific Calculations

1. **Self Evaluation**
   - When `relationship_type = null` or `"self"`
   - Individual score = Sum of weights / Number of responses
   - Percentage = Individual score / Number of self evaluations

2. **Top Boss Evaluation**
   - When `relationship_type = "top_boss"`
   - Individual score = Sum of weights / Number of responses
   - Percentage = Individual score / Number of top boss evaluations

3. **Total Calculations**
   - Combines all relationship types
   - Total Average = Sum of all relationship type averages / Number of types

### Score Calculations

#### Total Score Calculation
The average total score is calculated by excluding self-evaluations and averaging the weights for each statement. The process works as follows:

1. **Data Filtering**
   - All self-evaluations (where `relationship_type` is 'self' or null) are excluded
   - Only evaluations from other relationship types are considered

2. **Calculation Process**
   - For each statement:
     1. Sum up all weights from non-self evaluations
     2. Divide by the count of evaluations to get the average
     3. Final formula: `average_score_percentage = (totalWeight / count) / number_of_evaluations_for_relationship_type`

3. **Implementation Details**
   - The calculation is handled in both `fetchSpecificData` and `fetch_radar` functions
   - Self-evaluations are explicitly filtered out using: `relationship_type !== 'self' && relationship_type !== null`
   - Each statement's weights are averaged separately to maintain individual attribute scores

### Visualization Types

1. **Table View**
   - Rows: Attributes
   - Columns: Relationship types (Self, Top Boss, Total)
   - Values: Average scores and percentages

2. **Bar Chart**
   - X-axis: Relationship types
   - Y-axis: Average scores
   - Grouped by attributes

3. **Radar Chart**
   - Axes: Attributes
   - Values: Average scores
   - Multiple plots for different relationship types

### Example Calculation

```javascript
// Sample data structure
{
  attribute: "Leadership",
  responses: [
    { weight: 4, relationship: "self" },
    { weight: 5, relationship: "self" },
    { weight: 3, relationship: "top_boss" }
  ]
}

// Calculations
Self Average = (4 + 5) / 2 = 4.5
Self Percentage = 4.5 / 2 (number of self evaluations) = 2.25

Top Boss Average = 3 / 1 = 3
Top Boss Percentage = 3 / 1 = 3

Total Average = (4.5 + 3) / 2 = 3.75
```

### Data Processing Steps

1. **Initial Data Grouping**
   ```javascript
   attributeMap[attributeName] = {
     totalWeight: 0,
     count: 0,
     analysis_type: analysis_type
   }
   ```

2. **Relationship Type Mapping**
   ```javascript
   relation_count_map = {
     "self": number_of_self_evaluations,
     "top_boss": number_of_top_boss_evaluations,
     // ... other types
   }
   ```

3. **Final Data Structure**
   ```javascript
   {
     relationship_type: string,
     company_name: string,
     attribute_name: string,
     average_weight: number,
     average_score_percentage: number,
     analysis_type: string
   }
   ```

### Important Notes
- All calculations start with raw weights from evaluation responses
- Averages are calculated first at the attribute level
- Results are normalized by the number of evaluations of each type
- This ensures fair comparison between different relationship types

## Contributing
Please follow the project's coding standards and submit PRs for review.

## License
[Your License Information]
