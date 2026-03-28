-- Judge My Lawyer Database Schema
-- Master cases table contains all case data for analytics
-- Supporting tables for profiles and authentication

-- =====================================================
-- 1. CORE TABLES
-- =====================================================

-- Lawyers table (profile information)
CREATE TABLE lawyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  bar_registration TEXT UNIQUE,
  experience INTEGER,
  specialization TEXT[], -- Array of specializations
  courts TEXT[], -- Array of courts they practice in
  bio TEXT,
  address TEXT,
  profile_photo_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Judges table (profile information)
CREATE TABLE judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  designation TEXT, -- Chief Justice, Justice, etc.
  courts TEXT[], -- Array of courts
  appointment_date DATE,
  bio TEXT,
  profile_photo_url TEXT,
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Courts table (reference data)
CREATE TABLE courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT, -- Supreme Court, High Court, District Court, etc.
  state TEXT,
  city TEXT,
  address TEXT,
  established_year INTEGER,
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 2. MASTER CASES TABLE (Single Source of Truth)
-- =====================================================

CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Case Identification
  case_number TEXT UNIQUE NOT NULL,
  case_title TEXT NOT NULL,
  case_type TEXT NOT NULL, -- Criminal, Civil, Corporate, Family, etc.
  
  -- Court Information
  court_id UUID REFERENCES courts(id),
  court_name TEXT NOT NULL, -- Denormalized for faster queries
  
  -- Lawyer Information
  lawyer_id UUID REFERENCES lawyers(id),
  lawyer_name TEXT NOT NULL, -- Denormalized for faster queries
  lawyer_side TEXT, -- Plaintiff, Defendant, Petitioner, Respondent
  
  -- Judge Information
  judge_id UUID REFERENCES judges(id),
  judge_name TEXT NOT NULL, -- Denormalized for faster queries
  
  -- Case Timeline
  filing_date DATE NOT NULL,
  judgment_date DATE,
  first_hearing_date DATE,
  last_hearing_date DATE,
  
  -- Case Metrics
  total_hearings INTEGER DEFAULT 0,
  duration_days INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN judgment_date IS NOT NULL 
      THEN (judgment_date - filing_date) 
      ELSE NULL 
    END
  ) STORED,
  
  -- Case Outcome
  status TEXT DEFAULT 'pending', -- pending, disposed, withdrawn
  outcome TEXT, -- Won, Lost, Settled, Dismissed, Withdrawn
  
  -- Additional Details
  petitioner_name TEXT,
  respondent_name TEXT,
  summary TEXT,
  judgment_summary TEXT,
  
  -- Document Reference
  case_document_url TEXT,
  judgment_document_url TEXT,
  
  -- Data Quality
  data_source TEXT, -- manual, api, pdf_extract, etc.
  verified BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX idx_cases_lawyer_id ON cases(lawyer_id);
CREATE INDEX idx_cases_judge_id ON cases(judge_id);
CREATE INDEX idx_cases_court_id ON cases(court_id);
CREATE INDEX idx_cases_filing_date ON cases(filing_date);
CREATE INDEX idx_cases_case_type ON cases(case_type);
CREATE INDEX idx_cases_outcome ON cases(outcome);
CREATE INDEX idx_cases_status ON cases(status);

-- =====================================================
-- 3. AUTHENTICATION & USER MANAGEMENT
-- =====================================================

-- Clients table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Saved lawyers (client favorites)
CREATE TABLE saved_lawyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES lawyers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, lawyer_id)
);

