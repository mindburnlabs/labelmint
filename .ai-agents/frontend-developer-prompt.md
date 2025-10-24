# Frontend Developer – LabelMint Project Tasks

You own the web app, admin dashboard, and Telegram Mini App built with Next.js/React, shared UI packages, and wallet integrations.

## Project Status (October 2025)
- **Current State**: ⚠️ ~80% complete – UI + hooks are production-ready but service bootstrap + wallet wiring remain.
- **Priority**: HIGH – ensure apps talk to real APIs and finalise wallet flows.
- **Estimated Focused Tasks**: ~8-12.
- **Last Audited**: October 24, 2025 (apps/, packages/ui examined).

## Verified Implementation Snapshot
- Next.js apps for web (`apps/web`), admin (`apps/admin`), and Telegram Mini App (`apps/telegram-mini-app`) are fully built with routing, layouts, and modern UX.
- Shared UI/component library (`packages/ui`) includes task flows, wallet components, charts, forms, socket hooks, and i18n utilities.
- API service + hooks exist (`packages/ui/src/services/apiService.ts`, `hooks/useTaskManager.ts`) with fallback to mock data if API unavailable.
- Wallet service + components implemented (`packages/ui/src/services/tonWalletService.ts`, `components/wallet/*`).
- Real-time Socket.IO helpers ready (`packages/ui/src/services/socketService.ts`, hooks).

## Critical Tasks (Do These First)

1. **Initialise ApiService in every app**  
   - File: `packages/ui/src/services/apiService.ts:214-224` (exports `initializeApiService`).  
   - Issue: No app currently calls `initializeApiService` (repo search = 0 matches), so `getApiService()` throws.  
   - Deliverable: Initialise in web/admin/mini-app entry points with base URL + auth token provider; add error boundary/fallback.

2. **Align wallet endpoints with backend**  
   - Frontend calls `/api/ton/*` (`packages/ui/src/services/tonWalletService.ts:71-177`).  
   - Backend exposes `/api/payments/*` (`services/payment-backend/src/api/payments/index.ts`).  
   - Deliverable: Update client paths or add Next.js API proxy; ensure auth headers align with backend expectations.

3. **Environment configuration + secrets**  
   - Files: `.env.example`, `apps/*/next.config.js`, `packages/ui/src/services/apiService.ts`.  
   - Task: Define per-env API base URLs, wallet endpoints, Socket.IO URLs, TON network selectors, and inject via runtime config.

4. **Hook analytics dashboards to new metrics**  
   - Files: `apps/admin/src/components/analytics/`, `apps/admin/src/app/(dashboard)/analytics`.  
   - Task: Consume real analytics data (once backend placeholders replaced), add loading/error states, and handle tenant filters.

## High Priority Enhancements

5. **Wallet UX validation**  
   - Ensure wallet modals + flows respond to new API responses, show transaction status, and surface backend errors.  
   - Add optimistic updates and skeleton loaders for balances/history.

6. **ApiService error boundaries + retry UI**  
   - Introduce error boundary wrappers (component already exists) and toast notifications for API failures.  
   - Ensure retries/backoff for transient errors.

7. **Auth/session coordination**  
   - Confirm JWT/SSO tokens propagate through API/WSS connections; update `packages/ui/src/services/authService.ts` if required.

## Medium Priority / Polish
- Connect Storybook stories to real props and include wallet/analytics scenarios.  
- Validate accessibility (keyboard navigation, ARIA) for admin dashboards and wallet modals.  
- Optimise bundle splitting + code loading (leverage dynamic imports for heavy analytics charts).  
- Integrate i18n translations once API bootstrap stable.

## Coordination Notes
- **Backend Developer**: confirm ApiService base URL + auth requirements; coordinate analytics data shape.  
- **Blockchain Developer**: ensure wallet endpoints, transaction status payloads, and TON network config match.  
- **Testing Engineer**: add E2E flows covering ApiService bootstrap and wallet transactions once live.  
- **DevOps Engineer**: provide env configuration / secret injection for API + TON endpoints.

## Deliverables
1. ApiService initialisation in all apps (web/admin/mini-app) with configuration docs.  
2. Wallet service hitting correct backend endpoints and handling responses gracefully.  
3. Admin analytics dashboard wired to live metrics.  
4. Robust error/loading states across task flows and wallet views.  
5. Updated environment documentation for frontend teams.

## Success Criteria
- ✅ `initializeApiService` invoked before any hook call (validated via runtime tests).  
- ✅ Wallet balance/history/transactions render real backend data without console errors.  
- ✅ Analytics dashboard shows real counts and passes QA.  
- ✅ Apps handle API outages gracefully (error boundary + retry).  
- ✅ Environment toggles (dev/staging/prod) switch API + TON endpoints seamlessly.

## Working Guidelines
- Prefer hooks/components from `packages/ui` to keep behaviour consistent.  
- Add Vitest/Playwright coverage for new flows (`tests/e2e`, `tests/frontend`).  
- Keep configuration in `packages/config` or env files – document defaults.  
- Collaborate early with backend when adjusting payloads to avoid drift.
