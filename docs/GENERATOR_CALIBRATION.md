# Player Generator v1.0 Calibration

The simulation core includes a disposable population validator. It uses deterministic seeds so the same model version can be reproduced.

## Initial 10,000-player calibration

The first calibrated implementation produced:

- Overall mean: approximately 11.2
- Talent-class mix: close to the configured 22 / 56 / 17 / 4.5 / 0.5 percent targets
- Secondary archetypes: approximately 40%
- Off-profile gifts: approximately 5%
- Extreme outliers: approximately 0.75%
- Individual attribute means: generally between 10.3 and 11.3

The original formula over-correlated unrelated abilities because global talent carried too much weight. v1.0 therefore shifts more influence into hidden foundations and archetypes.

Representative correlations after recalibration:

- Speed / Acceleration: ~0.66
- Agility / Evasion: ~0.61
- Awareness / Anticipation: ~0.63
- Kicking Accuracy / Kicking on Run: ~0.61
- Strength / Tackling: ~0.55
- Aerial Marking / Vertical Leap: ~0.62

Unrelated pairs are substantially weaker; for example Speed / Composure is roughly 0.30.

These are calibration observations rather than permanent targets. Universal settings and model versions allow later tuning without regenerating existing players.

## Career smoke test

A representative age-22 player with roughly average development traits:

- improved overall into the early 30s,
- saw speed peak and decline before technical/mental skills,
- retained kicking accuracy later than pace,
- developed awareness into the early 30s,
- experienced sharply increasing retirement probability in the late 30s.

This is the intended qualitative behavior for the initial lifecycle model.


## Monthly lifecycle calibration

Beginning with development model v1.1, Century seasons occur monthly.

The original development curves remain expressed as annual expected movement. For a one-month season:

- expected development/decline is scaled to 1/12 of the annual amount,
- random development standard deviation is scaled by sqrt(1/12),
- the 3% annual breakout chance is converted to its equivalent one-month hazard,
- retirement probability is first calculated on the annual model and then converted to its equivalent one-month hazard.

This avoids applying an annual aging event twelve times per calendar year while still allowing incremental change after every season.
