# Century engine study reliability

These instructions apply to long-running engine laboratory studies in this repository. Preserve the scientific plan, fixed samples/seeds, qualified no-Maglev runtime, v1.0 lock and immutable outcomes. Never tune or replace seeds to hide a technical failure.

- Use `scripts/supervise-engine-study.py` for long simulation, analysis, archive and delivery stages. Keep separate stage-status files. Default heartbeats are 15 seconds and the no-progress deadline is 300 seconds; choose a documented longer deadline before launching a genuinely slower stage.
- Treat computation, verification, archive preparation and delivery as separate completion states. Inspect the actual checkpoint when a chat looks stalled. A completed historical study does not need another simulation just because its file handoff failed.
- A supervisor's completed-checkpoint shortcut verifies recorded source identity, counts and ledger presence, not a fresh audit of every event byte. Use the study's original pinned source for explicit full replay. New harness reliability fixes change future lab fingerprints; do not overwrite historical manifests, source patches or data bundles.
- For the weather factorial report, use `--compact-only` in a fresh output directory. Keep verification evidence under the study's `verification/` directory, or provide `--evidence-dir`. Missing ancillary proof files must be labeled as unavailable, not silently claimed as delivered.
- Deliver the small report, compact outcomes, manifest and reproduction material first. Full event ledgers are retained locally; large tar packaging and bulk delivery are separate deliverables when needed. Do not make multi-gigabyte archives a prerequisite for reviewing a few-megabyte report bundle.
- For NEW deliveries, `scripts/plan-study-delivery.py` prepares the review-first milestone. Follow current Library transfer guidance, preserve file identity and inspect every receipt. `scripts/confirm-study-delivery.py` records completion only after all ordered receipts and local identities verify.
- A timed-out or otherwise unconfirmed write must be reconciled before another write. Never automatically retry it, reorder it, shrink the original request or create duplicate saved files. Preserve the original request and status.
- Status reports must distinguish running, completed, stalled, failed and delivery-unconfirmed. No automatic simulation restart or delivery retry is authorized by these instructions.
- Routine reliability changes require fault-injection tests, not another full scientific sample. Keep gameplay coefficients, official results, rosters and coaches outside operational fixes.

User instructions and existing authorization take precedence. These instructions do not authorize external publication, deployment, messaging or changes to official competition data.
