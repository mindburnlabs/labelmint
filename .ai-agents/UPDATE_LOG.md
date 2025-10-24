# AI Agent Prompts – Update Log

## Update: October 24, 2025 (21:40 EEST)

**Action Taken**: Full re-audit of all prompts against the current repository to remove stale assumptions and capture real gaps.  
**Verification Method**: Manual code inspection across services, apps, contracts, and tests; `rg` search to confirm usage patterns.

### Summary
- ✅ Confirmed enterprise, payment, and workflow routes are active (no longer commented stubs).  
- ✅ Verified multi-tenant storage calculation is implemented and cached.  
- ✅ Confirmed SSO + LDAP services are present with concrete logic.  
- ✅ Observed rich automated test suites already in `tests/` (including blockchain).  
- ⚠️ Identified remaining stubs around TON payout helpers, analytics placeholders, and frontend API bootstrapping.

### Changes by Agent Prompt

1. **Backend Developer (`backend-developer-prompt.md`)**  
   - Removed references to commented routes and missing storage logic.  
   - Highlighted actual blockers: TON payout helper stubs (`tonPaymentService.optimized.ts:732-739`), analytics placeholders (`AnalyticsController.ts:65-70`), directory metrics gap (`DirectoryController.ts:147-170`).  
   - Updated task estimates to ~8-12 focused items.

2. **Blockchain Developer (`blockchain-developer-prompt.md`)**  
   - Confirmed contracts & blockchain tests exist (`contracts/`, `tests/blockchain`).  
   - Added concrete tasks: implement contract `recv_external` (`PaymentProcessor.fc:186-189`), finish TON payout helpers, align wallet endpoints with `/api/payments`.  
   - Adjusted priority to finishing flows instead of “missing contracts.”

3. **DevOps Engineer (`devops-engineer-prompt.md`)**  
   - Kept “infrastructure ready” status (Docker, Terraform, monitoring all present).  
   - Tuned focus to TON node ops, secret rotation, and observability polish.

4. **Enterprise Specialist (`enterprise-integrations-specialist-prompt.md`)**  
   - Acknowledged SSO + directory integrations are implemented.  
   - Pointed to real TODOs: analytics placeholders, directory user counts, workflow review loading.  
   - Removed references to commented routes / missing storage calculations.

5. **Frontend Developer (`frontend-developer-prompt.md`)**  
   - Clarified API client fallback logic; main blocker is missing `initializeApiService` usage.  
   - Flagged wallet endpoint mismatch (`/api/ton/*` vs `/api/payments/*`).  
   - Added guidance for wiring bootstrap + environment config.

6. **Testing Engineer (`testing-engineer-prompt.md`)**  
   - Recognised existing suites (unit, integration, E2E, blockchain, load, security).  
   - Shifted focus to new coverage for TON payouts, SSO, analytics, and regression tests once placeholders are filled.  
   - Removed incorrect claim about skipped USDT tests at `UsdtContract.ts:26`.

### Files Reviewed / Evidence Points
- `services/enterprise-api/src/routes/index.ts` (all enterprise routes enabled)  
- `services/enterprise-api/src/middleware/multiTenant.ts:223-286` (storage computation)  
- `services/enterprise-api/src/services/SSOService.ts`, `DirectoryService.ts`  
- `services/labeling-backend/src/services/tonPaymentService.optimized.ts:712-739` (stubs)  
- `packages/ui/src/services/apiService.ts`, `packages/ui/src/services/tonWalletService.ts`  
- `services/payment-backend/src/api/payments/index.ts` (actual endpoints)  
- `contracts/PaymentProcessor.fc:186-189`  
- `tests/blockchain/`, `tests/e2e/`, `tests/performance/`

### Next Checkpoint Suggestions
- Revisit prompts once TON payout helpers and analytics placeholders are implemented.  
- Update again after frontend apps wire `initializeApiService` and wallet endpoints are aligned.  
- Ensure test prompt reflects new coverage once the above changes ship.

---

_Maintainer: AI coordination audit (Oct 24, 2025). Append new entries above after each significant verification cycle._
