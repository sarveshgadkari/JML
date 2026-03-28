import { useState, useEffect } from 'react';
import { User, Mail, Phone, Briefcase, Award, Edit2, Save, Building2, FileText, Scale, FolderOpen, ClipboardList, TrendingUp, Clock, Calendar, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import ClaimCards from './ClaimCards';
import ClaimCases from './ClaimCases';
import MyClaims from './MyClaims';
import MyCaseClaims from './MyCaseClaims';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import getSupabase from '../../utils/supabase/client';

export default function LawyerDashboard() {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'claim-cards' | 'claim-cases' | 'my-claims'>('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    bar_registration: '',
    experience: 0,
    specialization: [] as string[],
    courts: [] as string[],
    bio: '',
    address: '',
    stats: {
      rank: 0,
      totalCases: 0,
      winRate: '0',
      lossRate: '0',
      settlementRate: '0',
      avgCaseDuration: 0,
      avgHearings: '0'
    }
  });

  const [editedProfile, setEditedProfile] = useState(profile);

  // Fetch lawyer profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const supabase = getSupabase();
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) throw new Error('No active user session found.');

      let { data: lawyer, error } = await supabase
        .from('lawyers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Auto-bootstrap profile if missing.
      if (!lawyer && !error) {
        const email = user.email || '';
        const name = (user.user_metadata?.name as string) || email.split('@')[0] || 'Lawyer';
        const phone = (user.user_metadata?.phone as string) || '';
        const { data: inserted, error: insertError } = await supabase
          .from('lawyers')
          .insert({
            user_id: user.id,
            name,
            email,
            phone,
            is_verified: false,
            is_admin: false,
          })
          .select('*')
          .single();
        if (insertError) throw insertError;
        lawyer = inserted;
      }

      if (error) throw error;
      if (!lawyer) throw new Error('Profile not found and could not be created.');

      // Prefer authoritative stats from lawyer_analytics (wide, precomputed)
      let { data: la } = await supabase
        .from('lawyer_analytics')
        .select('lawyer_id,lawyer_name,total_cases,won_cases,lost_cases,settled_cases,avg_case_duration_days,avg_hearings,win_rate,loss_rate,settlement_rate,win_rate_score,experience_score,velocity_score')
        .eq('lawyer_id', lawyer.id)
        .maybeSingle();
      // Fallback by name (if not yet linked by id)
      if (!la) {
        const byName = await supabase
          .from('lawyer_analytics')
          .select('lawyer_id,lawyer_name,total_cases,won_cases,lost_cases,settled_cases,avg_case_duration_days,avg_hearings,win_rate,loss_rate,settlement_rate,win_rate_score,experience_score,velocity_score')
          .ilike('lawyer_name', lawyer.name);
        la = (byName.data && byName.data[0]) || null;
      }

      const totalCases = Number(la?.total_cases ?? 0);
      const won = Number(la?.won_cases ?? 0);
      const lost = Number(la?.lost_cases ?? 0);
      const settled = Number(la?.settled_cases ?? 0);
      const outcomeBase = Math.max(1, won + lost + settled);
      const winRatePct = ((won / outcomeBase) * 100).toFixed(1);
      const lossRatePct = ((lost / outcomeBase) * 100).toFixed(1);
      const settleRatePct = ((settled / outcomeBase) * 100).toFixed(1);
      const avgHearings = (Number(la?.avg_hearings ?? 0)).toFixed(1);
      const avgCaseDuration = Math.round(Number(la?.avg_case_duration_days ?? 0));

      const mappedProfile = {
        ...profile,
        ...lawyer,
        specialization: lawyer.specialization ?? [],
        courts: lawyer.courts ?? [],
        stats: {
          rank: Math.round(Number(la?.win_rate_score ?? 0)), // display a primary score; can be refined
          totalCases,
          winRate: winRatePct,
          lossRate: lossRatePct,
          settlementRate: settleRatePct,
          avgCaseDuration,
          avgHearings,
        },
      };

      setProfile(mappedProfile);
      setEditedProfile(mappedProfile);
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const supabase = getSupabase();
      const { error } = await supabase
        .from('lawyers')
        .update({
        name: editedProfile.name,
        phone: editedProfile.phone,
        specialization: editedProfile.specialization,
        courts: editedProfile.courts,
        bio: editedProfile.bio,
        address: editedProfile.address,
          experience: editedProfile.experience,
          bar_registration: editedProfile.bar_registration,
        })
        .eq('id', editedProfile.id);
      if (error) throw error;
      
      setProfile(editedProfile);
      setIsEditing(false);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  if (loading && !profile.id) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !profile.id) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Profile</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={loadProfile}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lawyer Dashboard</h1>
        <p className="text-gray-600">Manage your profile and view your statistics</p>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
        <div className="flex flex-wrap border-b border-gray-200">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'profile'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <User className="w-5 h-5" />
            My Profile
          </button>
          <button
            onClick={() => setActiveTab('claim-cards')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'claim-cards'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <FileText className="w-5 h-5" />
            Claim Cards
          </button>
          <button
            onClick={() => setActiveTab('claim-cases')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'claim-cases'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Scale className="w-5 h-5" />
            Claim Cases
          </button>
          <button
            onClick={() => setActiveTab('my-claims')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'my-claims'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            My Claims
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <>
          {/* Stats Overview */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-gray-600">Your Rank</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">#{profile.stats.rank}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">Total Cases</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">{profile.stats.totalCases}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">Win Rate</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{profile.stats.winRate}%</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-gray-600">Avg Hearings</span>
              </div>
              <p className="text-3xl font-bold text-purple-600">{profile.stats.avgHearings}</p>
            </div>
          </div>

          {/* Profile Management */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Profile Information</h2>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProfile.name}
                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editedProfile.email}
                    onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.email}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editedProfile.phone}
                    onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.phone}</p>
                )}
              </div>

              {/* Bar Registration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Briefcase className="w-4 h-4 inline mr-1" />
                  Bar Registration
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProfile.bar_registration}
                    onChange={(e) => setEditedProfile({ ...editedProfile, bar_registration: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.bar_registration}</p>
                )}
              </div>

              {/* Experience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Years of Experience
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    value={editedProfile.experience}
                    onChange={(e) => setEditedProfile({ ...editedProfile, experience: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.experience} years</p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Office Address
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProfile.address}
                    onChange={(e) => setEditedProfile({ ...editedProfile, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.address}</p>
                )}
              </div>

              {/* Bio */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Professional Bio
                </label>
                {isEditing ? (
                  <textarea
                    value={editedProfile.bio}
                    onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.bio}</p>
                )}
              </div>

              {/* Specialization */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specialization
                </label>
                <div className="flex flex-wrap gap-2">
                  {(profile.specialization ?? []).map((spec, idx) => (
                    <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              {/* Courts */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Courts of Practice
                </label>
                <div className="flex flex-wrap gap-2">
                  {(profile.courts ?? []).map((court, idx) => (
                    <span key={idx} className="px-3 py-1 bg-green-50 text-green-700 rounded-full">
                      {court}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Visibility Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-green-900 mb-1">Profile is Live</h3>
                <p className="text-sm text-green-700">
                  Your profile is visible to clients searching for lawyers. Keep your contact information up to date to receive client inquiries.
                </p>
              </div>
            </div>
          </div>

          {/* Public Profile Preview */}
          <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Public Profile Preview</h2>
                <p className="text-sm text-gray-600">This is how clients see your profile</p>
              </div>
            </div>

            {/* Public Profile Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
              {/* Header with Navy Blue Background */}
              <div className="bg-gradient-to-r from-[#1e3a8a] to-[#1e40af] p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-3xl font-bold border-2 border-white/30">
                        {profile.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold mb-1">{profile.name}</h3>
                        <p className="text-blue-100 text-sm">{profile.bar_registration}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="px-4 py-1.5 bg-amber-400 text-amber-900 rounded-full text-sm font-bold flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        Rank #{profile.stats.rank}
                      </div>
                      <div className="px-3 py-1 bg-green-400 text-green-900 rounded-full text-xs font-semibold">
                        ✓ VERIFIED
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-gray-200">
                <div className="grid grid-cols-4 divide-x divide-gray-300">
                  <div className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{profile.stats.totalCases}</div>
                    <div className="text-xs text-gray-600 font-medium">Total Cases</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{profile.stats.winRate}%</div>
                    <div className="text-xs text-gray-600 font-medium">Win Rate</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{profile.stats.avgCaseDuration}</div>
                    <div className="text-xs text-gray-600 font-medium">Avg Days</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{profile.stats.avgHearings}</div>
                    <div className="text-xs text-gray-600 font-medium">Avg Hearings</div>
                  </div>
                </div>
              </div>

              {/* Profile Details */}
              <div className="p-6 space-y-4">
                {/* About */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    About
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed">{profile.bio}</p>
                </div>

                {/* Specialization */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Specialization
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(profile.specialization ?? []).map((spec, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Courts of Practice */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Courts of Practice
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(profile.courts ?? []).map((court, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {court}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Experience</h4>
                  <p className="text-gray-900 font-medium">{profile.experience} years of practice</p>
                </div>

                {/* Contact Information */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{profile.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{profile.phone}</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-600">{profile.address}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button className="flex-1 bg-gradient-to-r from-[#1e3a8a] to-[#1e40af] text-white py-3 px-4 rounded-lg font-semibold hover:from-[#1e40af] hover:to-[#1e3a8a] transition-all shadow-md hover:shadow-lg">
                    💾 Save Lawyer
                  </button>
                  <button className="flex-1 bg-white border-2 border-[#1e3a8a] text-[#1e3a8a] py-3 px-4 rounded-lg font-semibold hover:bg-blue-50 transition-all">
                    📞 Request Consultation
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Note */}
            <div className="mt-4 flex items-start gap-2 text-sm text-blue-800 bg-blue-100 p-3 rounded-lg">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold mb-1">Preview Mode</p>
                <p className="text-blue-700">This is a live preview of how your profile appears in search results and detail pages. Edit your profile above to see changes reflected here.</p>
              </div>
            </div>
          </div>

          {/* Full Detail Page Preview */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Complete Analytics View</h2>
                <p className="text-sm text-gray-600">Detailed performance metrics that clients can explore</p>
              </div>
            </div>

            {/* Story Section 1: Performance Overview */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 mb-6">
              <div className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  🎯 Your Track Record at a Glance
                </h3>
                <p className="text-blue-100 text-sm mt-1">Proven results that speak for themselves</p>
              </div>
              
              <div className="p-6">
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Win Rate Analysis */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">Success Rate</h4>
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="text-4xl font-bold text-green-600 mb-2">{profile.stats.winRate}%</div>
                    <p className="text-sm text-gray-600">Cases won favorably</p>
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Industry avg:</span>
                        <span className="font-semibold text-gray-900">62%</span>
                      </div>
                      <div className="mt-2 bg-green-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-green-500 h-full" style={{ width: `${profile.stats.winRate}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Case Volume */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">Total Experience</h4>
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <Briefcase className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="text-4xl font-bold text-blue-600 mb-2">{profile.stats.totalCases}</div>
                    <p className="text-sm text-gray-600">Cases handled</p>
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-gray-900">Top 1% in experience</span>
                      </div>
                    </div>
                  </div>

                  {/* Efficiency */}
                  <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-xl border-2 border-purple-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">Average Duration</h4>
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="text-4xl font-bold text-purple-600 mb-2">{profile.stats.avgCaseDuration}</div>
                    <p className="text-sm text-gray-600">Days per case</p>
                    <div className="mt-4 pt-4 border-t border-purple-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Court avg:</span>
                        <span className="font-semibold text-gray-900">320 days</span>
                      </div>
                      <p className="text-xs text-green-600 mt-1 font-medium">23% faster resolution</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Story Section 2: Case Outcomes Breakdown */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 mb-6">
              <div className="bg-gradient-to-r from-[#059669] to-[#10b981] px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  ⚖️ Case Outcomes Distribution
                </h3>
                <p className="text-green-100 text-sm mt-1">How cases are resolved</p>
              </div>
              
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Pie Chart */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Outcome Breakdown</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Won', value: profile.stats.winRate, color: '#10b981' },
                            { name: 'Lost', value: profile.stats.lossRate, color: '#ef4444' },
                            { name: 'Settled', value: profile.stats.settlementRate, color: '#f59e0b' },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#ef4444" />
                          <Cell fill="#f59e0b" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Outcome Stats */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xl">✓</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Cases Won</p>
                          <p className="text-xs text-gray-600">Favorable judgments</p>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-green-600">{profile.stats.winRate}%</div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xl">✗</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Cases Lost</p>
                          <p className="text-xs text-gray-600">Unfavorable outcomes</p>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-red-600">{profile.stats.lossRate}%</div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xl">⚡</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Cases Settled</p>
                          <p className="text-xs text-gray-600">Out of court</p>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-amber-600">{profile.stats.settlementRate}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Story Section 3: Efficiency Metrics */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 mb-6">
              <div className="bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  ⚡ Efficiency & Speed
                </h3>
                <p className="text-purple-100 text-sm mt-1">How quickly cases are resolved</p>
              </div>
              
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Case Duration Comparison */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Case Resolution Speed</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: 'You', duration: profile.stats.avgCaseDuration },
                        { name: 'Court Avg', duration: 320 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="duration" fill="#7c3aed" />
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="text-sm text-gray-600 mt-3 text-center">
                      <span className="font-semibold text-green-600">23% faster</span> than court average
                    </p>
                  </div>

                  {/* Hearings Efficiency */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Average Hearings per Case</h4>
                    <div className="flex items-center justify-center h-[200px]">
                      <div className="text-center">
                        <div className="text-7xl font-bold text-purple-600 mb-2">{profile.stats.avgHearings}</div>
                        <p className="text-gray-600 font-medium">hearings</p>
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                          <TrendingUp className="w-4 h-4" />
                          Efficient case management
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Story Section 4: Practice Areas Performance */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 mb-6">
              <div className="bg-gradient-to-r from-[#0891b2] to-[#06b6d4] px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  📊 Performance by Practice Area
                </h3>
                <p className="text-cyan-100 text-sm mt-1">Success rates across specializations</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {(profile.specialization ?? []).map((area, idx) => {
                    const winRates = [85.5, 72.3, 91.2, 68.9, 76.4];
                    const caseCounts = [156, 98, 87, 45, 101];
                    const winRate = winRates[idx % winRates.length];
                    const caseCount = caseCounts[idx % caseCounts.length];
                    
                    return (
                      <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">{area}</h4>
                          <span className="text-sm text-gray-600">{caseCount} cases</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-600">Win Rate</span>
                              <span className="font-bold text-green-600">{winRate}%</span>
                            </div>
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                                style={{ width: `${winRate}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Story Section 5: Court-wise Performance */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 mb-6">
              <div className="bg-gradient-to-r from-[#dc2626] to-[#ef4444] px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  🏛️ Court-wise Performance
                </h3>
                <p className="text-red-100 text-sm mt-1">Track record across different courts</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {(profile.courts ?? []).map((court, idx) => {
                    const stats = [
                      { cases: 234, wins: 182, winRate: 77.8 },
                      { cases: 198, wins: 156, winRate: 78.8 },
                      { cases: 55, wins: 43, winRate: 78.2 }
                    ];
                    const courtStat = stats[idx % stats.length];
                    
                    return (
                      <div key={idx} className="p-5 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg border-2 border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                              <Building2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900">{court}</h4>
                              <p className="text-sm text-gray-600">{courtStat.cases} total cases</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">{courtStat.winRate}%</div>
                            <p className="text-xs text-gray-600">Success rate</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-300">
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-600">{courtStat.wins}</div>
                            <div className="text-xs text-gray-600">Won</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-red-600">{courtStat.cases - courtStat.wins}</div>
                            <div className="text-xs text-gray-600">Lost</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-amber-600">{Math.floor(courtStat.cases * 0.06)}</div>
                            <div className="text-xs text-gray-600">Settled</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Final CTA */}
            <div className="bg-gradient-to-r from-[#1e3a8a] to-[#1e40af] rounded-xl p-8 text-center text-white">
              <h3 className="text-2xl font-bold mb-2">Ready to Get Expert Legal Help?</h3>
              <p className="text-blue-100 mb-6">Contact {profile.name} for a consultation today</p>
              <div className="flex gap-4 justify-center">
                <button className="bg-white text-[#1e3a8a] px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-all shadow-lg">
                  📞 Request Consultation
                </button>
                <button className="bg-amber-400 text-amber-900 px-8 py-3 rounded-lg font-semibold hover:bg-amber-300 transition-all shadow-lg">
                  💾 Save to Favorites
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'claim-cards' && (
        <ClaimCards lawyerId={profile.id} lawyerName={profile.name} />
      )}

      {activeTab === 'claim-cases' && (
        <ClaimCases lawyerId={profile.id} lawyerName={profile.name} />
      )}

      {activeTab === 'my-claims' && (
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Card Claims Status
            </h2>
            <MyClaims lawyerId={profile.id} />
          </div>
          
          <div className="border-t-2 border-gray-200 pt-8">
            <h2 className="text-2xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
              <Scale className="w-6 h-6" />
              Case Claims Status
            </h2>
            <MyCaseClaims lawyerId={profile.id} />
          </div>
        </div>
      )}
    </div>
  );
}