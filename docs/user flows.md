# user flows

# Application Workflow Diagrams

## 1. User Authentication Flow

```mermaid
graph TD
    A[Start] --> B[User Visits Login Page]
    B --> C{Validate Credentials}
    C -->|Valid| D{User Role?}
    C -->|Invalid| B
    D -->|Admin| E[Admin Dashboard]
    D -->|Regular User| F[User Dashboard]

```

## 2. Admin Workflow Flows

### 2.1 Industry Management Flow

```mermaid
graph TD
    A[Admin Dashboard] --> B[Industry Management]
    B --> C[Add New Industry]
    C --> D[Enter Industry Details]
    D --> E[Save Industry]
    E --> F[View/Edit/Delete Industries]

```

### 2.2 Attribute Management Flow

```mermaid
graph TD
    A[Admin Dashboard] --> B[Attribute Management]
    B --> C{Select Operation}
    
    C -->|Add Industry Attribute| D[Select Industry]
    D --> E[Choose Attribute Type: Behavior/Leadership]
    E --> F[Create Industry-Standard Attribute]
    F --> G[Define Statement Options]
    G --> H[Set Points for Options]
    H --> I[Save Industry Attribute]

    C -->|Add Company Attribute| J[Use Existing Industry Attribute]
    J -->|Yes| K[Select from Industry Attributes]
    J -->|No| L[Create New Company Attribute]
    L --> M[Define Company-Specific Options]
    M --> N[Set Points]
    K --> O[Save to Company Bank]
    N --> O
```

### 2.3 Super Admin vs Company Admin

```mermaid
graph TD
    A[Admin Login] --> B{Admin Type}
    B -->|Super Admin| C[Global Dashboard]
    B -->|Company Admin| D[Company Dashboard]
    
    C --> E[Manage All Companies]
    C --> F[Manage Industries]
    C --> G[Global Reports]
    
    D --> H[Manage Company Users]
    D --> I[Manage Company Evaluations]
    D --> J[Company Reports]
```

## 3. Attribute Bank Management Flow

```mermaid
graph TD
    A[Admin Dashboard] --> B[Attribute Bank Creation]
    B --> C[Select Company]
    C --> D[Choose Industry]
    D --> E[View Available Attributes]
    E --> F{Select Attributes}
    F -->|Industry Attributes| G[Select from Industry List]
    F -->|Company Attributes| H[Select from Company List]
    F -->|Create New| I[Create Company-Specific Attribute]
    G --> J[Review Selected Attributes]
    H --> J
    I --> J
    J --> K[Save Attribute Bank]
```

## 4. Evaluation Assignment Flow

```mermaid
graph TD
    A[Admin Dashboard] --> B[Evaluation Management]
    B --> C[Select Attribute Bank]
    C --> D[Choose Evaluated User]
    D --> E[Select Evaluators]
    E --> F{Self-Evaluation Option}
    F --> |Enable| G[Allow Self-Evaluation]
    F --> |Disable| H[Disable Self-Evaluation]
    G --> I[Assign Evaluation]
    H --> I

```

## 5. User Evaluation Flow

```mermaid
graph TD
    A[User Dashboard] --> B{Evaluation Tasks}
    B --> |Self-Evaluation| C[View Self-Evaluation Statements]
    B --> |Peer Evaluation| D[View Assigned Evaluations]
    C --> E[Rate Statements]
    D --> F[Rate Assigned User Statements]
    E --> G[Submit Self-Evaluation]
    F --> H[Submit Peer Evaluation]

```

## 6. Reporting Flow

```mermaid
graph TD
    A[Dashboard] --> B{User Type}
    B --> |Regular User| C[View Personal Evaluation]
    C --> D[See Self-Evaluation Scores]
    C --> E[View Evaluations Conducted]

    B --> |Admin| F[Comprehensive Reports]
    F --> G[Company-Level Reports]
    F --> H[Industry-Level Analytics]
    F --> I[Individual User Reports]

```

## 7. Evaluation Progress Tracking

```mermaid
graph TD
    A[Evaluation Assignment] --> B[Track Progress]
    B --> C{Completion Status}
    C -->|Self Evaluation| D[Track Self Completion]
    C -->|Peer Evaluations| E[Track Peer Completion]
    
    D --> F[Update Assignment Status]
    E --> F
    F --> G[Generate Reports]
```

## 8. Notification Flow

```mermaid
graph TD
    A[Evaluation Events] --> B{Event Type}
    B -->|New Assignment| C[Notify Assigned Users]
    B -->|Evaluation Complete| D[Notify Admin]
    B -->|Deadline Approaching| E[Remind Pending Users]
    
    C --> F[Email Notification]
    D --> F
    E --> F
```

## Detailed User Types and Permissions

### Super Admin Permissions:
1. Everything a Company Admin can do
2. Manage Multiple Companies
3. Create/Modify Industries
4. View Cross-Company Analytics
5. Manage Global Settings

### Company Admin Permissions:
1. Manage Company Users
2. Create/Modify Attribute Banks
3. Assign Evaluations
4. View Company Reports
5. Manage Company Settings

### Regular User Permissions:
1. View Personal Dashboard
2. Complete Self-Evaluations
3. Conduct Assigned Peer Evaluations
4. View Own Evaluation History

## Key Workflow Considerations

- Centralized login mechanism
- Role-based access control
- Flexible evaluation assignment
- Comprehensive reporting
- Data privacy and visibility controls

## Potential Enhancement Areas

1. Multilevel evaluation workflows
2. Advanced reporting and analytics
3. Integration with performance management systems
4. Export and sharing capabilities