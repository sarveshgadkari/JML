// Card merging utility functions for Judge My Lawyer platform

export interface LawyerCard {
  id: string;
  name_in_judgment: string;
  preferred_name?: string;
  status: 'unclaimed' | 'claimed' | 'merged';
  is_master_card: boolean;
  merged_into_card_id?: string;
  claimed_by_lawyer_id?: string;
  total_cases: number;
  cases_won: number;
  cases_lost: number;
  cases_settled: number;
  win_rate: number;
  bar_registration_number?: string;
  court_name: string;
  specialization?: string[];
  years_of_experience?: number;
}

export interface MergeResult {
  master_card_id: string;
  merged_card_ids: string[];
  aggregated_stats: {
    total_cases: number;
    cases_won: number;
    cases_lost: number;
    cases_settled: number;
    win_rate: number;
  };
}

/**
 * Aggregates statistics from multiple lawyer cards
 */
export function aggregateCardStats(cards: LawyerCard[]) {
  const totalCases = cards.reduce((sum, card) => sum + card.total_cases, 0);
  const casesWon = cards.reduce((sum, card) => sum + card.cases_won, 0);
  const casesLost = cards.reduce((sum, card) => sum + card.cases_lost, 0);
  const casesSettled = cards.reduce((sum, card) => sum + card.cases_settled, 0);
  const winRate = totalCases > 0 ? parseFloat(((casesWon / totalCases) * 100).toFixed(2)) : 0;

  return {
    total_cases: totalCases,
    cases_won: casesWon,
    cases_lost: casesLost,
    cases_settled: casesSettled,
    win_rate: winRate,
  };
}

/**
 * Selects the master card from a list of cards (highest case count)
 */
export function selectMasterCard(cards: LawyerCard[]): LawyerCard {
  return cards.reduce((master, card) => 
    card.total_cases > master.total_cases ? card : master
  );
}

/**
 * Merges multiple lawyer cards into one master card
 * This function should be called after admin approval
 * 
 * @param supabase - Supabase client
 * @param lawyerId - Lawyer's UUID
 * @param cardIds - Array of card IDs to merge
 * @param preferredName - Lawyer's preferred display name
 */
