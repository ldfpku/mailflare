CREATE TABLE mail_attachment_uploads (
  id text PRIMARY KEY NOT NULL,
  draft_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  upload_id text NOT NULL,
  filename text NOT NULL,
  content_type text NOT NULL,
  size integer NOT NULL,
  part_size integer NOT NULL,
  fingerprint text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  lease_id text,
  updated_at integer NOT NULL
);
CREATE INDEX mail_attachment_uploads_draft_idx ON mail_attachment_uploads(draft_id, user_id);
CREATE TABLE mail_attachment_upload_parts (
  upload_id text NOT NULL REFERENCES mail_attachment_uploads(id) ON DELETE CASCADE,
  part_number integer NOT NULL,
  etag text NOT NULL,
  PRIMARY KEY (upload_id, part_number)
);
UPDATE app_settings SET outbound_attachment_max_mb = 500 WHERE outbound_attachment_max_mb = 25;
