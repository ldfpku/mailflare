-- Full-text search over chat messages. Chat text is mostly Chinese, which the
-- unicode61 tokenizer of messages_fts keeps as one token per run of characters,
-- so this index uses the trigram tokenizer: any substring of three or more
-- characters is found by MATCH, and shorter ones by a scan of this table alone.
-- The text lives in the JSON body, so the index keeps its own copy of what is
-- searchable (text, file names, mail card subjects) rather than reading
-- im_messages; recalled messages are left out. Triggers keep it in step, and
-- insertMessage replaces the copy of a text message that carries inline HTML
-- with its plain text, since SQLite cannot strip tags.
CREATE VIRTUAL TABLE `im_messages_fts` USING fts5(
	`text`,
	tokenize='trigram case_sensitive 0'
);--> statement-breakpoint
CREATE TRIGGER `im_messages_fts_ai` AFTER INSERT ON `im_messages` WHEN new.`recalled_by` IS NULL AND json_valid(new.`body`) BEGIN
	INSERT INTO `im_messages_fts`(`rowid`, `text`)
	SELECT new.`id`, t FROM (SELECT CASE new.`type`
		WHEN 1 THEN json_extract(new.`body`, '$.content')
		WHEN 4 THEN json_extract(new.`body`, '$.fileName')
		WHEN 6 THEN json_extract(new.`body`, '$.filename')
		WHEN 19 THEN trim(coalesce(json_extract(new.`body`, '$.subject'), '') || ' ' || coalesce(json_extract(new.`body`, '$.fromName'), '') || ' ' || coalesce(json_extract(new.`body`, '$.from'), '') || ' ' || coalesce(json_extract(new.`body`, '$.snippet'), ''))
	END AS t) WHERE typeof(t) = 'text' AND t <> '';
END;--> statement-breakpoint
CREATE TRIGGER `im_messages_fts_ad` AFTER DELETE ON `im_messages` BEGIN
	DELETE FROM `im_messages_fts` WHERE `rowid` = old.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `im_messages_fts_au` AFTER UPDATE OF `body`, `type`, `recalled_by` ON `im_messages` BEGIN
	DELETE FROM `im_messages_fts` WHERE `rowid` = old.`id`;
	INSERT INTO `im_messages_fts`(`rowid`, `text`)
	SELECT new.`id`, t FROM (SELECT CASE new.`type`
		WHEN 1 THEN json_extract(new.`body`, '$.content')
		WHEN 4 THEN json_extract(new.`body`, '$.fileName')
		WHEN 6 THEN json_extract(new.`body`, '$.filename')
		WHEN 19 THEN trim(coalesce(json_extract(new.`body`, '$.subject'), '') || ' ' || coalesce(json_extract(new.`body`, '$.fromName'), '') || ' ' || coalesce(json_extract(new.`body`, '$.from'), '') || ' ' || coalesce(json_extract(new.`body`, '$.snippet'), ''))
	END AS t) WHERE new.`recalled_by` IS NULL AND json_valid(new.`body`) AND typeof(t) = 'text' AND t <> '';
END;--> statement-breakpoint
INSERT INTO `im_messages_fts`(`rowid`, `text`)
SELECT `id`, t FROM (SELECT `id`, CASE `type`
	WHEN 1 THEN json_extract(`body`, '$.content')
	WHEN 4 THEN json_extract(`body`, '$.fileName')
	WHEN 6 THEN json_extract(`body`, '$.filename')
	WHEN 19 THEN trim(coalesce(json_extract(`body`, '$.subject'), '') || ' ' || coalesce(json_extract(`body`, '$.fromName'), '') || ' ' || coalesce(json_extract(`body`, '$.from'), '') || ' ' || coalesce(json_extract(`body`, '$.snippet'), ''))
END AS t FROM `im_messages` WHERE `recalled_by` IS NULL AND json_valid(`body`)) WHERE typeof(t) = 'text' AND t <> '';
