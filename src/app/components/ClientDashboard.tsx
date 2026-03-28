import { useState } from 'react';
import { Search, Bookmark, Clock, TrendingUp } from 'lucide-react';
import { mockLawyers } from '../data/mockData';

interface ClientDashboardProps {
  onViewDetails: (id: string) => void;
}

export default function ClientDashboard({ onViewDetails }: ClientDashboardProps) {
  // Mock saved lawyers
  const [savedLawyers] = useState(['1', '2', '3']);
  
  const savedLawyersData = mockLawyers.filter(l => savedLawyers.includes(l.id));

  // Mock recent searches
  const recentSearches = [
    { query: 'Criminal Law Delhi High Court', date: '2026-01-09' },
    { query: 'Corporate Law Supreme Court', date: '2026-01-08' },
    { query: 'Family Law Mumbai', date: '2026-01-07' }
  ];

  // Mock consultation requests
  const consultationRequests = [
    {
      id: '1',
      lawyer: 'Adv. Rajesh Kumar',
      caseType: 'Criminal Law',
      requestDate: '2026-01-08',
      status: 'Pending'
    },
    {
      id: '2',
      lawyer: 'Adv. Priya Sharma',
      caseType: 'Civil Law',
      requestDate: '2026-01-05',
      status: 'Confirmed'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Client Dashboard</h1>
        <p className="text-gray-600">Manage your saved lawyers and consultation requests</p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="bg-blue-600 text-white p-6 rounded-lg hover:bg-blue-700 transition text-left"
        >
          <Search className="w-8 h-8 mb-2" />
          <h3 className="font-semibold mb-1">Find a Lawyer</h3>
          <p className="text-sm text-blue-100">Search for lawyers by court and case type</p>
        </button>

        <div className="bg-white border border-gray-200 p-6 rounded-lg">
          <Bookmark className="w-8 h-8 text-blue-600 mb-2" />
          <h3 className="font-semibold text-gray-900 mb-1">Saved Lawyers</h3>
          <p className="text-2xl font-bold text-blue-600">{savedLawyers.length}</p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-lg">
          <Clock className="w-8 h-8 text-green-600 mb-2" />
          <h3 className="font-semibold text-gray-900 mb-1">Active Requests</h3>
          <p className="text-2xl font-bold text-green-600">{consultationRequests.length}</p>
        </div>
      </div>

      {/* Saved Lawyers */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-blue-600" />
          Saved Lawyers
        </h2>
        
        {savedLawyersData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bookmark className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No saved lawyers yet. Start searching to save your favorites!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedLawyersData.map((lawyer) => (
              <div
                key={lawyer.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                onClick={() => onViewDetails(lawyer.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{lawyer.name}</h3>
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                        Rank #{lawyer.rank}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {lawyer.specialization.map((spec, idx) => (
                        <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">
                          {spec}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600">
                      {lawyer.experience} years experience • {lawyer.totalCases} cases
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-lg font-bold text-green-600">{lawyer.winRate}%</span>
                    </div>
                    <p className="text-xs text-gray-500">Win Rate</p>
                  </div>
                </div>
                
                {(lawyer.contactEmail || lawyer.contactPhone) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-sm">
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
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Consultation Requests */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-green-600" />
          Consultation Requests
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Lawyer</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Case Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Request Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {consultationRequests.map((request) => (
                <tr key={request.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">{request.lawyer}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                      {request.caseType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{request.requestDate}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs rounded ${
                      request.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                      request.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button className="text-blue-600 hover:text-blue-700 text-sm">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Searches */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-600" />
          Recent Searches
        </h2>
        
        <div className="space-y-2">
          {recentSearches.map((search, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900">{search.query}</span>
              </div>
              <span className="text-sm text-gray-500">{search.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
