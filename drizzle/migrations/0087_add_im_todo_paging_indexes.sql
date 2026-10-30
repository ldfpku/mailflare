CREATE INDEX `im_todos_user_created_idx` ON `im_todos` (`user_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `im_todos_user_done_created_idx` ON `im_todos` (`user_id`, `done`, `created_at`, `id`);
