# Multi-Lawyer Support Migration Guide

## Overview

Your Judge My Lawyer platform has been upgraded to support **multiple lawyers per case** with proper representation tracking (Petitioner vs Respondent). This is a significant enhancement that aligns with real-world court cases where each side has legal representation.

---

## 🔄 What Changed?

### 1. **Database Schema**
- ✅ **New table: `case_lawyers`** - Junction table linking cases to multiple lawyers
- ✅ **Tracks representation side** - Petitioner, Respondent, Plaintiff, Defendant, Complainant, Accused
- ✅ **Lawyer roles** - Lead Counsel, Senior Advocate, Counsel, Junior Counsel, Assistant
- ✅ **Backward compatible** - Existing `lawyer_id` field in `cases` table preserved (deprecated)

### 2. **API Enhancements**
- ✅ **Updated analytics** - All lawyer statistics now pull from `case_lawyers` junction table
- ✅ **Added CSV import endpoint** - Bulk import cases with multiple lawyers
- ✅ **Added CSV template download** - Get sample CSV format
- ✅ **New stats** - `petitionerCases` and `respondentCases` tracking

### 3. **CSV Import System**
- ✅ **Full validation** - Row-by-row error reporting
- ✅ **Auto-entity creation** - Automatically creates missing courts, judges, and lawyers
- ✅ **Multi-date format support** - YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
- ✅ **Batch processing** - Import hundreds of cases at once

---

## 📝 Step-by-Step Migration Instructions

### **Step 1: Run the Pre-Migration Setup**

⚠️ **IMPORTANT: Run this FIRST!**

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `/PRE_MIGRATION_SETUP.sql`
4. Click **Run**

**Expected Output:**
```
✅ Pre-migration setup complete!
```

This adds the `total_cases` column to the lawyers, judges, and courts tables.

### **Step 2: Run the Main Migration SQL**

1. Stay in **SQL Editor**
2. Copy and paste the contents of `/DATABASE_MIGRATION_MULTI_LAWYER.sql`
3. Click **Run**

**Expected Output:**
```
✅ case_lawyers table created
✅ Indexes created
✅ RLS policies applied
✅ Existing data migrated
✅ Analytics functions updated
✅ Rankings recalculated
✅ Migration complete!
```

### **Step 3: Verify Migration**

Run this verification query in SQL Editor:

```sql
-- Check case_lawyers distribution
SELECT 
  'Total case-lawyer relationships' as metric,
  COUNT(*) as value
FROM case_lawyers
UNION ALL
SELECT 
  'Petitioner side',
  COUNT(*)
FROM case_lawyers
WHERE representation_side IN ('Petitioner', 'Plaintiff', 'Complainant')
UNION ALL
SELECT 
  'Respondent side',
  COUNT(*)
FROM case_lawyers
WHERE representation_side IN ('Respondent', 'Defendant', 'Accused');
```

**Expected Result:** All your existing cases should now have entries in `case_lawyers`

### **Step 4: Redeploy Your Edge Function**

Your Edge Function has been updated with CSV import support. To deploy:

```bash
# From your project root
supabase functions deploy server
```

Or deploy through the Supabase Dashboard:
1. Go to **Edge Functions**
2. Select `server`
3. Click **Deploy**

---

## 🎯 New Features Available

### **1. CSV Import API**

**Endpoint:** `POST /make-server-e36f2be2/import/cases`

**Headers:**
```
Authorization: Bearer YOUR_SUPABASE_JWT_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "cases": [
    {
      "case_number": "CASE/000001/2024",
      "case_title": "State vs. John Doe",
      "case_type": "Criminal",
      "court_name": "Supreme Court of India",
      "judge_name": "Hon'ble Justice A.K. Sharma",
      "petitioner_lawyers": "Adv. Rajesh Kumar, Adv. Priya Sharma",
      "respondent_lawyers": "Adv. Anil Verma",
      "filing_date": "2024-01-15",
      "judgment_date": "2024-06-20",
      "status": "disposed",
      "outcome": "Won",
      "petitioner_name": "State of Delhi",
      "respondent_name": "John Doe",
      "total_hearings": 15,
      "summary": "Criminal case involving theft charges"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalRows": 1,
    "successfulImports": 1,
    "failedImports": 0,
    "newEntities": {
      "lawyers": 3,
      "judges": 1,
      "courts": 1
    }
  },
  "errors": []
}
```

### **2. Download CSV Template**

**Endpoint:** `GET /make-server-e36f2be2/import/template`

