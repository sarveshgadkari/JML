# Supabase Setup Guide for Judge My Lawyer

## Overview
This guide will help you set up the complete Supabase database schema with a **master cases table** as the single source of truth for all analytics.

## Database Architecture

### Master Cases Table
The `cases` table contains ALL case data including:
- Case identification (case number, title, type)
- Court information (denormalized for performance)
- Lawyer information (denormalized for performance)
- Judge information (denormalized for performance)
- Timeline data (filing date, judgment date, hearings)
- Outcome data (won/lost/settled/dismissed)
- Performance metrics (auto-calculated duration)

### Supporting Tables
- `lawyers` - Lawyer profiles and authentication
- `judges` - Judge profiles
- `courts` - Court reference data
- `clients` - Client accounts
- `card_claims` - Profile claiming system
- `case_claims` - Individual case claiming with Vakaalatnama
- `saved_lawyers` - Client favorites
- `consultation_requests` - Client-lawyer communications

## Step-by-Step Setup

### Step 1: Run SQL Schema in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `/supabase/migrations/001_initial_schema.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press `Cmd/Ctrl + Enter`)

**Expected Output:**
```
Success. No rows returned
```

This will create:
- ✅ 9 tables with proper relationships
- ✅ Indexes for fast queries
- ✅ Auto-update triggers for timestamps
- ✅ RLS (Row Level Security) policies
- ✅ Helper functions for calculating ranks
- ✅ Sample seed data (5 courts, 5 judges)

### Step 2: Create Storage Bucket

1. In Supabase Dashboard, go to **Storage**
2. Click **Create Bucket**
3. Bucket name: `make-e36f2be2-documents`
4. **Privacy:** Private (requires authentication)
5. Click **Create Bucket**

#### Configure Storage Policies:

Go to the bucket policies and add these:

**Policy 1: Users can upload their own documents**
```sql
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'make-e36f2be2-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Policy 2: Users can read their own documents**
```sql
CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'make-e36f2be2-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Policy 3: Admins can read all documents**
```sql
CREATE POLICY "Admins can read all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'make-e36f2be2-documents' 
  AND EXISTS (
    SELECT 1 FROM public.lawyers 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);
```

### Step 3: Verify Tables

Run this query to verify all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- ✅ card_claims
- ✅ case_claims
- ✅ cases
- ✅ clients
- ✅ consultation_requests
- ✅ courts
- ✅ judges
- ✅ lawyers
- ✅ saved_lawyers

### Step 4: Create Your First Admin User

1. Go to **Authentication** → **Users**
2. Click **Add User**
3. Enter email and password
4. Click **Create User**
5. Copy the **User ID** (UUID)

6. Go to **SQL Editor** and run:

```sql
-- Replace 'USER_ID_HERE' with the UUID you copied
-- Replace values with your details
INSERT INTO lawyers (
  user_id,
  name,
  email,
  phone,
  bar_registration,
  experience,
  specialization,
  courts,
  bio,
  address,
  is_verified,
  is_admin
) VALUES (
  'USER_ID_HERE',
  'Your Name',
  'your.email@example.com',
  '+91 98765 43210',
  'D/1234/2024',
  10,
  ARRAY['Criminal Law', 'Corporate Law'],
  ARRAY['Supreme Court of India', 'Delhi High Court'],
  'Experienced lawyer with a track record of success',
  '123 Legal Plaza, New Delhi',
  true,
  true -- This makes you an admin
);
```

### Step 5: Add Sample Cases Data

To populate the master cases table with sample data:

```sql
-- Get IDs from existing data
WITH court AS (SELECT id FROM courts WHERE name = 'Delhi High Court' LIMIT 1),
     judge AS (SELECT id FROM judges WHERE name LIKE '%Priya Verma%' LIMIT 1),
     lawyer AS (SELECT id FROM lawyers WHERE is_admin = true LIMIT 1)
INSERT INTO cases (
  case_number,
  case_title,
  case_type,
  court_id,
  court_name,
  lawyer_id,
  lawyer_name,
  lawyer_side,
  judge_id,
  judge_name,
  filing_date,
  judgment_date,
  first_hearing_date,
  last_hearing_date,
  total_hearings,
  status,
  outcome,
  petitioner_name,
  respondent_name,
  summary,
  verified
)
SELECT 
  'CRL/2024/001',
  'State vs. Accused',
  'Criminal',
  court.id,
  'Delhi High Court',
  lawyer.id,
  (SELECT name FROM lawyers WHERE id = lawyer.id),
  'Defense',
  judge.id,
  'Hon. Justice Priya Verma',
  '2024-01-15',
  '2024-08-20',
  '2024-02-01',
  '2024-08-15',
  12,
  'disposed',
  'Won',
  'State of Delhi',
  'John Doe',
  'Criminal case involving financial fraud',
  true
FROM court, judge, lawyer;

-- Add more sample cases by repeating with different data
```

### Step 6: Calculate Initial Rankings

Run these helper functions to calculate initial rankings:

```sql
-- Calculate lawyer rankings
SELECT calculate_lawyer_ranks();

-- Calculate judge rankings
SELECT calculate_judge_ranks();

-- Calculate court rankings
SELECT calculate_court_ranks();
```

**Note:** You should run these ranking functions periodically (e.g., daily via a cron job) to keep rankings up to date as new cases are added.

### Step 7: Test the Database

