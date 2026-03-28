// API Routes for Judge My Lawyer
// All analytics are computed from the master cases table

import { Context } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Create Supabase client helper
export const getSupabaseClient = (authHeader?: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = authHeader 
    ? authHeader.replace('Bearer ', '')
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, supabaseKey);
};

// Helper to verify authentication
export const verifyAuth = async (c: Context) => {
  const authHeader = c.req.header('Authorization');
  const supabase = getSupabaseClient(authHeader);
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: 'Unauthorized', user: null, supabase: null };
  }
  
  return { error: null, user, supabase };
};

// =====================================================
// LAWYER ROUTES
// =====================================================

export const searchLawyers = async (c: Context) => {
  try {
    const searchTerm = c.req.query('q') || '';
    const specialization = c.req.query('specialization');
    const court = c.req.query('court');
    
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('lawyers')
      .select('*')
      .eq('is_verified', true)
      .order('rank', { ascending: true, nullsFirst: false });
    
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,bar_registration.ilike.%${searchTerm}%`);
    }
    
    if (specialization) {
      query = query.contains('specialization', [specialization]);
    }
    
    if (court) {
      query = query.contains('courts', [court]);
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) throw error;
    
    // Enrich with stats from cases table
    const lawyersWithStats = await Promise.all(data.map(async (lawyer) => {
      const stats = await getLawyerStats(lawyer.id);
      return { ...lawyer, stats };
    }));
    
    return c.json({ lawyers: lawyersWithStats });
  } catch (error) {
    console.error('Error searching lawyers:', error);
    return c.json({ error: 'Failed to search lawyers' }, 500);
  }
};

export const getLawyerById = async (c: Context) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabaseClient();
    
    const { data: lawyer, error } = await supabase
      .from('lawyers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!lawyer) return c.json({ error: 'Lawyer not found' }, 404);
    
    // Get comprehensive stats
    const stats = await getLawyerStats(id);
    const caseHistory = await getLawyerCases(id);
    
    return c.json({ lawyer: { ...lawyer, stats, caseHistory } });
  } catch (error) {
    console.error('Error fetching lawyer:', error);
    return c.json({ error: 'Failed to fetch lawyer' }, 500);
  }
};

// Helper: Calculate lawyer stats from master cases table
async function getLawyerStats(lawyerId: string) {
  const supabase = getSupabaseClient();
  
  // Query using case_lawyers junction table
  const { data: caseLawyers, error } = await supabase
    .from('case_lawyers')
    .select(`
      case_id,
      representation_side,
      cases (
        id,
        case_type,
        outcome,
        status,
        duration_days,
        total_hearings,
        court_name,
        filing_date
      )
    `)
    .eq('lawyer_id', lawyerId);
  
  if (error || !caseLawyers) return getDefaultStats();
  
  const cases = caseLawyers
    .map(cl => ({ ...cl.cases, representation_side: cl.representation_side }))
    .filter(c => c !== null && c.id !== undefined);
  
  const totalCases = cases.length;
  if (totalCases === 0) return getDefaultStats();
  
  // Calculate wins/losses based on representation side and outcome
  const wonCases = cases.filter(c => {
    const isPetitioner = ['Petitioner', 'Plaintiff', 'Complainant'].includes(c.representation_side);
    const isRespondent = ['Respondent', 'Defendant', 'Accused'].includes(c.representation_side);
    
    if (isPetitioner) {
      return c.outcome === 'In favor of Complainant';
    } else if (isRespondent) {
      return c.outcome === 'In favor of Respondent' || c.outcome === 'Dismissed' || c.outcome === 'Withdrawn';
    }
    return false;
  }).length;
  
  const lostCases = cases.filter(c => {
    const isPetitioner = ['Petitioner', 'Plaintiff', 'Complainant'].includes(c.representation_side);
    const isRespondent = ['Respondent', 'Defendant', 'Accused'].includes(c.representation_side);
    
    if (isPetitioner) {
      return c.outcome === 'In favor of Respondent' || c.outcome === 'Dismissed';
    } else if (isRespondent) {
      return c.outcome === 'In favor of Complainant';
    }
    return false;
  }).length;
  
  const settledCases = cases.filter(c => c.outcome === 'Settled').length;
  const dismissedCases = cases.filter(c => c.outcome === 'Dismissed').length;
  
  const casesWithDuration = cases.filter(c => c.duration_days !== null);
  const avgCaseDuration = casesWithDuration.length > 0
    ? Math.round(casesWithDuration.reduce((sum, c) => sum + c.duration_days, 0) / casesWithDuration.length)
    : 0;
  
  const avgHearings = totalCases > 0
    ? (cases.reduce((sum, c) => sum + (c.total_hearings || 0), 0) / totalCases).toFixed(1)
    : 0;
  
  // Count by representation side
  const petitionerCases = cases.filter(c => 
    ['Petitioner', 'Plaintiff', 'Complainant'].includes(c.representation_side)
  ).length;
  const respondentCases = cases.filter(c => 
    ['Respondent', 'Defendant', 'Accused'].includes(c.representation_side)
  ).length;
  
  // Case type distribution
  const caseTypeDistribution = cases.reduce((acc, c) => {
    acc[c.case_type] = (acc[c.case_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Court-wise stats with win/loss calculation
  const courtStats = cases.reduce((acc, c) => {
    if (!acc[c.court_name]) {
      acc[c.court_name] = { total: 0, won: 0, lost: 0, settled: 0 };
    }
    acc[c.court_name].total++;
    
    // Calculate won/lost based on representation side
    const isPetitioner = ['Petitioner', 'Plaintiff', 'Complainant'].includes(c.representation_side);
    const isRespondent = ['Respondent', 'Defendant', 'Accused'].includes(c.representation_side);
    
    if (isPetitioner && c.outcome === 'In favor of Complainant') {
      acc[c.court_name].won++;
    } else if (isRespondent && (c.outcome === 'In favor of Respondent' || c.outcome === 'Dismissed')) {
      acc[c.court_name].won++;
    } else if (isPetitioner && (c.outcome === 'In favor of Respondent' || c.outcome === 'Dismissed')) {
      acc[c.court_name].lost++;
    } else if (isRespondent && c.outcome === 'In favor of Complainant') {
      acc[c.court_name].lost++;
    } else if (c.outcome === 'Settled') {
      acc[c.court_name].settled++;
    }
    
    return acc;
  }, {} as Record<string, any>);
  
  return {
    totalCases,
    wonCases,
    lostCases,
    settledCases,
    dismissedCases,
    winRate: ((wonCases / totalCases) * 100).toFixed(1),
    lossRate: ((lostCases / totalCases) * 100).toFixed(1),
    settlementRate: ((settledCases / totalCases) * 100).toFixed(1),
    dismissRate: ((dismissedCases / totalCases) * 100).toFixed(1),
    avgCaseDuration,
    avgHearings,
    petitionerCases,
    respondentCases,
    caseTypeDistribution,
    courtStats
  };
}

// Helper: Get lawyer case history
async function getLawyerCases(lawyerId: string) {
  const supabase = getSupabaseClient();
  
  const { data: cases, error } = await supabase
    .from('cases')
    .select('*')
    .eq('lawyer_id', lawyerId)
    .order('filing_date', { ascending: false })
    .limit(100);
  
  if (error) return [];
  return cases || [];
}

function getDefaultStats() {
  return {
    totalCases: 0,
    wonCases: 0,
    lostCases: 0,
    settledCases: 0,
    dismissRate: '0.0',
    winRate: '0.0',
    lossRate: '0.0',
    settlementRate: '0.0',
    avgCaseDuration: 0,
    avgHearings: '0.0',
    petitionerCases: 0,
    respondentCases: 0,
    caseTypeDistribution: {},
    courtStats: {}
  };
}

// =====================================================
// JUDGE ROUTES
// =====================================================

export const searchJudges = async (c: Context) => {
  try {
    const searchTerm = c.req.query('q') || '';
    const court = c.req.query('court');
    
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('judges')
      .select('*')
      .order('rank', { ascending: true, nullsFirst: false });
    
    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }
    
    if (court) {
      query = query.contains('courts', [court]);
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) throw error;
    
    // Enrich with stats
    const judgesWithStats = await Promise.all(data.map(async (judge) => {
      const stats = await getJudgeStats(judge.id);
      return { ...judge, stats };
    }));
    
    return c.json({ judges: judgesWithStats });
  } catch (error) {
    console.error('Error searching judges:', error);
    return c.json({ error: 'Failed to search judges' }, 500);
  }
};

export const getJudgeById = async (c: Context) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabaseClient();
    
    const { data: judge, error } = await supabase
      .from('judges')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!judge) return c.json({ error: 'Judge not found' }, 404);
    
    const stats = await getJudgeStats(id);
    const caseHistory = await getJudgeCases(id);
    
    return c.json({ judge: { ...judge, stats, caseHistory } });
  } catch (error) {
    console.error('Error fetching judge:', error);
    return c.json({ error: 'Failed to fetch judge' }, 500);
  }
};

// Helper: Calculate judge stats from master cases table
async function getJudgeStats(judgeId: string) {
  const supabase = getSupabaseClient();
  
  const { data: cases, error } = await supabase
    .from('cases')
    .select('*')
    .eq('judge_id', judgeId);
  
  if (error || !cases) return getDefaultJudgeStats();
  
  const totalCases = cases.length;
  if (totalCases === 0) return getDefaultJudgeStats();
  
  const dismissedCases = cases.filter(c => c.outcome === 'Dismissed').length;
  const disposedCases = cases.filter(c => c.status === 'disposed').length;
  const pendingCases = cases.filter(c => c.status === 'pending').length;
  
  const casesWithDuration = cases.filter(c => c.duration_days !== null);
  const avgCaseDuration = casesWithDuration.length > 0
    ? Math.round(casesWithDuration.reduce((sum, c) => sum + c.duration_days, 0) / casesWithDuration.length)
    : 0;
  
  const avgHearings = totalCases > 0
    ? (cases.reduce((sum, c) => sum + (c.total_hearings || 0), 0) / totalCases).toFixed(1)
    : 0;
  
  // Case type distribution
  const caseTypeDistribution = cases.reduce((acc, c) => {
    acc[c.case_type] = (acc[c.case_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalCases,
    dismissedCases,
    disposedCases,
    pendingCases,
    dismissRate: ((dismissedCases / totalCases) * 100).toFixed(1),
    disposalRate: ((disposedCases / totalCases) * 100).toFixed(1),
    avgCaseDuration,
    avgHearings,
    caseTypeDistribution
  };
}

async function getJudgeCases(judgeId: string) {
  const supabase = getSupabaseClient();
  
  const { data: cases, error } = await supabase
    .from('cases')
    .select('*')
    .eq('judge_id', judgeId)
    .order('filing_date', { ascending: false })
    .limit(100);
  
  if (error) return [];
  return cases || [];
}

function getDefaultJudgeStats() {
  return {
    totalCases: 0,
    dismissedCases: 0,
    disposedCases: 0,
    pendingCases: 0,
    dismissRate: '0.0',
    disposalRate: '0.0',
    avgCaseDuration: 0,
    avgHearings: '0.0',
    caseTypeDistribution: {}
  };
}

// =====================================================
// COURT ROUTES
// =====================================================

export const searchCourts = async (c: Context) => {
  try {
    const searchTerm = c.req.query('q') || '';
    const state = c.req.query('state');
    const type = c.req.query('type');
    
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('courts')
      .select('*')
      .order('rank', { ascending: true, nullsFirst: false });
    
    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }
    
    if (state) {
      query = query.eq('state', state);
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) throw error;
    
    // Enrich with stats
    const courtsWithStats = await Promise.all(data.map(async (court) => {
      const stats = await getCourtStats(court.id);
      return { ...court, stats };
    }));
    
    return c.json({ courts: courtsWithStats });
  } catch (error) {
    console.error('Error searching courts:', error);
    return c.json({ error: 'Failed to search courts' }, 500);
  }
};

export const getCourtById = async (c: Context) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabaseClient();
    
    const { data: court, error } = await supabase
      .from('courts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!court) return c.json({ error: 'Court not found' }, 404);
    
    const stats = await getCourtStats(id);
    const caseHistory = await getCourtCases(id);
    
    return c.json({ court: { ...court, stats, caseHistory } });
  } catch (error) {
    console.error('Error fetching court:', error);
    return c.json({ error: 'Failed to fetch court' }, 500);
  }
};

// Helper: Calculate court stats from master cases table
async function getCourtStats(courtId: string) {
  const supabase = getSupabaseClient();
  
  const { data: cases, error } = await supabase
    .from('cases')
    .select('*')
    .eq('court_id', courtId);
  
  if (error || !cases) return getDefaultCourtStats();
  
  const totalCases = cases.length;
  if (totalCases === 0) return getDefaultCourtStats();
  
  const disposedCases = cases.filter(c => c.status === 'disposed').length;
  const pendingCases = cases.filter(c => c.status === 'pending').length;
  
  const casesWithDuration = cases.filter(c => c.duration_days !== null);
  const avgCaseDuration = casesWithDuration.length > 0
    ? Math.round(casesWithDuration.reduce((sum, c) => sum + c.duration_days, 0) / casesWithDuration.length)
    : 0;
  
  const avgHearings = totalCases > 0
    ? (cases.reduce((sum, c) => sum + (c.total_hearings || 0), 0) / totalCases).toFixed(1)
    : 0;
  
  // Case type distribution
  const caseTypeDistribution = cases.reduce((acc, c) => {
    acc[c.case_type] = (acc[c.case_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalCases,
    disposedCases,
    pendingCases,
    disposalRate: ((disposedCases / totalCases) * 100).toFixed(1),
    avgCaseDuration,
    avgHearings,
    caseTypeDistribution
  };
}

async function getCourtCases(courtId: string) {
  const supabase = getSupabaseClient();
  
  const { data: cases, error } = await supabase
    .from('cases')
    .select('*')
    .eq('court_id', courtId)
    .order('filing_date', { ascending: false })
    .limit(100);
  
  if (error) return [];
  return cases || [];
}

function getDefaultCourtStats() {
  return {
    totalCases: 0,
    disposedCases: 0,
    pendingCases: 0,
    disposalRate: '0.0',
    avgCaseDuration: 0,
    avgHearings: '0.0',
    caseTypeDistribution: {}
  };
}

// =====================================================
// CLAIMING SYSTEM
// =====================================================

export const searchUnclaimedEntities = async (c: Context) => {
  try {
    const searchTerm = c.req.query('q');
    const entityType = c.req.query('type'); // 'lawyer', 'judge', 'court'
    
    if (!searchTerm || !entityType) {
      return c.json({ error: 'Search term and entity type required' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // Search in the respective table
    const { data, error } = await supabase
      .from(entityType === 'lawyer' ? 'lawyers' : entityType === 'judge' ? 'judges' : 'courts')
      .select('*')
      .eq('is_verified', false) // Only unclaimed/unverified entities
      .ilike('name', `%${searchTerm}%`)
      .limit(20);
    
    if (error) throw error;
    
    return c.json({ entities: data });
  } catch (error) {
    console.error('Error searching unclaimed entities:', error);
    return c.json({ error: 'Failed to search' }, 500);
  }
};

export const createCardClaim = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    const body = await c.req.json();
    const { claimed_entity_type, claimed_entity_id, bar_council_certificate_url, id_proof_url } = body;
    
    // Get lawyer ID
    const { data: lawyer } = await supabase!
      .from('lawyers')
      .select('id, name')
      .eq('user_id', user!.id)
      .single();
    
    if (!lawyer) {
      return c.json({ error: 'Lawyer profile not found' }, 404);
    }
    
    // Get claimed entity name
    const tableName = claimed_entity_type === 'lawyer' ? 'lawyers' : 
                      claimed_entity_type === 'judge' ? 'judges' : 'courts';
    
    const { data: entity } = await supabase!
      .from(tableName)
      .select('name')
      .eq('id', claimed_entity_id)
      .single();
    
    // Create claim
    const { data, error } = await supabase!
      .from('card_claims')
      .insert({
        lawyer_id: lawyer.id,
        claimed_entity_type,
        claimed_entity_id,
        claimed_entity_name: entity?.name || 'Unknown',
        bar_council_certificate_url,
        id_proof_url,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return c.json({ claim: data });
  } catch (error) {
    console.error('Error creating card claim:', error);
    return c.json({ error: 'Failed to create claim' }, 500);
  }
};

export const createCaseClaim = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    const body = await c.req.json();
    const { case_id, vakalatnama_url } = body;
    
    // Get lawyer ID
    const { data: lawyer } = await supabase!
      .from('lawyers')
      .select('id')
      .eq('user_id', user!.id)
      .single();
    
    if (!lawyer) {
      return c.json({ error: 'Lawyer profile not found' }, 404);
    }
    
    // Get case number
    const { data: caseData } = await supabase!
      .from('cases')
      .select('case_number')
      .eq('id', case_id)
      .single();
    
    // Create claim
    const { data, error } = await supabase!
      .from('case_claims')
      .insert({
        lawyer_id: lawyer.id,
        case_id,
        case_number: caseData?.case_number || 'Unknown',
        vakalatnama_url,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return c.json({ claim: data });
  } catch (error) {
    console.error('Error creating case claim:', error);
    return c.json({ error: 'Failed to create claim' }, 500);
  }
};

export const getMyCardClaims = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    const { data: lawyer } = await supabase!
      .from('lawyers')
      .select('id')
      .eq('user_id', user!.id)
      .single();
    
    if (!lawyer) {
      return c.json({ error: 'Lawyer profile not found' }, 404);
    }
    
    const { data, error } = await supabase!
      .from('card_claims')
      .select('*')
      .eq('lawyer_id', lawyer.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return c.json({ claims: data });
  } catch (error) {
    console.error('Error fetching card claims:', error);
    return c.json({ error: 'Failed to fetch claims' }, 500);
  }
};

export const getMyCaseClaims = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    const { data: lawyer } = await supabase!
      .from('lawyers')
      .select('id')
      .eq('user_id', user!.id)
      .single();
    
    if (!lawyer) {
      return c.json({ error: 'Lawyer profile not found' }, 404);
    }
    
    const { data, error } = await supabase!
      .from('case_claims')
      .select('*')
      .eq('lawyer_id', lawyer.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return c.json({ claims: data });
  } catch (error) {
    console.error('Error fetching case claims:', error);
    return c.json({ error: 'Failed to fetch claims' }, 500);
  }
};

// Admin routes for managing claims
export const getPendingCardClaims = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    // Verify admin
    const { data: lawyer } = await supabase!
      .from('lawyers')
      .select('is_admin')
      .eq('user_id', user!.id)
      .single();
    
    if (!lawyer?.is_admin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const { data, error } = await supabase!
      .from('card_claims')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return c.json({ claims: data });
  } catch (error) {
    console.error('Error fetching pending card claims:', error);
    return c.json({ error: 'Failed to fetch claims' }, 500);
  }
};

export const getPendingCaseClaims = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    // Verify admin
    const { data: lawyer } = await supabase!
      .from('lawyers')
      .select('is_admin')
      .eq('user_id', user!.id)
      .single();
    
    if (!lawyer?.is_admin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const { data, error } = await supabase!
      .from('case_claims')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return c.json({ claims: data });
  } catch (error) {
    console.error('Error fetching pending case claims:', error);
    return c.json({ error: 'Failed to fetch claims' }, 500);
  }
};

export const reviewCardClaim = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    // Verify admin
    const { data: adminLawyer } = await supabase!
      .from('lawyers')
      .select('id, is_admin')
      .eq('user_id', user!.id)
      .single();
    
    if (!adminLawyer?.is_admin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const claimId = c.req.param('id');
    const body = await c.req.json();
    const { status, admin_notes } = body;
    
    const { data, error } = await supabase!
      .from('card_claims')
      .update({
        status,
        admin_notes,
        reviewed_by: adminLawyer.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', claimId)
      .select()
      .single();
    
    if (error) throw error;
    
    // If approved, merge the entities (mark claimed entity as verified and link to lawyer)
    if (status === 'approved') {
      // Implementation depends on your merge strategy
      // You might want to update the lawyer profile with the claimed entity data
    }
    
    return c.json({ claim: data });
  } catch (error) {
    console.error('Error reviewing card claim:', error);
    return c.json({ error: 'Failed to review claim' }, 500);
  }
};

export const reviewCaseClaim = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    // Verify admin
    const { data: adminLawyer } = await supabase!
      .from('lawyers')
      .select('id, is_admin')
      .eq('user_id', user!.id)
      .single();
    
    if (!adminLawyer?.is_admin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const claimId = c.req.param('id');
    const body = await c.req.json();
    const { status, admin_notes } = body;
    
    const { data, error } = await supabase!
      .from('case_claims')
      .update({
        status,
        admin_notes,
        reviewed_by: adminLawyer.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', claimId)
      .select()
      .single();
    
    if (error) throw error;
    
    // If approved, update the case with the correct lawyer
    if (status === 'approved' && data.case_id && data.lawyer_id) {
      const { data: lawyer } = await supabase!
        .from('lawyers')
        .select('name')
        .eq('id', data.lawyer_id)
        .single();
      
      await supabase!
        .from('cases')
        .update({
          lawyer_id: data.lawyer_id,
          lawyer_name: lawyer?.name,
          verified: true
        })
        .eq('id', data.case_id);
    }
    
    return c.json({ claim: data });
  } catch (error) {
    console.error('Error reviewing case claim:', error);
    return c.json({ error: 'Failed to review claim' }, 500);
  }
};

// =====================================================
// PROFILE MANAGEMENT
// =====================================================

export const updateLawyerProfile = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    const body = await c.req.json();
    
    const { data, error } = await supabase!
      .from('lawyers')
      .update(body)
      .eq('user_id', user!.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return c.json({ lawyer: data });
  } catch (error) {
    console.error('Error updating lawyer profile:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
};

export const getMyProfile = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    // Try to find existing lawyer profile
    let { data, error } = await supabase!
      .from('lawyers')
      .select('*')
      .eq('user_id', user!.id)
      .single();
    
    // If no profile exists, create one automatically
    if (error && error.code === 'PGRST116') {
      console.log('No lawyer profile found, creating one for user:', user!.id);
      
      const { data: newLawyer, error: insertError } = await supabase!
        .from('lawyers')
        .insert({
          user_id: user!.id,
          name: user!.user_metadata?.name || user!.email?.split('@')[0] || 'Unnamed Lawyer',
          email: user!.email,
          phone: user!.user_metadata?.phone || '',
          bar_registration: 'PENDING_VERIFICATION',
          experience: 0,
          specialization: [],
          courts: [],
          bio: 'Professional lawyer - profile being set up',
          address: '',
          is_verified: false
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating lawyer profile:', insertError);
        throw insertError;
      }
      
      data = newLawyer;
    } else if (error) {
      throw error;
    }
    
    // Get stats for the lawyer
    if (data) {
      const stats = await getLawyerStats(data.id);
      return c.json({ lawyer: { ...data, stats } });
    }
    
    return c.json({ error: 'Failed to fetch profile' }, 500);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
};

// =====================================================
// CSV IMPORT FUNCTIONALITY
// =====================================================

interface CaseImportRow {
  case_number: string;
  case_title: string;
  case_type: string;
  court_name: string;
  judge_name: string;
  petitioner_lawyers: string; // Comma-separated
  respondent_lawyers: string; // Comma-separated
  filing_date: string;
  judgment_date?: string;
  status: string;
  outcome?: string;
  petitioner_name: string;
  respondent_name: string;
  total_hearings?: number;
  first_hearing_date?: string;
  last_hearing_date?: string;
  summary?: string;
  petitioner_lawyer_roles?: string; // Comma-separated
  respondent_lawyer_roles?: string; // Comma-separated
}

interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export const importCasesFromCSV = async (c: Context) => {
  try {
    const { error: authError, user, supabase } = await verifyAuth(c);
    if (authError) return c.json({ error: authError }, 401);
    
    // Verify admin
    const { data: lawyer } = await supabase!
      .from('lawyers')
      .select('is_admin')
      .eq('user_id', user!.id)
      .single();
    
    if (!lawyer?.is_admin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const body = await c.req.json();
    const { cases } = body as { cases: CaseImportRow[] };
    
    if (!cases || !Array.isArray(cases) || cases.length === 0) {
      return c.json({ error: 'No cases data provided' }, 400);
    }
    
    // Validate and process cases
    const validationErrors: ImportValidationError[] = [];
    const processedCases: any[] = [];
    const newLawyers: Set<string> = new Set();
    const newJudges: Set<string> = new Set();
    const newCourts: Set<string> = new Set();
    
    for (let i = 0; i < cases.length; i++) {
      const row = cases[i];
      const rowNumber = i + 2; // +2 for header row and 0-indexing
      
      // Validate required fields
      const validationResult = validateCaseRow(row, rowNumber);
      if (validationResult.length > 0) {
        validationErrors.push(...validationResult);
        continue; // Skip invalid row
      }
      
      // Parse dates
      const filingDate = parseDate(row.filing_date);
      const judgmentDate = row.judgment_date ? parseDate(row.judgment_date) : null;
      
      if (!filingDate) {
        validationErrors.push({ row: rowNumber, field: 'filing_date', message: 'Invalid date format' });
        continue;
      }
      
      // Parse lawyers
      const petitionerLawyers = row.petitioner_lawyers
        ? row.petitioner_lawyers.split(',').map(l => l.trim()).filter(l => l)
        : [];
      const respondentLawyers = row.respondent_lawyers
        ? row.respondent_lawyers.split(',').map(l => l.trim()).filter(l => l)
        : [];
      
      if (petitionerLawyers.length === 0 && respondentLawyers.length === 0) {
        validationErrors.push({ row: rowNumber, field: 'lawyers', message: 'At least one lawyer required' });
        continue;
      }
      
      // Track new entities
      newCourts.add(row.court_name);
      newJudges.add(row.judge_name);
      petitionerLawyers.forEach(l => newLawyers.add(l));
      respondentLawyers.forEach(l => newLawyers.add(l));
      
      // Calculate duration
      const duration = judgmentDate && filingDate
        ? Math.floor((judgmentDate.getTime() - filingDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      processedCases.push({
        ...row,
        filingDate,
        judgmentDate,
        duration,
        petitionerLawyers,
        respondentLawyers
      });
    }
    
    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return c.json({
        success: false,
        validationErrors,
        summary: {
          totalRows: cases.length,
          validRows: processedCases.length,
          errorRows: validationErrors.length
        }
      }, 400);
    }
    
    // Create new entities first
    await createMissingEntities(supabase!, {
      courts: Array.from(newCourts),
      judges: Array.from(newJudges),
      lawyers: Array.from(newLawyers)
    });
    
    // Import cases
    const importResults = await importProcessedCases(supabase!, processedCases);
    
    // Recalculate rankings
    await supabase!.rpc('calculate_lawyer_ranks');
    await supabase!.rpc('calculate_judge_ranks');
    await supabase!.rpc('calculate_court_ranks');
    
    return c.json({
      success: true,
      summary: {
        totalRows: cases.length,
        successfulImports: importResults.successful,
        failedImports: importResults.failed,
        newEntities: {
          lawyers: importResults.newLawyers,
          judges: importResults.newJudges,
          courts: importResults.newCourts
        }
      },
      errors: importResults.errors
    });
  } catch (error) {
    console.error('Error importing cases:', error);
    return c.json({ error: 'Failed to import cases' }, 500);
  }
};

function validateCaseRow(row: CaseImportRow, rowNumber: number): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  
  if (!row.case_number) {
    errors.push({ row: rowNumber, field: 'case_number', message: 'Required' });
  }
  if (!row.case_title) {
    errors.push({ row: rowNumber, field: 'case_title', message: 'Required' });
  }
  if (!row.case_type) {
    errors.push({ row: rowNumber, field: 'case_type', message: 'Required' });
  }
  if (!row.court_name) {
    errors.push({ row: rowNumber, field: 'court_name', message: 'Required' });
  }
  if (!row.judge_name) {
    errors.push({ row: rowNumber, field: 'judge_name', message: 'Required' });
  }
  if (!row.filing_date) {
    errors.push({ row: rowNumber, field: 'filing_date', message: 'Required' });
  }
  if (!row.petitioner_name) {
    errors.push({ row: rowNumber, field: 'petitioner_name', message: 'Required' });
  }
  if (!row.respondent_name) {
    errors.push({ row: rowNumber, field: 'respondent_name', message: 'Required' });
  }
  if (!row.status || !['disposed', 'pending'].includes(row.status.toLowerCase())) {
    errors.push({ row: rowNumber, field: 'status', message: 'Must be "disposed" or "pending"' });
  }
  if (row.status?.toLowerCase() === 'disposed') {
    if (!row.judgment_date) {
      errors.push({ row: rowNumber, field: 'judgment_date', message: 'Required for disposed cases' });
    }
    if (!row.outcome) {
      errors.push({ row: rowNumber, field: 'outcome', message: 'Required for disposed cases' });
    } else if (!['In favor of Complainant', 'In favor of Respondent', 'Settled', 'Dismissed', 'Partially Granted', 'Withdrawn'].includes(row.outcome)) {
      errors.push({ row: rowNumber, field: 'outcome', message: 'Must be one of: In favor of Complainant, In favor of Respondent, Settled, Dismissed, Partially Granted, Withdrawn' });
    }
  }
  
  return errors;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try multiple date formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        // YYYY-MM-DD
        return new Date(`${match[1]}-${match[2]}-${match[3]}`);
      } else {
        // DD/MM/YYYY or DD-MM-YYYY
        return new Date(`${match[3]}-${match[2]}-${match[1]}`);
      }
    }
  }
  
  // Fallback to built-in parser
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

async function createMissingEntities(
  supabase: any,
  entities: { courts: string[]; judges: string[]; lawyers: string[] }
) {
  // Get existing entities
  const { data: existingCourts } = await supabase
    .from('courts')
    .select('name')
    .in('name', entities.courts);
  
  const { data: existingJudges } = await supabase
    .from('judges')
    .select('name')
    .in('name', entities.judges);
  
  const { data: existingLawyers } = await supabase
    .from('lawyers')
    .select('name')
    .in('name', entities.lawyers);
  
  const existingCourtNames = new Set(existingCourts?.map(c => c.name) || []);
  const existingJudgeNames = new Set(existingJudges?.map(j => j.name) || []);
  const existingLawyerNames = new Set(existingLawyers?.map(l => l.name) || []);
  
  // Create missing courts
  const newCourts = entities.courts.filter(c => !existingCourtNames.has(c));
  if (newCourts.length > 0) {
    await supabase
      .from('courts')
      .insert(newCourts.map(name => ({
        name,
        type: 'District Court',
        state: 'Unknown',
        city: 'Unknown'
      })));
  }
  
  // Create missing judges
  const newJudges = entities.judges.filter(j => !existingJudgeNames.has(j));
  if (newJudges.length > 0) {
    await supabase
      .from('judges')
      .insert(newJudges.map(name => ({
        name,
        designation: 'Judge',
        courts: []
      })));
  }
  
  // Create missing lawyers
  const newLawyers = entities.lawyers.filter(l => !existingLawyerNames.has(l));
  if (newLawyers.length > 0) {
    await supabase
      .from('lawyers')
      .insert(newLawyers.map(name => ({
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@unverified.example.com`,
        bar_registration: 'PENDING_VERIFICATION',
        experience: 0,
        specialization: [],
        courts: [],
        is_verified: false
      })));
  }
}

