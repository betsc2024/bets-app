# Total Quotient Implementation Approach

## Overview

This document outlines the approach for adding a new "Total Quotient" section to the QuotientTable component. This section will appear after the existing "Raw Quotient" table and will provide a simplified view of the data by showing attribute-level total scores.

## Requirements

1. Create a new section titled "Total Quotient" after the existing "Raw Quotient" section
2. The section should contain a table with:
   - First column: List of attributes (same as in Raw Quotient)
   - Second column: "Before Total % Score" - average of relation total scores from the raw table
   - Third column (conditional): "After Total % Score" - only if after bank is available

## Data Processing Logic

### Before Total % Score Calculation
For each attribute, calculate the average of all relation total scores that are available in the raw table:
- Take the total scores for each relation type (hr, top_boss, peer, etc.) for a specific attribute
- Calculate the average of these scores
- Display this average as the "Before Total % Score"

Example:
```
Attribute: Leadership
Raw scores: HR (80), Top Boss (90), Peer (75)
Before Total % Score = (80 + 90 + 75) / 3 = 81.7
```

### After Total % Score Calculation
If an after bank is available:
- Apply the same logic as for the Before Total % Score
- Use the after bank relation scores instead
- Display this average as the "After Total % Score"

## Implementation Steps

1. Create a new function `calculateTotalQuotientData()` that:
   - Takes the existing `tableData` as input
   - Processes each attribute row to calculate the total scores
   - Returns an array of objects with { attributeName, beforeTotalScore, afterTotalScore }

2. Add a new section to the component's JSX:
   - Place it after the existing Raw Quotient table
   - Use the same title styling as the Raw Quotient section
   - Create a new table with the appropriate columns

3. Render the processed data in the new table:
   - Map through the total quotient data
   - Display each attribute with its corresponding total scores
   - Format the scores consistently with the raw table

4. Add a cumulative row at the bottom:
   - Calculate the average of all attribute total scores
   - Display this as the final row in the table

## Component Structure

```jsx
<>
  {/* Raw Quotient Section */}
  <h2 className="text-xl font-semibold text-primary mb-4">Raw Quotient</h2>
  <div className="w-full overflow-x-auto">
    {/* Existing Raw Quotient table */}
  </div>

  {/* Total Quotient Section */}
  <h2 className="text-xl font-semibold text-primary mb-4 mt-8">Total Quotient</h2>
  <div className="w-full overflow-x-auto">
    <Table className="border-collapse">
      <TableHeader>
        <TableRow>
          <TableHead className="border border-gray-300">Attribute</TableHead>
          <TableHead className="border border-gray-300">Before Total % Score</TableHead>
          {showAfterBank && (
            <TableHead className="border border-gray-300">After Total % Score</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* Map through totalQuotientData */}
        {/* Add cumulative row at the end */}
      </TableBody>
    </Table>
  </div>
</>
```

## Benefits

1. **Simplified View**: Provides a cleaner, more focused view of the total scores
2. **Easy Comparison**: Makes it easier to compare before and after scores
3. **Consistent Design**: Maintains the same styling and pattern as the existing components
4. **Reuses Existing Logic**: Leverages the existing data processing functions

This approach ensures that the Total Quotient section integrates seamlessly with the existing component while providing valuable additional information to the user.
