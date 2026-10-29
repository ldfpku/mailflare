ALTER TABLE users ADD COLUMN im_state_id TEXT NOT NULL DEFAULT '1';
--> statement-breakpoint
ALTER TABLE im_presence ADD COLUMN visible_online INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE im_presence SET visible_online = online;
