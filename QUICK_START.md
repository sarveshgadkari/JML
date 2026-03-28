# Quick Start Guide - Judge My Lawyer

## 🚀 Get Your Platform Running in 5 Steps

### Step 1: Setup Supabase Database (5 minutes)

1. **Open Supabase Dashboard** → SQL Editor
2. **Copy & paste** `/supabase/migrations/001_initial_schema.sql`
3. **Click Run** ✅

**What this does:**
- Creates 9 tables
- Sets up security policies
- Adds sample courts & judges
- Configures auto-updates

---

### Step 2: Create Storage Bucket (2 minutes)

1. **Supabase Dashboard** → Storage
2. **Create Bucket:**
   - Name: `make-e36f2be2-documents`
   - Privacy: **Private**
3. **Add policies** (copy from SUPABASE_SETUP.md Step 2)

**What this is for:**
- Vakaalatnama uploads
- Bar council certificates
- ID proof documents

---

### Step 3: Create Your Admin Account (3 minutes)

1. **Supabase Dashboard** → Authentication → Users
2. **Add User** with your email/password
3. **Copy the User ID** (UUID)

4. **SQL Editor** → Run this (replace USER_ID_HERE):

```sql
INSERT INTO lawyers (
  user_id, name, email, phone, bar_registration, 
  experience, specialization, courts, bio, address,
  is_verified, is_admin
) VALUES (
  'USER_ID_HERE', -- Paste UUID here
  'Your Name',
  'your.email@example.com',
  '+91 98765 43210',
  'D/1234/2024',
  10,
  ARRAY['Criminal Law', 'Corporate Law'],
  ARRAY['Supreme Court of India', 'Delhi High Court'],
  'Experienced lawyer with proven track record',
  '123 Legal Plaza, New Delhi',
  true,  -- Verified
  true   -- Admin
);
```

---

### Step 4: Add Sample Case Data (5 minutes)

**Option A: Quick Sample Data**

```sql
-- Get IDs from existing data
WITH court AS (SELECT id FROM courts WHERE name = 'Delhi High Court' LIMIT 1),
     judge AS (SELECT id FROM judges WHERE name LIKE '%Priya Verma%' LIMIT 1),
     lawyer AS (SELECT id FROM lawyers WHERE is_admin = true LIMIT 1)
INSERT INTO cases (
  case_number, case_title, case_type,
  court_id, court_name,
  lawyer_id, lawyer_name, lawyer_side,
  judge_id, judge_name,
  filing_date, judgment_date,
  first_hearing_date, last_hearing_date,
  total_hearings, status, outcome,
  petitioner_name, respondent_name,
  summary, verified
)
SELECT 
  'CRL/2024/001', 'State vs. Accused', 'Criminal',
  court.id, 'Delhi High Court',
  lawyer.id, (SELECT name FROM lawyers WHERE id = lawyer.id), 'Defense',
  judge.id, 'Hon. Justice Priya Verma',
  '2024-01-15', '2024-08-20',
  '2024-02-01', '2024-08-15',
  12, 'disposed', 'Won',
  'State of Delhi', 'John Doe',
  'Criminal case involving financial fraud', true
FROM court, judge, lawyer;

-- Repeat with different case numbers and outcomes
```

**Option B: Bulk Import Script**
- Create CSV with case data
- Use Supabase Dashboard → Table Editor → Import CSV

---

### Step 5: Calculate Rankings (1 minute)

```sql
SELECT calculate_lawyer_ranks();
SELECT calculate_judge_ranks();
SELECT calculate_court_ranks();
```

**Done! Your database is live! 🎉**

---

## 🧪 Test Your Setup

### Test 1: Check if tables exist
```sql
SELECT COUNT(*) FROM cases;
SELECT COUNT(*) FROM lawyers;
SELECT COUNT(*) FROM judges;
SELECT COUNT(*) FROM courts;
```

### Test 2: Verify analytics work
```sql
SELECT 
  l.name,
  COUNT(c.id) as total_cases,
  COUNT(CASE WHEN c.outcome = 'Won' THEN 1 END) as won_cases,
  ROUND(COUNT(CASE WHEN c.outcome = 'Won' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 1) as win_rate
FROM lawyers l
LEFT JOIN cases c ON c.lawyer_id = l.id
WHERE l.is_verified = true
GROUP BY l.id, l.name;
```

