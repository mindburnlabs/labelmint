# Blockchain Developer – LabelMint Project Tasks

## Project Status (October 2025)
- **Current State**: ⚠️ ~70% complete – smart contracts, TON SDK services, and tests exist; payout verification + contract externals remain.
- **Priority**: HIGH – unblock withdrawal verification and align wallet endpoints.
- **Estimated Focused Tasks**: ~6-10.
- **Last Audited**: October 24, 2025 (contracts, services, tests directories inspected).

## Verified Implementation Snapshot
- PaymentProcessor contract implemented in FunC/Tact (`contracts/PaymentProcessor.fc`, `contracts/PaymentProcessor.tact`).
- Blockchain integration services exist in payment backend (`services/payment-backend/src/services/blockchain` + `ton`).
- TON API manager + smart contract service connect to DB-configured nodes (`TonApiManager.ts`, `SmartContractService.ts`).
- Frontend wallet UI and hooks are ready (`packages/ui/src/services/tonWalletService.ts`, components under `packages/ui/src/components/wallet`).
- Automated blockchain tests already present (`tests/blockchain/PaymentProcessor.test.ts`, `integration.test.ts`, `deploy.test.ts`).

## Critical Tasks (Do These First)

1. **Implement payout verification + withdrawal helper stubs**  
   - File: `services/labeling-backend/src/services/tonPaymentService.optimized.ts:732-739`  
   - Task: Implement `checkBlockchainTransaction` and `sendWithdrawalTransaction`, using existing TON client utilities, and propagate structured errors/metrics.

2. **Expose contract read entrypoint**  
   - File: `contracts/PaymentProcessor.fc:186-189` (`recv_external` currently throws).  
   - Task: Implement signature verification and return contract state (owner, balance, channels). Needed for monitoring + integration tests.

3. **Align wallet API paths across stack**  
   - Frontend hits `/api/ton/*` (`packages/ui/src/services/tonWalletService.ts:71-177`); backend serves `/api/payments/*` (`services/payment-backend/src/api/payments/index.ts`).  
   - Deliverable: Decide on canonical path (e.g., proxy `/api/ton` → `/api/payments/ton`) and update both frontend + backend routing.

4. **Ensure ApiService initialisation for wallet flows**  
   - Since `initializeApiService` is unused (repo-wide search), coordinate with frontend/backend to supply base URLs + auth headers so wallet requests succeed.

## High Priority Enhancements

5. **Transaction monitoring + retries**  
   - File: `services/payment-backend/src/services/blockchain/TransactionMonitor.ts`  
   - Task: Hook the monitor into the payout helper to re-verify pending transactions and backoff on node failures.

6. **TON node configuration + health**  
   - Files: `infrastructure/ton-deployment.yaml`, `infrastructure/monitoring/`  
   - Task: Document required RPC endpoints, add health metrics, and alert on node lag/offline states.

7. **Contract deployment tooling**  
   - Ensure `scripts`, `tests/blockchain/deploy.test.ts`, and Terraform/k8s manifests cover the finalised bytecode + upgrade paths.

## Medium Priority / Polish
- Audit and document USDT Jetton integration details in `UsdtContract` + `TonWalletService`.  
- Evaluate multi-sig / custodial wallet support once primary flows are stable.  
- Add on-chain event listeners to push notifications into analytics/monitoring.

## Coordination Notes
- **Backend Developer**: jointly implement payout helper stubs and error handling.  
- **Frontend Developer**: agree on wallet API paths and authentication flow.  
- **DevOps Engineer**: provision TON nodes, secrets, and monitoring dashboards.  
- **Testing Engineer**: extend blockchain integration tests once helpers are implemented.

## Deliverables
1. Fully implemented payout helper methods with tests.  
2. PaymentProcessor external view implemented and covered by tests.  
3. Wallet API path alignment documented and functional from UI → backend → blockchain.  
4. Monitoring hooks for transaction status + node health.  
5. Deployment scripts updated with any contract or config changes.

## Success Criteria
- ✅ Withdrawal + verification helpers return success data and are exercised by integration tests.  
- ✅ Contract external handler returns state without throwing.  
- ✅ Wallet UI hits working endpoints and displays real balances/history.  
- ✅ Transaction monitor detects, retries, and reports failures.  
- ✅ Node health alerts configured and firing in staging.

## Working Guidelines
- Use TON sandbox/tests to validate contract and helper changes (`tests/blockchain`).  
- Maintain deterministic error codes for easier monitoring + retries.  
- Document new environment variables and keys required for payout flows.  
- Coordinate deployments with DevOps when touching contract bytecode or RPC credentials.