-- Consultation requests
CREATE TABLE consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES lawyers(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected, completed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 4. CLAIMING SYSTEM
-- =====================================================

-- Card claims (for merging duplicate profiles)
CREATE TABLE card_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID REFERENCES lawyers(id) ON DELETE CASCADE,
  claimed_entity_type TEXT NOT NULL, -- 'lawyer', 'judge', 'court'
  claimed_entity_id UUID NOT NULL, -- ID of the lawyer/judge/court being claimed
  claimed_entity_name TEXT NOT NULL,
  
  -- Verification documents
  bar_council_certificate_url TEXT,
  id_proof_url TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  admin_notes TEXT,
  reviewed_by UUID REFERENCES lawyers(id),
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Case claims (for individual cases with Vakaalatnama)
CREATE TABLE case_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID REFERENCES lawyers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  case_number TEXT NOT NULL,
  
  -- Verification document
  vakalatnama_url TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  admin_notes TEXT,
  reviewed_by UUID REFERENCES lawyers(id),
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 5. TRIGGERS FOR AUTO-UPDATE
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_lawyers_updated_at BEFORE UPDATE ON lawyers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_judges_updated_at BEFORE UPDATE ON judges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courts_updated_at BEFORE UPDATE ON courts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultation_requests_updated_at BEFORE UPDATE ON consultation_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_card_claims_updated_at BEFORE UPDATE ON card_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_case_claims_updated_at BEFORE UPDATE ON case_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_claims ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ ACCESS (D2C model - all data is publicly readable)
CREATE POLICY "Public read access for lawyers" ON lawyers FOR SELECT USING (true);
CREATE POLICY "Public read access for judges" ON judges FOR SELECT USING (true);
CREATE POLICY "Public read access for courts" ON courts FOR SELECT USING (true);
CREATE POLICY "Public read access for cases" ON cases FOR SELECT USING (true);

-- LAWYERS POLICIES
-- Lawyers can update their own profile
CREATE POLICY "Lawyers can update own profile" ON lawyers 
  FOR UPDATE USING (user_id = auth.uid());

-- Lawyers can insert their profile during signup
CREATE POLICY "Lawyers can insert own profile" ON lawyers 
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- CLIENTS POLICIES
CREATE POLICY "Clients can read own data" ON clients 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Clients can update own data" ON clients 
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Clients can insert own data" ON clients 
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- SAVED LAWYERS POLICIES
CREATE POLICY "Clients can manage saved lawyers" ON saved_lawyers 
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

-- CONSULTATION REQUESTS POLICIES
CREATE POLICY "Clients can create consultation requests" ON consultation_requests 
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Clients can view own consultation requests" ON consultation_requests 
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Lawyers can view their consultation requests" ON consultation_requests 
  FOR SELECT USING (
    lawyer_id IN (SELECT id FROM lawyers WHERE user_id = auth.uid())
  );

CREATE POLICY "Lawyers can update consultation status" ON consultation_requests 
  FOR UPDATE USING (
    lawyer_id IN (SELECT id FROM lawyers WHERE user_id = auth.uid())
  );

-- CARD CLAIMS POLICIES
CREATE POLICY "Lawyers can create card claims" ON card_claims 
  FOR INSERT WITH CHECK (
    lawyer_id IN (SELECT id FROM lawyers WHERE user_id = auth.uid())
  );

CREATE POLICY "Lawyers can view own card claims" ON card_claims 
  FOR SELECT USING (
    lawyer_id IN (SELECT id FROM lawyers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all card claims" ON card_claims 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lawyers WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update card claims" ON card_claims 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lawyers WHERE user_id = auth.uid() AND is_admin = true)
  );

-- CASE CLAIMS POLICIES
CREATE POLICY "Lawyers can create case claims" ON case_claims 
  FOR INSERT WITH CHECK (
    lawyer_id IN (SELECT id FROM lawyers WHERE user_id = auth.uid())
  );

CREATE POLICY "Lawyers can view own case claims" ON case_claims 
  FOR SELECT USING (
    lawyer_id IN (SELECT id FROM lawyers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all case claims" ON case_claims 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lawyers WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update case claims" ON case_claims 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lawyers WHERE user_id = auth.uid() AND is_admin = true)
  );

-- ADMIN POLICIES FOR DATA MANAGEMENT
CREATE POLICY "Admins can insert courts" ON courts 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lawyers WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update courts" ON courts 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lawyers WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can insert judges" ON judges 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lawyers WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update judges" ON judges 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lawyers WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can insert cases" ON cases 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lawyers WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update cases" ON cases 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lawyers WHERE user_id = auth.uid() AND is_admin = true)
  );

