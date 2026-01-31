## Option B: Phone + PIN access (brainstorm)

### Goal
- Limit trip visibility to participants only.
- Participants are identified by phone number.
- Users log in with phone + PIN to see trips that include their phone.

### Proposed flow
- Trip creation:
  - Add participants with `name`, `phone`, and `PIN` (PIN per participant).
  - Store phone + PIN for each participant.
- Login:
  - User enters phone + PIN.
  - Validate against participant records.
  - List only trips where that phone exists.

### Pros
- Simple to implement in current stack.
- No SMS/OTP or external providers.

### Cons / risks
- PINs are weaker than OTP (can be shared).
- Needs secure storage (hash PINs, do not store plain).

### Open questions
- Should PIN be set per trip or per user across trips? -- PIN per trip and only the Phone number to be validated to list all trips. Phone+PIN to be used to access a particular trip
- Who can change participant phone/PIN (admin vs any member)? -- Admin to the trip
- Should there be a logout or device remember option? -- Yes, logout should be there

## UI issue: Rupee symbol overlaps amount field

### Observation
- On the Add Expense screen, the rupee symbol overlaps the `0` placeholder/value in the amount input.

### Desired change
- Adjust styling so the currency symbol and number never overlap.
- Ensure adequate left padding inside the amount input.

## Feature: Expense category field

### Desired change
- Add a `Category` field on the Add Expense screen.
- Allowed values: `Travel`, `Food`, `Activity`, `Miscellaneous`.

## Feature: Trip admin by default

### Desired change
- The person who creates a trip is automatically marked as the trip admin.
