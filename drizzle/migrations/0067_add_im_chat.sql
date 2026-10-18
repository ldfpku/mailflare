CREATE TABLE `im_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`type` integer NOT NULL,
	`hot_flag` integer DEFAULT 0 NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`avatar` text DEFAULT '' NOT NULL,
	`owner_id` text,
	`single_key` text,
	`last_msg_id` integer,
	`active_time` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `im_rooms_single_key_unique` ON `im_rooms` (`single_key`);
--> statement-breakpoint
CREATE TABLE `im_room_members` (
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` integer DEFAULT 3 NOT NULL,
	`my_name` text DEFAULT '' NOT NULL,
	`remark` text DEFAULT '' NOT NULL,
	`top` integer DEFAULT false NOT NULL,
	`hide` integer DEFAULT false NOT NULL,
	`mute_notification` integer DEFAULT 0 NOT NULL,
	`shield` integer DEFAULT false NOT NULL,
	`last_read_msg_id` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `user_id`),
	FOREIGN KEY (`room_id`) REFERENCES `im_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `im_room_members_user_idx` ON `im_room_members` (`user_id`);
--> statement-breakpoint
CREATE TABLE `im_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`from_uid` text NOT NULL,
	`client_msg_id` text,
	`type` integer NOT NULL,
	`body` text NOT NULL,
	`reply_msg_id` integer,
	`recalled_by` text,
	`recalled_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `im_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `im_messages_room_idx` ON `im_messages` (`room_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `im_messages_client_msg_unique` ON `im_messages` (`from_uid`,`client_msg_id`);
--> statement-breakpoint
CREATE TABLE `im_presence` (
	`user_id` text PRIMARY KEY NOT NULL,
	`online` integer DEFAULT false NOT NULL,
	`last_opt_time` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `im_rooms` (`id`, `type`, `hot_flag`, `name`, `active_time`, `created_at`) VALUES ('1', 1, 1, '全员群', unixepoch() * 1000, unixepoch() * 1000);
