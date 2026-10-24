CREATE TABLE `im_room_mailboxes` (
	`room_id` text PRIMARY KEY NOT NULL,
	`mailbox_id` text NOT NULL,
	`enabled_by` text NOT NULL,
	`origin` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `im_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `im_room_mailboxes_mailbox_unique` ON `im_room_mailboxes` (`mailbox_id`);
