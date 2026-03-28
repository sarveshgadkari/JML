# CSV Import Schema for Judge My Lawyer

## Overview

This document defines the CSV format for importing case data into the Judge My Lawyer platform.

## CSV Format

### Required Columns

| Column Name | Data Type | Description | Example |
|------------|-----------|-------------|---------|
| `case_number` | Text | Unique case identifier | `CASE/123456/2024` |
| `case_title` | Text | Title/name of the case | `State vs. John Doe` |
| `case_type` | Text | Type of case | `Criminal`, `Civil`, `Corporate`, `Family`, `Property`, `Labor` |
| `court_name` | Text | Name of the court | `Supreme Court of India` |
| `judge_name` | Text | Name of the presiding judge | `Hon'ble Justice A.K. Sharma` |
| `petitioner_lawyers` | Text | Comma-separated lawyer names | `Adv. Rajesh Kumar, Adv. Priya Sharma` |
| `respondent_lawyers` | Text | Comma-separated lawyer names | `Adv. Anil Verma, Adv. Sunita Desai` |
| `filing_date` | Date | Date case was filed | `2024-01-15` or `15/01/2024` |
| `judgment_date` | Date | Date of judgment (if disposed) | `2024-06-20` or `20/06/2024` |
| `status` | Text | Case status | `disposed`, `pending` |
| `outcome` | Text | Case outcome (if disposed) | `Won`, `Lost`, `Settled`, `Dismissed` |
| `petitioner_name` | Text | Name of petitioner/plaintiff | `ABC Corporation` |
| `respondent_name` | Text | Name of respondent/defendant | `XYZ Limited` |

### Optional Columns

| Column Name | Data Type | Description | Example |
|------------|-----------|-------------|---------|
| `first_hearing_date` | Date | Date of first hearing | `2024-02-01` |
| `last_hearing_date` | Date | Date of last hearing | `2024-06-15` |
| `total_hearings` | Number | Number of hearings conducted | `12` |
| `summary` | Text | Brief case summary | `This case involves..` |
| `petitioner_lawyer_roles` | Text | Comma-separated roles matching petitioner_lawyers | `Lead Counsel, Senior Advocate` |
| `respondent_lawyer_roles` | Text | Comma-separated roles matching respondent_lawyers | `Counsel, Junior Counsel` |

## Sample CSV

```csv
case_number,case_title,case_type,court_name,judge_name,petitioner_lawyers,respondent_lawyers,filing_date,judgment_date,status,outcome,petitioner_name,respondent_name,total_hearings,summary
CASE/000001/2024,State vs. John Doe,Criminal,Supreme Court of India,Hon'ble Justice A.K. Sharma,"Adv. Rajesh Kumar, Adv. Priya Sharma",Adv. Anil Verma,2024-01-15,2024-06-20,disposed,Won,State of Delhi,John Doe,15,Criminal case involving theft charges
CASE/000002/2024,ABC Corp vs. XYZ Ltd,Civil,Delhi High Court,Hon'ble Justice B.K. Singh,Adv. Sunita Desai,"Adv. Rajesh Kumar, Adv. Maya Iyer",2023-11-10,2024-03-25,disposed,Settled,ABC Corporation,XYZ Limited,8,Contract dispute between two corporations
CASE/000003/2024,Property Dispute Matter,Property,District Court Saket,Shri R.P. Gupta,Adv. Priya Sharma,Adv. Anil Verma,2024-02-01,,pending,,Ramesh Kumar,Suresh Patel,5,Ongoing property boundary dispute
```

## Date Format Support

The import system supports multiple date formats:
- ISO format: `2024-01-15`
- DD/MM/YYYY: `15/01/2024`
- MM/DD/YYYY: `01/15/2024`
- DD-MM-YYYY: `15-01-2024`

## Lawyer Matching Logic

### Automatic Matching
The system will attempt to match lawyers by:
1. **Bar Registration Number** (if provided in format `Adv. Name (D/1234/2020)`)
2. **Exact Name Match** (case-insensitive)
3. **Fuzzy Name Match** (for typos/variations)

### New Lawyer Creation
If a lawyer is not found:
- A new **unverified** lawyer record will be created
- The lawyer can claim their profile later
- Admin can verify the lawyer manually

### Example Lawyer Formats

```csv
# With Bar Registration (Preferred)
"Adv. Rajesh Kumar (D/2234/2020), Adv. Priya Sharma (D/3344/2018)"

# Simple Names
"Adv. Rajesh Kumar, Adv. Priya Sharma"

# Single Lawyer
"Adv. Rajesh Kumar"
```

