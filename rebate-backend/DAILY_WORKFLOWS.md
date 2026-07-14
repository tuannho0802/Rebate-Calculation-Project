# Daily Workflows

## 2026-07-14 — Validation fix and Chain API audit/test follow-up

- [x] Audited the prior A/B/C/D implementation against prompts 17 and 18.
- [x] Removed remaining frontend client-side `markupMax`/rebate limit calculations and submit blocking; server errors now flow through `getErrorMessage()`.
- [x] Created `scratch/test-validation-and-chain.js` exactly as specified and reset/seeded the local DB after the test.
- [ ] Backend scratch test incomplete: 3 assertions passed and 1 failed, then the script crashed because it requests `GET /ib/tree?depth=all` with an MIB token while the final authorization rule intentionally limits MIB/IB users to direct children.
- [ ] Chain View multi-column UI does not exist, so the manual Chain View checklist was not run.
