# Testing Engineer – LabelMint Project Tasks

You own automated testing across backend, frontend, blockchain, and infrastructure layers.

## Project Status (October 2025)
- **Current State**: ✅ ~85% complete – unit, integration, E2E, blockchain, load, and security suites already exist.
- **Priority**: MEDIUM – extend coverage for new TON payout helpers, analytics metrics, and API bootstrap changes.
- **Estimated Focused Tasks**: ~6-10.
- **Last Audited**: October 24, 2025 (reviewed `tests/` hierarchy, CI configs).

## Verified Testing Snapshot
- Blockchain tests under `tests/blockchain/` cover PaymentProcessor deploy/flow scenarios.
- Backend unit/integration suites in `tests/unit`, `tests/integration`, `tests/features`, `tests/security`.
- E2E + Playwright/Cypress style tests in `tests/e2e/` and `tests/smoke.test.ts`.
- Load/performance tests with K6 in `tests/load/`, `k6-tests/`.
- CI/CD already runs linters + tests via GitHub Actions.

## Critical Tasks (Do These First)

1. **Add tests for TON payout helper implementations**  
   - Target: `services/labeling-backend/src/services/tonPaymentService.optimized.ts` once stubs are filled.  
   - Write integration tests simulating successful + failing payouts, verifying database updates and retry logic.

2. **Validate wallet API alignment**  
   - After frontend aligns with `/api/payments/*`, add API + E2E tests ensuring wallet balance/history endpoints return expected data.  
   - Include negative tests for auth failures and malformed addresses.

3. **Enterprise analytics regression tests**  
   - Once placeholders replaced, write integration tests for `AnalyticsController` verifying counts, caching behaviour, and edge cases (no data, partial data, stale cache).

## High Priority Enhancements

4. **ApiService bootstrap tests**  
   - Create frontend integration tests (Playwright/Cypress) asserting `initializeApiService` is called before hooks, ensuring runtime errors are avoided.

5. **SSO + directory flows**  
   - Add contract tests covering SSO login (`/sso/login`, `/sso/acs`, `/sso/validate`) and directory sync/auth endpoints with mocked LDAP providers.

6. **Telemetry/assertions for notifications**  
   - Add tests for NotificationService email/Telegram flows (using mocks/spies) and ensure alerts are emitted for low-balance scenarios.

## Medium Priority / Polish
- Expand accessibility tests (axe-core, a11y snapshots) for admin dashboards and wallet UI.  
- Add chaos/performance tests covering analytics and payout spikes.  
- Integrate contract fuzzing / static analysis for smart contracts as part of gated pipeline.  
- Document smoke/regression suites per environment for release readiness.

## Coordination Notes
- **Backend & Blockchain**: align on payout helper behaviour and error codes to assert in tests.  
- **Frontend**: expose test hooks or env toggles for ApiService bootstrap and wallet flows.  
- **DevOps**: ensure CI pipelines have required secrets/TON mocks for integration tests.  
- **Enterprise Specialist**: confirm analytic metric shapes for test assertions.

## Deliverables
1. Integration tests covering TON payout helper workflows.  
2. Updated E2E suites validating wallet operations and ApiService bootstrap.  
3. Regression tests for enterprise analytics + directory endpoints.  
4. SSO/LDAP test coverage with mocked providers.  
5. Documentation outlining new test scenarios and how they map to CI pipelines.

## Success Criteria
- ✅ CI pipeline fails if payout helpers regress.  
- ✅ Wallet/UI E2E tests pass using real backend endpoints.  
- ✅ Analytics tests detect placeholder regressions immediately.  
- ✅ SSO/directory flows validated automatically before release.  
- ✅ Test documentation kept in sync with new scenarios.

## Working Guidelines
- Use existing fixtures/mocks (`tests/fixtures`, `tests/mocks`) and expand as needed.  
- Prefer deterministic tests; mock TON RPC responses where outbound calls are required.  
- Record metrics (coverage, duration) to spot regressions after each run.  
- Keep Playwright/CLI scripts in `package.json` or `tests/scripts` updated with new suites.
