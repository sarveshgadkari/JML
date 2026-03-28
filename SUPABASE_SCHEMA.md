# Judge My Lawyer - Supabase Database Schema

## Overview
This schema supports lawyer card claiming, case claiming, admin approval, and card merging functionality.

---

## Tables

### 1. **lawyer_cards**
Stores all lawyer cards extracted from judgments (including duplicates from name variations).

```sql
CREATE TABLE lawyer_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Card Identity
  name_in_judgment TEXT NOT NULL, -- Original name from judgment
  preferred_name TEXT, -- Merged/preferred name (NULL until claimed)
  
  -- Status
  status TEXT DEFAULT 'unclaimed', -- 'unclaimed', 'claimed', 'merged'
  is_master_card BOOLEAN DEFAULT FALSE, -- True for the primary merged card
  merged_into_card_id UUID REFERENCES lawyer_cards(id), -- Points to master card if merged
  claimed_by_lawyer_id UUID REFERENCES lawyers(id), -- Lawyer who claimed it
  
  -- Statistics (aggregated from judgments)
  total_cases INTEGER DEFAULT 0,
  cases_won INTEGER DEFAULT 0,
  cases_lost INTEGER DEFAULT 0,
  cases_settled INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),
  
  -- Additional Metadata
  bar_registration_number TEXT,
  court_name TEXT,
  specialization TEXT[],
  years_of_experience INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  claimed_at TIMESTAMP,
  merged_at TIMESTAMP
);

CREATE INDEX idx_lawyer_cards_status ON lawyer_cards(status);
CREATE INDEX idx_lawyer_cards_name ON lawyer_cards(name_in_judgment);
CREATE INDEX idx_lawyer_cards_claimed_by ON lawyer_cards(claimed_by_lawyer_id);
CREATE INDEX idx_lawyer_cards_merged_into ON lawyer_cards(merged_into_card_id);
```

---

### 2. **card_claims**
Stores lawyer claims for cards (awaiting admin approval).

```sql
CREATE TABLE card_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Claim Details
  lawyer_id UUID NOT NULL REFERENCES lawyers(id),
  card_id UUID NOT NULL REFERENCES lawyer_cards(id),
  
  -- Preferred Identity
  preferred_name TEXT NOT NULL, -- Name lawyer wants to use
  bar_registration_number TEXT, -- For verification
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  
  -- Admin Action
  reviewed_by_admin_id UUID REFERENCES lawyers(id), -- Admin who reviewed
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Supporting Documents
  proof_document_url TEXT, -- URL to uploaded verification doc
  notes TEXT, -- Lawyer's explanation
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_card_claims_lawyer ON card_claims(lawyer_id);
CREATE INDEX idx_card_claims_status ON card_claims(status);
CREATE INDEX idx_card_claims_card ON card_claims(card_id);
```

---

### 3. **card_merge_groups**
Groups multiple cards that belong to the same lawyer (after admin approval).

```sql
CREATE TABLE card_merge_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Group Details
  lawyer_id UUID NOT NULL REFERENCES lawyers(id),
  master_card_id UUID NOT NULL REFERENCES lawyer_cards(id), -- Primary card
  preferred_name TEXT NOT NULL, -- Final merged name
  
  -- Merged Cards (JSON array of card IDs)
  merged_card_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Aggregated Statistics
  total_cases INTEGER DEFAULT 0,
  cases_won INTEGER DEFAULT 0,
  cases_lost INTEGER DEFAULT 0,
  cases_settled INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_merge_groups_lawyer ON card_merge_groups(lawyer_id);
CREATE INDEX idx_merge_groups_master_card ON card_merge_groups(master_card_id);
```

---

### 4. **lawyers** (Extended)
Add fields to existing lawyers table.

```sql
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS master_card_id UUID REFERENCES lawyer_cards(id);
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS has_claimed_cards BOOLEAN DEFAULT FALSE;
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
```

---

### 5. **judgments**
Stores uploaded judgment data (links to cards).

