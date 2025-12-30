# Bean Counter

A shared expense tracking app for small groups (like Tricount, but simpler).

## Tech Stack

- **Frontend**: Ionic 8 + Vue 3 + TypeScript
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Build**: Vite + Bun
- **Mobile**: Capacitor (not yet configured for native builds)
- **Hosting**: Cloudflare Pages

## Project Structure

```
src/
├── views/                      # Page components
│   ├── HomePage.vue            # List of user's groups
│   ├── CreateGroupPage.vue     # Create new group with members
│   ├── JoinGroupPage.vue       # Join group via link, pick member identity
│   ├── GroupDetailPage.vue     # Tabs: Transactions list + Balances
│   └── TransactionFormPage.vue # Create/edit transaction with splits
├── components/
│   ├── TransactionList.vue     # Transaction list with filter, sort, infinite scroll
│   └── BalanceView.vue         # Balance bars + settlement suggestions
├── composables/
│   ├── useSupabase.ts          # Supabase client singleton
│   ├── useGroups.ts            # Group CRUD + local storage for memberships
│   ├── useTransactions.ts      # Transaction CRUD + realtime subscriptions + pagination
│   └── useBalances.ts          # Fetch server balances + settlement algorithm
├── utils/
│   ├── settlement.ts           # Greedy algorithm to minimize transactions
│   └── currency.ts             # Exchange rate API (24h cache) + formatting
└── types/
    └── index.ts                # All TypeScript interfaces

supabase/
└── migrations/                 # Database migrations (timestamped SQL files)
```

## Key Architectural Decisions

1. **No user accounts** - Groups are accessed via UUID links. User's group memberships stored in localStorage.

2. **Soft deletes** - Transactions have `deleted_at` field. Never hard delete.

3. **Last write wins** - No locking or conflict resolution. If someone edits a deleted transaction, they get notified it was deleted.

4. **Realtime for changes** - Subscribe to transaction changes to show "Changes available" banner. Also notify users editing a deleted transaction. No presence tracking or auto-refresh.

5. **Split system** - Two modes:
    - Parts mode: proportional splitting (2 parts = double share)
    - Exact mode: fixed amounts, remainder split among unassigned

6. **Currency conversion** - Uses free exchangerate-api.com, cached 24h in localStorage.

7. **Server-side balances** - Balances are calculated by database triggers on transaction changes, stored in `member_balances` table. Client fetches pre-computed balances.

8. **Transaction pagination** - Transaction list uses infinite scroll, loading 20 items at a time.

## Commands

```bash
bun run dev      # Start dev server
bun run build    # Production build
bun run vue-tsc  # Type check

# Deploy to Cloudflare Pages
bunx wrangler pages deploy dist --project-name=bean-counter
```

## Environment Variables

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Set in `.env` locally, and in Cloudflare Pages dashboard for production.

## Database Schema

Migrations are in `supabase/migrations/`. Key tables:

- `groups` - id, name, default_currency
- `members` - id, group_id, name
- `transactions` - id, group_id, type, title, date, amount, currency, payer_id, deleted_at
- `transaction_splits` - transaction_id, member_id, parts OR exact_amount
- `transaction_changelog` - audit log of all changes
- `member_balances` - group_id, member_id, balance (auto-updated by triggers)

**Transaction types** (`transactions.type`):

- `expense` - Regular expense, payer credited, split members debited
- `repayment` - Direct payment between members to settle debt
- `income` - Group receives money (refund/deposit), receiver debited, split members credited

RLS policies allow all operations if you know the group ID (link-based access).

## Database Migrations

```bash
supabase db push              # Apply migrations to remote database
supabase migration new <name> # Create new migration (generates timestamp)
```

**Never modify existing migrations** once pushed to production. Always create new migrations to alter the schema.

## Common Tasks

**Add a new currency**: Update the `<ion-select>` options in `CreateGroupPage.vue` and `TransactionFormPage.vue`, plus the symbols map in `currency.ts`.

**Build for mobile**: Run `ionic capacitor add ios` or `android`, then build with Xcode/Android Studio.