Returns a downloadable CSV file with sample data and proper formatting.

### **3. Enhanced Lawyer Analytics**

The `/lawyers/:id` endpoint now returns:

```json
{
  "lawyer": {
    "id": "...",
    "name": "Adv. Rajesh Kumar",
    "stats": {
      "totalCases": 50,
      "wonCases": 35,
      "lostCases": 10,
      "settledCases": 5,
      "dismissedCases": 0,
      "winRate": "70.0",
      "lossRate": "20.0",
      "settlementRate": "10.0",
      "dismissRate": "0.0",
      "avgCaseDuration": 245,
      "avgHearings": "12.5",
      "petitionerCases": 30,  // NEW
      "respondentCases": 20,  // NEW
      "caseTypeDistribution": {...},
      "courtStats": {...}
    }
  }
}
```

---

## 📊 CSV Format Specification

### **Required Columns**

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| `case_number` | Text | `CASE/000001/2024` | Must be unique |
| `case_title` | Text | `State vs. John Doe` | Case name |
| `case_type` | Text | `Criminal` | Criminal, Civil, Corporate, Family, Property, Labor |
| `court_name` | Text | `Supreme Court of India` | Auto-created if not exists |
| `judge_name` | Text | `Hon'ble Justice A.K. Sharma` | Auto-created if not exists |
| `petitioner_lawyers` | Text | `Adv. A, Adv. B` | Comma-separated |
| `respondent_lawyers` | Text | `Adv. C, Adv. D` | Comma-separated |
| `filing_date` | Date | `2024-01-15` | YYYY-MM-DD or DD/MM/YYYY |
| `status` | Text | `disposed` | disposed or pending |
| `petitioner_name` | Text | `State of Delhi` | |
| `respondent_name` | Text | `John Doe` | |

### **Optional Columns**

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| `judgment_date` | Date | `2024-06-20` | Required if status=disposed |
| `outcome` | Text | `Won` | Won, Lost, Settled, Dismissed |
| `total_hearings` | Number | `15` | |
| `first_hearing_date` | Date | `2024-02-01` | |
| `last_hearing_date` | Date | `2024-06-15` | |
| `summary` | Text | `Case summary...` | Brief description |

### **Lawyer Format Examples**

✅ **Comma-separated:**
```
"Adv. Rajesh Kumar, Adv. Priya Sharma, Adv. Maya Iyer"
```

✅ **With Bar Registration:**
```
"Adv. Rajesh Kumar (D/2234/2020), Adv. Priya Sharma (D/3344/2018)"
```

✅ **Single lawyer:**
```
"Adv. Rajesh Kumar"
```

---

## 🔍 Data Validation

### **Automatic Validation**

The import system validates:
- ✅ All required fields are present
- ✅ Date formats are valid
- ✅ Status is "disposed" or "pending"
- ✅ Disposed cases have judgment_date and outcome
- ✅ At least one lawyer (petitioner or respondent) is specified

### **Error Response Example**

```json
{
  "success": false,
  "validationErrors": [
    {
      "row": 3,
      "field": "filing_date",
      "message": "Invalid date format"
    },
    {
      "row": 5,
      "field": "case_type",
      "message": "Required"
    }
  ],
  "summary": {
    "totalRows": 10,
    "validRows": 8,
    "errorRows": 2
  }
}
```

---

## 🎨 Frontend Integration Example

### **Example: CSV Import Component**

```typescript
import { useState } from 'react';
import { supabase } from './utils/supabase';
import Papa from 'papaparse'; // For CSV parsing

export function CSVImportPage() {
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Parse CSV
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        setImporting(true);
        
        try {
          // Get auth token
          const { data: { session } } = await supabase.auth.getSession();
          
          // Call import API
          const response = await fetch(
            'YOUR_SUPABASE_URL/functions/v1/make-server-e36f2be2/import/cases',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ cases: results.data })
            }
          );
          
          const data = await response.json();
          setResults(data);
          
          if (data.success) {
            alert(`✅ Successfully imported ${data.summary.successfulImports} cases!`);
          } else {
            alert(`⚠️ ${data.validationErrors.length} validation errors found`);
          }
        } catch (error) {
          console.error('Import failed:', error);
          alert('Import failed. Please try again.');
        } finally {
          setImporting(false);
        }
      },
      error: (error) => {
        alert(`CSV parsing error: ${error.message}`);
      }
    });
  };

  const downloadTemplate = async () => {
    window.open(
      'YOUR_SUPABASE_URL/functions/v1/make-server-e36f2be2/import/template',
      '_blank'
    );
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Import Cases from CSV</h1>
      
      <button
        onClick={downloadTemplate}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Download CSV Template
      </button>
      
      <div className="mb-4">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={importing}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>
      
      {importing && <p>Importing... Please wait.</p>}
      
      {results && (
        <div className="mt-4 p-4 border rounded">
          <h2 className="font-bold mb-2">Import Results</h2>
          <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

### **Install CSV Parser**

```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

