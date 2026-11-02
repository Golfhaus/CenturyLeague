# Competitive availability and corrections: implementation candidate

Implemented November 1, 2026, as a staged increment toward workflow 1.0. This is **validation-only** code and storage, not an activated official competition or a new adopted gameplay release. The current exhibition endpoint, accepted exhibition ledgers and frozen `0.1.0-exhibition` source/default fingerprint remain unchanged.

## Implemented behavior

The separate `0.2.0-availability-candidate` adapter retains the full 35-player rosters and 70 player box scores. It filters unavailable players before lineup/substitution selection. Excluded players receive no minutes, credits or participation events. Positions remain fluid and substitutions use the existing logic. A CI guard permits only the explicit adapter transformations of the frozen engine, including version markers, availability filtering and an exhaustion guard. The old engine remains available for every old replay.

The adapter retains the original gameplay random namespace. With everyone available and injuries disabled, its complete sporting ledger matches the frozen engine exactly after normalizing the two engine-version markers. Recovery sampling uses an independent domain and never consumes the gameplay random stream. Node and pinned Deno 2.6.4 also agree on a reduced-availability fixture under the existing explicitly bounded coordinate policy; scores, events, timing, inputs and statistics remain exact.

Calendar-day recovery continues across month boundaries. Eligibility requires full recovery on the fixture's explicit calendar date; there is no wall-clock dependency in a replay. A separate snapshot pins every player's eligibility and the source injury/ban IDs. A proposal whose eligibility changed before acceptance is rejected for explicit review/repinning. Fewer than 15 eligible players blocks simulation without inventing a forfeit. If a team exhausts its eligible reserves after an injury, the candidate aborts without returning a score rather than continuing an unsupported sporting disposition.

Suspensions follow player IDs across club and monthly-season changes. Only accepted competitive matches in which the player is rostered and otherwise medically eligible count toward service. Exhibitions cannot enter this operations journal, enforce these bans or serve them. Current serious-foul flags and repeated-foul evidence produce commissioner review cases, **not automatic suspensions**. A commissioner may dismiss a case or record an explicit sanction and reason. No named offense is inferred from an aggregate foul statistic.

Corrections accept technical/administrative reasons only; a refereeing appeal is rejected. A correction voids a registration in the derived view, removes its injury/ban/service contribution, and retains the immutable original proposal, digest, evidence and audit event. Later accepted matches involving overlapping players are flagged for review and remain recorded until the commissioner acts. Nothing is automatically replayed. A closed competition requires an explicit, reasoned reopening before correction. Closing requires the backend to confirm fixture completion and all known cases/reviews to be resolved.

A replacement uses a distinct fixture/proposal reference, the recorded corrected inputs and the original pinned seed. Its availability is reconstructed from the historical sequence preceding the replaced result, with current void dispositions honored; later decisions and served bans cannot leak backward into its lineup. The original ledger stays intact. The journal also records bounded technical-attempt evidence without partial scores or results. An ordinary restart must retain its pinned input digest, seed and engine; changed inputs require the correction path.

## Candidate choices requiring calibration

These choices are explicit, tested implementation candidates. They are not additions to the approved sporting policy by implication.

| Choice | Current candidate |
| --- | --- |
| Short recovery | 80% of injury events, uniformly 1–3 calendar days |
| Medium recovery | 18%, uniformly 4–10 days |
| Longer recovery | 2%, uniformly 11–28 days |
| Repeat-conduct review | Three recorded fouls by a player in one match triggers review; a serious flag also triggers review |
| Automatic disciplinary tariff | None; named offense classification/tariff still needs implementation and approval |
| Overlapping bans | Consecutive service: one accepted eligible fixture reduces at most the oldest outstanding ban for a player |
| Manual sanction boundary | Explicit commissioner decision, 0–20 matches; zero records dismissal |

Each validation stream pins its recovery policy immutably. Production calibration must consider the eventual fixture cadence and observed absences; a short calendar absence can miss several matches in a compressed tournament. This increment does not rerun broad league-balance sweeps or silently adopt a tournament schedule.

## Durable candidate storage

The generated migration `20261102013314_competition_operations_candidate.sql` adds three private, RLS-enabled validation tables: streams with immutable policy/category, immutable full proposal payloads, and an append-only operations journal. The stream purpose is constrained to `validation`. It does not write official match registrations or the existing exhibition views.

Backend-only security-invoker RPCs check a fresh commissioner registration, stage/read immutable source proposals, append with a revision/head comparison, and read with integrity verification. Browser `anon`/`authenticated` roles have no table or function access. Events have database-computed chained SHA256 digests, unique revisions, unique source-proposal registrations and source foreign keys. A lost-reply retry returns its prior event without a second contribution; conflicting retries and stale concurrent writers fail. Payload/engine/source digests are verified when loading, and corrections never rewrite source rows.

The validation database adapter resolves an acceptance's full result from saved proposal storage and ignores a caller-supplied result context. It verifies the saved digest, current eligibility and full candidate replay before constructing the compact acceptance event. Proposals contain the raw ledger once; journal events hold compact source references and effects. Source proposal storage by itself has no availability or record contribution.

This migration is committed for isolated testing and has **not been applied to the live project**. There is no new public Edge endpoint or commissioner UI for these operations yet. The helper is a backend validation adapter, not an alternate authoritative official store.

## Verification

Run:

```sh
npm run verify:match-baseline
npm run validate:availability
npm run validate:operations-db
```

The domain suite covers healthy-match compatibility, excluded players, recovery dates/month transitions, manual incident decisions, transfer/season ban carryover, proposal invalidation, exhaustion/technical aborts, retries, correction finality, preserved history, affected-match review, historical replacement eligibility and independent Node/Deno replay. The database suite covers actual migration execution, immutable saved proposals, digest/reference checks, ignored forged result context, recovery through a fresh client, derived effects, rollback, damaged-head detection, access controls and correction preservation. CI adds separate PostgreSQL sessions racing on the same stream.

Local results: 65 domain checks, 43 PostgreSQL/WASM storage checks, 26 existing replay checks, typecheck and production build pass. The frozen engine source/default fingerprint remains `9513ba17bef8814027cc3408731f7d26db9c8ce8cd5a25f52c42175286db3521`. CI runs the new checks against PostgreSQL alongside the existing match/competition suites.

## Integration gates before official use

1. Connect canonical fixture/roster/date pinning and the versioned availability snapshot to the authenticated commissioner surface. Keep the source engine identity/fingerprint and imported player abilities explicit.
2. Couple official result acceptance and availability effects in one transaction/lock order. The validation stream is not that official boundary. Recheck proposal eligibility, competition revision, schedule completion and affected-match review under that boundary.
3. Connect void/replacement dispositions to official team/player record queries, fixture status and accepted-only matchday exports. Preserve old payloads, and allow reviewed later fixtures or separate audited availability adjustments where necessary.
4. Decide/calibrate the candidate durations, repeat-review threshold and stacked-ban service. Implement an approved named-offense tariff before enabling automatic bans. Add commissioner controls for review, reopening and corrections.
5. Exercise the integrated workflow with a representative competitive rehearsal, including interrupted writes and corrected downstream effects, before declaring 1.0 or activating official competition. The inaugural format remains deferred.
