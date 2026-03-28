# 🚨 Quick Fix Instructions

## The Error You Got

```
ERROR: column "total_cases" of relation "lawyers" does not exist
```

## Why It Happened

The migration tried to update a column (`total_cases`) that doesn't exist yet in your `lawyers` table.

## How to Fix It (2 Steps)

### **Step 1: Run Pre-Migration Setup**

Copy and paste this into your Supabase SQL Editor and run:

```sql
-- Add missing total_cases columns
ALTER TABLE lawyers 
ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;

ALTER TABLE judges 
ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;

ALTER TABLE courts 
ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;

-- Verify
SELECT 'Ready to proceed!' as status;
```

**Expected output:** You should see "Ready to proceed!"

---

### **Step 2: Run Main Migration**

Now copy and paste the entire contents of `/DATABASE_MIGRATION_MULTI_LAWYER.sql` and run it.

**Expected output:** Should complete without errors and show:
```
✅ Migration complete! Multi-lawyer support enabled.
```

---

## Complete Migration Order

1. ✅ **First:** Run `/PRE_MIGRATION_SETUP.sql` (adds missing columns)
2. ✅ **Second:** Run `/DATABASE_MIGRATION_MULTI_LAWYER.sql` (main migration)
3. ✅ **Third:** Verify with test queries
4. ✅ **Fourth:** Redeploy Edge Function

---

## One-Command Alternative

If you want to do it all at once, run this complete script:

```sql
-- =====================================================
-- COMPLETE MIGRATION (All-in-one)
-- =====================================================

-- PART 1: Add missing columns
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;
ALTER TABLE judges ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;
ALTER TABLE courts ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;

-- PART 2: Create case_lawyers table
CREATE TABLE IF NOT EXISTS case_lawyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES lawyers(id) ON DELETE CASCADE,
  lawyer_name TEXT NOT NULL,
  representation_side TEXT NOT NULL CHECK (representation_side IN ('Petitioner', 'Respondent', 'Plaintiff', 'Defendant', 'Complainant', 'Accused')),
  lawyer_role TEXT DEFAULT 'Counsel' CHECK (lawyer_role IN ('Lead Counsel', 'Senior Advocate', 'Counsel', 'Junior Counsel', 'Assistant')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id, lawyer_id)
);

CREATE INDEX idx_case_lawyers_case_id ON case_lawyers(case_id);
CREATE INDEX idx_case_lawyers_lawyer_id ON case_lawyers(lawyer_id);
CREATE INDEX idx_case_lawyers_side ON case_lawyers(representation_side);

-- Enable RLS
ALTER TABLE case_lawyers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to case_lawyers"
  ON case_lawyers FOR SELECT USING (true);

CREATE POLICY "Only admins can modify case_lawyers"
  ON case_lawyers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lawyers
      WHERE lawyers.id = auth.uid()
      AND lawyers.is_admin = true
    )
  );

-- PART 3: Migrate existing data
INSERT INTO case_lawyers (case_id, lawyer_id, lawyer_name, representation_side, lawyer_role)
SELECT 
  id as case_id,
  lawyer_id,
  lawyer_name,
  CASE 
    WHEN lawyer_side IN ('Petitioner', 'Plaintiff', 'Complainant') THEN lawyer_side
    WHEN lawyer_side IN ('Respondent', 'Defendant', 'Accused') THEN lawyer_side
    ELSE 'Petitioner'
  END as representation_side,
  'Lead Counsel' as lawyer_role
FROM cases
WHERE lawyer_id IS NOT NULL
ON CONFLICT (case_id, lawyer_id) DO NOTHING;

-- PART 4: Update analytics functions
DROP FUNCTION IF EXISTS calculate_lawyer_analytics(UUID);
DROP FUNCTION IF EXISTS calculate_lawyer_ranks();

CREATE OR REPLACE FUNCTION calculate_lawyer_ranks()
RETURNS void AS $$
BEGIN
  WITH lawyer_stats AS (
    SELECT 
      l.id,
      COUNT(DISTINCT cl.case_id) as total_cases,
      COUNT(DISTINCT CASE WHEN c.outcome = 'Won' THEN cl.case_id END) as won_cases,
      COALESCE(AVG(c.duration_days), 0) as avg_duration,
      COALESCE(AVG(c.total_hearings), 0) as avg_hearings
    FROM lawyers l
    LEFT JOIN case_lawyers cl ON l.id = cl.lawyer_id
    LEFT JOIN cases c ON cl.case_id = c.id
    WHERE l.is_verified = true
    GROUP BY l.id
  ),
  ranked AS (
    SELECT 
      id,
      total_cases,
      won_cases,
      avg_duration,
      avg_hearings,
      (
        (won_cases * 10) +
        (total_cases * 5) +
        (CASE WHEN avg_duration > 0 THEN (1000 / avg_duration) ELSE 0 END * 2) +
        (CASE WHEN avg_hearings > 0 THEN (50 / avg_hearings) ELSE 0 END * 2)
      ) as score
    FROM lawyer_stats
  )
  UPDATE lawyers l
  SET 
    rank = r.rank_position,
    total_cases = rs.total_cases,
    updated_at = now()
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY score DESC, total_cases DESC) as rank_position
    FROM ranked
    WHERE total_cases > 0
  ) r
  INNER JOIN ranked rs ON r.id = rs.id
  WHERE l.id = r.id;
  
  RAISE NOTICE 'Lawyer ranks updated successfully';
END;
$$ LANGUAGE plpgsql;

-- PART 5: Recalculate rankings
SELECT calculate_lawyer_ranks();
SELECT calculate_judge_ranks();
SELECT calculate_court_ranks();

-- PART 6: Verify
SELECT 
  'Total case-lawyer relationships' as metric,
  COUNT(*) as value
FROM case_lawyers
UNION ALL
SELECT 
  'Cases migrated',
  COUNT(DISTINCT case_id)
FROM case_lawyers;

-- Done!
RAISE NOTICE '✅ Complete migration finished! Multi-lawyer support enabled.';
```

---

## What This Does

1. ✅ Adds `total_cases` column to lawyers, judges, courts tables
2. ✅ Creates `case_lawyers` junction table
3. ✅ Migrates all your existing cases to the new structure
4. ✅ Updates ranking functions to work with multi-lawyer data
5. ✅ Recalculates all rankings

---

## After Running This

You should see output like:
```
✅ Lawyer ranks updated successfully
✅ Complete migration finished! Multi-lawyer support enabled.
```

And a results table showing:
```
metric                           | value
---------------------------------|------
Total case-lawyer relationships  | 100
Cases migrated                   | 100
```

---

## Next Steps

1. ✅ Migration complete
2. ⏭️ Redeploy your Edge Function (Edge Functions → server → Deploy)
3. ⏭️ Test with: `GET /make-server-e36f2be2/lawyers/search`
4. ⏭️ Start using CSV import feature

---

## Still Getting Errors?

Copy the **exact error message** and let me know. I'll help you debug! 🚀
