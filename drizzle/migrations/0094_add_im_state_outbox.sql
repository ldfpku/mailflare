CREATE TABLE im_state_outbox (
	user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	revision INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX im_state_outbox_updated_idx ON im_state_outbox(updated_at, user_id);