```sql
CREATE TABLE judgments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Judgment Details
  case_number TEXT NOT NULL UNIQUE,
  case_title TEXT,
  judgment_date DATE,
  court_id UUID REFERENCES courts(id),
  judge_id UUID REFERENCES judges(id),
  
  -- Parties
  complainant_lawyer_card_id UUID REFERENCES lawyer_cards(id),
  respondent_lawyer_card_id UUID REFERENCES lawyer_cards(id),
  
  -- Outcome
  outcome TEXT, -- 'won_complainant', 'won_respondent', 'settled', 'dismissed'
  case_type TEXT,
  
  -- Document
  judgment_text TEXT,
  judgment_document_url TEXT,
  
  -- Extracted Data
  raw_extracted_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  uploaded_by_admin_id UUID REFERENCES lawyers(id)
);

CREATE INDEX idx_judgments_case_number ON judgments(case_number);
CREATE INDEX idx_judgments_court ON judgments(court_id);
CREATE INDEX idx_judgments_complainant_lawyer ON judgments(complainant_lawyer_card_id);
CREATE INDEX idx_judgments_respondent_lawyer ON judgments(respondent_lawyer_card_id);
```

---

### 6. **case_claims**
Stores lawyer claims for individual cases/judgments with Vakaalatnama document.

```sql
CREATE TABLE case_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Claim Details
  lawyer_id UUID NOT NULL REFERENCES lawyers(id),
  judgment_id UUID NOT NULL REFERENCES judgments(id),
  
  -- Role in case
  role TEXT NOT NULL, -- 'complainant' or 'respondent'
  
  -- Vakaalatnama Document (Power of Attorney)
  vakaalatnama_url TEXT NOT NULL, -- S3/Storage URL to uploaded document
  vakaalatnama_uploaded_at TIMESTAMP DEFAULT NOW(),
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  
  -- Admin Review
  reviewed_by_admin_id UUID REFERENCES lawyers(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Additional Info
  notes TEXT, -- Lawyer's explanation
  case_number TEXT, -- Denormalized for quick access
  client_name TEXT, -- Name of the client (from Vakaalatnama)
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_case_claims_lawyer ON case_claims(lawyer_id);
CREATE INDEX idx_case_claims_judgment ON case_claims(judgment_id);
CREATE INDEX idx_case_claims_status ON case_claims(status);
CREATE INDEX idx_case_claims_case_number ON case_claims(case_number);

-- Unique constraint: One lawyer can only claim one role per case
CREATE UNIQUE INDEX idx_case_claims_unique ON case_claims(judgment_id, lawyer_id, role);
```

---

### 7. **claimed_cases**
Junction table linking verified lawyers to their claimed cases.

```sql
CREATE TABLE claimed_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  lawyer_id UUID NOT NULL REFERENCES lawyers(id),
  judgment_id UUID NOT NULL REFERENCES judgments(id),
  case_claim_id UUID NOT NULL REFERENCES case_claims(id),
  
  -- Role
  role TEXT NOT NULL, -- 'complainant' or 'respondent'
  
  -- Metadata
  claimed_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_claimed_cases_lawyer ON claimed_cases(lawyer_id);
CREATE INDEX idx_claimed_cases_judgment ON claimed_cases(judgment_id);
CREATE INDEX idx_claimed_cases_case_claim ON claimed_cases(case_claim_id);

-- Unique constraint
CREATE UNIQUE INDEX idx_claimed_cases_unique ON claimed_cases(judgment_id, lawyer_id, role);
```

---

## Row Level Security (RLS) Policies

### lawyer_cards
```sql
ALTER TABLE lawyer_cards ENABLE ROW LEVEL SECURITY;

-- Public can view unclaimed and master cards
CREATE POLICY "Public can view active cards" ON lawyer_cards
  FOR SELECT USING (
    status = 'unclaimed' OR 
    (status = 'merged' AND is_master_card = TRUE) OR
    status = 'claimed'
  );

-- Lawyers can view cards they claimed
CREATE POLICY "Lawyers can view their claimed cards" ON lawyer_cards
  FOR SELECT USING (claimed_by_lawyer_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all cards" ON lawyer_cards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lawyers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update cards
CREATE POLICY "Admins can update cards" ON lawyer_cards
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM lawyers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
```

