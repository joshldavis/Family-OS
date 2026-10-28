# Daily agenda database safety gate

The legacy daily agenda cron uses a service-role client to read generic `public.profiles` and `public.students`, then writes `public.daily_agendas`. The shared made-again project's catalog has a different `public.profiles` shape. The saved Vercel server URL is write-only and has not been independently confirmed. A privileged job must not assume those names identify Family OS data.

This draft removes the scheduled trigger and makes the authenticated handler return 503 before constructing a database or model client. The gate is a source constant, not a runtime switch. It does not change the currently deployed app until reviewed and deployed, and it does not establish whether the old job has run or what its configured URL contains.

Restoring the feature requires a reviewed source change: confirm the actual server target without revealing credentials, select the intended Family OS schema and least-privilege access, verify its table and tenant boundaries, and rehearse the complete job with synthetic data in an isolated environment. Review costs and sensitive logging before scheduling it again. No production database access or migration is part of this draft.
