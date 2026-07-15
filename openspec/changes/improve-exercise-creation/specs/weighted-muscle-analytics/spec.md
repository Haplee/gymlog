## ADDED Requirements

### Requirement: Weighted volume distribution

When computing per-muscle volume, muscle fatigue, and the consistency/heatmap views, the system SHALL distribute each set's volume across the exercise's muscles proportionally to their weights, instead of assigning the full volume to a single muscle group.

#### Scenario: Split across muscles

- **WHEN** a set of an exercise with primary 60% and a secondary 40% contributes volume V
- **THEN** 0.6·V is attributed to the primary muscle and 0.4·V to the secondary

#### Scenario: Single-muscle exercise unchanged

- **WHEN** an exercise has only a primary at weight 100
- **THEN** the full set volume is attributed to that muscle, matching prior behavior

#### Scenario: Fatigue reflects weights

- **WHEN** muscle fatigue is calculated over recent sets
- **THEN** each muscle's load reflects its weighted share of the contributing sets

### Requirement: Exact per-muscle breakdown visible

The system SHALL let the user see (and, via the authoring form, set) the exact per-muscle contribution of an exercise, not only an internal value. The stats views SHALL reflect the exact weighted split.

#### Scenario: Breakdown shown

- **WHEN** the user views an exercise with weighted muscles
- **THEN** the exact primary and secondary muscle contributions are displayed

### Requirement: Historical stats consistency

The system SHALL define and apply a consistent strategy for historical data so that weighted distribution does not produce misleading past values. The chosen strategy (recompute all vs. apply going forward) MUST be documented and deterministic.

#### Scenario: Deterministic totals

- **WHEN** per-muscle stats are recomputed for the same underlying sets and weights
- **THEN** the resulting totals are identical across runs
