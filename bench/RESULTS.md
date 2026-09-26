# Replay benchmark

20 commits of the demo app replayed. For every commit the full suite was run once to learn which tests really broke, then each policy picked its tests from the diff alone.

| Policy | Tests run | Skipped | Test time (sum of per-test durations) | Measured wall-clock | Newly failing tests missed | Regressing commits caught |
| --- | --- | --- | --- | --- | --- | --- |
| Full suite | 1311 | 0% | 206.1 s | 143.4 s | 0 of 15 | 6 of 6 |
| Deterministic only, unmapped e2e skipped (unsafe) | 301 | 77.0% | 59.7 s | 70.5 s | 4 of 15 | 5 of 6 |
| Deterministic only, unmapped e2e all run | 527 | 59.8% | 193.8 s | 95.5 s | 0 of 15 | 6 of 6 |
| Deterministic + Jev (this project) | 395 | 69.9% | 122.5 s | 83.4 s | 0 of 15 | 6 of 6 |

Jev usage for the whole replay: 18 calls, 231 questions, 68,852 input tokens (about $0.0029 at $0.042/M input tokens).

## Failures that only Jev caught

These broken tests were not reachable by the import graph, an owner rule or the smoke tag. Jev had to flag them, and the probability shows how far above the threshold it was.

| Commit | Test | Jev probability |
| --- | --- | --- |
| `2e8a68f` | cart > a valid discount code lowers the total @cart | 0.93 |
| `3d8a57a` | cart > adding a book updates the header counter @cart | 0.95 |
| `3d8a57a` | cart > removing the last line empties the cart @cart | 0.92 |
| `80063db` | checkout > switching to store pickup removes shipping @checkout | 0.71 |

## Per commit (Deterministic + Jev)

| Commit | Changed files | Tests selected | Newly failing | Missed |
| --- | --- | --- | --- | --- |
| `4fa3908` docs: describe local setup in README | README.md | 4/64 | 0 | 0 |
| `c292519` feat(shipping): free standard shipping from $100 | src/cart.ts, src/shipping.ts, tests/unit/shipping.test.ts | 28/65 | 0 | 0 |
| `5abb377` refactor(money): extract currency symbols table | src/money.ts | 51/65 | 0 | 0 |
| `2e8a68f` feat(pricing): WELCOME10 gives 15% during launch week | src/pricing.ts | 23/65 | 3 | 0 |
| `ee8e9ff` revert: WELCOME10 back to 10% until marketing confirms | src/pricing.ts | 22/65 | 0 | 0 |
| `3d46ec8` style: warmer accent color and roomier book cards | public/styles.css | 10/65 | 0 | 0 |
| `3d8a57a` feat(layout): show the cart count as a badge | src/views/layout.ts | 7/65 | 3 | 0 |
| `9dfab9a` fix(layout): keep the cart-count test id on the badge | src/views/layout.ts | 6/65 | 0 | 0 |
| `4b2fa79` feat(search): match author names too | src/search.ts, tests/unit/search.test.ts | 12/66 | 0 | 0 |
| `17911f4` chore(auth): require 10-character passwords | src/auth.ts | 12/66 | 2 | 0 |
| `1276b24` fix(auth): back to 8 characters until the migration ships | src/auth.ts | 12/66 | 0 | 0 |
| `287c357` feat(catalog): add Contract Testing Field Guide | src/catalog.json | 28/66 | 5 | 0 |
| `e6a241e` test: update catalog expectations for 13 books | tests/e2e/catalog.spec.ts, tests/e2e/health.spec.ts, tests/unit/catalog.test.ts, tests/unit/search.test.ts | 17/66 | 0 | 0 |
| `39b4fcf` refactor(server): move static routes into a lookup table | src/server.ts | 17/66 | 0 | 0 |
| `80063db` feat(checkout): accept the shipping query parameter from the new link | src/server.ts | 11/66 | 1 | 0 |
| `db1606f` fix(checkout): still honour the method parameter used by the form | src/server.ts | 11/66 | 0 | 0 |
| `42bdebc` feat(cart): show the author next to each cart line | src/views/cart.ts | 12/66 | 0 | 0 |
| `6813fec` refactor(inventory): simplify the availability guard | src/inventory.ts | 23/66 | 1 | 0 |
| `29b72f5` revert: availability guard rejected the last copy in stock | src/inventory.ts | 23/66 | 0 | 0 |
| `618a410` chore(e2e): lower the per-test timeout to 15s | playwright.config.ts | all 66 (full) | 0 | 0 |
