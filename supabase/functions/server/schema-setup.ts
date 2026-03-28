/**
 * Database Schema Setup for Judge My Lawyer Platform
 * 
 * This file contains all SQL statements to create tables, indexes, RLS policies,
 * and functions for the complete claiming system.
 * 
 * Run these commands in Supabase SQL Editor in order.
 */

export const SCHEMA_SQL = `
-- =====================================================
-- ENABLE EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: lawyers
-- =====================================================
CREATE TABLE IF NOT EXISTS lawyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  bar_registration_number TEXT,
  specialization TEXT[],
  years_of_experience INTEGER,
  
  -- Admin & Verification
  is_admin BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  
  -- Card Claiming
  master_card_id UUID,
  has_claimed_cards BOOLEAN DEFAULT FALSE,
  
  -- Profile
  profile_photo_url TEXT,
  bio TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lawyers_email ON lawyers(email);
CREATE INDEX IF NOT EXISTS idx_lawyers_bar_number ON lawyers(bar_registration_number);
CREATE INDEX IF NOT EXISTS idx_lawyers_is_admin ON lawyers(is_admin);

-- =====================================================
-- TABLE: courts
-- =====================================================
CREATE TABLE IF NOT EXISTS courts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  court_type TEXT, -- 'Supreme Court', 'High Court', 'District Court'
  state TEXT,
  
  -- Statistics
  total_cases INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courts_name ON courts(name);
CREATE INDEX IF NOT EXISTS idx_courts_state ON courts(state);

-- =====================================================
-- TABLE: judges
-- =====================================================
CREATE TABLE IF NOT EXISTS judges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  court_id UUID REFERENCES courts(id),
  
  -- Statistics
  total_cases INTEGER DEFAULT 0,
  cases_dismissed INTEGER DEFAULT 0,
  dismiss_rate DECIMAL(5,2),
  average_case_duration INTEGER, -- in days
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_judges_name ON judges(name);
CREATE INDEX IF NOT EXISTS idx_judges_court ON judges(court_id);

-- =====================================================
-- TABLE: lawyer_cards
-- =====================================================
CREATE TABLE IF NOT EXISTS lawyer_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Card Identity
  name_in_judgment TEXT NOT NULL,
  preferred_name TEXT,
  
  -- Status
  status TEXT DEFAULT 'unclaimed', -- 'unclaimed', 'claimed', 'merged'
  is_master_card BOOLEAN DEFAULT FALSE,
  merged_into_card_id UUID REFERENCES lawyer_cards(id),
  claimed_by_lawyer_id UUID REFERENCES lawyers(id),
  
  -- Statistics (aggregated from judgments)
  total_cases INTEGER DEFAULT 0,
  cases_won INTEGER DEFAULT 0,
  cases_lost INTEGER DEFAULT 0,
  cases_settled INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),
  loss_rate DECIMAL(5,2),
  settlement_rate DECIMAL(5,2),
  average_case_duration INTEGER,
  average_hearings INTEGER,
  
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

CREATE INDEX IF NOT EXISTS idx_lawyer_cards_status ON lawyer_cards(status);
CREATE INDEX IF NOT EXISTS idx_lawyer_cards_name ON lawyer_cards(name_in_judgment);
CREATE INDEX IF NOT EXISTS idx_lawyer_cards_claimed_by ON lawyer_cards(claimed_by_lawyer_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_cards_merged_into ON lawyer_cards(merged_into_card_id);

-- =====================================================
-- TABLE: card_claims
-- =====================================================
CREATE TABLE IF NOT EXISTS card_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Claim Details
  lawyer_id UUID NOT NULL REFERENCES lawyers(id),
  card_ids UUID[] NOT NULL, -- Array of card IDs being claimed
  
  -- Preferred Identity
  preferred_name TEXT NOT NULL,
  bar_registration_number TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  
  -- Admin Action
  reviewed_by_admin_id UUID REFERENCES lawyers(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Supporting Documents
  proof_document_url TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_claims_lawyer ON card_claims(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_card_claims_status ON card_claims(status);

-- =====================================================
-- TABLE: card_merge_groups
-- =====================================================
CREATE TABLE IF NOT EXISTS card_merge_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Group Details
  lawyer_id UUID NOT NULL REFERENCES lawyers(id),
  master_card_id UUID NOT NULL REFERENCES lawyer_cards(id),
  preferred_name TEXT NOT NULL,
  
  -- Merged Cards
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

CREATE INDEX IF NOT EXISTS idx_merge_groups_lawyer ON card_merge_groups(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_merge_groups_master_card ON card_merge_groups(master_card_id);

-- =====================================================
-- TABLE: judgments
-- =====================================================
CREATE TABLE IF NOT EXISTS judgments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Judgment Details
  case_number TEXT NOT NULL UNIQUE,
  case_title TEXT,
  judgment_date DATE,
  court_id UUID REFERENCES courts(id),
  judge_id UUID REFERENCES judges(id),
  
  -- Parties
  complainant_name TEXT,
  respondent_name TEXT,
  complainant_lawyer_name TEXT, -- Raw name from judgment
  respondent_lawyer_name TEXT, -- Raw name from judgment
  complainant_lawyer_card_id UUID REFERENCES lawyer_cards(id),
  respondent_lawyer_card_id UUID REFERENCES lawyer_cards(id),
  
  -- Outcome
  outcome TEXT, -- 'won_complainant', 'won_respondent', 'settled', 'dismissed'
  case_type TEXT,
  
  -- Case Metrics
  case_duration INTEGER, -- in days
  number_of_hearings INTEGER,
  
  -- Document
  judgment_text TEXT,
  judgment_document_url TEXT,
  
  -- Extracted Data
  raw_extracted_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  uploaded_by_admin_id UUID REFERENCES lawyers(id)
);

CREATE INDEX IF NOT EXISTS idx_judgments_case_number ON judgments(case_number);
CREATE INDEX IF NOT EXISTS idx_judgments_court ON judgments(court_id);
CREATE INDEX IF NOT EXISTS idx_judgments_judge ON judgments(judge_id);
CREATE INDEX IF NOT EXISTS idx_judgments_complainant_lawyer ON judgments(complainant_lawyer_card_id);
CREATE INDEX IF NOT EXISTS idx_judgments_respondent_lawyer ON judgments(respondent_lawyer_card_id);
CREATE INDEX IF NOT EXISTS idx_judgments_date ON judgments(judgment_date);

-- =====================================================
-- TABLE: case_claims
-- =====================================================
CREATE TABLE IF NOT EXISTS case_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Claim Details
  lawyer_id UUID NOT NULL REFERENCES lawyers(id),
  judgment_id UUID NOT NULL REFERENCES judgments(id),
  
  -- Role in case
  role TEXT NOT NULL, -- 'complainant' or 'respondent'
  
  -- Vakaalatnama Document (Power of Attorney)
  vakaalatnama_url TEXT NOT NULL,
  vakaalatnama_uploaded_at TIMESTAMP DEFAULT NOW(),
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  
  -- Admin Review
  reviewed_by_admin_id UUID REFERENCES lawyers(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Additional Info
  notes TEXT,
  case_number TEXT, -- Denormalized for quick access
  client_name TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_claims_lawyer ON case_claims(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_case_claims_judgment ON case_claims(judgment_id);
CREATE INDEX IF NOT EXISTS idx_case_claims_status ON case_claims(status);
CREATE INDEX IF NOT EXISTS idx_case_claims_case_number ON case_claims(case_number);

-- Unique constraint: One lawyer can only claim one role per case
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_claims_unique ON case_claims(judgment_id, lawyer_id, role);

-- =====================================================
-- TABLE: claimed_cases
-- =====================================================
CREATE TABLE IF NOT EXISTS claimed_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  lawyer_id UUID NOT NULL REFERENCES lawyers(id),
  judgment_id UUID NOT NULL REFERENCES judgments(id),
  case_claim_id UUID NOT NULL REFERENCES case_claims(id),
  
  -- Role
  role TEXT NOT NULL,
  
  -- Metadata
  claimed_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claimed_cases_lawyer ON claimed_cases(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_claimed_cases_judgment ON claimed_cases(judgment_id);
CREATE INDEX IF NOT EXISTS idx_claimed_cases_case_claim ON claimed_cases(case_claim_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_claimed_cases_unique ON claimed_cases(judgment_id, lawyer_id, role);

-- =====================================================
-- TABLE: saved_lawyers (for clients)
-- =====================================================
CREATE TABLE IF NOT EXISTS saved_lawyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_email TEXT NOT NULL,
  lawyer_card_id UUID NOT NULL REFERENCES lawyer_cards(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_lawyers_client ON saved_lawyers(client_email);
CREATE INDEX IF NOT EXISTS idx_saved_lawyers_lawyer ON saved_lawyers(lawyer_card_id);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_merge_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE judgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claimed_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_lawyers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS: lawyers
-- =====================================================
CREATE POLICY "Public can view lawyers" ON lawyers
  FOR SELECT USING (true);

CREATE POLICY "Lawyers can update own profile" ON lawyers
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can update all lawyers" ON lawyers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =====================================================
-- RLS: courts
-- =====================================================
CREATE POLICY "Public can view courts" ON courts
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert courts" ON courts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =====================================================
-- RLS: judges
-- =====================================================
CREATE POLICY "Public can view judges" ON judges
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert judges" ON judges
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =====================================================
-- RLS: lawyer_cards
-- =====================================================
CREATE POLICY "Public can view active cards" ON lawyer_cards
  FOR SELECT USING (
    status = 'unclaimed' OR 
    (status = 'merged' AND is_master_card = TRUE) OR
    status = 'claimed'
  );

CREATE POLICY "Lawyers can view their claimed cards" ON lawyer_cards
  FOR SELECT USING (claimed_by_lawyer_id = auth.uid());

CREATE POLICY "Admins can view all cards" ON lawyer_cards
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can update cards" ON lawyer_cards
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can insert cards" ON lawyer_cards
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =====================================================
-- RLS: card_claims
-- =====================================================
CREATE POLICY "Lawyers can create claims" ON card_claims
  FOR INSERT WITH CHECK (lawyer_id = auth.uid());

CREATE POLICY "Lawyers can view their claims" ON card_claims
  FOR SELECT USING (lawyer_id = auth.uid());

CREATE POLICY "Admins can view all claims" ON card_claims
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can update claims" ON card_claims
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =====================================================
-- RLS: card_merge_groups
-- =====================================================
CREATE POLICY "Lawyers can view their merge groups" ON card_merge_groups
  FOR SELECT USING (lawyer_id = auth.uid());

CREATE POLICY "Admins can view all merge groups" ON card_merge_groups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can insert merge groups" ON card_merge_groups
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =====================================================
-- RLS: judgments
-- =====================================================
CREATE POLICY "Public can view judgments" ON judgments
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert judgments" ON judgments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can update judgments" ON judgments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =====================================================
-- RLS: case_claims
-- =====================================================
CREATE POLICY "Lawyers can create case claims" ON case_claims
  FOR INSERT WITH CHECK (lawyer_id = auth.uid());

CREATE POLICY "Lawyers can view their case claims" ON case_claims
  FOR SELECT USING (lawyer_id = auth.uid());

CREATE POLICY "Admins can view all case claims" ON case_claims
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can update case claims" ON case_claims
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =====================================================
-- RLS: claimed_cases
-- =====================================================
CREATE POLICY "Public can view claimed cases" ON claimed_cases
  FOR SELECT USING (true);

CREATE POLICY "Lawyers can view their claimed cases" ON claimed_cases
  FOR SELECT USING (lawyer_id = auth.uid());

CREATE POLICY "Admins can insert claimed cases" ON claimed_cases
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =====================================================
-- RLS: saved_lawyers
-- =====================================================
CREATE POLICY "Users can view their saved lawyers" ON saved_lawyers
  FOR SELECT USING (client_email = auth.email());

CREATE POLICY "Users can save lawyers" ON saved_lawyers
  FOR INSERT WITH CHECK (client_email = auth.email());

CREATE POLICY "Users can delete their saved lawyers" ON saved_lawyers
  FOR DELETE USING (client_email = auth.email());

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to merge lawyer cards
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
  -- Get master card (the one with most cases)
  SELECT id INTO v_master_card_id
  FROM lawyer_cards
  WHERE id = ANY(p_card_ids)
  ORDER BY total_cases DESC
  LIMIT 1;
  
  -- Aggregate statistics from all cards
  SELECT 
    COALESCE(SUM(total_cases), 0),
    COALESCE(SUM(cases_won), 0),
    COALESCE(SUM(cases_lost), 0),
    COALESCE(SUM(cases_settled), 0)
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
    loss_rate = CASE 
      WHEN v_total_cases > 0 THEN ROUND((v_cases_lost::DECIMAL / v_total_cases) * 100, 2)
      ELSE 0 
    END,
    settlement_rate = CASE 
      WHEN v_total_cases > 0 THEN ROUND((v_cases_settled::DECIMAL / v_total_cases) * 100, 2)
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

-- Function to approve case claim
CREATE OR REPLACE FUNCTION approve_case_claim(
  p_case_claim_id UUID,
  p_admin_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_lawyer_id UUID;
  v_judgment_id UUID;
  v_role TEXT;
  v_lawyer_card_id UUID;
BEGIN
  -- Get claim details
  SELECT lawyer_id, judgment_id, role
  INTO v_lawyer_id, v_judgment_id, v_role
  FROM case_claims
  WHERE id = p_case_claim_id;
  
  -- Get lawyer's master card
  SELECT master_card_id INTO v_lawyer_card_id
  FROM lawyers
  WHERE id = v_lawyer_id;
  
  -- Update case claim status
  UPDATE case_claims SET
    status = 'approved',
    reviewed_by_admin_id = p_admin_id,
    reviewed_at = NOW()
  WHERE id = p_case_claim_id;
  
  -- Link judgment to lawyer card
  IF v_role = 'complainant' THEN
    UPDATE judgments SET
      complainant_lawyer_card_id = v_lawyer_card_id
    WHERE id = v_judgment_id;
  ELSE
    UPDATE judgments SET
      respondent_lawyer_card_id = v_lawyer_card_id
    WHERE id = v_judgment_id;
  END IF;
  
  -- Create claimed_cases entry
  INSERT INTO claimed_cases (
    lawyer_id,
    judgment_id,
    case_claim_id,
    role
  ) VALUES (
    v_lawyer_id,
    v_judgment_id,
    p_case_claim_id,
    v_role
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

`;

