# Judge My Lawyer - Card Claiming Workflow Visual Guide

## 📊 COMPLETE WORKFLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: JUDGMENT UPLOAD (ADMIN)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  Admin uploads court judgment files/CSV     │
          │  System extracts lawyer names from text     │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  Creates lawyer_cards with:                 │
          │  - name_in_judgment: "Adv. Rajesh Kumar"    │
          │  - status: 'unclaimed'                      │
          │  - total_cases: 156                         │
          │  - win_rate: 62.82%                         │
          └─────────────────────────────────────────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   ▼                ▼                ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ Card #1      │  │ Card #2      │  │ Card #3      │
        │ "Adv. R.K."  │  │ "R. Kumar"   │  │ "Shri Rajesh"│
        │ 156 cases    │  │ 87 cases     │  │ 43 cases     │
        │ UNCLAIMED    │  │ UNCLAIMED    │  │ UNCLAIMED    │
        └──────────────┘  └──────────────┘  └──────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                  PHASE 2: CARD DISCOVERY (LAWYER)                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  Lawyer registers & logs in                 │
          │  Navigates to "Claim Cards" section         │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  🔍 Searches: "Rajesh Kumar"                │
          │                                             │
          │  System returns:                            │
          │  ✓ "Adv. Rajesh Kumar" (156 cases)         │
          │  ✓ "R. Kumar (Advocate)" (87 cases)        │
          │  ✓ "Shri Rajesh Kumar" (43 cases)          │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  Lawyer reviews & selects all 3 cards       │
          │                                             │
          │  Preview of merged stats:                   │
          │  📊 Total Cases: 286                        │
          │  📊 Win Rate: 63.5%                         │
          │  📊 Cases Won: 181                          │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  Fills claim form:                          │
          │  • Preferred Name: "Rajesh Kumar"           │
          │  • Bar Number: "D/1234/2010"                │
          │  • Notes: "These are my practice names"     │
          │                                             │
          │  [Submit Claim for 3 Cards] ✓               │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  Creates 3 entries in card_claims table:    │
          │  - claim_id: uuid-1                         │
          │  - lawyer_id: lawyer-uuid                   │
          │  - card_id: card-1                          │
          │  - status: 'pending'                        │
          │  - preferred_name: "Rajesh Kumar"           │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  ✅ Success Message:                        │
          │  "Claim submitted! Pending admin approval"  │
          │                                             │
          │  Lawyer can track status in "My Claims"     │
          └─────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: ADMIN REVIEW                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  Admin opens "Claims Approval" dashboard    │
          │                                             │
          │  Sees grouped claim:                        │
          │  👤 Rajesh Kumar (rajesh@example.com)       │
          │  📧 Bar: D/1234/2010                        │
          │  📋 3 cards claimed                         │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  Reviews individual cards:                  │
          │                                             │
          │  1️⃣ Adv. Rajesh Kumar                       │
          │     • 156 cases @ Delhi High Court          │
          │     • 62.82% win rate                       │
          │                                             │
          │  2️⃣ R. Kumar (Advocate)                     │
          │     • 87 cases @ District Court             │
          │     • 62.07% win rate                       │
          │                                             │
          │  3️⃣ Shri Rajesh Kumar                       │
          │     • 43 cases @ High Court                 │
          │     • 67.44% win rate                       │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  Verifies:                                  │
          │  ✓ Bar registration number matches          │
          │  ✓ Name variations are reasonable           │
          │  ✓ Case statistics make sense               │
          │  ✓ No conflicting claims                    │
          └─────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │  APPROVE ✅        │           │  REJECT ❌        │
        │                   │           │                   │
        │  Click "Approve   │           │  Provide reason:  │
        │  & Merge 3 Cards" │           │  "Name mismatch"  │
        └───────────────────┘           └───────────────────┘
                    │                               │
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │  Calls:           │           │  Updates claims:  │
        │  merge_lawyer_    │           │  status='rejected'│
        │  cards()          │           │  Lawyer notified  │
        └───────────────────┘           └───────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                  PHASE 4: CARD MERGE (AUTOMATIC)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  1. Select Master Card                      │
          │     → Card with highest case count (156)    │
          │     → master_card_id = card-1               │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  2. Aggregate Statistics                    │
          │     • Total Cases = 156 + 87 + 43 = 286     │
          │     • Cases Won = 98 + 54 + 29 = 181        │
          │     • Cases Lost = 42 + 28 + 12 = 82        │
          │     • Win Rate = (181/286) × 100 = 63.3%    │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  3. Update Master Card (card-1)             │
          │     • preferred_name = "Rajesh Kumar"       │
          │     • status = 'merged'                     │
          │     • is_master_card = TRUE                 │
          │     • total_cases = 286                     │
          │     • win_rate = 63.3%                      │
          │     • claimed_by_lawyer_id = lawyer-uuid    │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  4. Update Other Cards (card-2, card-3)     │
          │     • status = 'merged'                     │
          │     • is_master_card = FALSE                │
          │     • merged_into_card_id = card-1          │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  5. Create Merge Group Record               │
          │     • lawyer_id = lawyer-uuid               │
          │     • master_card_id = card-1               │
          │     • merged_card_ids = [card-1,2,3]        │
          │     • preferred_name = "Rajesh Kumar"       │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  6. Update Lawyer Record                    │
          │     • master_card_id = card-1               │
          │     • has_claimed_cards = TRUE              │
          │     • verified = TRUE                       │
          └─────────────────────────────────────────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  7. Update Claims Status                    │
          │     • All 3 claims: status = 'approved'     │
          │     • reviewed_at = NOW()                   │
          │     • reviewed_by_admin_id = admin-uuid     │
          └─────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                     PHASE 5: PUBLIC DISPLAY                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │  LAWYER VIEW      │           │  PUBLIC VIEW      │
        │                   │           │                   │
        │  Dashboard shows: │           │  Browse lawyers:  │
        │  ✅ VERIFIED      │           │                   │
        │  "Rajesh Kumar"   │           │  Rajesh Kumar     │
        │  286 cases        │           │  ✅ VERIFIED      │
        │  63.3% win rate   │           │  286 total cases  │
        │                   │           │  63.3% win rate   │
        │  Can manage       │           │  #3 Ranked        │
        │  profile & view   │           │                   │
        │  all merged data  │           │  [View Profile]   │
        └───────────────────┘           └───────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE STATE                                  │
