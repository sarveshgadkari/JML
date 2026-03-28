# Judge My Lawyer - Database Schema

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    MASTER CASES TABLE                            │
│              (Single Source of Truth)                            │
│                                                                   │
│  All case data, analytics computed from this table:              │
│  - Case identification (number, title, type)                     │
│  - Court info (denormalized)                                     │
│  - Lawyer info (denormalized)                                    │
│  - Judge info (denormalized)                                     │
│  - Timeline (filing, judgment, hearings)                         │
│  - Outcome (Won/Lost/Settled/Dismissed)                         │
│  - Auto-calculated duration                                      │
└─────────────────────────────────────────────────────────────────┘
              │              │              │
              │              │              │
              ▼              ▼              ▼
        ┌─────────┐    ┌─────────┐    ┌─────────┐
        │ LAWYERS │    │ JUDGES  │    │ COURTS  │
        │ (Profile│    │(Profile)│    │(Profile)│
        │  Data)  │    │         │    │         │
        └─────────┘    └─────────┘    └─────────┘
```

## Tables Detail

### 1. 🏛️ **cases** (Master Table)
**Purpose:** Single source of truth for all case data and analytics

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| case_number | TEXT | Unique case identifier |
| case_title | TEXT | Case name |
| case_type | TEXT | Criminal, Civil, Corporate, Family, etc. |
| court_id | UUID | FK to courts |
| court_name | TEXT | Denormalized for performance |
| lawyer_id | UUID | FK to lawyers |
| lawyer_name | TEXT | Denormalized for performance |
| lawyer_side | TEXT | Plaintiff, Defendant, etc. |
| judge_id | UUID | FK to judges |
| judge_name | TEXT | Denormalized for performance |
| filing_date | DATE | Case filing date |
| judgment_date | DATE | Judgment date (null if pending) |
| total_hearings | INTEGER | Number of hearings |
| duration_days | INTEGER | Auto-calculated (judgment_date - filing_date) |
| status | TEXT | pending, disposed, withdrawn |
| outcome | TEXT | Won, Lost, Settled, Dismissed |
| petitioner_name | TEXT | Petitioner name |
| respondent_name | TEXT | Respondent name |
| summary | TEXT | Case summary |
| data_source | TEXT | manual, api, pdf_extract |
| verified | BOOLEAN | Data quality flag |

**Indexes:**
- lawyer_id, judge_id, court_id (for fast lookups)
- filing_date, case_type, outcome, status (for filtering)

---

### 2. 👨‍⚖️ **lawyers**
**Purpose:** Lawyer profiles and authentication

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| name | TEXT | Full name |
| email | TEXT | Email (unique) |
| phone | TEXT | Contact number |
| bar_registration | TEXT | Bar council ID (unique) |
| experience | INTEGER | Years of practice |
| specialization | TEXT[] | Array of specializations |
| courts | TEXT[] | Array of courts |
| bio | TEXT | Professional bio |
| address | TEXT | Office address |
| is_verified | BOOLEAN | Profile verified |
| is_admin | BOOLEAN | Admin privileges |
| rank | INTEGER | Calculated rank |

**Stats Computed From Cases:**
- Total cases (COUNT)
- Win rate (Won / Total)
- Loss rate (Lost / Total)
- Settlement rate (Settled / Total)
- Avg case duration (AVG duration_days)
- Avg hearings (AVG total_hearings)

---

### 3. 👨‍⚖️ **judges**
**Purpose:** Judge profiles

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Full name |
| designation | TEXT | Chief Justice, Justice, etc. |
| courts | TEXT[] | Array of courts |
| appointment_date | DATE | Date of appointment |
| bio | TEXT | Biography |
| rank | INTEGER | Calculated rank |

**Stats Computed From Cases:**
- Total cases (COUNT)
- Dismiss rate (Dismissed / Total)
- Disposal rate (Disposed / Total)
- Avg case duration
- Avg hearings

---

### 4. 🏛️ **courts**
**Purpose:** Court reference data

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Court name (unique) |
| type | TEXT | Supreme Court, High Court, etc. |
| state | TEXT | State |
| city | TEXT | City |
| address | TEXT | Address |
| established_year | INTEGER | Year established |
| rank | INTEGER | Calculated rank |

**Stats Computed From Cases:**
- Total cases (COUNT)
- Disposal rate (Disposed / Total)
- Avg case duration
- Avg hearings

---

### 5. 👤 **clients**
**Purpose:** Client accounts

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| name | TEXT | Full name |
| email | TEXT | Email (unique) |
| phone | TEXT | Contact number |

---

### 6. 💾 **saved_lawyers**
**Purpose:** Client favorites

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| client_id | UUID | FK to clients |
| lawyer_id | UUID | FK to lawyers |
| created_at | TIMESTAMPTZ | When saved |

**Unique constraint:** (client_id, lawyer_id)

---

### 7. 📞 **consultation_requests**
**Purpose:** Client-lawyer communication

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| client_id | UUID | FK to clients |
| lawyer_id | UUID | FK to lawyers |
| message | TEXT | Request message |
| status | TEXT | pending, accepted, rejected, completed |
| created_at | TIMESTAMPTZ | Request time |

---

### 8. 📋 **card_claims**
**Purpose:** Profile claiming system (merge duplicates)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| lawyer_id | UUID | FK to lawyers (claimer) |
| claimed_entity_type | TEXT | lawyer, judge, court |
| claimed_entity_id | UUID | ID being claimed |
| claimed_entity_name | TEXT | Name being claimed |
| bar_council_certificate_url | TEXT | Verification doc |
| id_proof_url | TEXT | ID proof |
| status | TEXT | pending, approved, rejected |
| admin_notes | TEXT | Admin review notes |
| reviewed_by | UUID | FK to lawyers (admin) |
| reviewed_at | TIMESTAMPTZ | Review time |

---

### 9. ⚖️ **case_claims**
**Purpose:** Individual case claiming with Vakaalatnama

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| lawyer_id | UUID | FK to lawyers |
| case_id | UUID | FK to cases |
| case_number | TEXT | Case identifier |
| vakalatnama_url | TEXT | Verification doc (required) |
| status | TEXT | pending, approved, rejected |
| admin_notes | TEXT | Admin review notes |
| reviewed_by | UUID | FK to lawyers (admin) |
| reviewed_at | TIMESTAMPTZ | Review time |

---

## Data Flow

### Analytics Computation Flow:

```
┌─────────────┐
│   CASES     │  ← Single source of truth
│   TABLE     │
└──────┬──────┘
       │
       │ Query with GROUP BY lawyer_id
       ▼