export const SEED_DATA_SQL = `
-- Sample data for development/testing

-- Insert sample courts
INSERT INTO courts (id, name, location, court_type, state, total_cases) VALUES
('11111111-1111-1111-1111-111111111111', 'Delhi High Court', 'New Delhi', 'High Court', 'Delhi', 0),
('22222222-2222-2222-2222-222222222222', 'Mumbai High Court', 'Mumbai', 'High Court', 'Maharashtra', 0),
('33333333-3333-3333-3333-333333333333', 'Delhi District Court', 'Tis Hazari', 'District Court', 'Delhi', 0)
ON CONFLICT DO NOTHING;

-- Insert sample judges
INSERT INTO judges (id, name, court_id, total_cases) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Justice Rajesh Sharma', '11111111-1111-1111-1111-111111111111', 0),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Justice Meena Gupta', '33333333-3333-3333-3333-333333333333', 0)
ON CONFLICT DO NOTHING;

-- Insert sample unclaimed lawyer cards (duplicates from name variations)
INSERT INTO lawyer_cards (name_in_judgment, status, total_cases, cases_won, cases_lost, cases_settled) VALUES
('Adv. Rajesh Kumar', 'unclaimed', 156, 98, 42, 16),
('R. Kumar (Advocate)', 'unclaimed', 87, 54, 28, 5),
('Shri Rajesh Kumar', 'unclaimed', 43, 29, 12, 2),
('Adv. Priya Sharma', 'unclaimed', 234, 156, 62, 16),
('P. Sharma', 'unclaimed', 98, 67, 24, 7),
('Ms. Priya Sharma (Advocate)', 'unclaimed', 45, 32, 10, 3);
`;