---

## 🚀 Testing the Migration

### **Test 1: Verify Existing Data**

```sql
SELECT 
  c.case_number,
  c.case_title,
  COUNT(cl.id) as num_lawyers,
  STRING_AGG(cl.lawyer_name || ' (' || cl.representation_side || ')', ', ') as lawyers
FROM cases c
LEFT JOIN case_lawyers cl ON c.id = cl.case_id
GROUP BY c.id, c.case_number, c.case_title
LIMIT 10;
```

### **Test 2: Import Sample CSV**

1. Download template: `GET /make-server-e36f2be2/import/template`
2. Modify with your data
3. Import: `POST /make-server-e36f2be2/import/cases`

### **Test 3: Check Lawyer Stats**

```
GET /make-server-e36f2be2/lawyers/YOUR_LAWYER_ID
```

Should show `petitionerCases` and `respondentCases` in the stats.

---

## 🔒 Security Notes

- ✅ **Admin-only import** - Only users with `is_admin = true` can import
- ✅ **RLS policies** - Public read, admin-only write on `case_lawyers`
- ✅ **Automatic entity creation** - New lawyers are created as `is_verified = false`
- ✅ **Validation** - All data validated before import

---

## 📚 Additional Resources

- **CSV Import Schema:** `/CSV_IMPORT_SCHEMA.md`
- **Migration SQL:** `/DATABASE_MIGRATION_MULTI_LAWYER.sql`
- **Database Documentation:** `/DATABASE_SCHEMA.md`

---

## ❓ FAQ

### **Q: What happens to my existing cases?**
A: All existing cases are automatically migrated. The single lawyer in the `lawyer_id` field is copied to the `case_lawyers` table with representation side preserved.

### **Q: Can I still use the old schema?**
A: Yes! The `lawyer_id` field is preserved for backward compatibility but is now deprecated. All new features use the `case_lawyers` junction table.

### **Q: What if I import a lawyer that doesn't exist?**
A: The system automatically creates an **unverified** lawyer profile. The lawyer can claim and verify it later.

### **Q: How do I handle cases with 3+ lawyers per side?**
A: Simply list them all comma-separated in the CSV:
```
"Adv. A, Adv. B, Adv. C, Adv. D"
```

### **Q: Can I specify lawyer roles?**
A: Yes! Use the optional `petitioner_lawyer_roles` column with comma-separated values:
```csv
petitioner_lawyers,petitioner_lawyer_roles
"Adv. A, Adv. B","Lead Counsel, Junior Counsel"
```

---

## ✅ Migration Checklist

- [ ] Backup your database
- [ ] Run `/PRE_MIGRATION_SETUP.sql`
- [ ] Run `/DATABASE_MIGRATION_MULTI_LAWYER.sql`
- [ ] Verify migration with test queries
- [ ] Redeploy Edge Function
- [ ] Test CSV import with sample data
- [ ] Update frontend to display multi-lawyer data
- [ ] Test lawyer analytics endpoints
- [ ] Verify rankings are recalculating correctly

---

## 🆘 Troubleshooting

### **Issue: Migration fails with "function chr() does not exist"**
**Solution:** This is fixed in the migration file. Make sure you're using the latest version from `/DATABASE_MIGRATION_MULTI_LAWYER.sql`.

### **Issue: CSV import returns 401 Unauthorized**
**Solution:** Ensure you're:
1. Logged in as an admin user
2. Passing the correct JWT token in Authorization header
3. Admin user has `is_admin = true` in the lawyers table

### **Issue: Duplicate case numbers**
**Solution:** The system prevents duplicate case numbers. Either:
1. Change the case number in your CSV
2. Delete the existing case first

### **Issue: Rankings not updating**
**Solution:** Manually trigger recalculation:
```sql
SELECT calculate_lawyer_ranks();
SELECT calculate_judge_ranks();
SELECT calculate_court_ranks();
```

---

🎉 **Congratulations!** Your platform now supports real-world multi-lawyer case scenarios!