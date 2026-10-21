CREATE TABLE `im_room_announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`uid` text NOT NULL,
	`content` text NOT NULL,
	`top` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `im_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `im_room_announcements_room_idx` ON `im_room_announcements` (`room_id`,`top`,`id`);
