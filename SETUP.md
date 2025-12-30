# Bean Counter - Setup Guide

A simple, utilitarian expense sharing app for small groups.

## Prerequisites

- Bun installed (https://bun.sh)
- Supabase account (https://supabase.com)
- Supabase CLI installed (`bun add -g supabase`)

## 1. Supabase Setup

### Create Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Name it "bean-counter"
4. Set a secure database password
5. Choose a region close to you
6. Wait for provisioning (~2 minutes)

### Get Credentials

1. Go to Project Settings > API
2. Copy the **Project URL** (e.g., `https://xxxxx.supabase.co`)
3. Copy the **Publishable API key** (under "Project API keys")

### Link and Run Migrations

```bash
# Login to Supabase CLI
supabase login

# Link to your project (find project ref in Project Settings > General)
supabase link --project-ref your-project-ref

# Apply all migrations to your database
supabase db push
```

## 2. Local Development Setup

### Configure Environment

1. Create a `.env` file in the project root
2. Add your Supabase credentials:
    ```
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
    ```

### Install and Run

```bash
cd bean-counter
bun install
bun run dev
```

The app will open at http://localhost:5173

## 3. Database Migrations

Migrations are stored in `supabase/migrations/` with timestamp prefixes.

```bash
# Apply pending migrations to remote database
supabase db push

# Create a new migration
supabase migration new <name>

# Check migration status
supabase db diff
```

**Important:** Never modify existing migrations once pushed to production. Always create new migrations to alter the schema.

## 4. Building for Production

### Web (Cloudflare Pages)

```bash
# Build the app
bun run build

# Deploy to Cloudflare Pages
bunx wrangler pages deploy dist --project-name=bean-counter
```

On first deploy, you'll be prompted to log in and create the project. Set environment variables in the Cloudflare Pages dashboard under Settings > Environment variables.

### iOS

```bash
ionic capacitor add ios
ionic capacitor build ios
```

Open in Xcode and run on device.

### Android

```bash
ionic capacitor add android
ionic capacitor build android
```

Open in Android Studio and run on device.

## Project Structure

```
src/
├── components/           # Vue components
│   ├── TransactionList.vue   # Transaction list with swipe-to-delete
│   └── BalanceView.vue       # Balance bars + settlements
├── views/                # Page views
│   ├── HomePage.vue
│   ├── CreateGroupPage.vue
│   ├── JoinGroupPage.vue
│   ├── GroupDetailPage.vue
│   └── TransactionFormPage.vue
├── composables/          # Reusable logic
│   ├── useSupabase.ts        # Supabase client
│   ├── useGroups.ts          # Group CRUD
│   ├── useTransactions.ts    # Transaction CRUD + real-time
│   └── useBalances.ts        # Balance calculations
├── utils/
│   ├── settlement.ts         # Settlement algorithm
│   └── currency.ts           # Currency conversion
└── types/
    └── index.ts              # TypeScript types

supabase/
└── migrations/           # Database migrations (timestamped SQL files)
```

## Key Features

- **No accounts required** - Link-based group access
- **Transaction types** - Expenses, repayments, and income
- **Optimistic concurrency** - Last write wins, with delete protection
- **Real-time updates** - Get notified if transaction is deleted
- **Smart settlements** - Minimized transaction count
- **Currency conversion** - 24h cached rates from free API
- **Offline-friendly** - Local storage for user preferences

## Tech Stack

- **Frontend**: Ionic 8 + Vue 3 + TypeScript
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Build**: Vite + Bun
- **Mobile**: Capacitor
- **Hosting**: Cloudflare Pages
