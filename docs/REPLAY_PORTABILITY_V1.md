# Replay portability v1

The frozen `0.1.0-exhibition` engine and its source SHA256 remain unchanged. Saved proposals, accepted results and database payload digests are never rewritten or rounded by verification.

## Cause and evidence

A 10,000-pair probe using identical seeded random draws on Node 24.22.1 (V8 13.6.233.17-node.58) and Deno 2.6.4 (V8 14.2.231.17-rusty) produced identical uniform draws, logarithms and square roots. Sine differed in 354 cases and cosine in 348; 591 of 20,000 generated normal values differed. The frozen normal generator uses sine/cosine in its Box–Muller calculation. This reproduces a runtime-math source for the discrepancy without a database or JSON round trip.

ECMAScript specifies [Math.sin](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.sin) and [Math.cos](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.cos) as implementation-approximated. The probe supports the explanation for the observed coordinate drift; it does not guarantee every runtime or seed will produce the same sporting decisions.

The original live Roanoke–Lynchburg export reproduces every score, event identity, ordering, actor, time, input, quarter and player/team statistic exactly in Node. Only 133 event `y` values and 40 event `data.targetY` values differ, by at most four binary64 steps and 2.842170943040401e-14 metres. Its historical digest remains `8b66e3cfca7252a0402767f9dd3e1ae1009d7faf747d900ff182b7fae97fb1e1`.

## Explicit comparison contracts

| Policy | Contract |
| --- | --- |
| `century-replay-exact-v1` | Every persisted JSON field must match exactly. Object key order and omitted optional `undefined` properties follow the existing persistence contract. |
| `century-replay-coordinate-v1` | Same contract, allowing only `events[index].y` and `events[index].data.targetY` to differ by **both** at most eight binary64 steps and at most 1e-12 metres. Both values must be finite and inside the field width. |

All other coordinates, input/configuration values, times, scores, statistics, event types/actors/IDs, array order and additional/missing fields remain exact. Any difference outside this allowlist fails verification. Nonfinite numbers fail closed. Eight steps provide a small margin above the observed four-step maximum; they are a fixed verification boundary, not a promise of compatibility with arbitrary future runtimes.

The portable comparator returns the policy, whether the comparison was exact, allowed coordinate difference count, maximum absolute/step difference and first rejected path. The backend explicitly selects the coordinate policy; the UI distinguishes exact replay from bounded coordinate equivalence. Strict local competition validation and acceptance continue using their existing exact replay checks. This policy does not authorize changed results or loosen database acceptance rules.

Offline exported-match verification defaults to strict replay:

```sh
npm run verify:match-export -- /path/to/match.json
npm run verify:match-export -- /path/to/match.json --coordinate-rounding
```

An exported ledger alone cannot authenticate its origin: offline replay checks internal reproducibility, not the database digest or commissioner authorization. The authoritative saved database record and audit remain the source of truth.

## Regression checks

`npm run validate:replay` compares an entirely fictional fixture independently in Node and pinned Deno 2.6.4. It also verifies exact-mode rejection, coordinate boundaries, absolute limits, field bounds, nonfinite values, changed actors/events/order, statistics, times, inputs and seeds. It does not modify either compared result. CI runs it alongside the frozen baseline, match and competition suites.

A coordinate policy failure requires investigation. Do not expand tolerance, choose another seed, or overwrite the original ledger automatically. A future fully portable math implementation would require a new gameplay engine release and calibration.
