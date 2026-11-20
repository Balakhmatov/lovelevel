CREATE TABLE matchlove_notification_reads(user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL,item TEXT NOT NULL,PRIMARY KEY(user,kind,item));
CREATE INDEX matchlove_messages_recipient_sender ON messages(recipient,sender);