### Test 3: Login to your app
1. Open your app URL
2. Click "Login"
3. Use the email/password from Step 3
4. You should see your dashboard!

---

## 📊 Understanding Your Data

### Master Cases Table
**This is your single source of truth!**

Every case has:
- ✅ Court information
- ✅ Lawyer information
- ✅ Judge information
- ✅ Timeline (filing → judgment)
- ✅ Outcome (Won/Lost/Settled)
- ✅ Hearings count
- ✅ Auto-calculated duration

### Analytics Flow
```
Cases Table 
    ↓
Group by lawyer_id
    ↓
Calculate: Win Rate, Avg Duration, Total Cases
    ↓
Display on Lawyer Card
```

**No complex joins needed!** Everything is denormalized for speed.

---

## 🔧 Common Operations

### Add a New Case
```sql
INSERT INTO cases (
  case_number, case_title, case_type,
  court_id, court_name,
  lawyer_id, lawyer_name,
  judge_id, judge_name,
  filing_date, judgment_date,
  total_hearings, status, outcome,
  verified
) VALUES (
  'NEW/2024/123',
  'Case Title',
  'Civil',
  (SELECT id FROM courts WHERE name = 'Court Name'),
  'Court Name',
  (SELECT id FROM lawyers WHERE bar_registration = 'BAR/123'),
  'Lawyer Name',
  (SELECT id FROM judges WHERE name = 'Judge Name'),
  'Judge Name',
  '2024-01-01',
  '2024-06-01',
  8,
  'disposed',
  'Won',
  true
);
```

### Add a New Lawyer (Unverified)
```sql
INSERT INTO lawyers (
  name, email, bar_registration,
  specialization, courts,
  is_verified
) VALUES (
  'New Lawyer',
  'lawyer@example.com',
  'BAR/456',
  ARRAY['Corporate Law'],
  ARRAY['Mumbai High Court'],
  false  -- Will be claimed later
);
```

### Update Rankings
```sql
-- Run this daily or after bulk case import
SELECT calculate_lawyer_ranks();
SELECT calculate_judge_ranks();
SELECT calculate_court_ranks();
```

---

## 🎯 Next Steps

### For Development:
1. ✅ Database setup (done!)
2. 📱 Test frontend with real data
3. 🔍 Search lawyers, judges, courts
4. 📊 View analytics dashboards
5. 🎨 Customize design/branding

### For Production:
1. 📈 Import real case data
2. 🤖 Set up automated data extraction
3. 📊 Configure Google Ads
4. 🔒 Enable user signups
5. 📧 Set up email notifications
6. ⏰ Schedule daily ranking updates

### For Scaling:
1. 🚀 Add caching layer (Redis)
2. 📊 Create materialized views for heavy queries
3. 🔍 Add full-text search (PostgreSQL FTS)
4. 📈 Set up analytics tracking
5. 🎯 A/B testing for conversion optimization

---

## 🆘 Troubleshooting

### "relation does not exist"
**Fix:** Re-run the SQL migration script

### "permission denied"
**Fix:** Check RLS policies, ensure you're logged in

### "No data showing"
**Fix:** Add sample cases using Step 4

### Analytics not calculating
**Fix:** Run ranking functions from Step 5

### Upload failing
**Fix:** Check storage bucket exists and policies are set

---

## 📚 Resources

- **Database Schema:** See `DATABASE_SCHEMA.md`
- **Full Setup Guide:** See `SUPABASE_SETUP.md`
- **API Documentation:** Check `/supabase/functions/server/api.tsx`

---

## 🎉 You're Ready!

Your platform now has:
- ✅ Complete database schema
- ✅ Real-time analytics engine
- ✅ Secure authentication
- ✅ Admin capabilities
- ✅ Claiming system
- ✅ Document storage
- ✅ Public D2C access

**Start adding case data and watch the analytics come to life!** 🚀⚖️

---

**Questions?** Check the logs:
- Supabase Dashboard → Logs
- Edge Functions → Logs  
- Browser Console (F12)
