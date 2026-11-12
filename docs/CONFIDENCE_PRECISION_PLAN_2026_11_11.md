# Prespecified larger confidence study

This study addresses whether the previous one-win decline from three-win to five-win confidence was sampling noise. It changes neither the candidate engine nor its coefficients and has no access to official competition writes.

- **Sample:** 6,400 fresh independent matched fixture seeds: 3,200 for each of the same neutral and higher-pressure synthetic mirror-roster profiles.
- **Conditions:** no confidence; three-win confidence; five-win confidence. This is 19,200 engine runs, with identical seeds within a fixture and equal simulation-side exposure within each profile.
- **Primary comparison:** five-win minus three-win focal-club win probability, computed directly from each matched fixture's paired outcomes.
- **Primary uncertainty:** paired sample mean plus/minus 1.96 estimated standard errors, justified as a large-sample approximation. Report the counts of improved, worsened and unchanged winners.
- **Secondary comparisons:** each confidence condition versus control, paired score-margin differences and results separated by tactical profile. These do not replace the primary endpoint if it is unfavorable or inconclusive.
- **Planning:** the earlier replication had 83 discordant winners out of 256 pairs, approximately 0.324. At that discordance rate, 6,400 pairs give approximately a 1.4 percentage-point 95% half-width and about 80% power to detect a 2-point five-versus-three difference. These are planning estimates, not guaranteed precision or results.
- **Stopping and tuning:** finish all declared fixtures regardless of interim outcomes, retain every result, and make no coefficient changes. The earlier pilot/replication are not pooled into this fresh sample.
- **Interpretation:** an interval entirely above zero supports increasing confidence benefit in these tested profiles. An interval containing zero leaves the size/direction unresolved; it does not establish equivalence or an engine issue. A reliably negative result warrants investigation before any tuning or adoption.
- **Verification:** unchanged v1.0 hashes; unchanged v2.0 engine and streak-helper source; score/statistic reconciliation for every result; first fixture per profile/condition replayed fully; first controls compared to v1.0. All saved results are fully replayed if resumed.
- **Reproducibility:** pin source, runtime, coefficients, synthetic roster copies, every fixture seed, simulation side and compact result checksums. Retain complete event ledgers separately from public compact research evidence.

```bash
node experiments/v2/run-streaks.mjs --study-id confidence-precision-001 --arms confidence --trials 3200 --workers 8
```

Neither the size of confidence's desired final effect nor official v2.0 adoption is approved by this experiment. The inaugural tournament remains v1.0.
