import { useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, FileText, Eye } from 'lucide-react';

interface CardClaim {
  id: string;
  card_id: string;
  card_name: string;
  preferred_name: string;
  bar_registration_number: string;
  status: 'pending' | 'approved' | 'rejected';
  total_cases: number;
  win_rate: number;
  created_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
  notes?: string;
}

interface MyClaimsProps {
  lawyerId: string;
}

export default function MyClaims({ lawyerId }: MyClaimsProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedClaim, setSelectedClaim] = useState<CardClaim | null>(null);

  // Mock data - Replace with actual Supabase query
  const mockClaims: CardClaim[] = [
    {
      id: '1',
      card_id: 'card-1',
      card_name: 'Adv. Rajesh Kumar',
      preferred_name: 'Rajesh Kumar',
      bar_registration_number: 'D/1234/2010',
      status: 'pending',
      total_cases: 156,
      win_rate: 62.82,
      created_at: '2026-01-08T10:30:00Z',
      notes: 'This is my primary practice name at Delhi High Court'
    },
    {
      id: '2',
      card_id: 'card-2',
      card_name: 'R. Kumar (Advocate)',
      preferred_name: 'Rajesh Kumar',
      bar_registration_number: 'D/1234/2010',
      status: 'approved',
      total_cases: 87,
      win_rate: 62.07,
      created_at: '2026-01-05T14:20:00Z',
      reviewed_at: '2026-01-07T09:15:00Z'
    },
    {
      id: '3',
      card_id: 'card-3',
      card_name: 'Shri Rajesh Kumar',
      preferred_name: 'Rajesh Kumar',
      bar_registration_number: 'D/1234/2010',
      status: 'approved',
      total_cases: 43,
      win_rate: 67.44,
      created_at: '2026-01-05T14:22:00Z',
      reviewed_at: '2026-01-07T09:15:00Z'
    },
    {
      id: '4',
      card_id: 'card-4',
      card_name: 'Mr. R.K. Sharma',
      preferred_name: 'Rajesh Kumar',
      bar_registration_number: 'D/1234/2010',
      status: 'rejected',
      total_cases: 32,
      win_rate: 56.25,
      created_at: '2026-01-04T11:45:00Z',
      reviewed_at: '2026-01-06T16:30:00Z',
      rejection_reason: 'Name mismatch - This appears to be a different lawyer (R.K. Sharma vs Rajesh Kumar). Please provide additional documentation if you believe this is your card.'
    }
  ];

  const filteredClaims = filter === 'all'
    ? mockClaims
    : mockClaims.filter(claim => claim.status === filter);

  const stats = {
    total: mockClaims.length,
    pending: mockClaims.filter(c => c.status === 'pending').length,
    approved: mockClaims.filter(c => c.status === 'approved').length,
    rejected: mockClaims.filter(c => c.status === 'rejected').length
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'approved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700';
    }
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
        <h1 className="text-3xl font-bold text-[#1a2332] mb-2">My Card Claims</h1>
        <p className="text-[#5f6368]">
          Track the status of your card claim requests
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#e0e3e7] p-4 shadow-sm">
          <p className="text-sm text-[#5f6368] mb-1">Total Claims</p>
          <p className="text-3xl font-bold text-[#1a2332]">{stats.total}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
          <p className="text-sm text-amber-700 mb-1">Pending Review</p>
          <p className="text-3xl font-bold text-amber-900">{stats.pending}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 shadow-sm">
          <p className="text-sm text-green-700 mb-1">Approved</p>
          <p className="text-3xl font-bold text-green-900">{stats.approved}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 shadow-sm">
          <p className="text-sm text-red-700 mb-1">Rejected</p>
          <p className="text-3xl font-bold text-red-900">{stats.rejected}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-[#e0e3e7] p-1 shadow-sm mb-6 grid grid-cols-2 sm:grid-cols-4 gap-1">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors capitalize ${
              filter === status
                ? 'bg-[#1e3a8a] text-white'
                : 'text-[#5f6368] hover:bg-gray-50'
            }`}
          >
            {status} {status !== 'all' && `(${stats[status]})`}
          </button>
        ))}
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        {filteredClaims.map(claim => (
          <div
            key={claim.id}
            className="bg-white rounded-2xl border border-[#e0e3e7] p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {getStatusIcon(claim.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                    <h3 className="font-bold text-lg text-[#1a2332]">{claim.card_name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase border ${getStatusColor(claim.status)}`}>
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#5f6368] mb-1">
                    Claiming as: <span className="font-semibold text-[#1a2332]">{claim.preferred_name}</span>
                  </p>
                  {claim.bar_registration_number && (
                    <p className="text-sm text-[#5f6368]">
                      Bar No: {claim.bar_registration_number}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedClaim(claim)}
                className="px-4 py-2 text-[#1e3a8a] hover:bg-blue-50 rounded-lg transition-colors font-semibold flex items-center gap-2 self-start"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>
            </div>

            {/* Card Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-xs text-[#5f6368]">Total Cases</p>
                <p className="font-bold text-[#1a2332]">{claim.total_cases}</p>
              </div>
              <div>
                <p className="text-xs text-[#5f6368]">Win Rate</p>
                <p className="font-bold text-[#1e3a8a]">{claim.win_rate}%</p>
              </div>
              <div>
                <p className="text-xs text-[#5f6368]">Submitted</p>
                <p className="font-semibold text-[#1a2332] text-sm">{formatDate(claim.created_at)}</p>
              </div>
            </div>

            {/* Status Messages */}
            {claim.status === 'pending' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900">
                    Your claim is under review. This typically takes 1-3 business days.
                  </p>
                </div>
              </div>
            )}

            {claim.status === 'approved' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-900">
                    <p className="font-semibold">Approved on {formatDate(claim.reviewed_at!)}</p>
                    <p>This card has been merged into your profile.</p>
                  </div>
                </div>
              </div>
            )}

            {claim.status === 'rejected' && claim.rejection_reason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-900">
                    <p className="font-semibold mb-1">Rejected on {formatDate(claim.reviewed_at!)}</p>
                    <p className="text-red-800">{claim.rejection_reason}</p>
                  </div>
                </div>
              </div>
            )}

            {claim.notes && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs text-blue-700 font-semibold mb-1">Your Notes:</p>
                <p className="text-sm text-blue-900">{claim.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredClaims.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#e0e3e7] p-12 shadow-sm text-center">
          <FileText className="w-16 h-16 text-[#e0e3e7] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#1a2332] mb-2">No Claims Found</h3>
          <p className="text-[#5f6368]">
            {filter === 'all'
              ? "You haven't submitted any card claims yet"
              : `You don't have any ${filter} claims`}
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#e0e3e7] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold text-[#1a2332]">Claim Details</h2>
                <button
                  onClick={() => setSelectedClaim(null)}
                  className="text-[#5f6368] hover:text-[#1a2332]"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-[#5f6368] mb-2">Status</label>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedClaim.status)}
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold uppercase border ${getStatusColor(selectedClaim.status)}`}>
                    {selectedClaim.status}
                  </span>
                </div>
              </div>

              {/* Card Name */}
              <div>
                <label className="block text-sm font-semibold text-[#5f6368] mb-2">Card Name in Judgment</label>
                <p className="text-lg font-bold text-[#1a2332]">{selectedClaim.card_name}</p>
              </div>

              {/* Preferred Name */}
              <div>
                <label className="block text-sm font-semibold text-[#5f6368] mb-2">Preferred Name</label>
                <p className="text-lg font-bold text-[#1e3a8a]">{selectedClaim.preferred_name}</p>
              </div>

              {/* Bar Number */}
              {selectedClaim.bar_registration_number && (
                <div>
                  <label className="block text-sm font-semibold text-[#5f6368] mb-2">Bar Registration Number</label>
                  <p className="text-lg text-[#1a2332]">{selectedClaim.bar_registration_number}</p>
                </div>
              )}

              {/* Statistics */}
              <div>
                <label className="block text-sm font-semibold text-[#5f6368] mb-2">Card Statistics</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <p className="text-sm text-blue-700">Total Cases</p>
                    <p className="text-2xl font-bold text-blue-900">{selectedClaim.total_cases}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl">
                    <p className="text-sm text-green-700">Win Rate</p>
                    <p className="text-2xl font-bold text-green-900">{selectedClaim.win_rate}%</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedClaim.notes && (
                <div>
                  <label className="block text-sm font-semibold text-[#5f6368] mb-2">Your Notes</label>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-[#1a2332]">{selectedClaim.notes}</p>
                  </div>
                </div>
              )}

              {/* Rejection Reason */}
              {selectedClaim.rejection_reason && (
                <div>
                  <label className="block text-sm font-semibold text-[#5f6368] mb-2">Rejection Reason</label>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-900">{selectedClaim.rejection_reason}</p>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#5f6368] mb-2">Submitted</label>
                  <p className="text-[#1a2332]">{formatDate(selectedClaim.created_at)}</p>
                </div>
                {selectedClaim.reviewed_at && (
                  <div>
                    <label className="block text-sm font-semibold text-[#5f6368] mb-2">Reviewed</label>
                    <p className="text-[#1a2332]">{formatDate(selectedClaim.reviewed_at)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
