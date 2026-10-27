# CenturyLeague Player Pool Lifecycle

## Purpose

CenturyLeague distinguishes between:

- rostered active players,
- active unsigned players (free agents),
- retired players,
- players who leave the eligible player pool without a continuing Century career.

An unsigned player does not leave after a fixed number of years. Attrition is probabilistic and evaluated only at quarterly player-entry windows.

## Entry windows

Player entry windows occur after the:

- March season → April Entry Class
- June season → July Entry Class
- September season → October Entry Class
- December season → January Entry Class

The first ordinary window is Winter 2026, after the December 2026 season, producing the January 2027 Entry Class.

The inaugural player population is separately classified as the Founding Player Pool.

## Quarterly processing order

At an entry-window checkpoint:

1. Finish the trigger month's normal development and retirement processing.
2. Identify active unsigned players.
3. Calculate each free agent's market percentile within the relevant competition category.
4. Evaluate unsigned-player pool attrition.
5. Record exits and audit all probability calculations.
6. Determine the remaining active-player and free-agent population.
7. Determine the size of the incoming entry class.
8. Generate the new class.
9. Make the class eligible for the following month's season.

## Career Persistence

Every generated player receives a hidden Career Persistence rating from 1–20.

Career Persistence represents willingness to continue pursuing a Century career while unsigned. It does not affect in-match performance.

High Persistence reduces unsigned-player exit probability.
Low Persistence increases it.

It is stored with other hidden generation/lifecycle variables in the private schema.

## Pool-exit model v1.0

The quarterly model uses a logistic probability.

The logit contains:

- base intercept
- age pressure
- nonlinear time-unsigned pressure
- free-agent market percentile
- twelve-month Overall trend
- prior roster experience
- grace period after release
- Career Persistence

The resulting probability receives only a mild population-pressure multiplier.

### Age pressure

Age has little effect at young ages and increasingly matters later:

- +0.16 per year above age 22
- another +0.16 per year above age 28
- another +0.15 per year above age 32

### Time unsigned

Time unsigned is deliberately nonlinear:

- first six months: no direct time penalty
- after six months: +0.035 per month
- after eighteen months: an additional +0.025 per month
- after thirty-six months: an additional +0.020 per month

There is no automatic expiration date.

### Market percentile

Market percentile is calculated relative to the unsigned-player population for the applicable competition category.

Higher percentile means a stronger free agent.

The pressure term is:

`(0.50 - marketPercentile) × 2.40`

A top free agent therefore receives substantial protection while a bottom-of-pool player receives additional exit pressure.

The first version uses Overall as the market-ranking basis. Future versions can add archetype/role scarcity without changing the historical v1.0 calculations.

### Development trend

Twelve-month Overall trend is multiplied by -0.35.

Improving players are more likely to remain in the pool.
Declining players are more likely to leave.

### Prior roster experience

A previously rostered player receives a -0.75 adjustment.

Recent releases receive additional grace:

- released within six months: -1.20
- released 7–12 months ago: -0.50
- after twelve months: no additional release grace

### Career Persistence

The persistence term is:

`(10.5 - CareerPersistence) × 0.12`

### Population pressure

The default target is 270 free agents, based on a planned inaugural ecosystem of roughly 900 active players and 630 roster positions.

Population pressure is intentionally weak:

`1 + 0.50 × (currentFreeAgents / targetFreeAgents - 1)`

The multiplier is clamped to 0.85–1.20.

This means population balance can gently influence attrition without making individual players obviously disappear because the database wants a target number.

## Calibration examples

At the default pool size, v1.0 gives approximately:

- 21-year-old decent prospect, unsigned nine months: 1–2% quarterly exit risk
- weak 24-year-old, unsigned eighteen months: about 9%
- 27-year-old near bottom 15% of the market, unsigned two years: about 21%
- 33-year-old former roster player who remains useful: about 12%
- 34-year-old declining fringe player, unsigned two years: about 70%

These values are calibration targets, not fixed outcomes.

## Historical status

`retired` and `exited_pool` are separate states.

A player who leaves the pool is not automatically described as a retired professional. The exit event is retained historically in `player_pool_exits`.

Every quarterly evaluation, including players who remain eligible, is stored privately in `player_pool_exit_evaluations` with the probability inputs, random roll, and component values. This makes the simulation reproducible and auditable.