async function importProcessedCases(supabase: any, cases: any[]) {
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];
  const newLawyers = new Set();
  const newJudges = new Set();
  const newCourts = new Set();
  
  for (const caseData of cases) {
    try {
      // Get court ID
      const { data: court } = await supabase
        .from('courts')
        .select('id, name')
        .eq('name', caseData.court_name)
        .single();
      
      // Get judge ID
      const { data: judge } = await supabase
        .from('judges')
        .select('id, name')
        .eq('name', caseData.judge_name)
        .single();
      
      if (!court || !judge) {
        failed++;
        errors.push(`Case ${caseData.case_number}: Court or judge not found`);
        continue;
      }
      
      // Create case
      const { data: insertedCase, error: caseError } = await supabase
        .from('cases')
        .insert({
          case_number: caseData.case_number,
          case_title: caseData.case_title,
          case_type: caseData.case_type,
          court_id: court.id,
          court_name: court.name,
          judge_id: judge.id,
          judge_name: judge.name,
          filing_date: caseData.filingDate.toISOString().split('T')[0],
          judgment_date: caseData.judgmentDate ? caseData.judgmentDate.toISOString().split('T')[0] : null,
          first_hearing_date: caseData.first_hearing_date || null,
          last_hearing_date: caseData.last_hearing_date || null,
          total_hearings: caseData.total_hearings || 0,
          status: caseData.status.toLowerCase(),
          outcome: caseData.outcome || null,
          petitioner_name: caseData.petitioner_name,
          respondent_name: caseData.respondent_name,
          summary: caseData.summary || '',
          duration_days: caseData.duration,
          verified: false
        })
        .select()
        .single();
      
      if (caseError || !insertedCase) {
        failed++;
        errors.push(`Case ${caseData.case_number}: ${caseError?.message || 'Failed to insert'}`);
        continue;
      }
      
      // Add petitioner lawyers
      for (let i = 0; i < caseData.petitionerLawyers.length; i++) {
        const lawyerName = caseData.petitionerLawyers[i];
        const { data: lawyer } = await supabase
          .from('lawyers')
          .select('id, name')
          .eq('name', lawyerName)
          .single();
        
        if (lawyer) {
          await supabase
            .from('case_lawyers')
            .insert({
              case_id: insertedCase.id,
              lawyer_id: lawyer.id,
              lawyer_name: lawyer.name,
              representation_side: 'Petitioner',
              lawyer_role: i === 0 ? 'Lead Counsel' : 'Counsel'
            });
        }
      }
      
      // Add respondent lawyers
      for (let i = 0; i < caseData.respondentLawyers.length; i++) {
        const lawyerName = caseData.respondentLawyers[i];
        const { data: lawyer } = await supabase
          .from('lawyers')
          .select('id, name')
          .eq('name', lawyerName)
          .single();
        
        if (lawyer) {
          await supabase
            .from('case_lawyers')
            .insert({
              case_id: insertedCase.id,
              lawyer_id: lawyer.id,
              lawyer_name: lawyer.name,
              representation_side: 'Respondent',
              lawyer_role: i === 0 ? 'Lead Counsel' : 'Counsel'
            });
        }
      }
      
      successful++;
    } catch (error: any) {
      failed++;
      errors.push(`Case ${caseData.case_number}: ${error.message}`);
    }
  }
  
  return {
    successful,
    failed,
    errors,
    newLawyers: newLawyers.size,
    newJudges: newJudges.size,
    newCourts: newCourts.size
  };
}

