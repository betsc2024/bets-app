# Score Calculation Documentation

## Rating Scale
- 20 = Needs Improvement
- 40 = Fair & Satisfactory
- 60 = Good
- 80 = Very Good
- 100 = Excellent

## Universal Score Calculations
These formulas apply to ANY relationship type (Self, Top Boss, HR, Peers, etc.)

### 1. Statement Level
```
Raw Score = Sum of ratings from all evaluators
Max Possible = Number of evaluators × 100
Statement % = (Raw Score / Max Possible) × 100

Example with 2 evaluators:
Ratings: 40 (Fair), 60 (Good)
Raw Score = 40 + 60 = 100
Max = 2 × 100 = 200
Statement % = (100/200) × 100 = 50.0%

Example with 3 evaluators:
Ratings: 20 (NI), 20 (NI), 40 (Fair)
Raw Score = 20 + 20 + 40 = 80
Max = 3 × 100 = 300
Statement % = (80/300) × 100 = 26.7%
```

### 2. Attribute Level (Multiple Statements)
```
Average Score = Sum of Raw Scores / Number of Statements
Percentage Score = Sum of Statement Percentages / Number of Statements

Example with 5 statements (2 evaluators each):
Statement 1: 40,60 → Raw=100, %=50.0%
Statement 2: 20,40 → Raw=60,  %=30.0%
Statement 3: 40,40 → Raw=80,  %=40.0%
Statement 4: 40,40 → Raw=80,  %=40.0%
Statement 5: 20,40 → Raw=60,  %=30.0%

Average Score = (100+60+80+80+60) / 5 = 76.0
Percentage Score = (50.0+30.0+40.0+40.0+30.0) / 5 = 38.0%
```

## Total Calculations (All Relations Combined)
For the final overview combining all relation types (Self, Top Boss, HR, Peers, etc.):

```
Max Possible = Total evaluators across ALL relations × 100

Example with 11 total evaluators:
Max Possible = 11 × 100 = 1100

Statement scores combine ratings from all evaluators:
If rated by: 0×20 + 1×40 + 2×60 + 7×80 + 1×100
Raw Score = (0×20) + (1×40) + (2×60) + (7×80) + (1×100) = 820
Statement % = (820/1100) × 100 = 74.5%

For multiple statements in an attribute:
Average Score = Sum of Raw Scores / Number of Statements
Percentage Score = Sum of Statement Percentages / Number of Statements

Example with 3 statements:
Statement 1: Raw=820, %=74.5%
Statement 2: Raw=720, %=65.5%
Statement 3: Raw=660, %=60.0%

Average Score = (820+720+660) / 3 = 733.3
Percentage Score = (74.5+65.5+60.0) / 3 = 66.7%
```

## Important Notes
1. Number of evaluators affects Max Possible:
   - 1 evaluator: Max = 100
   - 2 evaluators: Max = 200
   - 3 evaluators: Max = 300
   etc.

2. Always calculate percentage at statement level first

3. Final scores for each attribute:
   - Average Score = Average of raw scores
   - Percentage Score = Average of percentages

4. All scores round to 1 decimal place
