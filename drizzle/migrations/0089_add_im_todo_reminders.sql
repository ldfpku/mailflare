ALTER TABLE `im_todos` ADD COLUMN `remind_at` integer;
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `reminder_revision` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE INDEX `im_todos_due_reminder_idx` ON `im_todos` (`remind_at`, `id`) WHERE `done` = 0 AND `remind_at` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `im_todo_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`todo_id` text NOT NULL REFERENCES `im_todos`(`id`) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`revision` integer NOT NULL,
	`scheduled_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`seen_at` integer,
	`notified_at` integer,
	`attempts` integer NOT NULL DEFAULT 0,
	`next_attempt_at` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `im_todo_reminders_todo_user_revision_idx` ON `im_todo_reminders` (`todo_id`, `user_id`, `revision`);
--> statement-breakpoint
CREATE INDEX `im_todo_reminders_user_seen_idx` ON `im_todo_reminders` (`user_id`, `seen_at`, `created_at`);
--> statement-breakpoint
CREATE INDEX `im_todo_reminders_delivery_idx` ON `im_todo_reminders` (`notified_at`, `next_attempt_at`, `created_at`);
