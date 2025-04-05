# Attributes, Statements and Analysis Types Schema Documentation

## Overview
This document explains the core schema design for attributes, statements, analysis types, and their relationships in the evaluation system.

## Core Tables and Relationships

### 1. Attributes (`attributes`)
- Base table for evaluation attributes
- Can be industry-standard or company-specific
- Properties:
  - `id`: UUID (Primary Key)
  - `company_id`: UUID (optional, for company-specific attributes)
  - `name`: TEXT
  - `description`: TEXT
  - `is_industry_standard`: BOOLEAN

### 2. Attribute Statements (`attribute_statements`)
- Contains evaluation statements for each attribute
- One attribute can have multiple statements
- Properties:
  - `id`: UUID (Primary Key)
  - `attribute_id`: UUID (References attributes)
  - `statement`: TEXT
  - `attribute_bank_id`: UUID (optional, for bank-specific statements)

### 3. Statement Options (`attribute_statement_options`)
- Contains possible response options for each statement
- Each statement can have multiple options with different weights
- Properties:
  - `id`: UUID (Primary Key)
  - `statement_id`: UUID (References attribute_statements)
  - `option_text`: TEXT
  - `weight`: INTEGER

### 4. Analysis Types (`analysis_types`)
- Defines different types of analysis (e.g., behavior, leadership)
- Properties:
  - `id`: UUID (Primary Key)
  - `name`: TEXT

### 5. Statement Analysis Types (`statement_analysis_types`)
- Junction table linking statements to analysis types
- Allows statements to be used in different types of analysis
- Properties:
  - `id`: UUID (Primary Key)
  - `statement_id`: UUID (References attribute_statements)
  - `analysis_type_id`: UUID (References analysis_types)

## Relationships and Flow

```
Attributes (1) ──► Statements (1) ──► Statement Options (Many)
                        │
                        ▼
                  Analysis Types (Many)
                  (via statement_analysis_types)
```

1. **Attribute to Statements**: One-to-Many
   - Each attribute can have multiple statements
   - Statements are specific to one attribute

2. **Statement to Options**: One-to-Many
   - Each statement has multiple response options
   - Options have weights for scoring

3. **Statement to Analysis Types**: Many-to-Many
   - Statements can be used in multiple types of analysis
   - Relationship managed through `statement_analysis_types` junction table
   - Provides flexibility to use same statement for different analysis purposes

## Key Features

1. **Flexible Analysis Types**
   - Analysis types are linked at the statement level, not attribute level
   - Same attribute can have statements for different types of analysis
   - Allows for more granular control over evaluation types

2. **Weighted Options**
   - Each statement option has a weight
   - Enables nuanced scoring in evaluations
   - Weights can be adjusted per option

3. **Company vs Industry Standard**
   - Attributes can be industry-standard or company-specific
   - Company-specific attributes are linked to a company_id
   - Industry-standard attributes have no company_id but are marked with is_industry_standard=true

## Usage Example

```sql
-- Example: Get all statements and their analysis types for an attribute
SELECT 
    a.name as attribute_name,
    ast.statement,
    at.name as analysis_type_name,
    aso.option_text,
    aso.weight
FROM attributes a
JOIN attribute_statements ast ON a.id = ast.attribute_id
JOIN statement_analysis_types sat ON ast.id = sat.statement_id
JOIN analysis_types at ON at.id = sat.analysis_type_id
JOIN attribute_statement_options aso ON ast.id = aso.statement_id
WHERE a.id = '[attribute_id]';
```