### card_claims
```sql
ALTER TABLE card_claims ENABLE ROW LEVEL SECURITY;

-- Lawyers can insert their own claims
CREATE POLICY "Lawyers can create claims" ON card_claims
  FOR INSERT WITH CHECK (lawyer_id = auth.uid());

-- Lawyers can view their own claims
CREATE POLICY "Lawyers can view their claims" ON card_claims
  FOR SELECT USING (lawyer_id = auth.uid());

-- Admins can view all claims
CREATE POLICY "Admins can view all claims" ON card_claims
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lawyers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update claims
CREATE POLICY "Admins can update claims" ON card_claims
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM lawyers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
```

### case_claims
```sql
ALTER TABLE case_claims ENABLE ROW LEVEL SECURITY;

-- Lawyers can insert their own case claims
CREATE POLICY "Lawyers can create case claims" ON case_claims
  FOR INSERT WITH CHECK (lawyer_id = auth.uid());

-- Lawyers can view their own case claims
CREATE POLICY "Lawyers can view their case claims" ON case_claims
  FOR SELECT USING (lawyer_id = auth.uid());

-- Admins can view all case claims
CREATE POLICY "Admins can view all case claims" ON case_claims
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lawyers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update case claims
CREATE POLICY "Admins can update case claims" ON case_claims
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM lawyers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
```

### claimed_cases
```sql
ALTER TABLE claimed_cases ENABLE ROW LEVEL SECURITY;

-- Lawyers can view their claimed cases
CREATE POLICY "Lawyers can view their claimed cases" ON claimed_cases
  FOR SELECT USING (lawyer_id = auth.uid());

-- Admins can view all claimed cases
CREATE POLICY "Admins can view all claimed cases" ON claimed_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lawyers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can insert claimed cases (after approval)
CREATE POLICY "Admins can create claimed cases" ON claimed_cases
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lawyers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
```

### judgments
```sql
ALTER TABLE judgments ENABLE ROW LEVEL SECURITY;

-- Public can view all judgments
CREATE POLICY "Public can view judgments" ON judgments
  FOR SELECT USING (true);

-- Admins can insert judgments
CREATE POLICY "Admins can create judgments" ON judgments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lawyers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update judgments
CREATE POLICY "Admins can update judgments" ON judgments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM lawyers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
```

---

## Database Functions

