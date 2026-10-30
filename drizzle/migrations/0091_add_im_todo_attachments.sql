CREATE TABLE `im_todo_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`todo_id` text NOT NULL REFERENCES `im_todos`(`id`) ON DELETE CASCADE,
	`drive_item_id` text REFERENCES `drive_items`(`id`) ON DELETE SET NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `im_todo_attachments_todo_item_idx` ON `im_todo_attachments` (`todo_id`, `drive_item_id`);
--> statement-breakpoint
CREATE INDEX `im_todo_attachments_todo_idx` ON `im_todo_attachments` (`todo_id`, `created_at`, `id`);
