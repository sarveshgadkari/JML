import { useState } from 'react';
import { Check, X, Eye, AlertTriangle, User, Scale, TrendingUp, Mail, Phone } from 'lucide-react';

interface PendingClaim {
  id: string;
  lawyer_id: string;
  lawyer_name: string;
  lawyer_email: string;
  lawyer_phone?: string;
  card_id: string;
  card_name: string;
  preferred_name: string;
  bar_registration_number: string;
  notes?: string;
  created_at: string;
  
  // Card statistics
  total_cases: number;
  cases_won: number;
  cases_lost: number;
  cases_settled: number;
  win_rate: number;
  court_name: string;
}

interface GroupedClaims {
  lawyer_id: string;
  lawyer_name: string;
  lawyer_email: string;
  preferred_name: string;
  bar_registration_number: string;
  claims: PendingClaim[];
  aggregated_stats: {
    total_cases: number;
    cases_won: number;
    cases_lost: number;
    cases_settled: number;
    win_rate: number;
  };
}

export default function AdminClaimsApproval() {
  const [selectedGroup, setSelectedGroup] = useState<GroupedClaims | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock data - Replace with actual Supabase query
  const mockClaims: PendingClaim[] = [
    {
      id: 'claim-1',
      lawyer_id: 'lawyer-1',
      lawyer_name: 'Rajesh Kumar',
      lawyer_email: 'rajesh.kumar@example.com',
      lawyer_phone: '+91 98765 43210',
      card_id: 'card-1',
      card_name: 'Adv. Rajesh Kumar',
      preferred_name: 'Rajesh Kumar',
      bar_registration_number: 'D/1234/2010',
      total_cases: 156,
      cases_won: 98,
      cases_lost: 42,
      cases_settled: 16,
      win_rate: 62.82,
      court_name: 'Delhi High Court',
      created_at: '2026-01-08T10:30:00Z',
      notes: 'This is my primary practice name at Delhi High Court'
    },
    {
      id: 'claim-2',
      lawyer_id: 'lawyer-1',
      lawyer_name: 'Rajesh Kumar',
      lawyer_email: 'rajesh.kumar@example.com',
      card_id: 'card-2',
      card_name: 'R. Kumar (Advocate)',
      preferred_name: 'Rajesh Kumar',
      bar_registration_number: 'D/1234/2010',
      total_cases: 87,
      cases_won: 54,
      cases_lost: 28,
      cases_settled: 5,
      win_rate: 62.07,
      court_name: 'Delhi District Court',
      created_at: '2026-01-08T10:32:00Z'
    },
    {
      id: 'claim-3',
      lawyer_id: 'lawyer-1',
      lawyer_name: 'Rajesh Kumar',
      lawyer_email: 'rajesh.kumar@example.com',
      card_id: 'card-3',
      card_name: 'Shri Rajesh Kumar',
      preferred_name: 'Rajesh Kumar',
      bar_registration_number: 'D/1234/2010',
      total_cases: 43,
      cases_won: 29,
      cases_lost: 12,
      cases_settled: 2,
      win_rate: 67.44,
      court_name: 'Delhi High Court',
      created_at: '2026-01-08T10:33:00Z'
    },
    {
      id: 'claim-4',
      lawyer_id: 'lawyer-2',
      lawyer_name: 'Priya Sharma',
      lawyer_email: 'priya.sharma@example.com',
      card_id: 'card-4',
      card_name: 'Ms. P. Sharma',
      preferred_name: 'Priya Sharma',
      bar_registration_number: 'M/5678/2015',
      total_cases: 72,
      cases_won: 48,
      cases_lost: 18,
      cases_settled: 6,
      win_rate: 66.67,
      court_name: 'Mumbai High Court',
      created_at: '2026-01-09T14:20:00Z',
      notes: 'I practice primarily in corporate law'
    }
  ];

  // Group claims by lawyer
  const groupedClaims: GroupedClaims[] = Object.values(
    mockClaims.reduce((acc, claim) => {
      if (!acc[claim.lawyer_id]) {
        acc[claim.lawyer_id] = {
          lawyer_id: claim.lawyer_id,
          lawyer_name: claim.lawyer_name,
          lawyer_email: claim.lawyer_email,
          preferred_name: claim.preferred_name,
          bar_registration_number: claim.bar_registration_number,
          claims: [],
          aggregated_stats: {
            total_cases: 0,
            cases_won: 0,
            cases_lost: 0,
            cases_settled: 0,
            win_rate: 0
          }
        };
      }
      acc[claim.lawyer_id].claims.push(claim);
      
      // Update aggregated stats
      acc[claim.lawyer_id].aggregated_stats.total_cases += claim.total_cases;
      acc[claim.lawyer_id].aggregated_stats.cases_won += claim.cases_won;
      acc[claim.lawyer_id].aggregated_stats.cases_lost += claim.cases_lost;
      acc[claim.lawyer_id].aggregated_stats.cases_settled += claim.cases_settled;
      
      return acc;
    }, {} as Record<string, GroupedClaims>)
  );

  // Calculate win rate for aggregated stats
  groupedClaims.forEach(group => {
    const { total_cases, cases_won } = group.aggregated_stats;
    group.aggregated_stats.win_rate = total_cases > 0 
      ? parseFloat(((cases_won / total_cases) * 100).toFixed(2))
      : 0;
  });

  const handleApproveClaims = async () => {
    if (!selectedGroup) return;

    setLoading(true);

    // TODO: Replace with actual Supabase calls
    // 1. Call merge_lawyer_cards() function
    // 2. Update all card_claims to 'approved'
    // 3. Update lawyer record with master_card_id

    setTimeout(() => {
      setLoading(false);
      setShowApproveModal(false);
      setSelectedGroup(null);
      alert(`Successfully merged ${selectedGroup.claims.length} cards for ${selectedGroup.lawyer_name}`);
    }, 1500);
  };

  const handleRejectClaim = async (claimId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setLoading(true);

    // TODO: Replace with actual Supabase update
    // Update card_claims set status='rejected', rejection_reason=...

    setTimeout(() => {
      setLoading(false);
      setShowRejectModal(false);
      setRejectionReason('');
      alert('Claim rejected successfully');
    }, 1000);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1a2332] mb-2">Card Claims Approval</h1>
        <p className="text-[#5f6368]">
          Review and approve lawyer card merge requests
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#e0e3e7] p-4 shadow-sm">
          <p className="text-sm text-[#5f6368] mb-1">Pending Lawyers</p>
          <p className="text-3xl font-bold text-[#1a2332]">{groupedClaims.length}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
          <p className="text-sm text-amber-700 mb-1">Total Claims</p>
          <p className="text-3xl font-bold text-amber-900">{mockClaims.length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm">
          <p className="text-sm text-blue-700 mb-1">Cards to Merge</p>
          <p className="text-3xl font-bold text-blue-900">{mockClaims.length}</p>
        </div>
      </div>

      {/* Grouped Claims List */}
      <div className="space-y-6">
        {groupedClaims.map(group => (
          <div
            key={group.lawyer_id}
            className="bg-white rounded-2xl border-2 border-[#e0e3e7] shadow-sm hover:shadow-lg transition-shadow"
          >
            {/* Lawyer Header */}
            <div className="p-6 border-b border-[#e0e3e7] bg-gradient-to-r from-blue-50 to-white">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#1e3a8a] rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#1a2332] mb-1">{group.lawyer_name}</h2>
                    <div className="flex items-center gap-4 text-sm text-[#5f6368]">
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        <span>{group.lawyer_email}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Scale className="w-4 h-4" />
                        <span>Bar: {group.bar_registration_number}</span>
                      </div>
                    </div>
                    <p className="text-sm text-[#1a2332] mt-2">
                      Preferred Name: <span className="font-bold text-[#1e3a8a]">{group.preferred_name}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedGroup(group)}
                    className="px-4 py-2 bg-blue-100 text-[#1e3a8a] rounded-lg hover:bg-blue-200 transition-colors font-semibold flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Review
                  </button>
                </div>
              </div>
            </div>

            {/* Aggregated Stats Preview */}
            <div className="p-6 bg-gradient-to-r from-[#1e3a8a] to-[#3b82f6] text-white">
              <h3 className="font-bold mb-3">Merged Profile Stats (After Approval)</h3>
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-sm text-white/80">Total Cases</p>
                  <p className="text-2xl font-bold">{group.aggregated_stats.total_cases}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-sm text-white/80">Won</p>
                  <p className="text-2xl font-bold">{group.aggregated_stats.cases_won}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-sm text-white/80">Lost</p>
                  <p className="text-2xl font-bold">{group.aggregated_stats.cases_lost}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-sm text-white/80">Settled</p>
                  <p className="text-2xl font-bold">{group.aggregated_stats.cases_settled}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-sm text-white/80">Win Rate</p>
                  <p className="text-2xl font-bold">{group.aggregated_stats.win_rate}%</p>
                </div>
              </div>
            </div>

            {/* Individual Cards */}
            <div className="p-6">
              <h3 className="font-bold text-[#1a2332] mb-3">
                Cards to Merge ({group.claims.length})
              </h3>
              <div className="space-y-3">
                {group.claims.map((claim, index) => (
                  <div
                    key={claim.id}
                    className="p-4 bg-gray-50 rounded-xl border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="w-6 h-6 bg-[#1e3a8a] text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </span>
                          <h4 className="font-bold text-[#1a2332]">{claim.card_name}</h4>
                          <span className="text-xs text-[#5f6368]">{claim.court_name}</span>
                        </div>

                        <div className="grid grid-cols-5 gap-3 ml-9">
                          <div>
                            <p className="text-xs text-[#5f6368]">Cases</p>
                            <p className="font-semibold">{claim.total_cases}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#5f6368]">Won</p>
                            <p className="font-semibold text-green-600">{claim.cases_won}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#5f6368]">Lost</p>
                            <p className="font-semibold text-red-600">{claim.cases_lost}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#5f6368]">Settled</p>
                            <p className="font-semibold text-blue-600">{claim.cases_settled}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#5f6368]">Win Rate</p>
                            <p className="font-semibold text-[#1e3a8a]">{claim.win_rate}%</p>
                          </div>
                        </div>

                        {claim.notes && (
                          <div className="ml-9 mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
                            <span className="font-semibold">Note:</span> {claim.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-[#e0e3e7] bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedGroup(group);
                  setShowRejectModal(true);
                }}
                className="px-6 py-3 bg-white border-2 border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors font-bold flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                Reject All
              </button>
              <button
                onClick={() => {
                  setSelectedGroup(group);
                  setShowApproveModal(true);
                }}
                className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-bold flex items-center gap-2"
              >
                <Check className="w-5 h-5" />
                Approve & Merge {group.claims.length} Cards
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {groupedClaims.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#e0e3e7] p-12 shadow-sm text-center">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#1a2332] mb-2">All Caught Up!</h3>
          <p className="text-[#5f6368]">
            There are no pending card claims to review at this time.
          </p>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-[#e0e3e7]">
              <h2 className="text-2xl font-bold text-[#1a2332]">Approve Card Merge</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-green-900 mb-1">Confirm Merge Action</p>
                    <p className="text-sm text-green-800">
                      You are about to merge <span className="font-bold">{selectedGroup.claims.length} cards</span> for{' '}
                      <span className="font-bold">{selectedGroup.lawyer_name}</span> into a single profile with preferred name{' '}
                      "<span className="font-bold">{selectedGroup.preferred_name}</span>".
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="font-bold text-blue-900 mb-2">After approval:</p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>All {selectedGroup.claims.length} cards will be merged into one master card</li>
                  <li>Statistics will be aggregated: {selectedGroup.aggregated_stats.total_cases} total cases, {selectedGroup.aggregated_stats.win_rate}% win rate</li>
                  <li>The lawyer's profile will be updated with the merged card</li>
                  <li>Public will see a single unified profile with preferred name</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-900">
                    Please verify the bar registration number and ensure all cards genuinely belong to this lawyer before approving.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#e0e3e7] flex justify-end gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={loading}
                className="px-6 py-3 bg-white border border-[#e0e3e7] text-[#5f6368] rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveClaims}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  'Processing...'
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Approve & Merge
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full">
            <div className="p-6 border-b border-[#e0e3e7]">
              <h2 className="text-2xl font-bold text-[#1a2332]">Reject Claims</h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[#5f6368]">
                Provide a reason for rejecting the card claims from <span className="font-bold text-[#1a2332]">{selectedGroup.lawyer_name}</span>.
              </p>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Name mismatch - Additional verification required..."
                rows={6}
                className="w-full px-4 py-3 border border-[#e0e3e7] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="p-6 border-t border-[#e0e3e7] flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                disabled={loading}
                className="px-6 py-3 bg-white border border-[#e0e3e7] text-[#5f6368] rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectClaim(selectedGroup.claims[0].id)}
                disabled={loading || !rejectionReason.trim()}
                className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  'Rejecting...'
                ) : (
                  <>
                    <X className="w-5 h-5" />
                    Reject All Claims
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
