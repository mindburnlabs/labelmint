# LabelMint AI Agent Prompts

This directory contains the coordinated AI agent prompts for the LabelMint platform.

## Quick Status Check

**Last Updated**: October 24, 2025  
**Verification**: ✅ Re-audited against repository state on Oct 24, 2025

### Available Agents

| Agent | Status | Priority | Focus Areas |
|-------|--------|----------|-------------|
| [Backend Developer](backend-developer-prompt.md) | ✅ Core Services Stable | MEDIUM | finalize TON payout helpers, replace analytics placeholders |
| [Blockchain Developer](blockchain-developer-prompt.md) | ⚠️ Finalize TON Flows | HIGH | implement TON payment verification, finish contract externals |
| [DevOps Engineer](devops-engineer-prompt.md) | ✅ Tooling In Place | LOW | TON node operations, secret rotation, observability polish |
| [Enterprise Specialist](enterprise-integrations-specialist-prompt.md) | ⚠️ Analytics & Directory Polish | MEDIUM | surface real analytics counts, directory metrics, documentation |
| [Frontend Developer](frontend-developer-prompt.md) | ⚠️ Wire Service Bootstrap | HIGH | initialize ApiService per app, align TON wallet API paths |
| [Testing Engineer](testing-engineer-prompt.md) | ✅ Suites Prepared | MEDIUM | add coverage for TON payouts, SSO happy/error paths |

**Estimated Remaining High-Impact Work**: ~45-65 focused tasks

## Project Health Dashboard

```
Infrastructure:     ██████████████████░░  90% Complete
Backend Services:   ███████████████░░░░░  85% Complete
Blockchain:         ███████████░░░░░░░░░  70% Complete
Frontend Apps:      █████████████░░░░░░░  80% Complete
Enterprise Features:██████████░░░░░░░░░░  75% Complete
Testing:            ████████████████░░░░  85% Complete
```

## Critical Issues (Track Closely)

1. **TON payout helpers unfinished**  
   `services/labeling-backend/src/services/tonPaymentService.optimized.ts:732-739` still return `Not implemented`, blocking blockchain settlement verification.
2. **API client not bootstrapped in apps**  
   `packages/ui/src/services/apiService.ts:214-224` exports `initializeApiService`, but no app currently calls it (search confirms zero usages), so `getApiService()` throws at runtime.
3. **Frontend wallet endpoints mismatch backend**  
   Frontend hits `/api/ton/*` (`packages/ui/src/services/tonWalletService.ts:71-177`) while the payment service exposes `/api/payments/*` (`services/payment-backend/src/api/payments/index.ts`). A proxy or path update is required.
4. **Enterprise analytics placeholders**  
   `services/enterprise-api/src/controllers/AnalyticsController.ts:65-70` still returns placeholder zeros for task/workflow metrics.
5. **Directory user metrics placeholder**  
   `services/enterprise-api/src/controllers/DirectoryController.ts:147-170` reports `0` users instead of querying real counts.
6. **PaymentProcessor external query stub**  
   `contracts/PaymentProcessor.fc:186-189` leaves `recv_external` unimplemented, preventing read-only contract queries.

## What's Working Well ✅

- Mature microservice backend: enterprise API routes active (`services/enterprise-api/src/routes/index.ts`), storage quota calculation implemented (`services/enterprise-api/src/middleware/multiTenant.ts:223-286`).
- TON payment backend fully wired with routes under `/api/payments` and monitoring utilities (`services/payment-backend/src/api/payments`).
- Frontend component library, Telegram Mini App integration, and Socket.IO helpers are production-grade.
- SSO, LDAP sync, and audit services are live (`services/enterprise-api/src/services/SSOService.ts`, `DirectoryService.ts`).
- Extensive testing harness already in place: blockchain tests (`tests/blockchain`), backend unit/integration suites, E2E, load, and security checks.

## Documentation

- **[STATUS_SUMMARY.md](STATUS_SUMMARY.md)** – snapshot of cross-team progress and risks.
- **[UPDATE_LOG.md](UPDATE_LOG.md)** – timeline of prompt changes and verification notes.
- Individual prompts – dedicated guidance for each specialist agent.

## Using These Prompts

1. Read the specialist prompt aligned with your role.
2. Cross-check STATUS_SUMMARY for upstream/downstream dependencies.
3. Focus on critical issues first, then move to medium/low priority refinements.
4. Update the relevant prompt + summary once a milestone lands.

## Recommended Focus Windows

- **Immediate (Week 1)**: unblock TON payout helpers, initialize API clients in apps, align wallet endpoints.
- **Short-Term (Weeks 2-3)**: refresh enterprise analytics metrics, fill directory/reporting gaps, add targeted tests.
- **Mid-Term (Weeks 4-6)**: bolster observability + secret rotation, round out analytics dashboards, harden TON tooling.

## Coordination Highlights

- Backend ↔ Blockchain: shared ownership of TON payout flows (`tonPaymentService.optimized.ts` and smart contracts).
- Frontend ↔ Backend: API initialization + wallet endpoint reconciliation.
- Enterprise ↔ Backend ↔ Testing: analytics metrics, directory stats, and coverage updates must stay in lockstep.
- DevOps ↔ Blockchain: TON node reliability and deployment automation.

## Success Metrics Checklist

- [ ] TON payout verification implemented and passing tests.
- [ ] Frontend apps bootstrap ApiService without throwing.
- [ ] Wallet UI talks to `/api/payments/*` (or equivalent proxy).
- [ ] Enterprise analytics report real data.
- [ ] Directory metrics and user counts surfaced via API.
- [ ] Contract external queries implemented for observability tools.

Keep prompts aligned with reality—update after meaningful progress so every agent starts from an accurate launchpad.