export async function mergeLawyerCards(
  supabase: any, // Replace with Supabase client type
  lawyerId: string,
  cardIds: string[],
  preferredName: string
): Promise<MergeResult> {
  try {
    // 1. Fetch all cards to merge
    const { data: cards, error: fetchError } = await supabase
      .from('lawyer_cards')
      .select('*')
      .in('id', cardIds);

    if (fetchError) throw fetchError;
    if (!cards || cards.length === 0) throw new Error('No cards found');

    // 2. Select master card (highest case count)
    const masterCard = selectMasterCard(cards);
    const masterCardId = masterCard.id;

    // 3. Aggregate statistics
    const aggregatedStats = aggregateCardStats(cards);

    // 4. Update master card
    const { error: updateMasterError } = await supabase
      .from('lawyer_cards')
      .update({
        preferred_name: preferredName,
        status: 'merged',
        is_master_card: true,
        claimed_by_lawyer_id: lawyerId,
        total_cases: aggregatedStats.total_cases,
        cases_won: aggregatedStats.cases_won,
        cases_lost: aggregatedStats.cases_lost,
        cases_settled: aggregatedStats.cases_settled,
        win_rate: aggregatedStats.win_rate,
        merged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', masterCardId);

    if (updateMasterError) throw updateMasterError;

    // 5. Update other cards to point to master
    const otherCardIds = cardIds.filter(id => id !== masterCardId);
    
    if (otherCardIds.length > 0) {
      const { error: updateOthersError } = await supabase
        .from('lawyer_cards')
        .update({
          status: 'merged',
          is_master_card: false,
          merged_into_card_id: masterCardId,
          merged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', otherCardIds);

      if (updateOthersError) throw updateOthersError;
    }

    // 6. Create merge group record
    const { error: mergeGroupError } = await supabase
      .from('card_merge_groups')
      .insert({
        lawyer_id: lawyerId,
        master_card_id: masterCardId,
        preferred_name: preferredName,
        merged_card_ids: cardIds,
        total_cases: aggregatedStats.total_cases,
        cases_won: aggregatedStats.cases_won,
        cases_lost: aggregatedStats.cases_lost,
        cases_settled: aggregatedStats.cases_settled,
        win_rate: aggregatedStats.win_rate,
      });

    if (mergeGroupError) throw mergeGroupError;

    // 7. Update lawyer record
    const { error: updateLawyerError } = await supabase
      .from('lawyers')
      .update({
        master_card_id: masterCardId,
        has_claimed_cards: true,
        verified: true,
      })
      .eq('id', lawyerId);

    if (updateLawyerError) throw updateLawyerError;

    // 8. Update all associated card_claims to 'approved'
    const { error: updateClaimsError } = await supabase
      .from('card_claims')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .in('card_id', cardIds)
      .eq('lawyer_id', lawyerId);

    if (updateClaimsError) throw updateClaimsError;

    return {
      master_card_id: masterCardId,
      merged_card_ids: cardIds,
      aggregated_stats: aggregatedStats,
    };
  } catch (error) {
    console.error('Error merging cards:', error);
    throw error;
  }
}

/**
 * Approves a single card claim
 */
export async function approveCardClaim(
  supabase: any,
  claimId: string,
  adminId: string
): Promise<void> {
  const { error } = await supabase
    .from('card_claims')
    .update({
      status: 'approved',
      reviewed_by_admin_id: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', claimId);

  if (error) throw error;
}

/**
 * Rejects a card claim
 */
export async function rejectCardClaim(
  supabase: any,
  claimId: string,
  adminId: string,
  rejectionReason: string
): Promise<void> {
  const { error } = await supabase
    .from('card_claims')
    .update({
      status: 'rejected',
      reviewed_by_admin_id: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason,
    })
    .eq('id', claimId);

  if (error) throw error;
}

/**
 * Submits a card claim
 */
export async function submitCardClaim(
  supabase: any,
  lawyerId: string,
  cardId: string,
  preferredName: string,
  barRegistrationNumber?: string,
  notes?: string,
  proofDocumentUrl?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('card_claims')
    .insert({
      lawyer_id: lawyerId,
      card_id: cardId,
      preferred_name: preferredName,
      bar_registration_number: barRegistrationNumber,
      notes: notes,
      proof_document_url: proofDocumentUrl,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Fetches unclaimed cards matching a search term
 */
export async function searchUnclaimedCards(
  supabase: any,
  searchTerm: string,
  limit: number = 50
): Promise<LawyerCard[]> {
  const { data, error } = await supabase
    .from('lawyer_cards')
    .select('*')
    .eq('status', 'unclaimed')
    .ilike('name_in_judgment', `%${searchTerm}%`)
    .order('total_cases', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Fetches all claims for a lawyer
 */
export async function getLawyerClaims(
  supabase: any,
  lawyerId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('card_claims')
    .select(`
      *,
      card:lawyer_cards(*)
    `)
    .eq('lawyer_id', lawyerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Fetches pending claims for admin review
 * Groups claims by lawyer for batch processing
 */
export async function getPendingClaimsGrouped(
  supabase: any
): Promise<Record<string, any[]>> {
  const { data, error } = await supabase
    .from('card_claims')
    .select(`
      *,
      card:lawyer_cards(*),
      lawyer:lawyers(*)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Group by lawyer_id
  const grouped = (data || []).reduce((acc: Record<string, any[]>, claim: any) => {
    if (!acc[claim.lawyer_id]) {
      acc[claim.lawyer_id] = [];
    }
    acc[claim.lawyer_id].push(claim);
    return acc;
  }, {});

  return grouped;
}

/**
 * Fetches a lawyer's merged card (master card)
 */
export async function getLawyerMasterCard(
  supabase: any,
  lawyerId: string
): Promise<LawyerCard | null> {
  const { data, error } = await supabase
    .from('lawyer_cards')
    .select('*')
    .eq('claimed_by_lawyer_id', lawyerId)
    .eq('is_master_card', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows returned
    throw error;
  }

  return data;
}

/**
 * Checks if a card has pending claims
 */
export async function hasCardPendingClaims(
  supabase: any,
  cardId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('card_claims')
    .select('id')
    .eq('card_id', cardId)
    .eq('status', 'pending')
    .limit(1);

  if (error) throw error;
  return (data || []).length > 0;
}

/**
 * Gets card merge history
 */
export async function getCardMergeHistory(
  supabase: any,
  masterCardId: string
): Promise<any> {
  const { data, error } = await supabase
    .from('card_merge_groups')
    .select(`
      *,
      lawyer:lawyers(name, email),
      cards:lawyer_cards(*)
    `)
    .eq('master_card_id', masterCardId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Validates if cards belong to same lawyer based on similarity
 * Returns confidence score (0-100)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const normalize = (str: string) => 
    str.toLowerCase()
      .replace(/adv\.|advocate|mr\.|ms\.|mrs\.|shri|smt\.|dr\./gi, '')
      .replace(/[^a-z\s]/g, '')
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 100;

  // Check if one name contains the other
  if (n1.includes(n2) || n2.includes(n1)) return 80;

  // Check word overlap
  const words1 = n1.split(/\s+/);
  const words2 = n2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));
  
  const overlapRatio = (commonWords.length * 2) / (words1.length + words2.length);
  return Math.round(overlapRatio * 100);
}

/**
 * Suggests potential duplicate cards for a given card
 */
export async function suggestDuplicateCards(
  supabase: any,
  cardId: string,
  minSimilarity: number = 60
): Promise<Array<LawyerCard & { similarity: number }>> {
  // Fetch the source card
  const { data: sourceCard, error: sourceError } = await supabase
    .from('lawyer_cards')
    .select('*')
    .eq('id', cardId)
    .single();

  if (sourceError) throw sourceError;

  // Fetch potential duplicates (same court or similar case counts)
  const { data: candidates, error: candidatesError } = await supabase
    .from('lawyer_cards')
    .select('*')
    .eq('status', 'unclaimed')
    .neq('id', cardId);

  if (candidatesError) throw candidatesError;

  // Calculate similarity and filter
  const suggestions = (candidates || [])
    .map(card => ({
      ...card,
      similarity: calculateNameSimilarity(sourceCard.name_in_judgment, card.name_in_judgment)
    }))
    .filter(card => card.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity);

  return suggestions;
}
