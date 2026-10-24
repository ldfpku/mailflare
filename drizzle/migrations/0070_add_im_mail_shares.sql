CREATE TABLE `im_mail_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`room_id` text NOT NULL,
	`shared_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `im_mail_shares_room_idx` ON `im_mail_shares` (`room_id`);
