import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// Create Supabase client singleton
const supabaseUrl = `https://${projectId}.supabase.co`;
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, publicAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
  }
  return supabaseClient;
}

// API base URL
export const API_BASE = `${supabaseUrl}/functions/v1/make-server-e36f2be2`;

// Helper to make authenticated API calls
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Card Claims API
export const cardClaimsAPI = {
  searchCards: (searchTerm: string) =>
    apiCall(`/cards/search?q=${encodeURIComponent(searchTerm)}`),
  
  createClaim: (data: {
    card_ids: string[];
    preferred_name: string;
    bar_registration_number?: string;
    notes?: string;
  }) =>
    apiCall('/card-claims', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getMyClaims: () =>
    apiCall('/card-claims/my-claims'),
  
  // Admin endpoints
  admin: {
    getPendingClaims: () =>
      apiCall('/admin/card-claims'),
    
    approveClaim: (claimId: string) =>
      apiCall(`/admin/card-claims/${claimId}/approve`, {
        method: 'POST',
      }),
    
    rejectClaim: (claimId: string, reason: string) =>
      apiCall(`/admin/card-claims/${claimId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejection_reason: reason }),
      }),
  },
};

// Case Claims API
export const caseClaimsAPI = {
  searchJudgments: (searchTerm: string, filterBy: 'case_number' | 'lawyer_name' | 'court' = 'case_number') =>
    apiCall(`/judgments/search?q=${encodeURIComponent(searchTerm)}&filter=${filterBy}`),
  
  createClaim: (data: {
    judgment_id: string;
    role: 'complainant' | 'respondent';
    client_name: string;
    vakaalatnama_url: string;
    notes?: string;
    case_number?: string;
  }) =>
    apiCall('/case-claims', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getMyClaims: () =>
    apiCall('/case-claims/my-claims'),
  
  // Admin endpoints
  admin: {
    getPendingClaims: () =>
      apiCall('/admin/case-claims'),
    
    approveClaim: (claimId: string) =>
      apiCall(`/admin/case-claims/${claimId}/approve`, {
        method: 'POST',
      }),
    
    rejectClaim: (claimId: string, reason: string) =>
      apiCall(`/admin/case-claims/${claimId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejection_reason: reason }),
      }),
  },
};

// File Upload API
export const uploadAPI = {
  getVakaalatnamaUploadUrl: (fileName: string, fileType: string) =>
    apiCall('/upload/vakaalatnama', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType }),
    }),
  
  uploadFile: async (file: File) => {
    // Step 1: Get signed upload URL
  const { uploadUrl, filePath } = await uploadAPI.getVakaalatnamaUploadUrl(
      file.name,
      file.type
    );
    
    // Step 2: Upload file to signed URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    
    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }
    
    // Step 3: Return public URL
    const supabase = getSupabase();
    const { data } = supabase.storage
      .from('vakaalatnamas')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  },
};

// Auth helpers
export const auth = {
  signUp: async (email: string, password: string, name: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });
    
    if (error) throw error;
    return data;
  },
  
  signIn: async (email: string, password: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },
  
  signOut: async () => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  
  getUser: async () => {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },
  
  getSession: async () => {
    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },
};

// Database queries (direct Supabase)
export const db = {
  lawyers: {
    getById: async (id: string) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('lawyers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    
    getAll: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('lawyers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  },
  
  lawyerCards: {
    getAll: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('lawyer_cards')
        .select('*')
        .in('status', ['unclaimed', 'claimed'])
        .or('is_master_card.eq.true')
        .order('total_cases', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    
    getById: async (id: string) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('lawyer_cards')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    
  },
  
  judgments: {
    getAll: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('judgments')
        .select(`
          *,
          court:courts(name, location),
          judge:judges(name)
        `)
        .order('judgment_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    
    getById: async (id: string) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('judgments')
        .select(`
          *,
          court:courts(name, location),
          judge:judges(name),
          complainant_card:complainant_lawyer_card_id(name_in_judgment, preferred_name),
          respondent_card:respondent_lawyer_card_id(name_in_judgment, preferred_name)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    getByJudgeId: async (judgeId: string) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('judgments')
        .select(`*, court:courts(name, location), judge:judges(name)`)
        .eq('judge_id', judgeId)
        .order('judgment_date', { ascending: false });

      if (error) throw error;
      return data;
    }
  },
  
  courts: {
    getAll: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('courts')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  },
  
  judges: {
    getAll: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('judges')
        .select(`
          *,
          court:courts(name)
        `)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    getById: async (id: string) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('judges')
        .select(`*, court:courts(name)`)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
  },
};

export default getSupabase;
