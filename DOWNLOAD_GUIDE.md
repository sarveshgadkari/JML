# 📥 Download Guide - Judge My Lawyer

## Files to Download (in order of priority)

### ✅ **CRITICAL FILES** (Must have)

#### Root Configuration
- [ ] `/package.json` - Dependencies
- [ ] `/vite.config.ts` - Build configuration
- [ ] `/postcss.config.mjs` - PostCSS config
- [ ] `/README.md` - Documentation
- [ ] `/.gitignore` - Git ignore rules

#### Main App
- [ ] `/src/app/App.tsx` - Main application component

#### Styles
- [ ] `/src/styles/index.css` - Main styles
- [ ] `/src/styles/tailwind.css` - Tailwind imports
- [ ] `/src/styles/theme.css` - Theme tokens
- [ ] `/src/styles/fonts.css` - Font imports

#### Supabase Configuration
- [ ] `/utils/supabase/info.tsx` - Supabase credentials (IMPORTANT!)
- [ ] `/src/utils/supabase/client.ts` - Supabase client
- [ ] `/src/utils/auth.ts` - Auth utilities
- [ ] `/src/utils/api.ts` - API utilities

---

### 🎨 **FRONTEND COMPONENTS** (Essential)

#### Main Components
- [ ] `/src/app/components/LandingPage.tsx`
- [ ] `/src/app/components/LoginModal.tsx`
- [ ] `/src/app/components/SearchLawyers.tsx`
- [ ] `/src/app/components/BackendTest.tsx` - Backend testing tool

#### Lawyer Components
- [ ] `/src/app/components/LawyersList.tsx`
- [ ] `/src/app/components/LawyerDetails.tsx`
- [ ] `/src/app/components/LawyerDashboard.tsx`

#### Judge Components
- [ ] `/src/app/components/JudgesList.tsx`
- [ ] `/src/app/components/JudgeDetails.tsx`

#### Court Components
- [ ] `/src/app/components/CourtsList.tsx`
- [ ] `/src/app/components/CourtDetails.tsx`

#### Dashboard Components
- [ ] `/src/app/components/ClientDashboard.tsx`
- [ ] `/src/app/components/AdminDashboard.tsx`

#### Claims Components
- [ ] `/src/app/components/ClaimCards.tsx`
- [ ] `/src/app/components/ClaimCases.tsx`
- [ ] `/src/app/components/MyClaims.tsx`
- [ ] `/src/app/components/MyCaseClaims.tsx`
- [ ] `/src/app/components/AdminClaimsApproval.tsx`
- [ ] `/src/app/components/AdminCaseClaimsApproval.tsx`

#### Figma Components
- [ ] `/src/app/components/figma/ImageWithFallback.tsx` - Image component

---

### 🎨 **UI COMPONENTS** (shadcn/ui)

Copy all files from `/src/app/components/ui/`:
- [ ] accordion.tsx
- [ ] alert-dialog.tsx
- [ ] alert.tsx
- [ ] avatar.tsx
- [ ] badge.tsx
- [ ] button.tsx
- [ ] card.tsx
- [ ] checkbox.tsx
- [ ] dialog.tsx
- [ ] input.tsx
- [ ] label.tsx
- [ ] select.tsx
- [ ] separator.tsx
- [ ] table.tsx
- [ ] tabs.tsx
- [ ] textarea.tsx
- [ ] tooltip.tsx
- [ ] utils.ts
- [ ] (and all others in the ui folder)

---

### 🚀 **BACKEND FILES** (Edge Functions)

#### Server Code
- [ ] `/supabase/functions/server/index.tsx` - Main server entry
- [ ] `/supabase/functions/server/api.tsx` - API routes
- [ ] `/supabase/functions/server/kv_store.tsx` - KV store utilities
- [ ] `/supabase/functions/server/schema-setup.ts` - Schema setup

#### Database Migrations
- [ ] `/supabase/migrations/001_initial_schema.sql` - Database schema

---

### 📚 **DOCUMENTATION FILES** (Optional but recommended)

- [ ] `/DATABASE_SCHEMA.md`
- [ ] `/CSV_IMPORT_SCHEMA.md`
- [ ] `/INTEGRATION_GUIDE.md`
- [ ] `/SUPABASE_SETUP.md`
- [ ] `/QUICK_START.md`

---

### 📊 **DATA FILES**

- [ ] `/src/app/data/mockData.ts` - Mock data

---

## 🛠️ **How to Download from Figma Make**

### Method 1: Individual File Download
1. Click file in sidebar
2. Right-click → Download
3. Save to corresponding folder

### Method 2: Copy-Paste
1. Open file in Figma Make
2. Select all (Cmd/Ctrl + A)
3. Copy (Cmd/Ctrl + C)
4. Create file locally with same path
5. Paste content

### Method 3: Use GitHub Integration
1. Look for "Connect to GitHub" in Figma Make
2. Authorize your GitHub account
3. Let Figma Make push everything automatically

---

## 📁 **Local Folder Structure**

```
judge-my-lawyer/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── figma/
│   │   │   └── [all component files]
│   │   ├── data/
│   │   │   └── mockData.ts
│   │   └── utils/
│   │       └── cardMergeUtils.ts
│   ├── styles/
│   │   ├── index.css
│   │   ├── tailwind.css
│   │   ├── theme.css
│   │   └── fonts.css
│   └── utils/
│       ├── api.ts
│       ├── auth.ts
│       └── supabase/
│           └── client.ts
├── supabase/
│   ├── functions/
│   │   └── server/
│   │       ├── index.tsx
│   │       ├── api.tsx
│   │       ├── kv_store.tsx
│   │       └── schema-setup.ts
│   └── migrations/
│       └── 001_initial_schema.sql
├── utils/
│   └── supabase/
│       └── info.tsx
├── package.json
├── vite.config.ts
├── postcss.config.mjs
├── .gitignore
└── README.md
```

---

## ⚡ **Quick Start After Download**

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 🔑 **Important Notes**

1. ⚠️ **Don't forget** `/utils/supabase/info.tsx` - Contains your Supabase credentials!
2. ✅ **Install dependencies** with `npm install` after downloading
3. 🔐 **Check** `.gitignore` is properly set up before pushing to GitHub
4. 📝 **Verify** all imports work after downloading

---

## 🆘 **Need Help?**

If files are missing or imports break:
1. Check the file path matches exactly
2. Ensure folder structure is correct
3. Run `npm install` to install dependencies
4. Check for typos in import statements

---

**Total Files to Download:** ~100+ files
**Estimated Time:** 15-30 minutes (manual) or 2 minutes (GitHub integration)

Good luck! 🚀