### 1. Merge Cards Function
```sql
CREATE OR REPLACE FUNCTION merge_lawyer_cards(
  p_lawyer_id UUID,
  p_card_ids UUID[],
  p_preferred_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_master_card_id UUID;
  v_total_cases INTEGER := 0;
  v_cases_won INTEGER := 0;
  v_cases_lost INTEGER := 0;
  v_cases_settled INTEGER := 0;
  v_card_id UUID;
BEGIN
  -- Create or get master card
  SELECT id INTO v_master_card_id
  FROM lawyer_cards
  WHERE id = ANY(p_card_ids)
  ORDER BY total_cases DESC
  LIMIT 1;
  
  -- Aggregate statistics from all cards
  SELECT 
    SUM(total_cases),
    SUM(cases_won),
    SUM(cases_lost),
    SUM(cases_settled)
  INTO v_total_cases, v_cases_won, v_cases_lost, v_cases_settled
  FROM lawyer_cards
  WHERE id = ANY(p_card_ids);
  
  -- Update master card
  UPDATE lawyer_cards SET
    preferred_name = p_preferred_name,
    status = 'merged',
    is_master_card = TRUE,
    claimed_by_lawyer_id = p_lawyer_id,
    total_cases = v_total_cases,
    cases_won = v_cases_won,
    cases_lost = v_cases_lost,
    cases_settled = v_cases_settled,
    win_rate = CASE 
      WHEN v_total_cases > 0 THEN ROUND((v_cases_won::DECIMAL / v_total_cases) * 100, 2)
      ELSE 0 
    END,
    merged_at = NOW(),
    updated_at = NOW()
  WHERE id = v_master_card_id;
  
  -- Mark other cards as merged
  FOREACH v_card_id IN ARRAY p_card_ids
  LOOP
    IF v_card_id != v_master_card_id THEN
      UPDATE lawyer_cards SET
        status = 'merged',
        is_master_card = FALSE,
        merged_into_card_id = v_master_card_id,
        merged_at = NOW(),
        updated_at = NOW()
      WHERE id = v_card_id;
    END IF;
  END LOOP;
  
  -- Create merge group record
  INSERT INTO card_merge_groups (
    lawyer_id,
    master_card_id,
    preferred_name,
    merged_card_ids,
    total_cases,
    cases_won,
    cases_lost,
    cases_settled,
    win_rate
  ) VALUES (
    p_lawyer_id,
    v_master_card_id,
    p_preferred_name,
    p_card_ids,
    v_total_cases,
    v_cases_won,
    v_cases_lost,
    v_cases_settled,
    CASE 
      WHEN v_total_cases > 0 THEN ROUND((v_cases_won::DECIMAL / v_total_cases) * 100, 2)
      ELSE 0 
    END
  );
  
  -- Update lawyer record
  UPDATE lawyers SET
    master_card_id = v_master_card_id,
    has_claimed_cards = TRUE,
    verified = TRUE
  WHERE id = p_lawyer_id;
  
  RETURN v_master_card_id;
END;
$$ LANGUAGE plpgsql;
```

---

## Sample Queries

### Find potential duplicate cards for a lawyer
```sql
-- Based on name similarity
SELECT * FROM lawyer_cards
WHERE status = 'unclaimed'
AND (
  LOWER(name_in_judgment) LIKE '%adv. sharma%' OR
  LOWER(name_in_judgment) LIKE '%a. sharma%' OR
  LOWER(name_in_judgment) LIKE '%sharma advocate%'
)
ORDER BY total_cases DESC;
```

### Get pending claims for admin review
```sql
SELECT 
  cc.*,
  lc.name_in_judgment,
  lc.total_cases,
  l.name as lawyer_name,
  l.email as lawyer_email
FROM card_claims cc
JOIN lawyer_cards lc ON cc.card_id = lc.id
JOIN lawyers l ON cc.lawyer_id = l.id
WHERE cc.status = 'pending'
ORDER BY cc.created_at ASC;
```

### Get lawyer's claimed cards
```sql
SELECT * FROM lawyer_cards
WHERE claimed_by_lawyer_id = 'lawyer-uuid-here'
AND status IN ('claimed', 'merged')
ORDER BY total_cases DESC;
```

---

## Migration Script

Run this in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables in order
-- (Copy table creation statements from above)

-- Enable RLS
-- (Copy RLS policies from above)

-- Create functions
-- (Copy function definitions from above)
```

---

## Workflow Summary

1. **Admin uploads judgments** → Creates `lawyer_cards` with `status='unclaimed'`
2. **Lawyer discovers cards** → Browses unclaimed cards, finds name variations
3. **Lawyer claims cards** → Creates entries in `card_claims` with `status='pending'`
4. **Admin reviews claims** → Approves/rejects via admin dashboard
5. **On approval** → Calls `merge_lawyer_cards()` function
6. **Cards merged** → Creates master card, updates `card_merge_groups`
7. **Public sees merged card** → Single card with preferred name and aggregated stats

---

This schema supports:
- ✅ Multiple name variations per lawyer
- ✅ Batch claiming of cards
- ✅ Admin approval workflow
- ✅ Automatic statistics aggregation
- ✅ Historical tracking of merges
- ✅ Row-level security for data protection