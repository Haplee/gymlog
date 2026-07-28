## ADDED Requirements

### Requirement: AI coach is off by default

The AI coach SHALL be disabled for every user until that user explicitly enables
it. The server-side flag `profiles.ai_coach_enabled` SHALL default to `false` and
SHALL be the source of truth. The client store MAY mirror it for UI purposes, but
when client and server disagree the server value SHALL win.

#### Scenario: New account

- **WHEN** a new user signs up
- **THEN** `ai_coach_enabled` is `false`, no coach surface is rendered, and no
  request is ever made to the coach endpoint

#### Scenario: Client mirror is stale

- **WHEN** the local store says enabled but the server says disabled
- **THEN** the app treats the coach as disabled and refreshes the local mirror

### Requirement: Explicit informed consent

Enabling the coach SHALL require an explicit consent step that states, in the
user's language: the exact list of data categories that leave the device, the fact
that a third-party model provider processes them, that the coach does not replace
medical or professional advice, and that it can be disabled and its data deleted at
any time. The confirm action MUST NOT be preselected or auto-focused.

#### Scenario: Consent given

- **WHEN** the user reads the consent screen and confirms
- **THEN** `ai_coach_enabled` becomes `true`, `ai_coach_consent_at` is set, the
  current consent version is stored, and an audit row without health data is written

#### Scenario: Consent dismissed

- **WHEN** the user closes the consent screen without confirming
- **THEN** the coach stays disabled and nothing is persisted

#### Scenario: Consent text changed

- **WHEN** the stored consent version is lower than the current one
- **THEN** the coach is inactive and the consent screen is shown again before any
  request is made

### Requirement: Revocation deletes coach data

Disabling the coach SHALL delete, in a single transaction, that user's coach
memory, messages and pending suggestions, and SHALL set `ai_coach_enabled` to
`false`. Only a content-free audit record SHALL remain.

#### Scenario: User disables the coach

- **WHEN** the user turns the coach off
- **THEN** memory, messages and suggestions for that user are deleted and the flag
  is `false`

#### Scenario: Purge is scoped

- **WHEN** the purge routine is called with another user's identifier
- **THEN** no rows belonging to that other user are affected

#### Scenario: Account deleted

- **WHEN** the auth user is deleted
- **THEN** all coach rows cascade away

### Requirement: Server kill switch

The system SHALL support disabling the coach globally through a server-side
environment flag, without deploying a client release. When disabled, the endpoint
SHALL return 503 before touching the database or the model provider.

#### Scenario: Kill switch active

- **WHEN** the global flag is off and a consenting user opens the coach
- **THEN** the endpoint returns 503, no model call is made, and the UI shows a
  temporary-unavailable message

### Requirement: No functional loss when disabled

The app SHALL remain fully usable with the coach disabled. Deterministic tips and
autoregulation suggestions SHALL continue to work offline and unchanged.

#### Scenario: Coach off, stats still advise

- **WHEN** the user with the coach disabled opens their stats
- **THEN** the existing tips and the deterministic load suggestions are shown
