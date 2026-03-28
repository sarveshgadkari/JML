# 🎯 Priority Files Download List

Download these files **in this exact order** to get your app running quickly.

---

## **Phase 1: Core Setup (5 minutes)** ⚡

These 10 files will get your project structure ready:

1. ✅ `/package.json` - All dependencies
2. ✅ `/vite.config.ts` - Vite configuration  
3. ✅ `/postcss.config.mjs` - PostCSS config
4. ✅ `/.gitignore` - Git ignore rules
5. ✅ `/src/styles/index.css` - Main CSS
6. ✅ `/src/styles/tailwind.css` - Tailwind imports
7. ✅ `/src/styles/theme.css` - Theme tokens
8. ✅ `/utils/supabase/info.tsx` - **CRITICAL** Supabase credentials
9. ✅ `/src/utils/supabase/client.ts` - Supabase client
10. ✅ `/src/app/App.tsx` - Main app component

**After downloading these:**
```bash
npm install
npm run dev  # Should work with errors, but structure is ready
```

---

## **Phase 2: Essential Components (10 minutes)** 🎨

Download these to remove import errors:

11. `/src/app/components/LandingPage.tsx`
12. `/src/app/components/LoginModal.tsx`
13. `/src/app/components/SearchLawyers.tsx`
14. `/src/app/components/LawyersList.tsx`
15. `/src/app/components/LawyerDetails.tsx`
16. `/src/app/components/JudgesList.tsx`
17. `/src/app/components/JudgeDetails.tsx`
18. `/src/app/components/CourtsList.tsx`
19. `/src/app/components/CourtDetails.tsx`
20. `/src/app/components/LawyerDashboard.tsx`
21. `/src/app/components/ClientDashboard.tsx`
22. `/src/app/components/AdminDashboard.tsx`
23. `/src/app/data/mockData.ts`

---

## **Phase 3: UI Components (10 minutes)** 🎭

Download ALL files from `/src/app/components/ui/`:

- `button.tsx`
- `card.tsx`
- `input.tsx`
- `label.tsx`
- `select.tsx`
- `table.tsx`
- `dialog.tsx`
- `badge.tsx`
- `tabs.tsx`
- `separator.tsx`
- `utils.ts`
- ... (and ~40 more UI component files)

**Quick tip:** Select all files in the `ui` folder and download them together if possible.

---

## **Phase 4: Backend (5 minutes)** 🚀

Download backend files:

24. `/supabase/functions/server/index.tsx` - Main server
25. `/supabase/functions/server/api.tsx` - API routes
26. `/supabase/functions/server/kv_store.tsx` - KV utilities
27. `/supabase/migrations/001_initial_schema.sql` - Database schema
28. `/src/utils/auth.ts` - Auth utilities
29. `/src/utils/api.ts` - API client

---

## **Phase 5: Additional Features (5 minutes)** ✨

30. `/src/app/components/BackendTest.tsx` - Testing tool
31. `/src/app/components/ClaimCards.tsx`
32. `/src/app/components/ClaimCases.tsx`
33. `/src/app/components/MyClaims.tsx`
34. `/src/app/components/figma/ImageWithFallback.tsx`
35. `/README.md` - Documentation

---

## **Phase 6: Documentation (Optional)** 📚

- `/DATABASE_SCHEMA.md`
- `/CSV_IMPORT_SCHEMA.md`
- `/INTEGRATION_GUIDE.md`
- `/SUPABASE_SETUP.md`

---

## 📊 **Progress Tracker**

```
Phase 1: Core Setup          [ ] 0/10 files
Phase 2: Components          [ ] 0/13 files  
Phase 3: UI Components       [ ] 0/~45 files
Phase 4: Backend             [ ] 0/6 files
Phase 5: Additional          [ ] 0/6 files
Phase 6: Documentation       [ ] 0/4 files
───────────────────────────────────────
Total Progress:              [ ] 0/84+ files
```

---

## 🚀 **Quick Test After Each Phase**

### After Phase 1:
```bash
npm install
npm run dev
# Should start but show errors
```

### After Phase 2:
```bash
npm run dev
# Should load landing page with UI errors
```

### After Phase 3:
```bash
npm run dev
# Should work fully! 🎉
```

### After Phase 4:
```bash
# Backend integration complete
# Test API calls work
```

---

## 💡 **Pro Tips**

1. **Download by folder:** If Figma Make allows, download entire `/src/app/components/ui/` folder at once
2. **Keep the same paths:** Ensure local file paths match exactly
3. **Check imports:** After each phase, run `npm run dev` to catch missing files
4. **Use version control:** Commit after each phase

---

## ⚡ **Fastest Method**

If Figma Make has **GitHub integration**:
1. Click "Connect to GitHub" or "Export"
2. Authorize GitHub
3. All files pushed automatically in 2 minutes! ✨

---

## 🆘 **Troubleshooting**

**Error: Cannot find module 'X'**
- Download the missing file from Figma Make
- Check the import path matches file location

**Error: Module not found**
- Run `npm install`
- Check package.json was downloaded

**Blank page**
- Check browser console for errors
- Verify App.tsx was downloaded
- Check all imports in App.tsx

---

**Total Time Estimate:**
- Manual: 30-45 minutes
- GitHub Integration: 2-5 minutes

Good luck! 🎯
