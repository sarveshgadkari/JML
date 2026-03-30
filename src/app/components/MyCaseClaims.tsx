import { useState } from 'react';
import { Clock, CheckCircle, XCircle, FileText, Eye, Download, ExternalLink } from 'lucide-react';

interface CaseClaim {
  id: string;
  judgment_id: string;
  case_number: string;
  case_title: string;
  role: 'complainant' | 'respondent';
  client_name: string;
  vakaalatnama_url: string;
  status: 'pending' | 'approved' | 'rejected';
  court_name: string;
  judgment_date: string;
  created_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
  notes?: string;
}

interface MyCaseClaimsProps {
  lawyerId: string;
}

export default function MyCaseClaims({ lawyerId }: MyCaseClaimsProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedClaim, setSelectedClaim] = useState<CaseClaim | null>(null);

  // Mock data - Replace with actual Supabase query
  const mockClaims: CaseClaim[] = [
    {
      id: '1',
      judgment_id: 'j-1',
      case_number: 'CRL.M.C. 1234/2024',
      case_title: 'XYZ Corporation vs ABC Ltd.',
      role: 'complainant',
      client_name: 'XYZ Corporation',
      vakaalatnama_url: '/documents/vakaalatnama-1.pdf',
      status: 'pending',
      court_name: 'Delhi High Court',
      judgment_date: '2024-12-15',
      created_at: '2026-01-09T10:30:00Z',
      notes: 'Represented client for 2 years in this case'
    },
    {
      id: '2',
      judgment_id: 'j-2',
      case_number: 'CS(OS) 567/2023',
      case_title: 'John Doe vs Jane Smith',
      role: 'respondent',
      client_name: 'Jane Smith',
      vakaalatnama_url: '/documents/vakaalatnama-2.pdf',
      status: 'approved',
      court_name: 'Delhi District Court',
      judgment_date: '2024-11-28',
      created_at: '2026-01-08T14:20:00Z',
      reviewed_at: '2026-01-09T09:15:00Z'
    },
    {
      id: '3',
      judgment_id: 'j-3',
      case_number: 'WP(C) 890/2023',
      case_title: 'Company A vs Government',
      role: 'complainant',
      client_name: 'Company A Pvt Ltd',
      vakaalatnama_url: '/documents/vakaalatnama-3.pdf',
      status: 'rejected',
      court_name: 'Delhi High Court',
      judgment_date: '2024-10-12',
      created_at: '2026-01-07T11:45:00Z',
      reviewed_at: '2026-01-08T16:30:00Z',
      rejection_reason: 'Vakaalatnama document is not clear. Please upload a higher resolution scan showing your signature and client authorization clearly.'
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
        <h1 className="text-3xl font-bold text-[#1a2332] mb-2">My Case Claims</h1>
        <p className="text-[#5f6368]">
          Track the status of your individual case claim requests
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
                    <h3 className="font-bold text-lg text-[#1a2332]">{claim.case_number}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase border ${getStatusColor(claim.status)}`}>
                      {claim.status}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold capitalize bg-blue-100 text-blue-700 border border-blue-200">
                      {claim.role}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#1a2332] mb-1">{claim.case_title}</p>
                  <p className="text-sm text-[#5f6368]">
                    Client: <span className="font-semibold text-[#1a2332]">{claim.client_name}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={claim.vakaalatnama_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-[#1e3a8a] hover:bg-blue-50 rounded-lg transition-colors font-semibold flex items-center gap-1 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Vakaalatnama
                </a>
                <button
                  onClick={() => setSelectedClaim(claim)}
                  className="px-3 py-2 text-[#1e3a8a] hover:bg-blue-50 rounded-lg transition-colors font-semibold flex items-center gap-1 text-sm"
                >
                  <Eye className="w-4 h-4" />
                  Details
                </button>
              </div>
            </div>

            {/* Case Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-xs text-[#5f6368]">Court</p>
                <p className="font-semibold text-[#1a2332] text-sm">{claim.court_name}</p>
              </div>
              <div>
                <p className="text-xs text-[#5f6368]">Judgment Date</p>
                <p className="font-semibold text-[#1a2332] text-sm">
                  {new Date(claim.judgment_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#5f6368]">Claimed On</p>
                <p className="font-semibold text-[#1a2332] text-sm">{formatDate(claim.created_at)}</p>
              </div>
            </div>

            {/* Status Messages */}
            {claim.status === 'pending' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900">
                    Your case claim is under admin review. This typically takes 1-2 business days.
                  </p>
                </div>
              </div>
            )}

            {claim.status === 'approved' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-900 flex-1">
                    <p className="font-semibold">Approved on {formatDate(claim.reviewed_at!)}</p>
                    <p>This case has been added to your profile and statistics.</p>
                  </div>
                  <a
                    href={`/judgments/${claim.judgment_id}`}
                    className="text-green-700 hover:text-green-900 flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="text-xs font-semibold">View Case</span>
                  </a>
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
                    <button className="mt-2 text-xs font-semibold text-red-700 hover:text-red-900 underline">
                      Re-submit with corrected document
                    </button>
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
              ? "You haven't submitted any case claims yet"
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
                <h2 className="text-xl sm:text-2xl font-bold text-[#1a2332]">Case Claim Details</h2>
                <button
                  onClick={() => setSelectedClaim(null)}
                  className="text-[#5f6368] hover:text-[#1a2332] text-2xl"
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

              {/* Case Info */}
              <div>
                <label className="block text-sm font-semibold text-[#5f6368] mb-2">Case Number</label>
                <p className="text-lg font-bold text-[#1a2332]">{selectedClaim.case_number}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#5f6368] mb-2">Case Title</label>
                <p className="text-lg text-[#1a2332]">{selectedClaim.case_title}</p>
              </div>

              {/* Role & Client */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#5f6368] mb-2">Your Role</label>
                  <p className="text-lg font-semibold text-[#1e3a8a] capitalize">{selectedClaim.role} Lawyer</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#5f6368] mb-2">Client Name</label>
                  <p className="text-lg font-semibold text-[#1a2332]">{selectedClaim.client_name}</p>
                </div>
              </div>

              {/* Court & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#5f6368] mb-2">Court</label>
                  <p className="text-[#1a2332]">{selectedClaim.court_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#5f6368] mb-2">Judgment Date</label>
                  <p className="text-[#1a2332]">{new Date(selectedClaim.judgment_date).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Vakaalatnama */}
              <div>
                <label className="block text-sm font-semibold text-[#5f6368] mb-2">Vakaalatnama Document</label>
                <a
                  href={selectedClaim.vakaalatnama_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-[#1e3a8a] rounded-lg hover:bg-blue-100 transition-colors font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Download Document
                </a>
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
              <div className="grid grid-cols-2 gap-4">
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