-- =====================================================
-- 7. HELPER FUNCTIONS FOR ANALYTICS
-- =====================================================

-- Function to calculate lawyer rank based on win rate and case volume
CREATE OR REPLACE FUNCTION calculate_lawyer_ranks()
RETURNS void AS $$
BEGIN
  WITH lawyer_stats AS (
    SELECT 
      lawyer_id,
      COUNT(*) as total_cases,
      COUNT(*) FILTER (WHERE outcome = 'Won') * 100.0 / NULLIF(COUNT(*), 0) as win_rate
    FROM cases
    WHERE lawyer_id IS NOT NULL
    GROUP BY lawyer_id
  ),
  ranked_lawyers AS (
    SELECT 
      lawyer_id,
      ROW_NUMBER() OVER (ORDER BY win_rate DESC, total_cases DESC) as rank
    FROM lawyer_stats
  )
  UPDATE lawyers l
  SET rank = r.rank
  FROM ranked_lawyers r
  WHERE l.id = r.lawyer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate judge rank based on case disposal rate
CREATE OR REPLACE FUNCTION calculate_judge_ranks()
RETURNS void AS $$
BEGIN
  WITH judge_stats AS (
    SELECT 
      judge_id,
      COUNT(*) as total_cases,
      COUNT(*) FILTER (WHERE status = 'disposed') * 100.0 / NULLIF(COUNT(*), 0) as disposal_rate
    FROM cases
    WHERE judge_id IS NOT NULL
    GROUP BY judge_id
  ),
  ranked_judges AS (
    SELECT 
      judge_id,
      ROW_NUMBER() OVER (ORDER BY disposal_rate DESC, total_cases DESC) as rank
    FROM judge_stats
  )
  UPDATE judges j
  SET rank = r.rank
  FROM ranked_judges r
  WHERE j.id = r.judge_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate court rank based on average case duration
CREATE OR REPLACE FUNCTION calculate_court_ranks()
RETURNS void AS $$
BEGIN
  WITH court_stats AS (
    SELECT 
      court_id,
      COUNT(*) as total_cases,
      AVG(duration_days) as avg_duration
    FROM cases
    WHERE court_id IS NOT NULL AND duration_days IS NOT NULL
    GROUP BY court_id
  ),
  ranked_courts AS (
    SELECT 
      court_id,
      ROW_NUMBER() OVER (ORDER BY avg_duration ASC, total_cases DESC) as rank
    FROM court_stats
  )
  UPDATE courts c
  SET rank = r.rank
  FROM ranked_courts r
  WHERE c.id = r.court_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. SEED DATA (Sample data for testing)
-- =====================================================

-- Insert sample courts
INSERT INTO courts (name, type, state, city) VALUES
  ('Supreme Court of India', 'Supreme Court', 'Delhi', 'New Delhi'),
  ('Delhi High Court', 'High Court', 'Delhi', 'New Delhi'),
  ('Mumbai High Court', 'High Court', 'Maharashtra', 'Mumbai'),
  ('District Court Dwarka', 'District Court', 'Delhi', 'New Delhi'),
  ('District Court Saket', 'District Court', 'Delhi', 'New Delhi');

-- Insert sample judges
INSERT INTO judges (name, designation, courts) VALUES
  ('Hon. Justice Ramesh Sharma', 'Chief Justice', ARRAY['Supreme Court of India']),
  ('Hon. Justice Priya Verma', 'Justice', ARRAY['Delhi High Court']),
  ('Hon. Justice Anil Kumar', 'Justice', ARRAY['Mumbai High Court']),
  ('Hon. Justice Sunita Desai', 'District Judge', ARRAY['District Court Dwarka']),
  ('Hon. Justice Vikram Singh', 'District Judge', ARRAY['District Court Saket']);

-- Note: Lawyers will be created when they sign up
-- Sample cases will be inserted by admin after lawyer profiles exist
