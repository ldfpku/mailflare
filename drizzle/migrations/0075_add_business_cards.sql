CREATE TABLE `business_cards` (
	`user_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`mobile` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`placement` text DEFAULT 'hq' NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_cards_token_unique` ON `business_cards` (`token`);