┌──────────────────────────────┐
│  Lawyer Analytics:           │
│  - COUNT(*) → totalCases     │
│  - COUNT(outcome='Won')      │
│  - AVG(duration_days)        │
│  - AVG(total_hearings)       │
│  - GROUP BY case_type        │
│  - GROUP BY court_name       │
└──────────────────────────────┘
```

### Claiming System Flow:

```
┌──────────────┐
│   Lawyer     │
│  searches    │
│  for their   │
│   profile    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Find unclaimed  │
│  lawyer profile  │
│  (is_verified=   │
│     false)       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Create card     │
│  claim with      │
│  verification    │
│  documents       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Admin reviews   │
│  & approves      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Profile merged  │
│  & verified      │
└──────────────────┘
```

## Security (RLS Policies)

### Public Read Access (D2C Model):
- ✅ All users can read: lawyers, judges, courts, cases
- ✅ No login required for browsing

### Authenticated Users:
- ✅ Can update their own profile
- ✅ Can create card/case claims
- ✅ Can save lawyers
- ✅ Can request consultations

### Admin Users (is_admin = true):
- ✅ Can review claims
- ✅ Can insert/update cases, judges, courts
- ✅ Can view all documents

## Performance Optimizations

1. **Denormalized Data:**
   - Court name, lawyer name, judge name stored in cases table
   - Faster queries, no joins needed for basic analytics

2. **Generated Columns:**
   - `duration_days` auto-calculated
   - No need to compute in application layer

3. **Indexes:**
   - All foreign keys indexed
   - Common filter columns indexed (date, type, outcome)

4. **Materialized Views (Future):**
   - Pre-compute complex analytics
   - Refresh daily via cron

## Ranking Algorithm

### Lawyer Rank:
```sql
ORDER BY win_rate DESC, total_cases DESC
```

### Judge Rank:
```sql
ORDER BY disposal_rate DESC, total_cases DESC
```

### Court Rank:
```sql
ORDER BY avg_duration ASC, total_cases DESC
```

Ranks are recalculated via helper functions:
- `calculate_lawyer_ranks()`
- `calculate_judge_ranks()`
- `calculate_court_ranks()`

---

## Summary

✅ **Master cases table** = Single source of truth  
✅ **All analytics** computed from cases table  
✅ **Denormalized design** for performance  
✅ **RLS policies** for security  
✅ **Claiming system** for data quality  
✅ **Auto-calculated** metrics  
✅ **Public D2C model** - no login required to browse  

**Ready for production! 🚀**
