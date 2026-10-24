CREATE TABLE `im_meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`rtk_meeting_id` text NOT NULL,
	`title` text NOT NULL,
	`host_id` text NOT NULL,
	`room_id` text,
	`invitee_ids` text DEFAULT '[]' NOT NULL,
	`starts_at` integer,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE INDEX `im_meetings_host_idx` ON `im_meetings` (`host_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `im_meeting_participants` (
	`meeting_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rtk_participant_id` text NOT NULL,
	`auth_token` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`meeting_id`, `user_id`),
	FOREIGN KEY (`meeting_id`) REFERENCES `im_meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
