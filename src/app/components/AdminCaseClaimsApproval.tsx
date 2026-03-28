import { useState } from 'react';
import { Check, X, Eye, Download, User, FileText, Calendar, Scale, AlertTriangle } from 'lucide-react';

interface PendingCaseClaim {
  id: string;
  lawyer_id: string;
  lawyer_name: string;
  lawyer_email: string;
  lawyer_bar_number: string;
  judgment_id: string;
  case_number: string;
  case_title: string;
  role: 'complainant' | 'respondent';
  client_name: string;
  vakaalatnama_url: string;
  court_name: string;
  judgment_date: string;
  created_at: string;
  notes?: string;
}

export default function AdminCaseClaimsApproval() {
  const [selectedClaim, setSelectedClaim] = useState<PendingCaseClaim | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock data - Replace with actual Supabase query
  const mockClaims: PendingCaseClaim[] = [
    {
      id: 'claim-1',
      lawyer_id: 'lawyer-1',
      lawyer_name: 'Rajesh Kumar',
      lawyer_email: 'rajesh.kumar@example.com',
      lawyer_bar_number: 'D/1234/2010',
      judgment_id: 'j-1',
      case_number: 'CRL.M.C. 1234/2024',
      case_title: 'XYZ Corporation vs ABC Ltd.',
      role: 'complainant',
      client_name: 'XYZ Corporation',
      vakaalatnama_url: '/documents/vakaalatnama-1.pdf',
      court_name: 'Delhi High Court',
      judgment_date: '2024-12-15',
      created_at: '2026-01-09T10:30:00Z',
      notes: 'Represented client for 2 years in this case'
    },
    {
      id: 'claim-2',
      lawyer_id: 'lawyer-2',
      lawyer_name: 'Priya Sharma',
      lawyer_email: 'priya.sharma@example.com',
      lawyer_bar_number: 'M/5678/2015',
      judgment_id: 'j-2',
      case_number: 'CS(OS) 567/2023',
      case_title: 'John Doe vs Jane Smith',
      role: 'respondent',
      client_name: 'Jane Smith',
      vakaalatnama_url: '/documents/vakaalatnama-2.pdf',
      court_name: 'Mumbai High Court',
      judgment_date: '2024-11-28',
      created_at: '2026-01-09T14:20:00Z'
    }
  ];

  const handleApproveClaim = async () => {
    if (!selectedClaim) return;

    setLoading(true);

    // TODO: Replace with actual Supabase calls
    // 1. Update case_claims status to 'approved'
    // 2. Create entry in claimed_cases table
    // 3. Update judgment to link lawyer
    // 4. Send notification to lawyer

    setTimeout(() => {
      setLoading(false);
      setShowApproveModal(false);
      setSelectedClaim(null);
      alert(`Successfully approved case claim for ${selectedClaim.lawyer_name}`);
    }, 1500);
  };

  const handleRejectClaim = async () => {
    if (!selectedClaim || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setLoading(true);

    // TODO: Replace with actual Supabase update
    // Update case_claims status='rejected', rejection_reason=...

    setTimeout(() => {
      setLoading(false);
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedClaim(null);
      alert('Case claim rejected successfully');
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
        <h1 className="text-3xl font-bold text-[#1a2332] mb-2">Case Claims Approval</h1>
        <p className="text-[#5f6368]">
          Review and approve lawyer case claims with Vakaalatnama verification
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#e0e3e7] p-4 shadow-sm">
          <p className="text-sm text-[#5f6368] mb-1">Pending Claims</p>
          <p className="text-3xl font-bold text-[#1a2332]">{mockClaims.length}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
          <p className="text-sm text-amber-700 mb-1">Avg Review Time</p>
          <p className="text-3xl font-bold text-amber-900">1.2 days</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm">
          <p className="text-sm text-blue-700 mb-1">Approval Rate</p>
          <p className="text-3xl font-bold text-blue-900">92%</p>
        </div>
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        {mockClaims.map(claim => (
          <div
            key={claim.id}
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
                    <h2 className="text-xl font-bold text-[#1a2332] mb-1">{claim.lawyer_name}</h2>
                    <div className="flex items-center gap-4 text-sm text-[#5f6368]">
                      <span>{claim.lawyer_email}</span>
                      <span>Bar: {claim.lawyer_bar_number}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedClaim(claim)}
                    className="px-4 py-2 bg-blue-100 text-[#1e3a8a] rounded-lg hover:bg-blue-200 transition-colors font-semibold flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Review
                  </button>
                </div>
              </div>
            </div>

            {/* Case Details */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-[#1a2332]">{claim.case_number}</h3>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold capitalize bg-blue-100 text-blue-700 border border-blue-200">
                      {claim.role} Lawyer
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#1a2332] mb-3">{claim.case_title}</p>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-[#5f6368]">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      <span>{claim.court_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Judgment: {new Date(claim.judgment_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>Client: {claim.client_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Claimed: {formatDate(claim.created_at)}</span>
                    </div>
                  </div>

                  {claim.notes && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700 font-semibold mb-1">Lawyer's Notes:</p>
                      <p className="text-sm text-blue-900">{claim.notes}</p>
                    </div>
                  )}
                </div>

                <a
                  href={claim.vakaalatnama_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-6 px-4 py-2 bg-gray-100 text-[#1a2332] rounded-lg hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Vakaalatnama
                </a>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-[#e0e3e7] bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedClaim(claim);
                  setShowRejectModal(true);
                }}
                className="px-6 py-3 bg-white border-2 border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors font-bold flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                Reject
              </button>
              <button
                onClick={() => {
                  setSelectedClaim(claim);
                  setShowApproveModal(true);
                }}
                className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-bold flex items-center gap-2"
              >
                <Check className="w-5 h-5" />
                Approve Claim
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {mockClaims.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#e0e3e7] p-12 shadow-sm text-center">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#1a2332] mb-2">All Caught Up!</h3>
          <p className="text-[#5f6368]">
            There are no pending case claims to review at this time.
          </p>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-[#e0e3e7]">
              <h2 className="text-2xl font-bold text-[#1a2332]">Approve Case Claim</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-green-900 mb-1">Confirm Approval</p>
                    <p className="text-sm text-green-800">
                      You are about to approve the case claim for{' '}
                      <span className="font-bold">{selectedClaim.lawyer_name}</span> for case{' '}
                      <span className="font-bold">{selectedClaim.case_number}</span>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="font-bold text-blue-900 mb-2">After approval:</p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>The case will be linked to the lawyer's profile</li>
                  <li>Statistics will be updated automatically</li>
                  <li>The lawyer will be notified via email</li>
                  <li>This case will appear in public lawyer profile</li>
                </ul>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-900">
                    Please verify the Vakaalatnama document shows clear authorization from the client and matches the case details before approving.
                  </p>
                </div>
              </div>

              {/* Claim Summary */}
              <div className="border border-[#e0e3e7] rounded-xl p-4">
                <h3 className="font-bold text-[#1a2332] mb-3">Claim Summary</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#5f6368]">Lawyer</p>
                    <p className="font-semibold">{selectedClaim.lawyer_name}</p>
                  </div>
                  <div>
                    <p className="text-[#5f6368]">Bar Number</p>
                    <p className="font-semibold">{selectedClaim.lawyer_bar_number}</p>
                  </div>
                  <div>
                    <p className="text-[#5f6368]">Role</p>
                    <p className="font-semibold capitalize">{selectedClaim.role} Lawyer</p>
                  </div>
                  <div>
                    <p className="text-[#5f6368]">Client</p>
                    <p className="font-semibold">{selectedClaim.client_name}</p>
                  </div>
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
                onClick={handleApproveClaim}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  'Processing...'
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Approve Claim
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full">
            <div className="p-6 border-b border-[#e0e3e7]">
              <h2 className="text-2xl font-bold text-[#1a2332]">Reject Case Claim</h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[#5f6368]">
                Provide a reason for rejecting the case claim from{' '}
                <span className="font-bold text-[#1a2332]">{selectedClaim.lawyer_name}</span> for case{' '}
                <span className="font-bold text-[#1a2332]">{selectedClaim.case_number}</span>.
              </p>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Vakaalatnama document is not clear. Please upload a higher resolution scan..."
                rows={6}
                className="w-full px-4 py-3 border border-[#e0e3e7] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
              />

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
                The lawyer will be able to re-submit the claim with corrections after viewing your feedback.
              </div>
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
                onClick={handleRejectClaim}
                disabled={loading || !rejectionReason.trim()}
                className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  'Rejecting...'
                ) : (
                  <>
                    <X className="w-5 h-5" />
                    Reject Claim
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
