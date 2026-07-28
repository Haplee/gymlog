## ADDED Requirements

### Requirement: Learned facts are scoped to their owner

The coach SHALL persist learned facts about a user in a dedicated table protected
by row-level security so that only the owning user can read or modify them. The
owning identifier SHALL be supplied by the server from the verified token and SHALL
NOT be part of the model-facing tool schema.

#### Scenario: Fact written

- **WHEN** the model records a fact during a conversation
- **THEN** it is stored against the authenticated caller only

#### Scenario: Cross-user read blocked

- **WHEN** user A queries the memory table
- **THEN** no rows belonging to user B are returned

#### Scenario: Model cannot choose the owner

- **WHEN** the model attempts to specify an owner for a fact
- **THEN** the field does not exist in the tool schema and the server value is used

### Requirement: Strict fact schema and bounded size

Facts SHALL be written through a strict tool schema with a closed set of categories
and a bounded length. The system SHALL keep at most 50 facts per user, evicting the
oldest lowest-confidence entry when the limit is exceeded.

#### Scenario: Invalid category rejected

- **WHEN** a fact is submitted with a category outside the allowed set
- **THEN** the write is rejected

#### Scenario: Limit reached

- **WHEN** a 51st fact is recorded
- **THEN** the oldest lowest-confidence fact is removed

### Requirement: Memory is visible and deletable

The user SHALL be able to see every stored fact, grouped by category, and delete
them individually or all at once from settings.

#### Scenario: Fact deleted

- **WHEN** the user deletes a fact
- **THEN** it is removed and does not appear in the context of subsequent requests

#### Scenario: Full clear

- **WHEN** the user clears all coach data
- **THEN** the memory table holds no rows for that user

### Requirement: Untrusted text cannot escalate

User-authored free text included in the context SHALL be delimited and labelled as
untrusted data. The model SHALL have no tool capable of reading arbitrary data,
deleting records, making network calls, or writing to training tables.

#### Scenario: Injected instruction in an exercise name

- **WHEN** an exercise name contains text instructing the model to delete data
- **THEN** no deletion occurs, because no such capability is exposed

#### Scenario: Worst case is user-visible

- **WHEN** an injection succeeds in recording a false fact
- **THEN** that fact appears in the user's own memory list and can be deleted there
