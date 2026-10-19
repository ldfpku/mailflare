CREATE TABLE `im_files` (
	`id` text PRIMARY KEY NOT NULL,
	`uploader_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer,
	`upload_token_hash` text,
	`upload_expires_at` integer,
	`uploaded_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `im_files_uploader_idx` ON `im_files` (`uploader_id`,`created_at`);