// Get CSV template
export const downloadCSVTemplate = async (c: Context) => {
  const template = `case_number,case_title,case_type,court_name,judge_name,petitioner_lawyers,respondent_lawyers,filing_date,judgment_date,status,outcome,petitioner_name,respondent_name,total_hearings,summary
CASE/000001/2024,Sample Criminal Case,Criminal,Supreme Court of India,Hon'ble Justice A.K. Sharma,\"Adv. Rajesh Kumar, Adv. Priya Sharma\",Adv. Anil Verma,2024-01-15,2024-06-20,disposed,In favor of Complainant,State of Delhi,John Doe,15,Sample criminal case
CASE/000002/2024,Sample Civil Case,Civil,Delhi High Court,Hon'ble Justice B.K. Singh,Adv. Sunita Desai,\"Adv. Rajesh Kumar, Adv. Maya Iyer\",2023-11-10,2024-03-25,disposed,Settled,ABC Corporation,XYZ Limited,8,Sample civil case
CASE/000003/2024,Sample Pending Case,Property,District Court Saket,Shri R.P. Gupta,Adv. Priya Sharma,Adv. Anil Verma,2024-02-01,,pending,,Ramesh Kumar,Suresh Patel,5,Ongoing property dispute
CASE/000004/2024,Sample Dismissed Case,Civil,Delhi High Court,Hon'ble Justice B.K. Singh,Adv. Rajesh Kumar,Adv. Sunita Desai,2024-01-10,2024-05-15,disposed,Dismissed,XYZ Private Ltd,ABC Corporation,8,Case dismissed - respondent wins`
  
  return new Response(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="case_import_template.csv"'
    }
  });
};

