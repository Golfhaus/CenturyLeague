# Integrated competitive rehearsal

The commissioner Match Center now includes **Competitive rehearsal · persistent availability**. It uses canonical season rosters, explicit dated fixtures and the separate availability adapter. Rehearsal results remain outside official league records and the inaugural tournament remains unscheduled. The proposed recovery distribution and manual discipline controls remain visible as calibration candidates.

## Result and availability transaction

The backend saves a complete availability input before simulation. It includes the canonical 35-player rosters, source identity, fixture seed, date and injury/ban evidence. A failed simulation can resume the same input; it cannot silently choose another roster, eligibility snapshot or seed. Completed proposals are immutable and have database-generated digests.

Acceptance loads that saved proposal, verifies its scope, current eligibility and replay, then appends the accepted-result effects with a revision/head comparison. A database trigger inserts its result registration in the **same transaction**. Failure at registration rolls back the event, stream revision/head, injury/ban effects and record contribution together. An exact retry or lost-reply recovery finds the prior registration rather than simulating another match.

The browser sends IDs, revisions and commissioner decisions. It cannot submit a result ledger, ability edits, recovery policy, actor identity, source fingerprint or completion assertion. JWT verification and fresh commissioner role checks remain enforced. New storage stays in private RLS-enabled tables, with backend-only security-invoker RPCs; registered viewers cannot read/write these rehearsal records directly.

## Commissioner workflow

1. Expand the competitive rehearsal panel, choose a season, and add explicit dated fixtures. The backend imports both teams and original coaching from canonical season snapshots.
2. Simulate and review a proposal. Its pinned availability, all 70 player box scores, team statistics, quarters, winning play and replay remain inspectable/exportable.
3. Accept once. Result registration and persistent availability effects commit together. Later fixtures exclude players who have not recovered or have an outstanding ban.
4. Review recorded serious/repeated incidents. Dismiss or assign an explicit sanction with a reason; no named offense or automatic ban is invented. Pending relevant incidents/reviews pause the next affected fixture.
5. If an unaccepted proposal's eligibility changes, explicitly prepare an audited replacement. Keep its old proposal/input and retain the original seed. Replacing a fixture cannot silently change a previously saved retry request.
6. Correct an accepted result only for a recorded technical/administrative reason. Preserve its full payload and digest, void its derived contribution, and flag affected later matches. Prepare a distinct replacement from canonical rosters, with corrected participants if necessary. Replacement eligibility uses the historical sequence, and newly introduced participants also cause relevant later matches to be flagged.
7. Review later affected results explicitly. Exports include active accepted matches only and retain unresolved review flags. Player totals and team records exclude voided/superseded sources.
8. Close only after all current leaf fixtures are accepted and required reviews are resolved. Explicit reopening is required before a closed rehearsal can be corrected.

Accepted historical fixtures display their actual pinned eligibility, rather than applying a later injury or ban backward to the match that produced it. Source records remain available after correction. Injury recovery runs on calendar dates; fatigue resets between matches.

## Storage and source identity

The original candidate migration is followed by `20261102022215_integrate_competitive_rehearsals.sql`. The latter adds canonical fixture/roster links, immutable pinned inputs, result registrations and fixture-change audit receipts. Binding triggers enforce fixture/input/date/replacement scope. Result registration and the availability journal cannot diverge for a bound rehearsal stream.

The adapter source identity is checked separately from the frozen exhibition baseline:

```sh
npm run verify:competitive-source
npm run validate:rehearsal-integration
```

`verify:competitive-source` pins the availability adapter plus the ten frozen gameplay dependencies. The exhibition fingerprint stays unchanged. Edge copies of match, competition and competitive source are checked against their canonical files. The commissioner controls load separately on demand, so the normal exhibition view does not load the competitive simulator in the browser.

## Verification and release limits

The integration harness runs the actual request service against the actual migrations. Its scenarios include canonical snapshot protection, ignored forged result/config/policy fields, viewer rejection, pinned-input recovery, zero proposed-result contribution, injected registration failure, lost successful reply, stale eligibility, explicit repinning, ban service, preserved corrected payloads, affected-match review, accepted-only briefings/player totals, closure/reopening and database access controls. PostgreSQL CI adds independent-session contention.

The backend also passes Deno type checking, application type checking and production build. The existing match, exhibition, roster, lifecycle and replay regressions remain in CI. [Live deployment and browser evidence](LIVE_COMPETITIVE_REHEARSAL_2026_11_01.md) confirm the closed two-match rehearsal, audited replacement, preserved original payload, exact replay and reload recovery.

This completes the result/effect transaction and commissioner integration **for rehearsals**. Official activation still requires adopting/calibrating the numeric policies, approving any named-offense tariff before automatic bans, and binding one authoritative availability journal per league category across official competitions/monthly seasons. Do not create a fresh official availability state for each tournament or month. The inaugural format is still deferred until the engine is ready.
