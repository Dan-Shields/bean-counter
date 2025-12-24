# Bean Counter - Setup Guide

A simple, utilitarian expense sharing app for small groups.

## Prerequisites

- Bun installed (https://bun.sh)
- Supabase account (https://supabase.com)

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

### Run Database Migration
1. Go to SQL Editor in your Supabase dashboard
2. Click "New Query"
3. Copy the entire contents of `supabase-setup.sql`
4. Paste and click "Run"
5. Verify tables were created in Table Editor

## 2. Local Development Setup

### Configure Environment
1. Open `.env` file in the project root
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

## 3. Building for Production

### Web
```bash
bun run build
```

Deploy the `dist` folder to Supabase hosting or any static host.

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
├── components/       # Vue components (to be created)
├── views/           # Page views (to be created)
├── composables/     # Reusable logic
│   ├── useSupabase.ts    # Supabase client
│   ├── useGroups.ts      # Group CRUD
│   ├── useExpenses.ts    # Expense CRUD + real-time
│   └── useBalances.ts    # Balance calculations
├── utils/
│   ├── settlement.ts     # Settlement algorithm
│   └── currency.ts       # Currency conversion
└── types/
    └── index.ts          # TypeScript types
```

## Key Features

- **No accounts required** - Link-based group access
- **Optimistic concurrency** - Last write wins, with delete protection
- **Real-time updates** - Get notified if expense is deleted
- **Smart settlements** - Minimized transaction count
- **Currency conversion** - 24h cached rates from free API
- **Offline-friendly** - Local storage for user preferences

## Next Steps

1. Create Vue components for UI
2. Create views for group management
3. Implement expense form
4. Build balance visualization
5. Add native mobile features (haptics, status bar)

## Tech Stack

- **Frontend**: Ionic 8 + Vue 3 + TypeScript
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Build**: Vite + Bun
- **Mobile**: Capacitor
