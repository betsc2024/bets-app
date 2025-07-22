# Quotient Report Table Approach

## Overview
This document outlines the approach for implementing the Quotient report table in the Reports.jsx component. The Quotient report allows users to compare attributes and scores between two banks (Before Bank and After Bank) with a focus on evaluation scores across different relationship types.

## Table Reference
The table should follow a structure similar to this reference:

```
+-------------------+----------+----------+----------+----------+----------+----------+
|    Attribute      | Before   | After    | Before   | After    | Before   | After    |
|                   | Self     | Self     | HR       | HR       | Boss     | Boss     |
+-------------------+----------+----------+----------+----------+----------+----------+
| Committed         | 75.0     | 80.0     | 70.0     | 75.0     | 82.0     | 68.0     |
| Decision Making   | 65.0     | 70.0     | 60.0     | 85.0     | 80.0     | 75.0     |
| Communication     | 65.0     | NA       | 70.0     | 80.0     | NA       | 85.0     |
+-------------------+----------+----------+----------+----------+----------+----------+
```

The table will dynamically include all relationship types (self, HR, top boss, peer, subordinate, reporting boss) that are linked to the selected bank(s) and user.

## Table Structure

### Column Structure
1. **First Column: Attributes**
   - Lists all attributes from the selected bank(s)
   - If two banks are selected (Before Bank and After Bank):
     - Similar attributes appear once (no duplication)
     - Unique attributes from either bank appear as separate rows

2. **Subsequent Columns: Relationship Scores**
   - Column headers will follow the pattern "[Bank] - [Relationship Type]"
   - For each bank, include columns for all relationship types found in the evaluations
   - Examples: "Before Bank - Self", "Before Bank - HR", "After Bank - Boss", etc.
   - Show the total percentage score for each attribute/relationship combination
   - Only include relationships that exist in the evaluations for the selected bank(s)
   - Display columns in a consistent order across banks (alphabetically sorted by relationship type)
   - Capitalize first letter of relationship type for better readability

### Data Processing Logic

1. **Fetching Data**
   - When Before Bank is selected (required):
     - Fetch all attributes and their scores for the selected bank
     - Filter evaluations to only include those for the selected company and user
     - Include all relationship types found in the evaluations for that specific bank 

2. **Handling Two Banks (Before and After)**
   - If After Bank is selected (optional):
     - Fetch attributes and scores for both banks
     - Create a merged attribute list:
       - Include all attributes from both banks
       - Remove duplicates (attributes that appear in both banks)
     - Create a merged relationship type list:
       - Include all relationship types from both banks
     - For each attribute and relationship type combination, show scores from both banks

3. **Special Case: "None" Selected for After Bank**
   - Only show data for the Before Bank
   - This is equivalent to only one bank being selected

## Data Calculation

1. **Score Calculation**
   - Use the shared evaluation calculation logic from `evaluationUtils.js`:
     - Calculate statement level scores: (Raw Score / Max Possible) × 100
     - For each attribute, calculate average of statement scores
     - For total percentage score: sum of all attribute percentage scores divided by number of attributes
     - Format to 00.0 format (two digits before decimal, one after)
   - This ensures consistency with all other evaluation components (SelfEvaluation, HREvaluation, etc.)
2. **Comparison Logic (When Two Banks Selected)**
   - For attributes present in both banks:
     - Show scores from both banks for direct comparison
   - For attributes unique to one bank:
     - Show score for that bank
     - Show "NA" for the other bank
   - For relationship types present in one bank but not the other:
     - Show "NA" for the missing relationship type

## UI Considerations

1. **Table Styling**
   - Use consistent styling with other report tables
   - Include headers for each column (Attribute, Relationship Type Scores)
   - Group columns by bank with clear visual separation
   - Add column borders for better readability

2. **Empty States**
   - If no evaluations exist for the selected bank/user combination:
     - Show a message indicating no data is available
   - If no evaluations exist for a specific attribute/relationship combination:
     - Show "NA" in the corresponding table cell

3. **Responsive Design**
   - Implement horizontal scrolling for tables with many columns
   - Consider collapsible sections for mobile viewing
   - Ensure table remains readable on smaller screens

## Implementation Steps

1. **Shared Utilities**
   - Use `evaluationUtils.js` for shared calculation logic:
     - `processEvaluationData`: Process evaluations and calculate scores by attribute
     - `formatScoreWithPadding`: Format scores to 00.0 format
     - `calculateCumulativeScore`: Calculate average scores across attributes

2. **Data Fetching**
   - Create a function to fetch evaluation data for a specific bank
   - Modify to handle fetching data for two banks when needed
   - Include all relationship types in the query

2. **Data Processing**
   - Create functions to process and merge attribute data
   - Extract and organize all relationship types from the evaluation data for each bank
   - Handle the special case of "None" selected for After Bank

3. **Table Rendering**
   - Create a table component that dynamically renders based on available data
   - Generate columns dynamically based on discovered relationship types
   - Group columns by bank for better organization
   - Ensure responsive design for various screen sizes

4. **Integration**
   - Integrate the table into the Quotient report section
   - Connect to the Before Bank and After Bank selection dropdowns

This approach provides a comprehensive view of evaluation data across multiple relationship types while maintaining clarity and usability.
