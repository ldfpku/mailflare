CREATE TABLE `im_calendar_invites` (
	`attachment_id` text NOT NULL,
	`event_index` integer DEFAULT 0 NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`uid` text,
	`method` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	`cancelled` integer DEFAULT 0 NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`time_zone` text,
	`rrule` text,
	`summary` text,
	`parsed_at` integer NOT NULL,
	PRIMARY KEY(`attachment_id`, `event_index`),
	FOREIGN KEY (`attachment_id`) REFERENCES `message_attachments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `im_calendar_invites_user_idx` ON `im_calendar_invites` (`user_id`,`starts_at`);
