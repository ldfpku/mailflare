CREATE TABLE `im_todos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`due_at` integer,
	`done` integer DEFAULT false NOT NULL,
	`done_at` integer,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_id` text,
	`source_title` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `im_todos_user_idx` ON `im_todos` (`user_id`,`done`,`due_at`);