#### Test 1: Verify lawyer stats calculation
```sql
SELECT 
  l.name,
  l.rank,
  COUNT(c.id) as total_cases,
  COUNT(c.id) FILTER (WHERE c.outcome = 'Won') as won_cases,
  COUNT(c.id) FILTER (WHERE c.outcome = 'Won') * 100.0 / NULLIF(COUNT(c.id), 0) as win_rate,
  AVG(c.duration_days) as avg_duration
FROM lawyers l
LEFT JOIN cases c ON c.lawyer_id = l.id
WHERE l.is_verified = true
GROUP BY l.id, l.name, l.rank
ORDER BY l.rank;
```

#### Test 2: Verify RLS policies
```sql
-- This should only show publicly readable data
SET ROLE authenticated;
SELECT COUNT(*) FROM lawyers; -- Should work (public read)
SELECT COUNT(*) FROM cases; -- Should work (public read)
```

## Data Import Strategy

### For Bulk Case Import (from PDFs or APIs):

When you extract data from case files, insert directly into the `cases` table:

```sql
INSERT INTO cases (
  case_number,
  case_title,
  case_type,
  court_id,
  court_name,
  lawyer_id,
  lawyer_name,
  lawyer_side,
  judge_id,
  judge_name,
  filing_date,
  judgment_date,
  total_hearings,
  status,
  outcome,
  petitioner_name,
  respondent_name,
  summary,
  data_source
) VALUES (
  'extracted_case_number',
  'extracted_title',
  'extracted_type',
  (SELECT id FROM courts WHERE name = 'extracted_court_name'),
  'extracted_court_name',
  (SELECT id FROM lawyers WHERE bar_registration = 'extracted_bar_reg'),
  'extracted_lawyer_name',
  'extracted_side',
  (SELECT id FROM judges WHERE name = 'extracted_judge_name'),
  'extracted_judge_name',
  'extracted_filing_date',
  'extracted_judgment_date',
  extracted_hearings_count,
  'disposed',
  'Won', -- or Lost, Settled, etc.
  'petitioner_name',
  'respondent_name',
  'case_summary',
  'pdf_extract' -- or 'api', 'manual', etc.
);
```

### Auto-Creating Missing Entities:

If a lawyer/judge/court doesn't exist yet, create them first:

```sql
-- Example: Create lawyer if not exists
INSERT INTO lawyers (name, email, bar_registration, is_verified)
VALUES ('New Lawyer Name', 'lawyer@example.com', 'BAR/123', false)
ON CONFLICT (bar_registration) DO NOTHING;
```

## Maintenance Tasks

### Daily Tasks (Set up via Supabase Functions or Cron):

1. **Update Rankings:**
```sql
SELECT calculate_lawyer_ranks();
SELECT calculate_judge_ranks();
SELECT calculate_court_ranks();
```

2. **Clean up expired signed URLs** (handled automatically by Supabase)

### Weekly Tasks:

1. **Verify data quality:**
```sql
-- Find cases without duration
SELECT COUNT(*) FROM cases WHERE judgment_date IS NOT NULL AND duration_days IS NULL;

-- Find unverified cases
SELECT COUNT(*) FROM cases WHERE verified = false;
```

## API Endpoints

After setup, these endpoints will be available:

### Public Endpoints (No Auth Required):
- `GET /make-server-e36f2be2/lawyers/search` - Search lawyers
- `GET /make-server-e36f2be2/lawyers/:id` - Get lawyer details
- `GET /make-server-e36f2be2/judges/search` - Search judges
- `GET /make-server-e36f2be2/judges/:id` - Get judge details
- `GET /make-server-e36f2be2/courts/search` - Search courts
- `GET /make-server-e36f2be2/courts/:id` - Get court details

### Authenticated Endpoints (Require Login):
- `GET /make-server-e36f2be2/lawyers/me` - Get my profile
- `PUT /make-server-e36f2be2/lawyers/profile` - Update profile
- `POST /make-server-e36f2be2/card-claims` - Create card claim
- `POST /make-server-e36f2be2/case-claims` - Create case claim
- `GET /make-server-e36f2be2/card-claims/my` - My card claims
- `GET /make-server-e36f2be2/case-claims/my` - My case claims
- `POST /make-server-e36f2be2/upload` - Upload documents

### Admin Only Endpoints:
- `GET /make-server-e36f2be2/card-claims/pending` - Pending card claims
- `GET /make-server-e36f2be2/case-claims/pending` - Pending case claims
- `PUT /make-server-e36f2be2/card-claims/:id/review` - Review card claim
- `PUT /make-server-e36f2be2/case-claims/:id/review` - Review case claim

## Troubleshooting

### Issue: "relation does not exist"
**Solution:** Re-run the migration SQL script

### Issue: "permission denied for table"
**Solution:** Check RLS policies are enabled and configured correctly

### Issue: "storage bucket not found"
**Solution:** Create the storage bucket `make-e36f2be2-documents`

### Issue: Rankings are not updating
**Solution:** Run the ranking calculation functions manually:
```sql
SELECT calculate_lawyer_ranks();
SELECT calculate_judge_ranks();
SELECT calculate_court_ranks();
```

## Next Steps

1. ✅ Run SQL schema migration
2. ✅ Create storage bucket
3. ✅ Create admin user
4. ✅ Add sample cases
5. ✅ Calculate initial rankings
6. 🚀 Deploy Edge Function (already configured in `/supabase/functions/server/`)
7. 🎯 Start importing real case data
8. 📊 Configure Google Ads integration
9. 👥 Enable user signups

## Support

For issues or questions about the database setup, check:
- Supabase logs in Dashboard → Logs
- Edge Function logs in Dashboard → Edge Functions → Logs
- Browser console for frontend errors

---

**Database is production-ready!** All analytics are computed in real-time from the master cases table. 🎉
