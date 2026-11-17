# Heat-only validation across copied clubs

This next step follows the completed Philadelphia–Norfolk factorial. It tests generalization before any further coefficient reduction. All coefficients, original tactics, ratings and official records remain fixed. The optional 0.35 tolerance candidate is inactive. No traits or psychology are enabled.

## Fixed design before execution

Study: `copied-club-heat-validation-001`. Select the existing `pair-1-focal-0` through `pair-4-focal-0` profiles from the same copied founding snapshot. The four unordered matchups are Dover–Lancaster, Anacostia–Hagerstown, Norfolk–Philadelphia and Greensboro–Lynchburg. Reciprocal profiles describe the same clubs and are not extra independent matchups.

Execute **800 fresh matched seeds per matchup**, split equally between simulation sides: **3,200 independent fixture clusters / 6,400 outcomes**. Both arms share each fixture seed. Temperate: 18 C; hot: 35 C; both 80% humidity, no wind/gust/rain. Fixed healthy lab availability and explicit alternating-quarter end policy. Match date 2026-11-14. New study-specific seed namespace; never pool earlier samples or replace failures. Complete the fixed sample without outcome-dependent stopping or expansion.

Primary family: four matchup-specific mean score-margin differences, hot minus temperate, measured for the first club above. Report approximate normal paired intervals with Bonferroni protection across four contrasts (z = NormalDist.inv_cdf(1 - .05/8)). No signed cross-matchup average: focal labels are arbitrary. Approximate family intervals are not an exact finite-sample guarantee.

Secondary: paired win-rate differences with conservative Bonferroni/Wilson discordance intervals; protect the four contrast family by using eight marginal Wilson bounds (z = NormalDist.inv_cdf(1 - .05/16)). Ordinary nominal intervals may be shown separately. Report both clubs' baseline/hot win rates, changed winners, total score, duration, final and time-weighted energy, requested extra fatigue and local probability shifts with denominators. Simulation-side subsets are exploratory nominal intervals. Club-specific energy averages are descriptive; game lengths and selected players/actions may change.

Compare Philadelphia's pure-heat effect with the earlier pure-heat factorial contrast using its proper sign. That is a separate fresh sample, not a replication of the Shapley heat allocation averaged over wind/rain contexts. Neither difference certifies empirical physiological calibration or a global weather ceiling. Eight copied clubs and four opponents do not represent all league matchups. Tactic/roster differences are associated context, not isolated causal tactic estimates.

## Qualification and retention

Use qualified `--no-maglev` workers and the supervisor: 15-second status / 300-second no-checkpoint-progress deadline. Test arm construction, immutable profiles, cold/wind/rain absence, both simulation sides, exact temperate/v1.0 parity, enabled replay, save/resume, rejection of corrupted telemetry and exact prior-result replay before research. Audit each result's clock/scoring/statistics, retain all full gzip ledgers atomically, replay the first two seeds per matchup/arm, checksum retained results after subsequent matches. Confirm all full-ledger CRCs, hashes and compact records independently afterward. Preserve the 64-file v1.0 lock.

Deliver a small report, compact outcomes, verification, pinned manifest/copied profiles and reproducible source patch first. Full ledgers stay separate; no bulk tar is a prerequisite. No official deployment, coefficient adoption or competition data changes are authorized by this laboratory study.
