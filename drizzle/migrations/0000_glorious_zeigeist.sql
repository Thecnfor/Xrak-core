CREATE TABLE `auth_login_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(254) NOT NULL,
	`user_id` int DEFAULT 0,
	`success` boolean DEFAULT false,
	`reason` varchar(128) DEFAULT '',
	`ip` varchar(45) DEFAULT '',
	`ua_hash` varchar(128) DEFAULT '',
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `auth_login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_session_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(128) NOT NULL,
	`user_id` int NOT NULL,
	`ip` varchar(45) DEFAULT '',
	`ua_hash` varchar(128) DEFAULT '',
	`user_agent` varchar(512) DEFAULT '',
	`country` varchar(2) DEFAULT '',
	`city` varchar(64) DEFAULT '',
	`issued_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`revoked_at` timestamp DEFAULT NULL,
	CONSTRAINT `auth_session_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_session_audit_archive` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(128) NOT NULL,
	`user_id` int NOT NULL,
	`ip` varchar(45) DEFAULT '',
	`ua_hash` varchar(128) DEFAULT '',
	`user_agent` varchar(512) DEFAULT '',
	`country` varchar(2) DEFAULT '',
	`city` varchar(64) DEFAULT '',
	`issued_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`revoked_at` timestamp DEFAULT NULL,
	CONSTRAINT `auth_session_audit_archive_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_user_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`ua_hash` varchar(128) NOT NULL,
	`label` varchar(64) DEFAULT '',
	`first_seen_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`last_seen_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`revoked_at` timestamp DEFAULT NULL,
	CONSTRAINT `auth_user_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_ua` UNIQUE(`user_id`,`ua_hash`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`email` varchar(254) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`consumed_at` timestamp DEFAULT NULL,
	`consumed` boolean DEFAULT false,
	`revoked_at` timestamp DEFAULT NULL,
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_reset_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`namespace` varchar(64) NOT NULL DEFAULT 'default',
	`key` varchar(64) NOT NULL,
	`value_json` varchar(2048) NOT NULL DEFAULT '{}',
	`updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_pref` UNIQUE(`user_id`,`namespace`,`key`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(254) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`password_salt` varchar(128) DEFAULT '',
	`display_name` varchar(64) DEFAULT '',
	`email_verified_at` timestamp DEFAULT NULL,
	`last_login_at` timestamp DEFAULT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_users_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int DEFAULT 0,
	`email` varchar(254) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`consumed_at` timestamp DEFAULT NULL,
	`consumed` boolean DEFAULT false,
	`revoked_at` timestamp DEFAULT NULL,
	CONSTRAINT `verification_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_verify_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `user_preferences` ADD CONSTRAINT `user_preferences_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `idx_login_email` ON `auth_login_attempts` (`email`);--> statement-breakpoint
CREATE INDEX `idx_login_user` ON `auth_login_attempts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_login_created_at` ON `auth_login_attempts` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_login_ip` ON `auth_login_attempts` (`ip`);--> statement-breakpoint
CREATE INDEX `idx_login_email_time` ON `auth_login_attempts` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_login_ip_time` ON `auth_login_attempts` (`ip`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_auth_session_id` ON `auth_session_audit` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_session_user` ON `auth_session_audit` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_session_ip` ON `auth_session_audit` (`ip`);--> statement-breakpoint
CREATE INDEX `idx_auth_session_issued_at` ON `auth_session_audit` (`issued_at`);--> statement-breakpoint
CREATE INDEX `idx_auth_session_revoked_at` ON `auth_session_audit` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `idx_auth_session_user_issued` ON `auth_session_audit` (`user_id`,`issued_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_archive_user_issued` ON `auth_session_audit_archive` (`user_id`,`issued_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_archive_ip` ON `auth_session_audit_archive` (`ip`);--> statement-breakpoint
CREATE INDEX `idx_devices_user` ON `auth_user_devices` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_devices_ua` ON `auth_user_devices` (`ua_hash`);--> statement-breakpoint
CREATE INDEX `idx_devices_last_seen_at` ON `auth_user_devices` (`last_seen_at`);--> statement-breakpoint
CREATE INDEX `idx_devices_revoked_at` ON `auth_user_devices` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `idx_reset_user` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_reset_email` ON `password_reset_tokens` (`email`);--> statement-breakpoint
CREATE INDEX `idx_reset_expires_at` ON `password_reset_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_prefs_user` ON `user_preferences` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_prefs_namespace` ON `user_preferences` (`namespace`);--> statement-breakpoint
CREATE INDEX `idx_prefs_updated_at` ON `user_preferences` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_last_login` ON `users` (`last_login_at`);--> statement-breakpoint
CREATE INDEX `idx_verify_email` ON `verification_tokens` (`email`);--> statement-breakpoint
CREATE INDEX `idx_verify_user` ON `verification_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_verify_expires_at` ON `verification_tokens` (`expires_at`);