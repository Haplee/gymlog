## ADDED Requirements

### Requirement: Bodyweight set logging

For an exercise flagged as bodyweight, the system SHALL NOT require entering kg when logging a set. The set's volume SHALL be estimated using the user's body weight effective on the set's date, optionally plus added external load (lastre).

#### Scenario: No kg required

- **WHEN** the user logs a set of a bodyweight exercise entering only reps
- **THEN** the set is saved without requiring a kg value

#### Scenario: Volume from body weight

- **WHEN** a bodyweight set is saved and the user has a body weight recorded on/before that date
- **THEN** the set volume is estimated as (body weight [+ added load]) × reps

#### Scenario: Added load counts

- **WHEN** the user adds external load to a bodyweight set
- **THEN** the added load is included in the volume estimate

### Requirement: Effective body weight by date

The system SHALL use the body weight effective on the set's date (the most recent measurement on or before that date), not the current weight, when estimating volume.

#### Scenario: Uses historical weight

- **WHEN** a set was performed on a date with an earlier recorded body weight than today's
- **THEN** the volume estimate uses that earlier weight

### Requirement: Weekly body weight prompt

The system SHALL prompt the user to record their body weight approximately once per week. The submitted value SHALL be stored in `body_measurements` and used as the current body weight for bodyweight volume estimation. The prompt MUST be dismissable and MUST NOT reappear until the next weekly cycle once answered.

#### Scenario: Weekly prompt shown

- **WHEN** a week has passed since the last body weight entry (or none exists)
- **THEN** the user is prompted to record their current body weight

#### Scenario: Answer stored and reused

- **WHEN** the user submits their weight in the prompt
- **THEN** it is saved to `body_measurements` and used for subsequent bodyweight volume estimates

#### Scenario: Not re-prompted within the week

- **WHEN** the user has already recorded weight this week
- **THEN** the weekly prompt does not reappear until the next cycle

### Requirement: Graceful degradation without body weight

When no body weight is recorded for the user, the system SHALL degrade gracefully: it MUST let the user still log reps (or enter a manual weight) and MUST surface a non-blocking notice rather than failing.

#### Scenario: No body weight recorded

- **WHEN** the user logs a bodyweight set but has no body weight on record
- **THEN** the set is still saved (reps or manual kg) and a notice invites recording body weight