└─────────────────────────────────────────────────────────────────────────┘

BEFORE MERGE:
lawyer_cards:
  ┌──────┬───────────────────┬──────────┬──────────┬───────┐
  │  id  │  name_in_judgment │ status   │ is_master│ cases │
  ├──────┼───────────────────┼──────────┼──────────┼───────┤
  │ c-1  │ Adv. Rajesh Kumar │unclaimed │  FALSE   │  156  │
  │ c-2  │ R. Kumar (Adv)    │unclaimed │  FALSE   │   87  │
  │ c-3  │ Shri Rajesh Kumar │unclaimed │  FALSE   │   43  │
  └──────┴───────────────────┴──────────┴──────────┴───────┘

card_claims:
  ┌──────┬──────────┬────────┬────────┬─────────────────┐
  │  id  │lawyer_id │card_id │ status │ preferred_name  │
  ├──────┼──────────┼────────┼────────┼─────────────────┤
  │ cl-1 │  l-123   │  c-1   │pending │ Rajesh Kumar    │
  │ cl-2 │  l-123   │  c-2   │pending │ Rajesh Kumar    │
  │ cl-3 │  l-123   │  c-3   │pending │ Rajesh Kumar    │
  └──────┴──────────┴────────┴────────┴─────────────────┘


AFTER MERGE:
lawyer_cards:
  ┌──────┬────────────────┬────────┬──────────┬───────┬─────────┬────────┐
  │  id  │preferred_name  │ status │is_master │ cases │merged_to│win_rate│
  ├──────┼────────────────┼────────┼──────────┼───────┼─────────┼────────┤
  │ c-1  │ Rajesh Kumar   │merged  │   TRUE   │  286  │  NULL   │ 63.3%  │ ← MASTER
  │ c-2  │      -         │merged  │  FALSE   │   87  │  c-1    │ 62.1%  │
  │ c-3  │      -         │merged  │  FALSE   │   43  │  c-1    │ 67.4%  │
  └──────┴────────────────┴────────┴──────────┴───────┴─────────┴────────┘

card_claims:
  ┌──────┬──────────┬────────┬─────────┬────────────────┬───────────┐
  │  id  │lawyer_id │card_id │ status  │ preferred_name │reviewed_by│
  ├──────┼──────────┼────────┼─────────┼────────────────┼───────────┤
  │ cl-1 │  l-123   │  c-1   │approved │ Rajesh Kumar   │ admin-1   │
  │ cl-2 │  l-123   │  c-2   │approved │ Rajesh Kumar   │ admin-1   │
  │ cl-3 │  l-123   │  c-3   │approved │ Rajesh Kumar   │ admin-1   │
  └──────┴──────────┴────────┴─────────┴────────────────┴───────────┘

card_merge_groups:
  ┌──────┬──────────┬──────────────┬──────────────────┬───────┬────────┐
  │  id  │lawyer_id │master_card_id│merged_card_ids   │ cases │win_rate│
  ├──────┼──────────┼──────────────┼──────────────────┼───────┼────────┤
  │ mg-1 │  l-123   │     c-1      │ [c-1, c-2, c-3]  │  286  │ 63.3%  │
  └──────┴──────────┴──────────────┴──────────────────┴───────┴────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                      KEY TECHNICAL POINTS                               │
