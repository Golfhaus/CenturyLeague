# Automatic halftime policy candidate

Candidate: `restored-halftime-policy-v1`, an isolated, default-off implementation in `experiments/halftime-policy/`. The earlier candidate's formulas are semantically restored under a new source identity. The implementation matches all 96 saved policy choices/distances and 96 saved diagnostic choices, without claiming that the missing historical TypeScript bytes were recovered.

## Decision boundary and observations

Run once at the score-triggered halftime, after the existing interval and native personnel review. Build both observations and decisions before applying either team's change. Each coach can use the current public score and first-half shot/disposal totals, original tactical root, own active players' ratings/energy, own pre-interval energy/stints and own native personnel-review events. Opponent private ratings/energy, future events, future random draws and the other coach's decision are excluded.

The existing substitutions and recovery remain in force. The policy does not rewrite player ratings, a starting lineup, history, the match winner or a clock. Its output changes effective tactical sliders only for the second half. All choices and candidate components are recorded, including Hold and veto reasons.

## Unchanged graded candidate

Recipes remain conserve, press, aerial, lower-aerial and drop-counter, each with half/full steps. At most two sliders change, total absolute distance from the original root is at most two and each slider stays in 1-5. Empty or duplicate candidate changes are omitted.

Adoption hurdles are 0.12 at a deficit of four or less (including leading/tied), 0.06 at deficits 5-20, and 0.02 at deficits 21+. Major changes require a hurdle of at least 0.12, directional evidence of at least 0.65 and reliability of at least 0.45. These numbers are **heuristic support scores, not predicted percentage-point win gains**. The existing distance, execution and workload costs are unchanged; selection requires net support strictly above the candidate's hurdle.

Pressing is vetoed when not trailing or when median own active-player energy is below 0.45. Drop-counter requires a high-pressure root. All actions require sufficient directional evidence. A coach can retain Hold even while trailing; no target adoption frequency is imposed.

## Validation and adoption

The frozen fresh plan, including its prospective interval-method amendment, is `halftime-natural-policy-plan-2026-11-17.json`. Mechanical checks cover unchanged defaults, Hold equivalence, first-half identity, replay, fatigue/leading vetoes, bounds and own-observation reconstruction. Every scientific match is audited; old screens, qualification and preflight outcomes are excluded from the new estimate. Decision coverage and sporting outcomes are distinct findings.

The completed batch contains 384 paired cases and 1,536 audited outcomes. Focal-only coaching changed tactics in 30/384 cases (7.8%), including 21/61 when trailing by 21+. Its pre-match win-rate estimate was -1.30 percentage points versus neither coach adapting (200 versus 205 wins); the conservative 95% interval was [-15.16, +12.56] points. All five changed winners went against the focal team. Benefit is not established; this pattern warrants decision-quality review without claiming proven harm or tuning thresholds to this sample. This full-match estimate includes Hold and cannot be pooled with earlier conditional second-half estimates.

Functional restoration alone does not settle policy optimality or authorize adoption. The next gate is genuine opposing-tactic/personnel-fit mismatches and persistent-fatigue coverage, since this study used mirrored skill patterns and common starting tactical backgrounds. The current tournament retains its existing engine. December-season v2 remains gated by adequate halftime-context coverage, holistic modifier testing, an isolated season rehearsal and the later release decision. Additional v3 factors remain out of scope.

The subsequent targeted decision-quality review is recorded in HALFTIME_DECISION_QUALITY_2026_11_17.md. It identifies a slider-limit support defect in this preserved original candidate; a separate boundary-corrected candidate is mechanically qualified. Original outcome estimates must not be attributed to that correction. Moderate competitive-fatigue and holistic validation remain open.
