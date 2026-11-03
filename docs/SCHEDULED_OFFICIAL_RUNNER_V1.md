# Scheduled official runner v1

The inaugural runner processes the approved tournament from its fixed 19:00 America/New_York windows. Database Cron checks every minute, and a completed invocation can dispatch the next due match immediately. Results therefore appear progressively after the window opens; the clock is a target start, not a guarantee that eight results appear in the same instant. No LLM is used to simulate matches.

## Scope and authority

One private control row pins the existing competition, commissioner actor, category journal, worker endpoint and a digest of a dedicated random bearer credential. The raw credential lives in Vault. Cron invokes the separate `run-official-fixture` endpoint; it never sends a service-role key. That endpoint has gateway JWT verification off because it authenticates its own dedicated token through backend-only RPCs. The existing commissioner endpoint retains JWT verification. User JWTs, publishable keys, arbitrary fixture IDs and client-supplied scores do not authorize a worker invocation.

Only the argument-free private dispatcher needs security-definer privileges, to read its fixed Vault credential and issue the fixed HTTP call. Its search path is empty and browser execution is revoked. Public queue RPCs are invoker functions callable only by the backend. The service role can pause execution and maintain leases but cannot enable release activation or alter the pinned actor, credential or endpoint. Browser roles cannot read private control, jobs or audit records.

## Execution and retries

At a due window the dispatcher prepares any bracket fixtures whose accepted feeder results are available, then queues current leaf fixtures. A single 180-second lease serializes category execution. Each worker handles one match, using the existing official pin/proposal/acceptance workflow. Every sporting RPC holds the control lock while verifying the exact job and lease, so a timed-out worker cannot mutate state after a successor claims its job. The RPC allowlist prohibits discipline, corrections, activation, arbitrary competitions and arbitrary fixtures.

Acceptance uses one stable command ID per fixture. Lost successful replies recover the accepted source; retries reuse pinned inputs, the same seed and any saved proposal. Lease expiration and transport failures can retry, with three attempts before manual recovery. Safety-limit aborts, stale eligibility, invalid routing and other sporting exceptions require commissioner recovery. No alternate random seed, fabricated score or automatic forfeit is introduced.

Serious/repeated incident and correction reviews pause affected matches. Other eligible fixtures can continue. The worker cannot dismiss incidents or issue suspensions. The existing commissioner panel remains authoritative for those decisions.

Match Center includes **Automatic match execution**, with status, pause/resume and reasoned retry controls. Retry never overwrites an accepted result or bypasses review. The execution audit records claims, outcomes, expired leases and manual actions. Match statistics and briefing exports remain the existing accepted-ledger products; no quotes, venues or narration are invented.

## Installation and launch

The source migration creates only queue infrastructure. A controlled launch installs `pg_cron` and `pg_net`, creates the Vault-held 256-bit credential, binds the existing men's competition, enables only its release gate, activates the draft, and installs `century-inaugural-runner-v1`. The women's category is unchanged. The clock does not simulate before a fixture's stored timestamp. It unschedules itself once all required bracket games are accepted, including a reset only when needed. Post-completion corrections remain explicit commissioner work.

The deployment must revoke browser/public access to the pg_net request queue, which briefly contains the dedicated credential. Never print Vault values, HTTP headers or request bodies in evidence or logs. Deployment verification reports only configuration IDs, timestamps, status and counts.

`npm run validate:scheduled-runner` uses an isolated database and a fixed test clock. It covers due-time boundaries, token rejection, disabled execution, lease fencing, stable command IDs, review pauses, manual retries, bounded failure, successful real gameplay and statistics, lost acceptance replies, future-fixture exclusion and browser-role denial. PostgreSQL CI also races two independent worker claims. HTTP/Vault operations are stubbed in this disposable test; the live clock is verified separately before the first due window, with no official simulation.

This is the scheduling layer for the inaugural. December divisional fixtures remain to be generated from the tournament's division allocations before their reserved December 8–27 program can be scheduled.
