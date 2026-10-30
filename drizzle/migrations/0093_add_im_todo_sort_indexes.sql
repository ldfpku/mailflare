CREATE INDEX `im_todos_user_due_order_idx` ON `im_todos` (`user_id`, (`due_at` IS NULL), `due_at`, `created_at` DESC, `id` DESC);
--> statement-breakpoint
CREATE INDEX `im_todos_assignee_due_order_idx` ON `im_todos` (`assignee_id`, (`due_at` IS NULL), `due_at`, `created_at` DESC, `id` DESC);
--> statement-breakpoint
CREATE INDEX `im_todos_user_title_order_idx` ON `im_todos` (`user_id`, `title` COLLATE NOCASE, `created_at` DESC, `id` DESC);
--> statement-breakpoint
CREATE INDEX `im_todos_assignee_title_order_idx` ON `im_todos` (`assignee_id`, `title` COLLATE NOCASE, `created_at` DESC, `id` DESC);
