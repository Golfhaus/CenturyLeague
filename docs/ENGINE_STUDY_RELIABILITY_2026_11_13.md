# Engine study stability and recovery — November 13, 2026

## What is established

The latest factorial simulation completed all 800 matched fixtures and 12,800 outcomes. Independent calculations and all full-ledger checks also completed. The subsequent save attempted eleven files totaling 2,520,114,802 bytes and ended with `The read operation timed out`. Its receipt file is empty and the saved copies have not been confirmed. A current recursive inventory still shows the earlier recovery checkpoint, not the eleven attempted deliverables.

The earlier 19,200-outcome confirmation and 17,600-outcome reduction/recheck also completed; their delivery receipts verified 18 and 20 files respectively. Those successful deliveries were larger than the latest failed one. Therefore no fixed file-size limit or exact server-side cause has been established. Large all-or-nothing handoffs amplify a timeout's impact, but size alone is not a proven cause.

The mobile read-only and unknown-error messages cannot be diagnosed conclusively from the available execution logs. Nothing in this evidence establishes a phone, network or account fault. Official stuck-state guidance recommends checking actual execution/approval state; official long-running-work guidance emphasizes checkpointed milestones and durable status:

- https://learn.chatgpt.com/docs/reference/troubleshooting
- https://developers.openai.com/blog/run-long-horizon-tasks-with-codex

## Weaknesses found and corrected

1. The three long-run launchers rejected nonzero worker exits but could wait indefinitely after an unexpected exit with code 0. They now reject any worker exit before the study is complete. No such worker exit was observed in the latest run; this is a demonstrated vulnerability, not the confirmed cause of its save failure.
2. A live worker could stop producing results without a bounded no-progress policy. The new supervisor checks durable fixture progress, writes status every 15 seconds and stops the child process group after a configurable deadline (300 seconds by default). It retains checkpoints and does not automatically restart or change seeds. Repeated log output is not simulation progress.
3. Completed computation could be confused with failed delivery. Stage states are separate. A matching completed checkpoint is recognized without launching a simulation. An exit code 0 with an incomplete simulation checkpoint is a failure. Successful delivery processes still await receipt verification.
4. The report generator previously built bulk tar archives before creating its small review files, and the old upload order placed bulk files first. `--compact-only` now creates a review bundle without tar creation or bulk archive reads. Deferred archive work is labeled accurately. The original uncertain handoff is not reordered or retried.
5. Temporary evidence files could unnecessarily block report regeneration. An explicit evidence directory is supported; unavailable ancillary files are labeled in an evidence-status file. Future runs should retain proofs under their study directory.

## Use for future studies

```bash
python3 scripts/supervise-engine-study.py \
  --study-dir experiments/v2/runs/NEW_STUDY_ID \
  --stage simulation \
  -- node PATH_TO_PINNED_RUNNER --study-id NEW_STUDY_ID OTHER_PINNED_OPTIONS
```

The supervisor is operational only. It does not choose new seeds, change sample size or retry failures. If a completed historical study is found it returns a completed status without starting the command. To verify historical data, restore its original pinned source and use `--verify-existing` explicitly. The shortcut is not a fresh CRC or full event audit.

For a new compact review revision:

```bash
python3 scripts/report-weather-factorial.py REPO NEW_OUTPUT_DIR SOURCES \
  --compact-only --evidence-dir STUDY_VERIFICATION_DIR
```

Use a fresh output directory. The generator refuses to overwrite an uncertain delivery or a directory with delivery receipts. A full archive is no longer required for compact report preparation. The existing full archive mode remains available for an explicitly needed event-ledger handoff.

For a NEW delivery only:

```bash
python3 scripts/plan-study-delivery.py NEW_OUTPUT_DIR/uploads.json NEW_PLAN_DIR
```

Save and verify the small review milestone using current transfer instructions. A delivery supervisor reports `awaiting_receipt_check` after a successful process, and `unconfirmed` after failure/interruption. Validate every receipt before marking delivery complete:

```bash
python3 scripts/confirm-study-delivery.py REQUEST_JSON RECEIPTS_JSON DELIVERY_STATUS_JSON
```

Unknown writes require reconciliation, not automatic retries. The original failed save request and status remain untouched. Bulk archives are a separate handoff; they should not block review or restart completed research.

## Validation and limits

Fault-injection tests exercise a silent hanging process, log spam without checkpoint progress, a genuinely progressing process, completed-run skipping, clean exit without results, delivery timeout and retry blocking, receipt gating, core-first planning, preservation of uncertain outputs and compact-only reporting. The actual three runners are also tested with workers that immediately exit 0 in an isolated checkout. No real scientific simulation is rerun by these tests.

No gameplay coefficients, physics source, player ratings, official coaches or v1.0 source files changed. Historical study inputs and results remain intact. The changes improve failure detection, recovery and handoff; they cannot guarantee availability of ChatGPT's UI or the remote save service.
