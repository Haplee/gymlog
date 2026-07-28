## ADDED Requirements

### Requirement: RIR/RPE-based load suggestion

The system SHALL compute, for each exercise with recent history, a suggested load
and rep target for the next session from the logged RIR and RPE values. The
computation MUST be a pure function, run offline, and send no data anywhere.

#### Scenario: Easy sessions raise the load

- **WHEN** the last sets of an exercise averaged RIR at least 2 above the target
- **THEN** the suggestion raises the working weight by 2.5–5% with a stated reason

#### Scenario: Hard sessions hold the load

- **WHEN** the last two sessions averaged RPE 9.5 or higher with declining reps
- **THEN** the suggestion holds or reduces the load instead of progressing

#### Scenario: Hard cap on increases

- **WHEN** any rule would produce an increase above 10% over the last logged weight
- **THEN** the suggestion is clamped to 10%

#### Scenario: Insufficient history

- **WHEN** an exercise has fewer than two logged sessions or no RIR/RPE data
- **THEN** no load suggestion is produced and no value is invented

### Requirement: Stall and deload detection

The system SHALL flag an exercise as stalled when estimated 1RM has not improved
across at least three sessions or 21 days, and SHALL recommend a deload week when
sustained high volume coincides with falling RIR and low session ratings.

#### Scenario: Stall flagged with a probable cause

- **WHEN** e1RM is flat for four sessions
- **THEN** the exercise is flagged as stalled with a probable cause among volume,
  frequency or fatigue

#### Scenario: Deload recommended

- **WHEN** weekly volume has climbed for three weeks while RIR falls and session
  ratings drop
- **THEN** a deload recommendation is produced

### Requirement: Readiness modulation from wearable data

When wearable sleep and resting heart-rate data exist, the system SHALL modulate
the load suggestion. When no wearable data exists, the modifier SHALL be absent
rather than estimated.

#### Scenario: Poor recovery holds progression

- **WHEN** the 7-day average sleep is under 6 hours or resting HR is more than 7 bpm
  above baseline
- **THEN** the suggestion recommends holding the load rather than increasing it

#### Scenario: No wearable connected

- **WHEN** the user has no wearable data
- **THEN** no readiness modifier is applied and the suggestion is unchanged
