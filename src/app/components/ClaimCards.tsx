import { useState, useEffect } from 'react';
import { Search, Plus, Check, AlertCircle, FileText, Scale, TrendingUp } from 'lucide-react';
import getSupabase from '../../utils/supabase/client';

interface LawyerCard {
  id: string;
  name_in_judgment: string;
  status: 'unclaimed' | 'claimed' | 'merged';
  total_cases: number;
  cases_won: number;
  cases_lost: number;
  cases_settled: number;
  win_rate: number;
  court_name: string;
  bar_registration_number?: string;
  is_master_card: boolean;
}

interface ClaimCardsProps {
  lawyerId: string;
  lawyerName: string;
}

export default function ClaimCards({ lawyerId, lawyerName }: ClaimCardsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [unclaimedCards, setUnclaimedCards] = useState<LawyerCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [preferredName, setPreferredName] = useState(lawyerName);
  const [barNumber, setBarNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const searchCards = async () => {
    if (!searchTerm.trim()) {
      setUnclaimedCards([]);
      return;
    }

    setSearchLoading(true);
    try {
      const supabase = getSupabase();
      // Pull candidate lawyer rows from precomputed analytics (source of truth for totals and rates)
      const like = `%${searchTerm}%`;
      const { data, error } = await supabase
        .from('lawyer_analytics')
        .select('lawyer_id,lawyer_name,total_cases,won_cases,lost_cases,settled_cases,win_rate')
        .ilike('lawyer_name', like)
        .order('total_cases', { ascending: false })
        .limit(200);
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        lawyer_id: string;
        lawyer_name: string;
        total_cases: number;
        won_cases: number;
        lost_cases: number;
        settled_cases: number;
        win_rate: number | string | null;
      }>;
      const cards: LawyerCard[] = rows.map((r) => ({
        id: r.lawyer_id,
        name_in_judgment: r.lawyer_name,
        status: 'unclaimed',
        total_cases: Number(r.total_cases ?? 0),
        cases_won: Number(r.won_cases ?? 0),
        cases_lost: Number(r.lost_cases ?? 0),
        cases_settled: Number(r.settled_cases ?? 0),
        win_rate: Number(r.win_rate ?? 0),
        court_name: 'MahaRERA',
        is_master_card: true,
      }));
      setUnclaimedCards(cards);
    } catch (e) {
      setUnclaimedCards([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev =>
      prev.includes(cardId)
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleSubmitClaim = async () => {
    if (selectedCards.length === 0) {
      alert('Please select at least one card to claim');
      return;
    }

    if (!preferredName.trim()) {
      alert('Please enter your preferred name');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabase();
      const selected = unclaimedCards.filter(c => selectedCards.includes(c.id));
      // Create a single claim row with claimed_names array for admin review
      const { error } = await supabase.from('card_claims').insert({
        lawyer_id: lawyerId,
        claimed_names: selected.map(s => s.name_in_judgment),
        preferred_name: preferredName,
        bar_registration_number: barNumber || null,
        notes: notes || null,
        status: 'pending',
      });
      if (error) throw error;

      setSuccess(true);
      setSelectedCards([]);
      setNotes('');
      setUnclaimedCards(prev => prev.filter(card => !selectedCards.includes(card.id)));
      setTimeout(() => setSuccess(false), 5000);
    } catch (e) {
      alert('Failed to submit claim. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateAggregatedStats = () => {
    const selected = unclaimedCards.filter(card => selectedCards.includes(card.id));
    const totalCases = selected.reduce((sum, card) => sum + card.total_cases, 0);
    const casesWon = selected.reduce((sum, card) => sum + card.cases_won, 0);
    const casesLost = selected.reduce((sum, card) => sum + card.cases_lost, 0);
    const casesSettled = selected.reduce((sum, card) => sum + card.cases_settled, 0);
    const winRate = totalCases > 0 ? ((casesWon / totalCases) * 100).toFixed(2) : '0.00';

    return { totalCases, casesWon, casesLost, casesSettled, winRate };
  };

  const aggregatedStats = calculateAggregatedStats();

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1a2332] mb-2">Claim Your Lawyer Cards</h1>
        <p className="text-[#5f6368]">
          Search for cards with your name variations and claim them to merge into your profile
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">Claim Submitted Successfully!</p>
            <p className="text-sm text-green-700">Your claim is pending admin approval. You'll be notified once reviewed.</p>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="bg-white rounded-2xl border border-[#e0e3e7] p-6 shadow-sm mb-6">
        <h2 className="text-xl font-bold text-[#1a2332] mb-4">Search for Your Cards</h2>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#5f6368]" />
            <input
              type="text"
              placeholder="Enter your name or variations (e.g., 'Rajesh Kumar', 'R. Kumar', 'Adv. Kumar')"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchCards()}
              className="w-full pl-10 pr-4 py-3 border border-[#e0e3e7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
          </div>
          <button
            onClick={searchCards}
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
              <p className="font-semibold mb-1">Tips for finding your cards:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Try different name formats: "Rajesh Kumar", "R. Kumar", "R.K."</li>
                <li>Include titles: "Adv.", "Advocate", "Mr.", "Ms."</li>
                <li>Search by last name only to find all variations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {unclaimedCards.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e0e3e7] p-6 shadow-sm mb-6">
          <h2 className="text-xl font-bold text-[#1a2332] mb-4">
            Found {unclaimedCards.length} Unclaimed Card{unclaimedCards.length !== 1 ? 's' : ''}
          </h2>

          <div className="space-y-3">
            {unclaimedCards.map(card => (
              <div
                key={card.id}
                onClick={() => toggleCardSelection(card.id)}
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  selectedCards.includes(card.id)
                    ? 'border-[#1e3a8a] bg-blue-50'
                    : 'border-[#e0e3e7] hover:border-[#3b82f6]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                        selectedCards.includes(card.id)
                          ? 'bg-[#1e3a8a] border-[#1e3a8a]'
                          : 'border-[#e0e3e7]'
                      }`}
                    >
                      {selectedCards.includes(card.id) && <Check className="w-4 h-4 text-white" />}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg text-[#1a2332]">{card.name_in_judgment}</h3>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                          UNCLAIMED
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-[#5f6368] mb-3">
                        <div className="flex items-center gap-1">
                          <Scale className="w-4 h-4" />
                          <span>{card.court_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          <span>{card.total_cases} cases</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-4">
                        <div>
                          <p className="text-xs text-[#5f6368]">Total Cases</p>
                          <p className="font-bold text-[#1a2332]">{card.total_cases}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#5f6368]">Won</p>
                          <p className="font-bold text-green-600">{card.cases_won}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#5f6368]">Lost</p>
                          <p className="font-bold text-red-600">{card.cases_lost}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#5f6368]">Settled</p>
                          <p className="font-bold text-blue-600">{card.cases_settled}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#5f6368]">Win Rate</p>
                          <p className="font-bold text-[#1e3a8a]">{card.win_rate}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Cards Summary */}
      {selectedCards.length > 0 && (
        <div className="bg-gradient-to-r from-[#1e3a8a] to-[#3b82f6] rounded-2xl p-6 shadow-lg mb-6 text-white">
          <h2 className="text-xl font-bold mb-4">Selected Cards Summary ({selectedCards.length})</h2>
          
          <div className="grid grid-cols-5 gap-4 mb-4">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-sm text-white/80">Total Cases</p>
              <p className="text-2xl font-bold">{aggregatedStats.totalCases}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-sm text-white/80">Won</p>
              <p className="text-2xl font-bold">{aggregatedStats.casesWon}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-sm text-white/80">Lost</p>
              <p className="text-2xl font-bold">{aggregatedStats.casesLost}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-sm text-white/80">Settled</p>
              <p className="text-2xl font-bold">{aggregatedStats.casesSettled}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-sm text-white/80">Win Rate</p>
              <p className="text-2xl font-bold">{aggregatedStats.winRate}%</p>
            </div>
          </div>

          <p className="text-sm text-white/90">
            These statistics will be merged into your single profile after admin approval
          </p>
        </div>
      )}

      {/* Claim Form */}
      {selectedCards.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e0e3e7] p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#1a2332] mb-4">Submit Claim Request</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#1a2332] mb-2">
                Preferred Name *
              </label>
              <input
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Enter the name you want displayed on your profile"
                className="w-full px-4 py-3 border border-[#e0e3e7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
              <p className="text-xs text-[#5f6368] mt-1">
                This will be your official name after cards are merged
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1a2332] mb-2">
                Bar Registration Number
              </label>
              <input
                type="text"
                value={barNumber}
                onChange={(e) => setBarNumber(e.target.value)}
                placeholder="e.g., D/1234/2010"
                className="w-full px-4 py-3 border border-[#e0e3e7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
              <p className="text-xs text-[#5f6368] mt-1">
                Helps admin verify your identity
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1a2332] mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Explain why these cards belong to you or provide any additional context..."
                rows={4}
                className="w-full px-4 py-3 border border-[#e0e3e7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>

            <button
              onClick={handleSubmitClaim}
              disabled={loading}
              className="w-full py-4 bg-[#1e3a8a] text-white rounded-xl hover:bg-[#2563eb] transition-colors font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                'Submitting...'
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Submit Claim for {selectedCards.length} Card{selectedCards.length !== 1 ? 's' : ''}
                </>
              )}
            </button>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold mb-1">What happens next?</p>
                  <ul className="list-disc list-inside space-y-1 text-amber-800">
                    <li>Your claim will be reviewed by our admin team</li>
                    <li>We may contact you for additional verification</li>
                    <li>Once approved, all selected cards will merge into one</li>
                    <li>Your preferred name and aggregated statistics will be displayed</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Results */}
      {searchTerm && unclaimedCards.length === 0 && !searchLoading && (
        <div className="bg-white rounded-2xl border border-[#e0e3e7] p-12 shadow-sm text-center">
          <Search className="w-16 h-16 text-[#e0e3e7] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#1a2332] mb-2">No Cards Found</h3>
          <p className="text-[#5f6368] mb-4">
            We couldn't find any unclaimed cards matching "{searchTerm}"
          </p>
          <p className="text-sm text-[#5f6368]">
            Try different name variations or contact support if you believe your cards should be here
          </p>
        </div>
      )}
    </div>
  );
}
