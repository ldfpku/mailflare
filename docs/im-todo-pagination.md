# IM to-do workspace

The desktop and Web workspaces use the authenticated IM API. Apply migrations
0087–0093 before deploying the matching application and Worker changes.

## Paging and access

`GET /api/im/im/todo/page` returns `{ items, hasMore, nextCursor }`. Pass the
returned cursor unchanged to request the next page. `pageSize` defaults to 50
and is limited to 200; `status` is `open`, `done`, or `all`. `view` supports
`tasks` (the default list), `owned`, `all` (owned or assigned), `important`,
`planned`, `day`, `assigned`, and `list`. The `day` and `list` views require
their matching `day` or `listId` parameter. Optional `q` searches titles and
notes; `sort` accepts `created`, `due`, or `title`.

Cursors bind the filter and sort and include stable tie breakers. Paging is not
a snapshot: refresh after tasks change, move, or change permissions. A task is
visible only to its owner or current assignee. Source-mail metadata is returned
only while the caller can still read the mailbox or original share.

The default quota is 10,000 owned tasks, including completed tasks. An operator
can set `IM_TODO_LIMIT` to an integer from 1 to 1,000,000; invalid configuration
is an error. On the Node runtime it is an environment variable. On Workers,
configure it as a Worker secret so it is preserved by the project's deploy
configuration. Inserts and repeated-task creation check the quota atomically.

Tasks and steps carry versions. Send `expectedVersion` on update and deletion;
a stale write returns IM code 409 and must be refreshed before retrying.
Personal lists are private; deleting one moves its tasks to the default list.
Each person's My Day membership is separate, keyed to the selected local day.
Assignments to another person require `confirmShare: true`; only the owner may
change details, assign, or delete, while the assignee may complete tasks and
steps. Assignment does not grant access to the source mail or Drive files.

## Reminders, repetition, and attachments

Reminders are persisted in D1 before a live socket notification is attempted.
The one-minute Worker cron creates due reminders idempotently; failures are
logged and retried with backoff, and unseen reminders remain available after
the user reconnects. Browser or system notifications require the platform's
permission and a running, connected client. A cron trigger is not a guarantee
of real-time delivery during outages or scheduling delays. The self-hosted
Node scheduler also persists reminders; without an IM socket hub, delivery is
logged as unavailable and reminders remain available for later review.

Daily, weekly, monthly and yearly repeats retain the original wall-clock time
and IANA time zone. DST gaps move to the next valid time, ambiguous times use
the earlier occurrence, and monthly/yearly dates clamp to the last day of the
month while retaining the original day for future occurrences. Completing a
repeating task atomically creates at most one next occurrence and resets its
steps. Date-only deadlines retain their calendar date and time zone; reminders
on the next occurrence retain the original absolute offset from the deadline.

Attachments are references to existing Drive files, limited to 20 files per
task and 500 MB per file. Removing a reference never deletes the Drive file.
Each viewer's Drive access is rechecked when listing, and the Drive download
endpoint rechecks it again when opening the file. Revoked or deleted files are
reported as unavailable without disclosing their names.

AI-generated task suggestions remain proposals until the user explicitly
reviews and confirms them; these APIs do not bypass that approval flow.
