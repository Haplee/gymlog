## ADDED Requirements

### Requirement: The client never talks to the model provider

All model calls SHALL be made from a server-side function. The provider API key
SHALL exist only in server environment variables and SHALL NOT appear in any client
bundle, environment variable exposed to the client, or built artifact.

#### Scenario: Key absent from the build

- **WHEN** the production bundle is built
- **THEN** no provider key or provider credential string is present in the output

#### Scenario: Direct provider call attempted

- **WHEN** client code attempts to reach the provider directly
- **THEN** it has no credential to do so and the call cannot succeed

### Requirement: Caller identity comes from the JWT

The coach endpoint SHALL authenticate every request by verifying the caller's
Supabase JWT and SHALL derive the user identity from that token only. A shared
secret carried by the client SHALL NOT be used as the authorization mechanism. Any
user identifier present in the request body SHALL be ignored.

#### Scenario: Missing or invalid token

- **WHEN** a request arrives without a valid `Authorization` bearer token
- **THEN** the endpoint returns 401 without querying the database or the provider

#### Scenario: Body identifier ignored

- **WHEN** a valid token for user A carries a body naming user B
- **THEN** only user A's data is read and written

#### Scenario: Cross-origin restricted

- **WHEN** a request arrives from an origin outside the configured allow-list
- **THEN** permissive CORS headers are not returned

### Requirement: Consent and quota enforced before any model call

The endpoint SHALL verify the stored consent flag and consume a per-user quota
before contacting the provider. Quota consumption MUST be atomic so concurrent
requests cannot exceed the limit.

#### Scenario: Consent missing

- **WHEN** a request arrives for a user whose coach flag is false
- **THEN** the endpoint returns 403 and makes no provider call

#### Scenario: Quota exhausted

- **WHEN** the user has reached the daily limit for the requested mode
- **THEN** the endpoint returns 429 with a retry hint and makes no provider call

#### Scenario: Concurrent requests

- **WHEN** ten requests arrive simultaneously against a remaining quota of one
- **THEN** exactly one is served and the rest receive 429

### Requirement: Minimized context

The context sent to the provider SHALL contain only aggregates and derived values.
It SHALL NOT contain the user identifier, email, display name, avatar, exact date
of birth, geolocation, wearable credentials, or raw per-set rows. Age SHALL be sent
as a band rather than a date.

#### Scenario: Identifiers stripped

- **WHEN** the request context is assembled
- **THEN** it contains no user identifier or contact details

#### Scenario: Consent list matches reality

- **WHEN** the set of transmitted data categories changes
- **THEN** the consent version is incremented and consent is requested again

### Requirement: Validated structured output

The endpoint SHALL request a strict structured response and SHALL validate it
against a schema before persisting or returning it. Responses that fail validation
SHALL NOT reach the UI. A provider refusal SHALL be detected before reading the
response content, and rendered content SHALL be treated as plain text.

#### Scenario: Malformed response

- **WHEN** the provider returns a response that fails schema validation
- **THEN** the endpoint returns a neutral error and persists nothing

#### Scenario: Refusal

- **WHEN** the provider signals a refusal stop reason
- **THEN** the endpoint returns a neutral message without dereferencing the content

### Requirement: Deterministic safety filter

Model output SHALL pass a server-side deterministic filter before being persisted
or shown. The filter SHALL reject load suggestions exceeding 10% over the last
logged weight, SHALL reject nutrition, supplement and pharmacological content, and
SHALL force the professional-referral flag when the user's message contains
pain or injury indicators.

#### Scenario: Excessive jump rejected

- **WHEN** a suggestion proposes a 40% load increase
- **THEN** the response is rejected and no suggestion is stored

#### Scenario: Out-of-scope content rejected

- **WHEN** the response contains dietary or supplement advice
- **THEN** the response is rejected

#### Scenario: Pain reported

- **WHEN** the user's message mentions pain or injury
- **THEN** the professional-referral flag is set and load suggestions are suppressed
  regardless of what the model returned

### Requirement: The coach proposes, the user applies

Suggestions SHALL be stored as pending and SHALL require an explicit user action to
be applied. The system SHALL NOT modify routines, exercises, weights or sets on the
model's behalf.

#### Scenario: Suggestion accepted

- **WHEN** the user taps apply on a load suggestion
- **THEN** the normal edit flow opens prefilled and the change is saved only after
  the user confirms

#### Scenario: Suggestion ignored

- **WHEN** the user ignores a suggestion
- **THEN** nothing in their training data changes

### Requirement: Privacy-preserving logging

Server logs SHALL record only operational metrics — token counts, latency, stop
reason, status code. Prompt content and model responses SHALL NOT be logged.

#### Scenario: Error path

- **WHEN** a request fails
- **THEN** the log entry identifies the failure without including user data
