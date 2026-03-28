import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as api from "./api.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-e36f2be2/health", (c) => {
  return c.json({ status: "ok" });
});

// =====================================================
// LAWYER ROUTES
// =====================================================

app.get("/make-server-e36f2be2/lawyers/search", api.searchLawyers);
app.get("/make-server-e36f2be2/lawyers/:id", api.getLawyerById);
app.put("/make-server-e36f2be2/lawyers/profile", api.updateLawyerProfile);
app.get("/make-server-e36f2be2/lawyers/me", api.getMyProfile);

// =====================================================
// JUDGE ROUTES
// =====================================================

app.get("/make-server-e36f2be2/judges/search", api.searchJudges);
app.get("/make-server-e36f2be2/judges/:id", api.getJudgeById);

// =====================================================
// COURT ROUTES
// =====================================================

app.get("/make-server-e36f2be2/courts/search", api.searchCourts);
app.get("/make-server-e36f2be2/courts/:id", api.getCourtById);

// =====================================================
// CLAIMING SYSTEM ROUTES
// =====================================================

// Search unclaimed entities
app.get("/make-server-e36f2be2/entities/search", api.searchUnclaimedEntities);

// Card claims (for merging duplicate profiles)
app.post("/make-server-e36f2be2/card-claims", api.createCardClaim);
app.get("/make-server-e36f2be2/card-claims/my", api.getMyCardClaims);
app.get("/make-server-e36f2be2/card-claims/pending", api.getPendingCardClaims);
app.put("/make-server-e36f2be2/card-claims/:id/review", api.reviewCardClaim);

// Case claims (for individual cases)
app.post("/make-server-e36f2be2/case-claims", api.createCaseClaim);
app.get("/make-server-e36f2be2/case-claims/my", api.getMyCaseClaims);
app.get("/make-server-e36f2be2/case-claims/pending", api.getPendingCaseClaims);
app.put("/make-server-e36f2be2/case-claims/:id/review", api.reviewCaseClaim);

// =====================================================
// DATA IMPORT ROUTES
// =====================================================

// CSV import for bulk case data
app.post("/make-server-e36f2be2/import/cases", api.importCasesFromCSV);
app.get("/make-server-e36f2be2/import/template", api.downloadCSVTemplate);

// =====================================================
// ADMIN MANAGEMENT ROUTES
// =====================================================

// Check if user is admin
app.get("/make-server-e36f2be2/auth/is-admin", api.checkIsAdmin);

// Set admin status (protected - requires existing admin or service role)
app.post("/make-server-e36f2be2/auth/set-admin", api.setAdminStatus);

// =====================================================
// STORAGE HELPERS
// =====================================================

// Upload document to Supabase Storage
app.post("/make-server-e36f2be2/upload", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const supabase = api.getSupabaseClient(authHeader);
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'documents';
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;
    
    // Upload to Supabase Storage
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(fileArrayBuffer);
    
    const { data, error } = await supabase
      .storage
      .from('make-e36f2be2-documents')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      });
    
    if (error) throw error;
    
    // Get signed URL
    const { data: signedUrlData } = await supabase
      .storage
      .from('make-e36f2be2-documents')
      .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year expiry
    
    return c.json({ 
      path: data.path,
      url: signedUrlData?.signedUrl
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return c.json({ error: 'Failed to upload file' }, 500);
  }
});

// Start the server
Deno.serve(app.fetch);