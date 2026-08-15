# PulseChat Database

## Current status
No database has been created or migrated yet in Phase 3.

## Planned core entities
- profiles
- conversations
- conversation_members
- messages
- message_receipts
- attachments
- devices
- user_presence

Additional privacy, reporting, reaction and notification-preference tables will be added when their features are implemented.

The final SQL schema, indexes, foreign keys and RLS policies will be defined during the database/authentication phases rather than prematurely embedding database assumptions in the UI layer.
