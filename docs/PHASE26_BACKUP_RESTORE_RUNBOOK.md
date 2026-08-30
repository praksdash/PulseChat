# Phase 26 backup and restore runbook

Phase 26 is not accepted until both PostgreSQL data and private Storage objects
have a documented recovery path. Supabase database backups do not by themselves
guarantee recovery of the bytes stored in the `avatars` and `chat-media`
buckets.

## Recovery objectives for the Prototype V1 beta

- Database RPO: 24 hours or better.
- Private Storage RPO: 24 hours or better.
- Service RTO: four hours for an internal-beta incident.
- Restore drill: at least once before Phase 26 acceptance and every 90 days
  while the beta remains active.

## Backup check

1. Confirm the Supabase project plan exposes the expected daily backup/PITR
   capability and record the newest successful backup timestamp.
2. Export a schema-only backup after every migration. Store it encrypted in an
   owner-controlled release location; never commit it.
3. Configure an encrypted daily copy/export for both private buckets. Preserve
   object paths, byte sizes, MIME metadata and checksums. The backup destination
   must not be public.
4. Compare the backup manifest with `pulsechat_private.storage_dashboard`.
   Investigate missing objects or unexplained byte-count changes before release.
5. Restrict backup access, enable MFA, and document the operators who can
   restore or delete backups.

## Isolated restore drill

Never rehearse a destructive restore in the production project.

1. Create a temporary isolated Supabase project with no real users, Webhooks,
   Cron jobs or push secrets enabled.
2. Restore the selected database backup/snapshot, then apply any later committed
   migrations in order.
3. Restore the private Storage backup without making either bucket public.
4. Run `supabase/phase21_verify.sql`, `supabase/phase24_verify.sql`, and
   `supabase/phase26_verify.sql`.
5. Compare table counts, storage object counts/bytes, representative checksums,
   foreign-key integrity, RLS status and function privileges with the recorded
   source snapshot. Use controlled synthetic accounts when opening the app.
6. Verify push Webhooks/Cron remain disabled in the drill project so restored
   rows cannot notify real devices.
7. Record start/end time, backup timestamp, database/storage results, evidence
   location, deviations and achieved RPO/RTO.
8. Delete the temporary project and its credentials after evidence is retained.

Fill `restoreDrillCompletedAt` and `restoreDrillEvidence` in the ignored
`release/operations/owner-inputs.json`, then run `npm run ops:audit`.

## Recovery decision

For corrupted application data, prefer a forward repair or narrowly scoped
restore. A full project restore is an incident-level action: stop writes,
preserve evidence, confirm the restore point, notify beta testers, rotate any
exposed secrets, restore, verify all security scripts, and reopen gradually.
