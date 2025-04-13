# Score Calculation Documentation

## Rating Scale
- 20 = Needs Improvement
- 40 = Fair & Satisfactory
- 60 = Good
- 80 = Very Good
- 100 = Excellent

## 1. Self Evaluation
```
Statement Level:
Raw Score = Rating value (single evaluator)
Max Possible = 100 (always, since only 1 evaluator)

Attribute Level:
Average Score = Sum of statement raw scores / Number of statements
Percentage Score = (Average Score / 100) × 100
```

## 2. Relationship Type Evaluations
(Top Boss, HR, Peer, Subordinate, Reporting Boss)
```
Statement Level:
Raw Score = Sum of ratings from all evaluators of this type
Max Possible = Number of evaluators of this type × 100

Attribute Level:
Average Score = Sum of statement raw scores / Number of statements
Percentage Score = (Average Score / Max Possible) × 100
```

## 3. Total (All Relations Combined)
```
Statement Level:
Raw Score = Sum of ratings across ALL evaluators
Max Possible = Total number of evaluators × 100

Attribute Level:
Average Score = Sum of statement raw scores / Number of statements
Percentage Score = (Average Score / Max Possible) × 100
```

## Important Notes
1. Max possible score varies by evaluation type:
   - Self: Always 100 (1 evaluator)
   - Relationship Types: n × 100 (where n = number of evaluators of that type)
   - Total: N × 100 (where N = total number of evaluators across all types)
2. For each statement:
   - Count ratings in each category
   - Multiply rating value × number of ratings
   - Sum all values for total
3. The final percentage is calculated using the average score
4. All scores round to 1 decimal place