## Court and Judge Matching

### Courts
- Matched by exact name (case-insensitive)
- If not found, a new court record is created automatically

### Judges
- Matched by exact name (case-insensitive)
- If not found, a new judge record is created automatically

## Validation Rules

### Required Field Validation
- `case_number` must be unique
- `case_title`, `case_type`, `court_name`, `judge_name` cannot be empty
- At least one lawyer (petitioner or respondent) must be specified
- `filing_date` is required
- If `status = 'disposed'`, then `judgment_date` and `outcome` are required

### Data Type Validation
- Dates must be valid and parseable
- `total_hearings` must be a positive number
- `case_type` must be one of: Criminal, Civil, Corporate, Family, Property, Labor
- `status` must be: disposed or pending
- `outcome` must be one of: Won, Lost, Settled, Dismissed (if status is disposed)

### Business Logic Validation
- `judgment_date` must be after `filing_date`
- `last_hearing_date` must be after `first_hearing_date`
- If `status = 'pending'`, `outcome` should be empty

## Import Process

### Step 1: Upload CSV
User uploads CSV file through the admin dashboard

### Step 2: Validation
System validates all rows and reports errors:
- **Critical Errors**: Prevent import (missing required fields, invalid data types)
- **Warnings**: Allow import but flag for review (unmatched lawyers, new judges)

### Step 3: Preview
User sees:
- Total rows to import
- New lawyers to be created
- New judges to be created
- New courts to be created
- Validation errors/warnings

### Step 4: Confirm Import
User confirms and system:
1. Creates new courts, judges, lawyers (as needed)
2. Inserts case records
3. Creates case_lawyers relationships
4. Calculates duration and other derived fields
5. Recalculates rankings

### Step 5: Import Report
User receives:
- Success count
- Error count
- List of errors with row numbers
- List of newly created entities

## Error Handling

### Common Errors

| Error | Resolution |
|-------|-----------|
| Duplicate case number | Change case number or skip row |
| Invalid date format | Use supported format (YYYY-MM-DD) |
| Missing required field | Add the missing data |
| Invalid case type | Use one of the allowed values |
| Judgment date before filing date | Correct the dates |

### Partial Import
- System supports partial imports (skip error rows, import valid ones)
- Error report includes row numbers and specific error messages

## Performance Considerations

- **Batch Size**: Import in batches of 1000 rows
- **Large Files**: Files over 10,000 rows should be split
- **Processing Time**: Approximately 100-200 rows per second
- **Timeout**: 5 minutes maximum per import session

## Best Practices

1. **Prepare Data**: Clean and validate CSV before upload
2. **Use Bar Registration**: Include bar registration numbers for accurate lawyer matching
3. **Consistent Naming**: Use consistent spelling for courts, judges, lawyers
4. **Test with Sample**: Import a small sample first to verify format
5. **Backup First**: Export existing data before large imports
6. **Monitor Imports**: Check import reports for warnings and errors

## Example Import Scenarios

### Scenario 1: New Case with Existing Lawyers
```csv
case_number,case_title,case_type,court_name,judge_name,petitioner_lawyers,respondent_lawyers,filing_date,status
CASE/NEW001/2024,New Case Title,Civil,Delhi High Court,Justice A.K. Sharma,Adv. Rajesh Kumar,Adv. Priya Sharma,2024-06-01,pending
```
Result: Case created with relationships to existing lawyers

### Scenario 2: Case with New Lawyer
```csv
case_number,case_title,case_type,court_name,judge_name,petitioner_lawyers,respondent_lawyers,filing_date,status
CASE/NEW002/2024,Another Case,Criminal,Supreme Court of India,Justice B.K. Singh,Adv. New Lawyer,Adv. Rajesh Kumar,2024-07-01,pending
```
Result: New unverified lawyer "Adv. New Lawyer" created automatically

### Scenario 3: Disposed Case with Outcome
```csv
case_number,case_title,case_type,court_name,judge_name,petitioner_lawyers,respondent_lawyers,filing_date,judgment_date,status,outcome,total_hearings
CASE/DISP001/2024,Completed Case,Family,District Court Saket,Shri R.P. Gupta,Adv. Sunita Desai,Adv. Anil Verma,2024-01-10,2024-08-15,disposed,Settled,10
```
Result: Case with calculated duration and all metrics

## Template Download

A blank CSV template with all columns and sample data is available in the admin dashboard under **Data Management** → **Download CSV Template**.
