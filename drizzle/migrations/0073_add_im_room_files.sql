CREATE TABLE `im_room_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`file_id` text NOT NULL,
	`msg_id` integer,
	`uploader_id` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`msg_type` integer NOT NULL,
	`created_at` integer NOT NULL,
	`removed_at` integer,
	FOREIGN KEY (`room_id`) REFERENCES `im_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `im_room_files_room_idx` ON `im_room_files` (`room_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `im_room_files_msg_file_unique` ON `im_room_files` (`msg_id`,`file_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `im_room_files` (`room_id`, `file_id`, `msg_id`, `uploader_id`, `file_name`, `content_type`, `size`, `msg_type`, `created_at`)
SELECT m.`room_id`, f.`id`, m.`id`, m.`from_uid`,
	CASE
		WHEN m.`type` = 4 AND coalesce(json_extract(m.`body`, '$.fileName'), '') <> '' THEN json_extract(m.`body`, '$.fileName')
		WHEN m.`type` = 6 AND coalesce(json_extract(m.`body`, '$.filename'), '') <> '' THEN json_extract(m.`body`, '$.filename')
		ELSE f.`file_name`
	END,
	f.`content_type`, coalesce(f.`size`, 0), m.`type`, m.`created_at`
FROM `im_messages` m
JOIN `im_rooms` r ON r.`id` = m.`room_id` AND r.`type` = 1
JOIN `im_files` f ON f.`uploaded_at` IS NOT NULL
	AND instr(json_extract(m.`body`, '$.url'), '/api/im/files/') > 0
	AND f.`id` = substr(json_extract(m.`body`, '$.url'), instr(json_extract(m.`body`, '$.url'), '/api/im/files/') + 14, 32)
WHERE m.`type` IN (3, 4, 6) AND m.`recalled_by` IS NULL AND json_valid(m.`body`);
