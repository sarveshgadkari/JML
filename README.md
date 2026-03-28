# ⚖️ Judge My Lawyer

A comprehensive legal analytics platform that evaluates court judgments to create ranking cards for lawyers, judges, and courts with detailed statistics and performance metrics.

## 🌟 Features

### **For Public Users (No Login Required)**
- 🔍 **Search Lawyers** - Find lawyers with detailed performance analytics
- 👨‍⚖️ **Judge Rankings** - View judge statistics including dismiss rates and case performance
- 🏛️ **Court Analytics** - Explore court-wise performance metrics
- 📊 **Comprehensive Stats** - Win rates, settlement rates, average case duration, and more
- 💰 **Monetized with Google Ads** - Strategically placed throughout the platform

### **For Clients**
- 💾 **Save Lawyers** - Bookmark lawyers for future reference
- 📝 **Consultation Requests** - Manage consultation requests with lawyers
- 📊 **Personal Dashboard** - Track saved lawyers and requests

### **For Lawyers**
- 🎯 **Profile Management** - Update bio, specializations, courts, and contact info
- 📈 **Performance Dashboard** - View detailed analytics and case statistics
- 💼 **Case Insights** - Track case outcomes and performance metrics

### **For Admins**
- 📥 **CSV Import** - Bulk import cases with validation
- ✅ **Automatic Entity Creation** - Auto-create lawyers, judges, and courts
- 🔧 **Multi-Lawyer Support** - Handle cases with multiple lawyers per side
- 📊 **Platform Analytics** - Monitor overall platform statistics

## 🎨 Design

- **Premium Theme**: Navy blue (#1a2332) and gold (#d4a574) color scheme
- **Responsive**: Works seamlessly on desktop and mobile
- **Sophisticated UI**: Card-based layouts with smooth animations

## 🏗️ Tech Stack

### **Frontend**
- ⚛️ **React** - UI components and state management
- 🎨 **Tailwind CSS v4** - Utility-first styling
- 🎯 **TypeScript** - Type safety
- 🎭 **Lucide Icons** - Beautiful icon set

### **Backend**
- 🚀 **Supabase Edge Functions** - Serverless API (Deno runtime)
- 🗄️ **PostgreSQL** - Database with Supabase
- 🔐 **Supabase Auth** - Authentication system
- 📦 **Hono** - Lightweight web framework for edge functions

## 📊 Database Schema

### **Core Tables**
- `lawyers` - Lawyer profiles and metadata
- `judges` - Judge information
- `courts` - Court details
- `cases` - Case records
- `case_lawyers` - Junction table for multi-lawyer cases (with sides: Petitioner/Respondent)
- `kv_store_e36f2be2` - Key-value store for flexible data

### **Legal Outcome Values**
- ✅ In favor of Complainant
- ✅ In favor of Respondent
- 🤝 Settled
- ❌ Dismissed
- ⚖️ Partially Granted
- 📤 Withdrawn

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ 
- Supabase account
- Git

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR-USERNAME/judge-my-lawyer.git
   cd judge-my-lawyer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project
   - Run the database migrations (see `/supabase/migrations/`)
   - Deploy the Edge Function from `/supabase/functions/server/`

4. **Configure environment variables**
   - Copy `env.example` to `.env`
   - Set `VITE_SUPABASE_PROJECT_ID` and `VITE_SUPABASE_ANON_KEY`

5. **Run the development server**
   ```bash
   npm run dev
   ```

## 📥 CSV Import Format

Download the template from the Admin Dashboard or use this format:

```csv
case_number,case_title,case_type,court_name,judge_name,petitioner_lawyers,respondent_lawyers,filing_date,judgment_date,status,outcome,petitioner_name,respondent_name,total_hearings,summary
```

**Multi-lawyer support:** Separate multiple lawyers with semicolons:
```
Lawyer A; Lawyer B; Lawyer C
```

## 📈 Analytics Calculated

### **Lawyer Metrics**
- Win Rate, Loss Rate, Settlement Rate, Dismiss Rate
- Average Case Duration
- Average Hearings per Case
- Petitioner vs Respondent Case Distribution
- Case Type Distribution
- Court-wise Performance

### **Judge Metrics**
- Total Cases Handled
- Dismiss Rate
- Disposal Rate
- Average Case Duration
- Case Type Distribution

### **Court Metrics**
- Total Cases
- Disposal Rate
- Average Case Duration
- Average Hearings
- Case Type Distribution

## 🔐 Authentication Roles

- **Public** - Browse all content without login
- **Client** - Save lawyers, request consultations
- **Lawyer** - Manage profile, view analytics
- **Admin** - Import cases, manage platform (set `is_admin` flag in Supabase)

## 🛣️ API Endpoints

```
GET  /make-server-e36f2be2/health
GET  /make-server-e36f2be2/lawyers/search?q=
GET  /make-server-e36f2be2/lawyers/:id
GET  /make-server-e36f2be2/judges/search?q=
GET  /make-server-e36f2be2/judges/:id
GET  /make-server-e36f2be2/courts/search?q=
GET  /make-server-e36f2be2/courts/:id
GET  /make-server-e36f2be2/import/template
POST /make-server-e36f2be2/import/validate
POST /make-server-e36f2be2/import/cases
```

## 📝 License

MIT License - feel free to use this project for your own legal analytics platform!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Built with ⚖️ by the Judge My Lawyer Team**
