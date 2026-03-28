import { useState } from 'react';
import { Search, Filter, TrendingUp, Briefcase, Clock, Calendar } from 'lucide-react';
import { mockLawyers } from '../data/mockData';

interface SearchLawyersProps {
  onViewDetails: (id: string) => void;
}

export default function SearchLawyers({ onViewDetails }: SearchLawyersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourt, setSelectedCourt] = useState('');
  const [selectedCaseType, setSelectedCaseType] = useState('');
  const [minWinRate, setMinWinRate] = useState(0);

  // Get unique courts and case types
  const allCourts = Array.from(new Set(mockLawyers.flatMap(l => l.courts))).sort();
  const allCaseTypes = Array.from(new Set(mockLawyers.flatMap(l => l.specialization))).sort();

  // Filter lawyers based on search criteria
  const filteredLawyers = mockLawyers.filter(lawyer => {
    const matchesSearch = searchQuery === '' || 
      lawyer.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCourt = selectedCourt === '' || 
      lawyer.courts.includes(selectedCourt);
    
    const matchesCaseType = selectedCaseType === '' || 
      lawyer.specialization.includes(selectedCaseType);
    
    const matchesWinRate = lawyer.winRate >= minWinRate;

    return matchesSearch && matchesCourt && matchesCaseType && matchesWinRate;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Find a Lawyer</h1>
        <p className="text-gray-600">Search and filter lawyers based on your requirements</p>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search by Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by Name
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter lawyer name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter by Court */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Court
            </label>
            <select
              value={selectedCourt}
              onChange={(e) => setSelectedCourt(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Courts</option>
              {allCourts.map(court => (
                <option key={court} value={court}>{court}</option>
              ))}
            </select>
          </div>

          {/* Filter by Case Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Case Type
            </label>
            <select
              value={selectedCaseType}
              onChange={(e) => setSelectedCaseType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Case Types</option>
              {allCaseTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Filter by Win Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Win Rate: {minWinRate}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={minWinRate}
              onChange={(e) => setMinWinRate(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Active Filters */}
        {(searchQuery || selectedCourt || selectedCaseType || minWinRate > 0) && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600">Active Filters:</span>
            {searchQuery && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full flex items-center gap-1">
                Search: {searchQuery}
                <button onClick={() => setSearchQuery('')} className="hover:text-blue-900">×</button>
              </span>
            )}
            {selectedCourt && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full flex items-center gap-1">
                Court: {selectedCourt}
                <button onClick={() => setSelectedCourt('')} className="hover:text-green-900">×</button>
              </span>
            )}
            {selectedCaseType && (
              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full flex items-center gap-1">
                Type: {selectedCaseType}
                <button onClick={() => setSelectedCaseType('')} className="hover:text-purple-900">×</button>
              </span>
            )}
            {minWinRate > 0 && (
              <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full flex items-center gap-1">
                Min Win Rate: {minWinRate}%
                <button onClick={() => setMinWinRate(0)} className="hover:text-orange-900">×</button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCourt('');
                setSelectedCaseType('');
                setMinWinRate(0);
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mb-4">
        <p className="text-gray-600">
          Found <span className="font-semibold text-gray-900">{filteredLawyers.length}</span> lawyer{filteredLawyers.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Lawyers List */}
      <div className="space-y-4">
        {filteredLawyers.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Filter className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No lawyers found</h3>
            <p className="text-gray-600">Try adjusting your search criteria</p>
          </div>
        ) : (
          filteredLawyers.map((lawyer) => (
            <div
              key={lawyer.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition cursor-pointer"
              onClick={() => onViewDetails(lawyer.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">{lawyer.name}</h2>
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
                      Rank #{lawyer.rank}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {lawyer.specialization.map((spec, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-purple-50 text-purple-700 text-sm rounded-full"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>

                  <p className="text-sm text-gray-600 mb-3">
                    {lawyer.experience} years experience • {lawyer.barRegistration}
                  </p>

                  <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                    {lawyer.courts.map((court, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {court}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="text-center bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-xl font-bold text-green-600">{lawyer.winRate}%</span>
                    </div>
                    <p className="text-xs text-gray-500">Win Rate</p>
                  </div>
                  <div className="text-center bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                      <span className="text-xl font-bold text-gray-900">{lawyer.totalCases}</span>
                    </div>
                    <p className="text-xs text-gray-500">Cases</p>
                  </div>
                  <div className="text-center bg-orange-50 p-3 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-semibold text-gray-900">{lawyer.avgCaseDuration}d</span>
                    </div>
                    <p className="text-xs text-gray-500">Avg Duration</p>
                  </div>
                  <div className="text-center bg-purple-50 p-3 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-semibold text-gray-900">{lawyer.avgHearings}</span>
                    </div>
                    <p className="text-xs text-gray-500">Avg Hearings</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              {(lawyer.contactEmail || lawyer.contactPhone) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex gap-4 text-sm">
                    {lawyer.contactEmail && (
                      <a
                        href={`mailto:${lawyer.contactEmail}`}
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lawyer.contactEmail}
                      </a>
                    )}
                    {lawyer.contactPhone && (
                      <a
                        href={`tel:${lawyer.contactPhone}`}
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lawyer.contactPhone}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
