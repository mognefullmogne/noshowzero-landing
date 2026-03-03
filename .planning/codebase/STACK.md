# Technology Stack

**Analysis Date:** 2025-03-03

## Languages

**Primary:**
- TypeScript 5 - Full application codebase (frontend and API routes)
- JavaScript - Build configuration files (Next.js config via .mts/mjs)

**Secondary:**
- SQL - Database migrations and schema definition (Supabase PostgreSQL)
- XML - TwiML responses for Twilio webhooks

## Runtime

**Environment:**
- Node.js v25.6.0 (no `.nvmrc` pinning)
- Next.js 16.1.6 (React framework)
- React 19.2.3 + React DOM 19.2.3

**Package Manager:**
- npm 11.8.0
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework (frontend + API routes)
- React 19.2.3 - UI components
- Tailwind CSS 4 - Styling with PostCSS 4

**UI Components:**
- Radix UI 1.4.3 - Accessible component primitives
- shadcn 3.8.5 - Component CLI for Radix-based components
- Lucide React 0.576.0 - Icon library
- Framer Motion 12.34.4 - Animation library
- CVA (class-variance-authority) 0.7.1 - Component variant styling
- clsx 2.1.1 - Class name merging
- tailwind-merge 3.5.0 - Tailwind CSS class merging

**Forms & Validation:**
- React Hook Form 7.71.2 - Form state management
- @hookform/resolvers 5.2.2 - Form validation schema adapters
- Zod 4.3.6 - TypeScript-first schema validation

**Build & Dev:**
- TypeScript 5 - Compiler
- ESLint 9 - Linting
- eslint-config-next 16.1.6 - Next.js linting preset
- Tailwind CSS with PostCSS - Styling pipeline

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.98.0 - Supabase client (database, auth, realtime)
- @supabase/ssr 0.9.0 - Supabase server-side rendering helpers
- stripe 20.4.0 - Stripe server SDK for payments
- @stripe/stripe-js 8.9.0 - Stripe client SDK for checkout
- @anthropic-ai/sdk 0.78.0 - Claude AI SDK for chat and classification
- twilio 5.12.2 - Twilio SDK for SMS, WhatsApp, notifications
- pg 8.19.0 - PostgreSQL client (dev dependency, indirect via Supabase)

**Infrastructure:**
- tw-animate-css 1.4.0 - Tailwind animations utility

## Configuration

**Environment:**
- `.env.example` defines all required environment variables
- `.env.local` (local development only, git-ignored)
- Secrets managed via environment variables (see `.env.example`)

**Build Configuration:**
- `tsconfig.json` - TypeScript compiler options with Next.js plugin
  - Target: ES2017
  - Module: esnext, moduleResolution: bundler
  - Path alias: `@/*` maps to `./src/*`
  - Strict mode enabled
- `next.config.ts` - Next.js configuration
  - Security headers enabled (DENY X-Frame-Options, HSTS, CSP, etc.)
- `postcss.config.mjs` - PostCSS configuration for Tailwind
- `components.json` - shadcn component configuration
- `eslint.config.mjs` - ESLint configuration (flat config)

## Platform Requirements

**Development:**
- Node.js v25.6.0+
- npm 11.8.0+
- Environment variables from `.env.example`
- Supabase project (for database and auth)
- Stripe account (for payment processing)
- Twilio account (for messaging)
- Anthropic API key (for AI features)
- Google OAuth credentials (for Google Calendar integration)
- Microsoft OAuth credentials (for Outlook Calendar integration)

**Production:**
- Deployment target: Vercel (Next.js native)
- `.vercel/` directory present (Vercel configuration)
- `vercel.json` - Vercel-specific configuration
- Environment variables required in Vercel dashboard:
  - Supabase keys
  - Stripe keys and webhook secret
  - Anthropic API key
  - Twilio credentials
  - Google and Microsoft OAuth credentials
  - Encryption keys for token storage
  - CRON_SECRET for scheduled jobs

**Security Headers (enforced via Next.js):**
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
- Permissions-Policy: disables camera, microphone, geolocation

---

*Stack analysis: 2025-03-03*
