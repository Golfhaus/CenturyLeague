# Match Simulator

The exhibition match engine is implemented in `packages/simulation-core/src/match`.

It consumes the canonical drafted player records and existing coach tendencies, resolves meaningful events, and produces scores, box scores, quarter scores, event ledgers and podcast briefings. There is no browser UI yet.

See [the model and running instructions](../../docs/MATCH_ENGINE_V0.md). Run `npm run validate:matches` for the independent scoring, replay, participation and workload checks. Run `npm run simulate:exhibitions -- --players ... --draft ... --coaches ... --output ... --repeats 10` for the four-club test program.
