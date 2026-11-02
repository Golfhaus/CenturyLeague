# Official registry readiness

The official registry adapter connects the accepted-result transaction to one durable availability journal per league category. The migration ships both categories disabled. It creates no official competition, fixture, result or journal, and does not adopt an inaugural format.

## Adopted recovery policy · November 2, 2026

The commissioner adopted **80% uniformly 1–4 calendar days, 18% uniformly 5–10 days, and 2% uniformly 11–28 days** as `recovery-calendar-v1`. The exact mean is **3.74 days**, and eligibility begins on the recovery date. New rehearsals and future official category journals use this policy. Both categories record recovery approval while format approval and activation remain off; no official journal or competition is initialized by adoption.

`20261102132159_adopt_calendar_recovery_v1.sql` updates only the uninitialized official category configuration. It refuses to rewrite policy after an official journal is initialized. Existing validation journals keep their immutable original policy, revision and hash head. The UI displays the actual selected journal policy, so the historical 1–3 / 4–10 day rehearsal remains accurately labeled. The adopted policy is a separate configuration export; both frozen gameplay source fingerprints remain unchanged.

## Original recovery calibration (historical candidate)

The original, subsequently revised candidate was: 80% uniformly 1–3 calendar days, 18% uniformly 4–10 days, and 2% uniformly 11–28 days. Its exact mean is **3.25 days**. A separate 20,000-draw deterministic probe produced 79.91% / 18.19% / 1.90% and a 3.234-day mean. This validates the recovery sampler, not the gameplay injury rate.

A player is eligible on the recovery date. The following figures are exact consequences of the proposed duration policy; they are scheduling illustrations rather than an adopted fixture cadence.

| Days between matches | Chance an injury misses the next match | Expected later matches missed per injury |
| --- | --- | --- |
| 1 | 73.33% | 2.250 |
| 2 | 46.67% | 0.935 |
| 3 | 20.00% | 0.425 |
| 7 | 9.71% | 0.120 |

Forty-eight independent, initially healthy Roanoke–Lynchburg matches produced one injury and two serious-foul flags. That small two-team sample cannot establish a reliable league injury rate or predict cumulative season availability. It gives no basis to rebalance the frozen gameplay injury chance. Keep the accepted gameplay settings and inspect actual availability during the first competition. [Machine-readable evidence](verification/recovery-calibration-2026-11-02.json) records the source digest and caveat. Run `npm run calibrate:availability -- <immutable-match-export> <report-path>` to repeat with those rosters; without an export the script uses explicitly fictional controlled rosters.

Retain manual commissioner review for serious/repeated flags. Three recorded fouls is a review threshold, not a named offense or automatic ban. Keep explicit reasoned decisions, dismissal at zero matches, and consecutive service of overlapping bans. A healthy rostered player serves at most the oldest outstanding ban per accepted official match. No automatic tariff is enabled without an approved named-offense table. Automatic sanction durations are not adopted by the recovery-policy change.

## Authoritative integration

`20261102111203_official_competition_registry.sql` adds category release gates, immutable competition/journal bindings, canonical dated fixture metadata, immutable availability pins, and compact result dispositions. Existing candidate-named engine/storage identifiers remain stable internal replay identities; renaming them would change historical ledgers. Workflow release status is separate from the engine version.

An official competition imports public abilities and coaching from canonical season rosters. It never accepts browser-supplied rosters, result ledgers, recovery policies, actor identities or source fingerprints. New competitions and monthly seasons use the existing category journal. Stable player IDs carry injuries and bans across transfers. Men's and women's journals are separate. Validation journals and exhibitions remain separate from official effects.

Proposals are computed on the backend from immutable pins. The compact journal acceptance, public immutable result registration, active disposition and audit receipt commit in one transaction. A public registration failure rolls back the journal event, revision and hash head. Lost replies recover the saved proposal/result. The legacy exhibition acceptance path cannot register an official result without the corresponding category event.

Voiding preserves the source ledger and registration, removes it from active records and effects, and flags affected later results throughout the category. Replacements preserve the original seed/date, pin corrected canonical inputs, and remain separate auditable fixtures. Public team records omit voided sources. Official round/player exports omit voided and superseded contributions. Competition closure/reopening is explicit and recorded; it does not reset the category journal.

## Commissioner surface and API

Match Center adds **Official competition · release readiness**, including a gate-status table and the shared saved-competition review, simulation, acceptance, discipline, correction, replay and export controls. Official draft creation remains an API operation requiring an explicit recorded format decision; no generic tournament planner or format is invented in the UI. The existing rehearsal planner remains available separately.

