## ADDED Requirements

### Requirement: Browse catalog UI

The system SHALL present a catalog view with a search input, rendering matching exercises in a scrollable list (with a featured selection when the query is empty). All strings MUST use i18next (Spanish), touch targets MUST be ≥44px, and the view MUST use the app design tokens (no hardcoded hex). (Attribute filter chips are deferred — see the exercise-catalog spec note on free-tier limitations.)

#### Scenario: Rendering results

- **WHEN** the catalog query resolves with exercises
- **THEN** each exercise is shown with its name and a thumbnail (GIF/image) in the list

#### Scenario: Empty state

- **WHEN** no exercises match the active search and filters
- **THEN** an i18n empty-state message is shown instead of an empty list

#### Scenario: Loading state

- **WHEN** the catalog query is loading
- **THEN** a skeleton or loading indicator is shown, not a blank screen

### Requirement: Exercise detail with media and instructions

The system SHALL show a detail view for a selected exercise displaying its media (GIF/image, and video when available), primary and secondary muscles, equipment, and step-by-step instructions. Media MUST load lazily and degrade gracefully when absent.

#### Scenario: Exercise with GIF

- **WHEN** the user opens an exercise that has a GIF/image URL
- **THEN** the media renders lazily with descriptive alt text

#### Scenario: Exercise with video

- **WHEN** the selected exercise exposes a video URL
- **THEN** a video player/affordance is offered in addition to the static media

#### Scenario: Instructions list

- **WHEN** the exercise has instructions
- **THEN** they are rendered as an ordered list in reading order

### Requirement: Unified sources with own-exercise creation preserved

The system SHALL present exercises from both the user's Supabase library (own and public) and the ExerciseDB catalog in a single unified browse experience, visually distinguishing each item's source (e.g. an "own" vs "catalog" badge). The existing ability to create and manage own exercises MUST remain fully functional with no regression.

#### Scenario: Mixed results

- **WHEN** the user searches and both a Supabase library exercise and an ExerciseDB exercise match
- **THEN** both are shown in the same list, each labeled with its source

#### Scenario: Create own exercise still works

- **WHEN** the user creates a new custom exercise
- **THEN** it is saved to their Supabase library exactly as before and appears labeled as an own exercise

#### Scenario: Source is distinguishable

- **WHEN** any exercise is rendered in the unified list
- **THEN** its origin (own / public / ExerciseDB catalog) is visually indicated

### Requirement: Select exercise for a workout

The system SHALL allow the user to pick a catalog exercise while logging a workout, prefilling the exercise name (and available metadata such as target muscle and equipment) into the existing workout logging flow.

#### Scenario: Pick from catalog

- **WHEN** the user selects an exercise from the catalog within the workout flow
- **THEN** the workout entry is prefilled with that exercise's name and available metadata

#### Scenario: Return without selecting

- **WHEN** the user leaves the catalog without choosing an exercise
- **THEN** the existing workout flow is unchanged and no entry is added
