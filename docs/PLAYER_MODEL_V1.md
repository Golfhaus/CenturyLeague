# Century Player Model v1.0

## Visible attributes

All visible attributes use a 1–20 scale.

### Physical

1. Speed
2. Acceleration
3. Agility
4. Strength
5. Vertical Leap
6. Stamina
7. Durability
8. Recovery

### Ball and gameplay skills

9. Kicking Power
10. Kicking Accuracy
11. Kicking on the Run
12. Opposite-Side Skill
13. Hand-Passing
14. Ball Carrying
15. Evasion
16. Aerial Marking
17. Contested Possession
18. Ground-Ball Skill
19. Tackling
20. Defensive Spoiling

### Mental

21. Awareness
22. Decision-Making
23. Anticipation
24. Composure
25. Discipline

## Hidden foundations

- Athleticism
- Power
- Coordination
- Endurance
- Game Sense

## Archetypes

- Balanced All-Rounder
- Inside Ball-Winner
- Outside Runner
- Explosive Runner
- Power Carrier
- Field General
- Precision Distributor
- Long Kicker
- Aerial Target
- Pressure Forward
- Finisher
- Lockdown Defender
- Intercept Defender
- Aerial Defender
- High-Motor Utility

Players may also receive a secondary archetype.

## Entry-age distribution

| Age | Probability |
|---:|---:|
| 16 | 0.1% |
| 17 | 0.4% |
| 18 | 1.0% |
| 19 | 2.0% |
| 20 | 12.0% |
| 21 | 19.0% |
| 22 | 25.0% |
| 23 | 22.0% |
| 24 | 16.0% |
| 25 | 2.0% |
| 26 | 0.5% |

## Talent distribution defaults

- Below average: 22%
- Average: 56%
- Above average: 17%
- Star: 4.5%
- Exceptional: 0.5%

These are universe-level configurable trends.

## Geography

Initial player generation is approximately 99% United States and 1% international.

Core U.S. birthplace region:

- Virginia
- Maryland
- Delaware
- Pennsylvania
- Washington, DC
- North Carolina

Adjacent states such as New Jersey, West Virginia, South Carolina, New York, Ohio, Tennessee, and Kentucky are the next strongest sources. Domestic probability decays with distance from the core while retaining a small national-population component.

## Ratings

Ratings are stored internally as continuous values, for example 13.4621, and displayed rounded to 1–20.

This permits gradual development across multiple seasons without forcing every change to appear as an integer point immediately.

## Season cadence and development

Century has twelve seasons per calendar year. Each season corresponds to one calendar month.

- Season 1: November 2026
- Event: Inaugural Tournament
- Season 2: December 2026
- Season 3: January 2027
- and so on

Player entry age is measured at the start of the season for which the player is generated. Date of birth is generated consistently with that age.

Lifecycle processing runs after every monthly season. The underlying development model remains calibrated in annual terms, but expected rating movement is multiplied by 1/12 for a normal one-month advancement. Random development variance is scaled by the square root of 1/12 so twelve monthly checks have approximately the intended annual variance. Rare breakout and retirement probabilities are converted from annual probabilities to equivalent monthly hazards rather than simply being applied twelve times.

Ratings stored for a season are the ratings used during that month. At the end of the month, development and retirement processing produces the state for the following season.

Attributes have separate peak families.

- Early physical peak: approximately age 25
- Mid physical/contest peak: approximately age 28
- Technical peak: approximately age 30
- Mental peak: approximately age 32

Each player receives individualized peak offsets, development potential, development speed, decline rate, longevity, retirement tendency, and a hidden Career Persistence rating used only for unsigned-player lifecycle decisions.

Potential is probabilistic rather than a fixed maximum rating.

Development model v1.1 uses monthly advancement. Twelve one-month advancement periods are designed to approximate the long-run behavior originally specified for one annual advancement, while allowing smaller visible changes and fewer retirements in any single season.

## Role ratings

Derived ratings:

- Defensive
- Central
- Attacking
- Overall

Overall is based primarily on the player's best role with smaller credit for secondary-role versatility; it is not the simple average of all 25 attributes.


## Quarterly player entry and unsigned attrition

New ordinary entry classes are generated after the March, June, September, and December seasons and become eligible for the following month. The inaugural population is classified separately as the Founding Player Pool.

Unsigned players are evaluated for leaving the active player pool at those same quarterly checkpoints. Exit probability depends on age, time unsigned, market percentile, recent development trend, prior roster history, release grace, Career Persistence, and a mild free-agent-pool pressure adjustment.

Leaving the player pool is distinct from retirement.


## Competition-category independence

Player generation occurs one league at a time. A generation batch cannot mix men's and women's players, and a player may only be committed against a season belonging to the same competition category.

For launch, the Founding Player Pool is men's-only. The working target is 900 men for 18 teams with 35-player rosters, leaving approximately 270 initial free agents. The women's founding pool will be generated later when that league is initialized and will use its own season calendar and population targets.
