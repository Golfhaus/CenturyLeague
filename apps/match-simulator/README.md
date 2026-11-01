# Match Simulator

The adopted v0.1 match engine is implemented in `packages/simulation-core/src/match`; its release identity is `0.1.0-exhibition` for saved-match compatibility.

It consumes the canonical drafted player records and existing coach tendencies, resolves meaningful events, and produces scores, box scores, quarter scores, event ledgers and podcast briefings. There is no browser UI yet.

See [the release scope](../../docs/MATCH_ENGINE_V0_RELEASE.md) and [the model and running instructions](../../docs/MATCH_ENGINE_V0.md). Run `npm run verify:match-baseline` to verify the adopted source/defaults and `npm run validate:matches` for scoring, replay, participation and workload checks.

For a nine-match round featuring each club once, use `npm run simulate:round -- --players /private/players.json --draft /private/draft.json --coaches /private/coaches.json --round-id exhibition-round-02 --output /private/round-02`. For the original four-club calibration program, use `npm run simulate:exhibitions -- --players ... --draft ... --coaches ... --output ... --repeats 10`. Official competition scheduling, standings and persistent availability are separate league-management work.