The `official-*` actions use the existing authenticated `manage-matches` endpoint. Readiness/list/detail/replay/export remain readable to the commissioner while activation is paused. Database gates reject official creation, activation, pinning, proposal staging and journal mutations while disabled. Only a controlled database release change can approve policy/format and enable activation: the service role can read the gates and initialize their journal pointer, but cannot change approval flags. A category's journal pointer cannot be cleared or replaced. Browser roles cannot call these backend RPCs or access private operational tables. Registered readers use security-invoker public result views.

## Verification and remaining release steps

The isolated service/database harness exercises canonical generation, default configuration, complete 70-player ledgers, cross-month transfer and suspension service, shared-journal record scoping, immutable source replay, corrections/replacements, downstream review, active-only exports, closure/reopening, authorization, disabled-gate bypass rejection, transaction rollback and lost-reply recovery. PostgreSQL CI adds simultaneous writers against different competitions sharing the same journal revision.

The existing exhibition and rehearsal integration regressions, availability domain checks, replay/source guards, application types and production build remain required. The gameplay baseline fingerprint and availability adapter fingerprint are unchanged.

Before official activation: decide the inaugural format, standings/tie-break/advancement rules where applicable; bind that exact format to fixture preparation; perform the final signed-in official workflow rehearsal under controlled release conditions; then enable only the intended category and declare workflow 1.0. The format remains deferred until the engineering checks are complete. No additional broad league-balance sweep is required.

## Deployment verification · November 2, 2026

[PR #6](https://github.com/Golfhaus/CenturyLeague/pull/6) merged as `eb9db71592689c003ab174470d1e41311a2a9262`, with the exact tested source tree `8e0f8c2ade7db25c9012a9f3b14967f171c960d8`. [PostgreSQL CI](https://github.com/Golfhaus/CenturyLeague/actions/runs/41436435283) passed **67 official registry checks**, including independent concurrent sessions, alongside 59 rehearsal integration checks, 110 exhibition database checks, 47 operations database checks, 67 availability domain checks and the existing gameplay/replay/lifecycle suite. The standalone local official harness passed 64 checks. Deno type checking, application types and the production build passed.

The additive migration is applied and authenticated `manage-matches` version **4** is active with JWT verification retained. [Frontend deployment](https://github.com/Golfhaus/CenturyLeague/actions/runs/41436780555) succeeded. Live read-only verification confirms both category gates off, zero official journals/competitions/registrations, five preserved exhibition results, three preserved rehearsal registrations, and unchanged 18 canonical rosters / 630 assigned players. The service cannot approve activation flags; browsers cannot read private gates, execute readiness RPCs directly or write result dispositions. Both public result views retain `security_invoker=true`.

The security advisor reports the intentional deny-all private RLS tables without browser policies and the pre-existing leaked-password-protection warning; authentication settings were not changed. [Structured deployment evidence](verification/official-registry-2026-11-02.json) records permissions, counts and gate receipts. The refreshed public app loads its new bundle. The signed-in readiness and shared review/export checks are now complete, as recorded below. No fresh login email was sent by the agent.

During initial verification, a secure browser sign-in request was rejected by automatic approval review before submission, citing the prior email rate-limit problems and restriction on additional magic-link requests. No email was sent by the agent. The commissioner subsequently completed email-link sign-in directly in the cloud browser, resolving this block. The earlier [sign-in capture](verification/official-signin-pending-2026-11-02.jpg) remains historical evidence. Post-merge CI also passed (run `41436780546`).


## Signed-in commissioner verification completed

The commissioner session successfully opened Match Center and its official readiness panel. Both men's and women's rows show **Pending / Deferred / Off**, the saved official competition list is empty, and refresh completes without an error. A full page reload preserved authorization; reopening Match Center restored the same readiness gates.

The updated shared review screen also reopened the existing closed integrated rehearsal: two active accepted matches, its retained superseded source, unchanged 2–0 / 0–2 team records, and seven audit events. The active November 1 replacement remained Roanoke 100–91 Lynchburg, with quarter/team statistics and both 35-player box-score controls. Its replay returned **Replay passed exactly.**

The Round 1 download contains exactly one active accepted replacement, zero pending fixtures, 70 player totals and 191 credited points. The superseded source is excluded. These checks used the deployed authenticated backend through the intended UI. No official competition, fixture, result or approval gate was created or changed. The [current commissioner-screen proof](verification/official-visual-verified-2026-11-02.jpg) excludes the account sidebar.

This completes the previously blocked signed-in readiness/UI regression check. It does not claim that an official competition has been activated or played: the deferred exact format and its fixture integration, and the final controlled official acceptance rehearsal still precede workflow 1.0 activation. The revised recovery policy above is now adopted.
