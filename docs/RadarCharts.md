# Guide to Implementing the "Total" Accordion (Bar and Radar Graph)

This document outlines the steps, schema references, calculations, and logic required to implement the "Total" accordion functionality, which includes rendering both a **Bar Chart** and a **Radar Chart** based on all completed evaluations (excluding self-evaluations).

---

## 1. **Schema Reference (Supabase)**

The primary table used is `evaluations` with nested relationships:

### evaluations Table
- `status` (string) — Only evaluations with `status = 'completed'`
- `relationship_type` (nullable string) — Determines if it's self or not (self = null)

### evaluation_assignments (Joined)
- `company_id`
- `user_to_evaluate_id`
- `companies`
  - `name`
  - `ideal_score`

### evaluation_responses (Joined)
- `attribute_statement_options`
  - `weight` (number)
  - `attribute_statements`
    - `statement`
    - `attributes`
      - `name`

---

## 2. **Fetching the Data**

### Step-by-Step:

1. **Query evaluations** with `.eq('status', 'completed')`
2. **Join nested relationships** for `evaluation_assignments`, `evaluation_responses`, and linked attributes.
3. **Filter evaluations** by:
    - `evaluation_assignments.company_id === selectedCompany?.id`
    - `evaluation_assignments.user_to_evaluate_id === selectedUser?.id`
4. **Filter evaluation responses** where `attribute_statements.attributes.name === selectedAttribute`
5. **Exclude self-evaluations** by checking `relationship_type !== null`

---

## 3. **Calculation Logic**

### a. **Total (Non-Self) Scores Per Statement**

```js
const processedData = {};

data.forEach((evaluation) => {
  evaluation.evaluation_responses.forEach((response) => {
    const option = response.attribute_statement_options;
    const statement = option.attribute_statements.statement;
    
    if (!processedData[statement]) {
      processedData[statement] = { totalWeight: 0, count: 0 };
    }

    processedData[statement].totalWeight += option.weight;
    processedData[statement].count += 1;
  });
});

const result = Object.entries(processedData).map(([statement, { totalWeight, count }]) => ({
  statement,
  average_weight: totalWeight / count
}));
```

This `result` array is used for both bar and radar charts.

---

## 4. **Radar Chart Data Setup**

### Labels:
```js
const labels = result.map(item => item.statement);
```

### Datasets:
```js
const radarData = {
  labels,
  datasets: [
    {
      label: 'Total',
      data: result.map(item => item.average_weight.toFixed(2)),
      backgroundColor: 'rgba(0, 128, 0, 0.15)',
      borderColor: 'rgba(0, 128, 0, 0.9)',
      // Styling options...
    },
    {
      label: 'Max Score (100)',
      data: new Array(result.length).fill(100)
    },
    {
      label: 'Ideal Score',
      data: new Array(result.length).fill(radial_ideal_score)
    }
  ]
};

setRadial_data(radarData);
```

---

## 5. **Bar Chart Data Setup**

Bar chart is only used if `score_type !== null`, showing both self and relationship scores.

```js
setBarData({
  labels,
  datasets: [
    {
      label: "Total",
      data: result.map(item => item.average_weight.toFixed(2)),
      backgroundColor: "#e74c3c"
    }
  ]
});
```

---

## 6. **UI Integration**

- The "Total" accordion is one of the options from the `items` array:

```js
{
  id: 7,
  title: "Total",
  key: "total"
}
```

- When the user selects "Total", `fetch_radar("total")` is triggered.
- Data flows to radar/bar chart handlers once `radial_result` is ready.

---

## 7. **Assumptions**

- `selectedCompany`, `selectedUser`, and `selectedAttribute` are globally managed states.
- Evaluations without a `relationship_type` are self-evaluations.
- Charts use Chart.js via React wrappers.

---

## 8. **Summary**

To implement the "Total" section:
- Pull completed evaluations.
- Filter by company, user, attribute.
- Exclude self evaluations.
- Compute average weight per statement.
- Pass the result to both radar and bar charts.

Let the data speak ✨

