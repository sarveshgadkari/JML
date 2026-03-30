import { useState } from 'react';
import { Search, Upload, FileText, Scale, Calendar, User, CheckCircle, AlertCircle } from 'lucide-react';
import getSupabase from '../../utils/supabase/client';

interface Judgment {
  id: string;
  case_number: string;
  case_title: string;
  judgment_date: string;
  court_name: string;
  judge_name: string;
  outcome: string;
  case_type: string;
  complainant_lawyer: string;
  respondent_lawyer: string;
  already_claimed_by_lawyer: boolean;
  claimed_role?: 'complainant' | 'respondent';
}

interface ClaimCasesProps {
  lawyerId: string;
  lawyerName: string;
}

export default function ClaimCases({ lawyerId, lawyerName }: ClaimCasesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState<'case_number' | 'lawyer_name' | 'court'>('case_number');
  const [cases, setCases] = useState<Judgment[]>([]);
  const [selectedCase, setSelectedCase] = useState<Judgment | null>(null);
  const [selectedRole, setSelectedRole] = useState<'complainant' | 'respondent'>('complainant');
  const [vakaalatnama, setVakaalatnama] = useState<File | null>(null);
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const searchCases = async () => {
    if (!searchTerm.trim()) {
      setCases([]);
      return;
    }

    setSearchLoading(true);
    try {
      const supabase = getSupabase();
      const like = `%${searchTerm}%`;
      let query = supabase
        .from('cases')
        .select('id,case_number,case_title,judgment_date,court_name,case_type,judge_1,judge_2,judge_3,judge_4,judge_5,judge_6,judge_7,judge_8,judge_9,petitioner_lawyer_1,petitioner_lawyer_2,petitioner_lawyer_3,petitioner_lawyer_4,petitioner_lawyer_5,respondent_lawyer_1,respondent_lawyer_2,respondent_lawyer_3,respondent_lawyer_4,respondent_lawyer_5,outcome')
        .order('judgment_date', { ascending: false })
        .limit(300);
      if (filterBy === 'case_number') {
        query = query.ilike('case_number', like);
      } else if (filterBy === 'lawyer_name') {
        query = query.or([
          `petitioner_lawyer_1.ilike.${like}`,
          `petitioner_lawyer_2.ilike.${like}`,
          `petitioner_lawyer_3.ilike.${like}`,
          `petitioner_lawyer_4.ilike.${like}`,
          `petitioner_lawyer_5.ilike.${like}`,
          `respondent_lawyer_1.ilike.${like}`,
          `respondent_lawyer_2.ilike.${like}`,
          `respondent_lawyer_3.ilike.${like}`,
          `respondent_lawyer_4.ilike.${like}`,
          `respondent_lawyer_5.ilike.${like}`,
        ].join(','));
      } else {
        query = query.ilike('court_name', like);
      }
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const firstJudge = (r: any) => r.judge_1 || r.judge_2 || r.judge_3 || r.judge_4 || r.judge_5 || r.judge_6 || r.judge_7 || r.judge_8 || r.judge_9 || '';
      const mapped: Judgment[] = rows.map(r => ({
        id: r.id,
        case_number: r.case_number,
        case_title: r.case_title,
        judgment_date: r.judgment_date,
        court_name: r.court_name || 'MahaRERA',
        judge_name: firstJudge(r),
        outcome: r.outcome || '',
        case_type: r.case_type || '',
        complainant_lawyer: r.petitioner_lawyer_1 || '',
        respondent_lawyer: r.respondent_lawyer_1 || '',
        already_claimed_by_lawyer: false,
      }));
      setCases(mapped);
    } catch (e) {
      setCases([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVakaalatnama(e.target.files[0]);
    }
  };

  const handleSubmitClaim = async () => {
    if (!selectedCase) {
      alert('Please select a case');
      return;
    }

    if (!vakaalatnama) {
      alert('Please upload Vakaalatnama document');
      return;
    }

    if (!clientName.trim()) {
      alert('Please enter client name');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabase();
      // Upload file to Storage (bucket must exist: 'vakaalatnamas')
      const ext = (vakaalatnama!.name.split('.').pop() || 'pdf').toLowerCase();
      const path = `${lawyerId}/${selectedCase.case_number}_${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('vakaalatnamas')
        .upload(path, vakaalatnama as File, { upsert: false });
      if (uploadError) throw uploadError;

      // Create case claim
      const { error } = await supabase.from('case_claims').insert({
        lawyer_id: lawyerId,
        case_id: selectedCase.id,
        role: selectedRole,
        vakaalatnama_url: uploadData?.path || path,
        client_name: clientName,
        notes: notes || null,
        case_number: selectedCase.case_number,
        status: 'pending'
      });
      if (error) throw error;

      setSuccess(true);
      setSelectedCase(null);
      setVakaalatnama(null);
      setClientName('');
      setNotes('');
      setTimeout(() => setSuccess(false), 5000);
    } catch (e: any) {
      alert(`Failed to submit claim: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1a2332] mb-2">Claim Individual Cases</h1>
        <p className="text-[#5f6368]">
          Search for cases you appeared in and claim them by uploading Vakaalatnama document
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">Case Claim Submitted Successfully!</p>
            <p className="text-sm text-green-700">Your claim is pending admin approval. You'll be notified once reviewed.</p>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="bg-white rounded-2xl border border-[#e0e3e7] p-6 shadow-sm mb-6">
        <h2 className="text-xl font-bold text-[#1a2332] mb-4">Search Cases</h2>
        
        {/* Filter Type */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilterBy('case_number')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filterBy === 'case_number'
                ? 'bg-[#1e3a8a] text-white'
                : 'bg-gray-100 text-[#5f6368] hover:bg-gray-200'
            }`}
          >
            Case Number
          </button>
          <button
            onClick={() => setFilterBy('lawyer_name')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filterBy === 'lawyer_name'
                ? 'bg-[#1e3a8a] text-white'
                : 'bg-gray-100 text-[#5f6368] hover:bg-gray-200'
            }`}
          >
            Lawyer Name
          </button>
          <button
            onClick={() => setFilterBy('court')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filterBy === 'court'
                ? 'bg-[#1e3a8a] text-white'
                : 'bg-gray-100 text-[#5f6368] hover:bg-gray-200'
            }`}
          >
            Court
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#5f6368]" />
            <input
              type="text"
              placeholder={
                filterBy === 'case_number' ? 'Enter case number (e.g., CRL.M.C. 1234/2024)' :
                filterBy === 'lawyer_name' ? 'Enter lawyer name' :
                'Enter court name'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchCases()}
              className="w-full pl-10 pr-4 py-3 border border-[#e0e3e7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
          </div>
          <button
            onClick={searchCases}
            disabled={searchLoading}
            className="px-6 py-3 bg-[#1e3a8a] text-white rounded-xl hover:bg-[#2563eb] transition-colors font-semibold disabled:opacity-50"
          >
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Tips for finding your cases:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Search by exact case number for precise results</li>
                <li>Search by your name to find all cases you appeared in</li>
                <li>Filter by court to narrow down results</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {cases.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e0e3e7] p-6 shadow-sm mb-6">
          <h2 className="text-xl font-bold text-[#1a2332] mb-4">
            Found {cases.length} Case{cases.length !== 1 ? 's' : ''}
          </h2>

          <div className="space-y-3">
            {cases.map(caseItem => (
              <div
                key={caseItem.id}
                onClick={() => setSelectedCase(caseItem)}
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  selectedCase?.id === caseItem.id
                    ? 'border-[#1e3a8a] bg-blue-50'
                    : caseItem.already_claimed_by_lawyer
                    ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                    : 'border-[#e0e3e7] hover:border-[#3b82f6]'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="font-bold text-lg text-[#1a2332]">{caseItem.case_number}</h3>
                      {caseItem.already_claimed_by_lawyer ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                          ALREADY CLAIMED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                          AVAILABLE
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-[#1a2332] mb-2">{caseItem.case_title}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-[#5f6368] mb-3">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4" />
                        <span>{caseItem.court_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{caseItem.judge_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(caseItem.judgment_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{caseItem.case_type}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-[#5f6368]">Complainant Lawyer</p>
                        <p className="font-semibold text-[#1a2332]">{caseItem.complainant_lawyer}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#5f6368]">Respondent Lawyer</p>
                        <p className="font-semibold text-[#1a2332]">{caseItem.respondent_lawyer}</p>
                      </div>
                    </div>

                    {caseItem.already_claimed_by_lawyer && caseItem.claimed_role && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                        ✓ You already claimed this case as <span className="font-bold capitalize">{caseItem.claimed_role}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim Form */}
      {selectedCase && !selectedCase.already_claimed_by_lawyer && (
        <div className="bg-white rounded-2xl border border-[#e0e3e7] p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#1a2332] mb-4">Submit Case Claim</h2>

          <div className="space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-semibold text-[#1a2332] mb-2">
                Your Role in this Case *
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setSelectedRole('complainant')}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors ${
                    selectedRole === 'complainant'
                      ? 'bg-[#1e3a8a] text-white'
                      : 'bg-gray-100 text-[#5f6368] hover:bg-gray-200'
                  }`}
                >
                  Complainant Lawyer
                </button>
                <button
                  onClick={() => setSelectedRole('respondent')}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors ${
                    selectedRole === 'respondent'
                      ? 'bg-[#1e3a8a] text-white'
                      : 'bg-gray-100 text-[#5f6368] hover:bg-gray-200'
                  }`}
                >
                  Respondent Lawyer
                </button>
              </div>
            </div>

            {/* Client Name */}
            <div>
              <label className="block text-sm font-semibold text-[#1a2332] mb-2">
                Client Name *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter your client's name as in Vakaalatnama"
                className="w-full px-4 py-3 border border-[#e0e3e7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>

            {/* Vakaalatnama Upload */}
            <div>
              <label className="block text-sm font-semibold text-[#1a2332] mb-2">
                Upload Vakaalatnama Document *
              </label>
              <div className="border-2 border-dashed border-[#e0e3e7] rounded-xl p-6 text-center hover:border-[#1e3a8a] transition-colors">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                  id="vakaalatnama-upload"
                />
                <label htmlFor="vakaalatnama-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-[#5f6368] mx-auto mb-2" />
                  {vakaalatnama ? (
                    <div>
                      <p className="font-semibold text-[#1a2332]">{vakaalatnama.name}</p>
                      <p className="text-sm text-[#5f6368]">{(vakaalatnama.size / 1024).toFixed(2)} KB</p>
                      <p className="text-xs text-green-600 mt-1">✓ File selected. Click to change.</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-[#1a2332]">Click to upload</p>
                      <p className="text-sm text-[#5f6368]">PDF, JPG, or PNG (Max 10MB)</p>
                    </div>
                  )}
                </label>
              </div>
              <p className="text-xs text-[#5f6368] mt-2">
                Upload the Vakaalatnama (Power of Attorney) document that proves you represented the client in this case
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-[#1a2332] mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional context or explanation..."
                rows={3}
                className="w-full px-4 py-3 border border-[#e0e3e7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>

            <button
              onClick={handleSubmitClaim}
              disabled={loading || !vakaalatnama || !clientName.trim()}
              className="w-full py-4 bg-[#1e3a8a] text-white rounded-xl hover:bg-[#2563eb] transition-colors font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Submitting...' : 'Submit Case Claim'}
            </button>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold mb-1">Verification Process:</p>
                  <ul className="list-disc list-inside space-y-1 text-amber-800">
                    <li>Admin will verify your Vakaalatnama document</li>
                    <li>Document should clearly show your name and client's name</li>
                    <li>Approval typically takes 1-2 business days</li>
                    <li>Once approved, this case will be added to your profile</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Results */}
      {searchTerm && cases.length === 0 && !searchLoading && (
        <div className="bg-white rounded-2xl border border-[#e0e3e7] p-12 shadow-sm text-center">
          <FileText className="w-16 h-16 text-[#e0e3e7] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#1a2332] mb-2">No Cases Found</h3>
          <p className="text-[#5f6368] mb-4">
            We couldn't find any cases matching "{searchTerm}"
          </p>
          <p className="text-sm text-[#5f6368]">
            Try different search terms or filter options
          </p>
        </div>
      )}
    </div>
  );
}
