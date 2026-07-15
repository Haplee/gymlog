## ADDED Requirements

### Requirement: Configurable ExerciseDB endpoint

The system SHALL provide an API client for ExerciseDB whose base URL and optional authentication are configurable via Vite environment variables. By default it MUST target the free open-source endpoint without any API key. When a RapidAPI key is provided, the client MUST attach the required RapidAPI headers instead.

#### Scenario: Default free endpoint

- **WHEN** no `VITE_EXERCISEDB_RAPIDAPI_KEY` is set
- **THEN** the client issues requests to the free base URL (`VITE_EXERCISEDB_BASE_URL` or its documented default) with no authentication headers

#### Scenario: RapidAPI override

- **WHEN** `VITE_EXERCISEDB_RAPIDAPI_KEY` and a RapidAPI base URL are configured
- **THEN** every request includes the `x-rapidapi-key` and `x-rapidapi-host` headers with the configured values

### Requirement: Search exercises

The system SHALL let a user query the catalog by free-text name. The query MUST be debounced to avoid excessive requests, and MUST require a minimum length before hitting the network. With no active query, a featured selection MUST be shown so the screen is never blank.

Note: the free open-source ExerciseDB tier does not support server-side attribute filtering, and its `/exercises/search` results omit muscle/equipment/body-part fields, so combinable attribute filters are out of scope for this change (deferred; would require the RapidAPI provider or a full-catalog sync).

#### Scenario: Text search

- **WHEN** the user types a query with at least 2 characters
- **THEN** the catalog returns exercises whose name matches the query

#### Scenario: Below minimum length

- **WHEN** the query has fewer than 2 characters
- **THEN** no search request is issued and a featured selection is shown

### Requirement: Normalized exercise model

The system SHALL map each raw ExerciseDB record into a stable internal exercise model exposing at least: id, name, media URL (GIF/image), video URL when present, body parts, target muscles, secondary muscles, equipment, and ordered instructions. UI code MUST depend only on this internal model, never on the raw API shape.

#### Scenario: Mapping a raw record

- **WHEN** the client receives a raw ExerciseDB exercise
- **THEN** it produces an internal model with non-raw field names and safe defaults for missing optional fields

#### Scenario: Missing media

- **WHEN** a raw record has no video URL
- **THEN** the mapped model exposes a null/absent video URL without throwing

### Requirement: Cached and resilient fetching

The system SHALL fetch catalog data through TanStack Query with a long `staleTime` (catalog is effectively static), retries on transient failures, and explicit loading and error states surfaced to the UI.

#### Scenario: Network failure

- **WHEN** a catalog request fails after retries
- **THEN** the query exposes an error state and the UI can render a retry affordance rather than crashing

#### Scenario: Cache reuse

- **WHEN** the same catalog query is requested again within `staleTime`
- **THEN** cached data is returned without a new network request
