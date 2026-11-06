# Blox Fruit Services — Vercel & Neon PostgreSQL Deployment Guide

This guide explains how to deploy the **Blox Fruit Services** website to **Vercel** with a free **Neon PostgreSQL** database, while preserving all in-game trade currency rules (M), non-custodial co-op carry safeguards, and the 50/50 payment escrow workflow.

---

## 1. Architecture Summary

- **Frontend**: React 19 + Vite 8 + Tailwind CSS v4 SPA built to static HTML/JS in `dist/`.
- **Backend API**: Express serverless handler located at `/api/index.ts` and managed via `vercel.json` rewrites.
- **Database**: Serverless Neon PostgreSQL queried through Drizzle ORM via `@neondatabase/serverless` (HTTP driver with zero connection pool limits).
- **Security**: Staff session management enforced strictly through `HttpOnly; Secure; SameSite=Lax` cookies. Session tokens are never exposed to browser `localStorage` or frontend JavaScript.

---

## 2. Free Tier Plans & Commercial Eligibility Analysis

> [!IMPORTANT]
> ### Vercel Hobby vs. Commercial Use
> - **Vercel Hobby Tier ($0/month)**: Strictly for **personal, non-commercial, or educational projects**.
> - **In-Game Roblox Currency Context**: Blox Fruit Services deals strictly in **in-game virtual fruits and gamepasses** (0 real-world cash, 0 credit card checkouts).
> - **Eligibility Rule**: If you operate this site as an unpaid personal community project or gaming guild service without charging real fiat money or running commercial advertising, **Vercel Hobby is permitted**. If you ever transition to charging real fiat currency (e.g. PayPal/Stripe donations, subscriptions, or registered commercial business operations), Vercel terms require upgrading to **Vercel Pro ($20/month per member)**.

### Free Tier Limits

1. **Neon PostgreSQL Free Tier**:
   - 0.5 GB shared storage.
   - Autosuspends compute after 5 minutes of idle time to conserve free hours.
   - Resumes automatically in ~500ms when a new request arrives.
   - Uses HTTPS single round-trip queries (`neon-http`), so cold starts do not exhaust connection limits.

2. **Vercel Hobby Tier**:
   - 100 GB monthly bandwidth.
   - Max serverless function duration: 10-15 seconds.
   - Automatic SSL certificates and global CDN edge caching.

---

## 3. Step 1: Create Your Neon PostgreSQL Database

1. Sign up for free at [neon.tech](https://neon.tech) (no credit card required).
2. Click **Create Project**, name it (e.g., `blox-fruit-services`), and choose a region close to your primary audience (e.g., `US East` or `Frankfurt`).
3. In the Neon Console Dashboard, find your **Connection String**.
4. Select the **Pooled connection** or direct connection string. It will look like:
   ```
   postgresql://user:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Keep this connection string safe for Step 3.

---

## 4. Step 2: Bootstrap Tables & Seed Services (Optional / First Run)

The codebase includes an automatic fallback that seamlessly creates in-memory/local stores if no database is connected. When you connect Neon, you can run the bootstrap script or migration:

```bash
DATABASE_URL="your-neon-connection-string" npm run db:seed
```

---

## 5. Step 3: Deploy to Vercel

1. Push your project to a **GitHub repository** (keep the main branch safe).
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click **Add New...** → **Project** and select your GitHub repository.
4. In the **Configure Project** screen:
   - **Framework Preset**: Select `Vite` (Vercel will automatically detect `dist` output).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand the **Environment Variables** section and add:

| Variable Name | Description | Example / Placeholder Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require` |
| `ADMIN_PASSWORD` | Master password for staff portal | `YourVerySecureStaffPassword2026!` |
| `SESSION_SECRET` | Secret key for signing staff cookies | Any 64-character random string |
| `NODE_ENV` | Environment mode | `production` |

6. Click **Deploy**. Vercel will build the frontend assets and provision the `/api` serverless handler.

---

## 6. Post-Deployment Verification Checklist

- [ ] **Catalog (`/services`)**: All published carries display with in-game trade values (M).
- [ ] **Order Booking (`/order`)**: Submit a test order with multiple fruits/gamepasses; confirm you receive an order code (`BFS-XXXX`) and tracking token.
- [ ] **Order Tracking (`/track?token=...`)**: Confirm the 50/50 payment escrow breakdown displays correctly.
- [ ] **Customer Support (`/support`)**: Verify the support form submits an inquiry and the Discord invite button works.
- [ ] **Proofs Wall (`/proofs`)**: Verify that proofs with customer consent appear on the wall.
- [ ] **Active Carries (`/ongoing`)**: Verify active carries display with privacy-masked client names.
- [ ] **Staff Portal (`/admin`)**: Log in with your `ADMIN_PASSWORD`; verify that the session cookie is set (`HttpOnly; Secure; SameSite=Lax`) and test accepting an order and recording a 50% deposit.