// =====================================================
// ADMIN MANAGEMENT
// =====================================================

import * as kv from './kv_store.tsx';

// Check if current user is admin
export const checkIsAdmin = async (c: Context) => {
  try {
    const { error: authError, user } = await verifyAuth(c);
    
    if (authError || !user) {
      return c.json({ isAdmin: false, error: 'Unauthorized' }, 401);
    }
    
    // Check admin status in KV store
    const adminStatus = await kv.get(`admin:${user.id}`);
    
    return c.json({ 
      isAdmin: adminStatus === 'true',
      userId: user.id,
      email: user.email
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return c.json({ isAdmin: false, error: 'Failed to check admin status' }, 500);
  }
};

// Set admin status for a user
export const setAdminStatus = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { userId, email, isAdmin } = body;
    
    if (!userId && !email) {
      return c.json({ error: 'Either userId or email is required' }, 400);
    }
    
    // This endpoint can be called in two ways:
    // 1. With service role key (no auth header) - for initial setup
    // 2. With existing admin auth - for admin to create other admins
    
    const authHeader = c.req.header('Authorization');
    const supabase = getSupabaseClient(authHeader);
    
    let targetUserId = userId;
    
    // If email provided instead of userId, look up the user
    if (!targetUserId && email) {
      // Use service role to look up user by email
      const serviceSupabase = getSupabaseClient();
      const { data: { users }, error: listError } = await serviceSupabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
        return c.json({ error: 'Failed to find user' }, 500);
      }
      
      const foundUser = users?.find(u => u.email === email);
      if (!foundUser) {
        return c.json({ error: 'User not found with that email' }, 404);
      }
      
      targetUserId = foundUser.id;
    }
    
    // If using auth header (not service role), verify caller is admin
    if (authHeader && !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Check if caller is admin
      const callerAdminStatus = await kv.get(`admin:${user.id}`);
      if (callerAdminStatus !== 'true') {
        return c.json({ error: 'Only admins can set admin status' }, 403);
      }
    }
    
    // Set admin status in KV store
    if (isAdmin) {
      await kv.set(`admin:${targetUserId}`, 'true');
    } else {
      await kv.del(`admin:${targetUserId}`);
    }
    
    return c.json({ 
      success: true,
      userId: targetUserId,
      isAdmin,
      message: `Admin status ${isAdmin ? 'granted' : 'revoked'} successfully`
    });
  } catch (error) {
    console.error('Error setting admin status:', error);
    return c.json({ error: 'Failed to set admin status' }, 500);
  }
};