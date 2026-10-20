CREATE TABLE `im_call_busy` (
	`user_id` text NOT NULL,
	`ref` text NOT NULL,
	`busy_until` integer NOT NULL,
	PRIMARY KEY(`user_id`, `ref`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
