// API Helper for Judge My Lawyer Platform
// Connects to Supabase backend

import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e36f2be2`;

// Helper to get auth token from localStorage
const getAuthToken = () => {
  const token = localStorage.getItem('supabase_auth_token');
  console.log('Getting auth token:', token ? 'Token found' : 'No token, using anon key');
  return token || publicAnonKey;
};

// Helper for API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  
  console.log('API Call:', {
    endpoint,
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
  });
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    console.error('API Error:', {
      endpoint,
      status: response.status,
      error
    });
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

// =====================================================
// LAWYER API
// =====================================================

export async function searchLawyers(params: {
  q?: string;
  specialization?: string;
  court?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.append('q', params.q);
  if (params.specialization) searchParams.append('specialization', params.specialization);
  if (params.court) searchParams.append('court', params.court);
  
  const queryString = searchParams.toString();
  const endpoint = `/lawyers/search${queryString ? `?${queryString}` : ''}`;
  
  return apiCall(endpoint);
}

export async function getLawyerById(id: string) {
  return apiCall(`/lawyers/${id}`);
}

export async function getMyProfile() {
  return apiCall('/lawyers/me');
}

export async function updateMyProfile(data: any) {
  return apiCall('/lawyers/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// =====================================================
// JUDGE API
// =====================================================

export async function searchJudges(params: {
  q?: string;
  court?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.append('q', params.q);
  if (params.court) searchParams.append('court', params.court);
  
  const queryString = searchParams.toString();
  const endpoint = `/judges/search${queryString ? `?${queryString}` : ''}`;
  
  return apiCall(endpoint);
}

export async function getJudgeById(id: string) {
  return apiCall(`/judges/${id}`);
}

// =====================================================
// COURT API
// =====================================================

export async function searchCourts(params: {
  q?: string;
  state?: string;
  type?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.append('q', params.q);
  if (params.state) searchParams.append('state', params.state);
  if (params.type) searchParams.append('type', params.type);
  
  const queryString = searchParams.toString();
  const endpoint = `/courts/search${queryString ? `?${queryString}` : ''}`;
  
  return apiCall(endpoint);
}

export async function getCourtById(id: string) {
  return apiCall(`/courts/${id}`);
}

// =====================================================
// CLAIMING SYSTEM API
// =====================================================

export async function searchUnclaimedEntities(params: {
  q: string;
  type: 'lawyer' | 'judge' | 'court';
}) {
  const searchParams = new URLSearchParams();
  searchParams.append('q', params.q);
  searchParams.append('type', params.type);
  
  return apiCall(`/entities/search?${searchParams.toString()}`);
}

export async function createCardClaim(data: {
  claimed_entity_type: 'lawyer' | 'judge' | 'court';
  claimed_entity_id: string;
  bar_council_certificate_url: string;
  id_proof_url: string;
}) {
  return apiCall('/card-claims', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createCaseClaim(data: {
  case_id: string;
  vakalatnama_url: string;
}) {
  return apiCall('/case-claims', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMyCardClaims() {
  return apiCall('/card-claims/my');
}

export async function getMyCaseClaims() {
  return apiCall('/case-claims/my');
}

export async function getPendingCardClaims() {
  return apiCall('/card-claims/pending');
}

export async function getPendingCaseClaims() {
  return apiCall('/case-claims/pending');
}

export async function reviewCardClaim(id: string, data: {
  status: 'approved' | 'rejected';
  admin_notes?: string;
}) {
  return apiCall(`/card-claims/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function reviewCaseClaim(id: string, data: {
  status: 'approved' | 'rejected';
  admin_notes?: string;
}) {
  return apiCall(`/case-claims/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// =====================================================
// FILE UPLOAD API
// =====================================================

export async function uploadDocument(file: File, folder: string = 'documents') {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Upload failed');
  }

  return response.json();
}

// =====================================================
// AUTHENTICATION HELPERS
// =====================================================

export function setAuthToken(token: string) {
  console.log('Setting auth token:', token.substring(0, 20) + '...');
  localStorage.setItem('supabase_auth_token', token);
}

export function clearAuthToken() {
  console.log('Clearing auth token');
  localStorage.removeItem('supabase_auth_token');
}

export function isAuthenticated() {
  const token = localStorage.getItem('supabase_auth_token');
  return !!token && token !== publicAnonKey;
}

// =====================================================
// ADMIN API
// =====================================================

// Check if current user is admin
export async function checkIsAdmin() {
  return apiCall('/auth/is-admin');
}

// Set admin status for a user (requires admin or service role)
export async function setAdminStatus(params: {
  userId?: string;
  email?: string;
  isAdmin: boolean;
}) {
  return apiCall('/auth/set-admin', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}