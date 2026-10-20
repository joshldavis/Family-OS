# FOS-009 — Shared-project catalog gate

On 2026-10-20, an owner-authorized **catalog-only** read checked the confirmed
made-again project (`mivuyqyayhiolelrfyxu`). The queries read `pg_catalog`
definitions only: table/column names, defaults, constraints, foreign keys,
and trigger definitions. They did not select family rows, storage objects,
credentials, or make any database changes.

## Findings for the School Agent proposals

- The existing `family_os.assignments` table has the text ID, UUID `family_id`,
  text `student_id` and `title`, date `due_date`, and text `source` expected by
  the FOS-007 RPC. Its required `subject` and `status` fields have defaults
  (`''` and `Not Started`). Its source check permits `AI`. The completion
  trigger stamps timestamps and clears completion fields for a new assignment
  in the default status.
- `family_os.students` and `family_os.assignments` have RLS enabled. The
  proposed School Agent source, review, claim, receipt and erasure-fence tables
  are **absent** from the shared project. No proposal has been applied there.
- The FOS-006 preflight and disposable fixtures now cover the assignment
  columns and required defaults. CI deliberately removes one default and
  verifies the proposal rejects that schema before creating tables.

## Findings for full household deletion

Most catalogued references to `public.households` use `ON DELETE CASCADE`.
Two use `ON DELETE SET NULL`: `public.profiles.current_household_id` and
`public.illustration_requests.household_id`. The latter would leave a row
with `user_id`, `recipe_id`, status, timing and cost metadata after a simple
household delete. An account-deletion workflow must handle those rows
explicitly. A shared caregiver's profile may properly survive, so Auth user
deletion needs a separate membership and identity decision.

`public.captures` cascades from the household, but includes `storage_path`.
Deleting its database row does not prove removal of the referenced Storage
object. The actual deletion process must enumerate and remove those objects
before deleting the pointer, and account for failed external deletion and
backup expiry. The project also has additional household-linked tables not
implemented in this repository. No complete production account-deletion path
can be claimed from the FOS-008 School Agent function alone.

## Release gate

Keep FOS-006/007/008 as review proposals. Before any migration or execution
route, pin and review the shared workspace's actual migration history, check
all household-linked tables and Storage policies, and rehearse the complete
account-deletion flow in an isolated environment with a schema matching the
shared project. The catalog-only read is compatibility evidence, not a
production write authorization or a full data audit.
