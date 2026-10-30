CREATE TABLE `im_todo_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `im_todo_lists_user_position_idx` ON `im_todo_lists` (`user_id`, `position`, `id`);
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `list_id` text REFERENCES `im_todo_lists`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `assignee_id` text REFERENCES `users`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `source_share_id` text;
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `important` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE INDEX `im_todos_user_list_created_idx` ON `im_todos` (`user_id`, `list_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `im_todos_assignee_created_idx` ON `im_todos` (`assignee_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE TABLE `im_todo_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`todo_id` text NOT NULL REFERENCES `im_todos`(`id`) ON DELETE CASCADE,
	`title` text NOT NULL,
	`done` integer NOT NULL DEFAULT 0,
	`position` integer NOT NULL,
	`version` integer NOT NULL DEFAULT 1,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `im_todo_steps_todo_position_idx` ON `im_todo_steps` (`todo_id`, `position`, `id`);
--> statement-breakpoint
CREATE TABLE `im_todo_day_entries` (
	`todo_id` text NOT NULL REFERENCES `im_todos`(`id`) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`day` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY (`todo_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `im_todo_day_entries_user_day_idx` ON `im_todo_day_entries` (`user_id`, `day`, `todo_id`);