└─────────────────────────────────────────────────────────────────────────┘

✅ Statistics Aggregation Formula:
   total_cases = SUM(all cards.total_cases)
   cases_won = SUM(all cards.cases_won)
   win_rate = (SUM(cases_won) / SUM(total_cases)) × 100

✅ Master Card Selection:
   Master = Card with MAX(total_cases)
   Rationale: Most comprehensive historical data

✅ Query Optimization:
   - Index on: status, claimed_by_lawyer_id, merged_into_card_id
   - RLS policies prevent unauthorized access
   - Merge operation is atomic (single transaction)

✅ Data Integrity:
   - Foreign key constraints prevent orphaned records
   - Timestamps track all state changes
   - Soft delete (status change, not DELETE)

✅ Rollback Capability:
   - Original card data preserved
   - Merge history in card_merge_groups
   - Can reverse by updating status & clearing merged_into_card_id


┌─────────────────────────────────────────────────────────────────────────┐
│                       EDGE CASES HANDLED                                │
└─────────────────────────────────────────────────────────────────────────┘

1. Conflicting Claims:
   - Two lawyers claim same card
   - Solution: First-come-first-served + Admin manual review

2. Partial Approval:
   - Admin approves some cards, rejects others
   - Solution: Each claim handled independently

3. Name Mismatch:
   - Cards belong to different lawyers
   - Solution: Name similarity algorithm (60%+ threshold) + Admin review

4. Already Claimed:
   - Card claimed while another lawyer viewing
   - Solution: Real-time status updates, show "Already claimed" message

5. Duplicate Master Cards:
   - Lawyer already has master card, claims more
   - Solution: Merge into existing master card, update stats

6. Zero Cases:
   - Card has no case history
   - Solution: Allow merge but flag for verification


┌─────────────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW (OPTIONAL)                         │
└─────────────────────────────────────────────────────────────────────────┘

Email Template 1: Claim Submitted (to Lawyer)
  Subject: Your card claim is being reviewed
  Body: We're reviewing your claim for 3 lawyer cards...

Email Template 2: Claim Approved (to Lawyer)
  Subject: ✅ Your cards have been verified and merged!
  Body: Your 3 cards are now merged. Your profile shows 286 cases...

Email Template 3: Claim Rejected (to Lawyer)
  Subject: Your card claim needs attention
  Body: We couldn't verify your claim. Reason: ...

Email Template 4: New Claim (to Admin)
  Subject: [Admin] New card claim pending review
  Body: Rajesh Kumar claimed 3 cards. Review now...


┌─────────────────────────────────────────────────────────────────────────┐
│                         SUCCESS METRICS                                 │
└─────────────────────────────────────────────────────────────────────────┘

📊 Platform Health Dashboard:

  ┌──────────────────────────────────────────────────────┐
  │  Unclaimed Cards:    2,547  (-342 this week) ↓       │
  │  Pending Claims:        23  (+8 today) ↑             │
  │  Verified Lawyers:     892  (+47 this week) ↑        │
  │  Avg Review Time:    1.8 days  (Target: <2 days) ✅  │
  │  Approval Rate:      91.2%  (Target: >85%) ✅        │
  │  Avg Cards/Lawyer:     3.2  cards merged             │
  └──────────────────────────────────────────────────────┘


END OF WORKFLOW
```

---

## 🎯 Quick Reference

| Actor  | Action | Component | Result |
|--------|--------|-----------|--------|
| Admin | Upload judgments | Bulk import | Creates unclaimed cards |
| Lawyer | Search cards | ClaimCards.tsx | Finds name variations |
| Lawyer | Submit claim | ClaimCards.tsx | Creates pending claim |
| Lawyer | Track status | MyClaims.tsx | Sees approval progress |
| Admin | Review claim | AdminClaimsApproval.tsx | Views grouped claims |
| Admin | Approve merge | AdminClaimsApproval.tsx | Triggers auto-merge |
| System | Execute merge | cardMergeUtils.ts | Creates master card |
| Public | View profile | LawyerDetails.tsx | Sees verified badge |

---

## 📱 Screen Flow

```
Lawyer Login
    ↓
Dashboard → Claim Cards Tab
    ↓
Search: "Your Name"
    ↓
Review Results (3 cards found)
    ↓
Select All → Preview Stats
    ↓
Submit Claim Form
    ↓
Success! → My Claims Tab
    ↓
Status: PENDING ⏱️
    ↓
[Admin Reviews & Approves]
    ↓
Status: APPROVED ✅
    ↓
Your Profile → VERIFIED Badge
    ↓
Public Sees Merged Stats
```

---

**System Ready!** 🚀
All workflows documented and components created!
