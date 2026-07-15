## ADDED Requirements

### Requirement: Weighted multi-muscle model

An exercise SHALL have exactly one primary muscle group and zero or more secondary muscle groups. Each association SHALL carry a contribution weight (0–100). The system SHALL persist these via a relation table and MUST migrate existing exercises so their current `muscle_group` becomes the primary at weight 100.

#### Scenario: Existing exercise migrated

- **WHEN** the migration runs on an exercise with a single `muscle_group`
- **THEN** that group is recorded as primary with weight 100 and no secondaries

#### Scenario: Create with secondaries

- **WHEN** the user creates an exercise with a primary and two weighted secondaries
- **THEN** all three associations are persisted with their roles and weights

### Requirement: Exercise creation and edit form

The system SHALL provide a guided form to create and edit an own exercise capturing: name, primary muscle group, optional weighted secondaries, equipment, compound/isolation type, and a bodyweight flag. The form MUST validate input, use i18next strings, and meet ≥44px touch targets.

#### Scenario: Primary is required

- **WHEN** the user tries to save without a primary muscle group
- **THEN** the form blocks saving and shows an i18n validation message

#### Scenario: Secondary weights validated

- **WHEN** the user adds a secondary with a weight outside 0–100
- **THEN** the form rejects it with a validation message

#### Scenario: Edit propagates

- **WHEN** the user edits an existing exercise's muscles or bodyweight flag and saves
- **THEN** the changes persist and are reflected in the library

### Requirement: Save catalog exercise as own

The system SHALL allow saving an ExerciseDB catalog exercise as an own exercise, prefilling the form from the catalog data (primary/secondary muscles, bodyweight when equipment indicates body weight).

#### Scenario: Prefill from catalog

- **WHEN** the user chooses to save a catalog exercise as own
- **THEN** the creation form opens prefilled with the catalog's name and mapped muscles/equipment
