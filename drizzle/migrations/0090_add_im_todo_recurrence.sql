ALTER TABLE `im_todos` ADD COLUMN `repeat_kind` text;
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `repeat_timezone` text;
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `repeat_time` text;
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `repeat_anchor_day` integer;
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `repeat_anchor_month` integer;
--> statement-breakpoint
ALTER TABLE `im_todos` ADD COLUMN `next_occurrence_id` text;
