ALTER TABLE `users` ADD `is_admin` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `user_level` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `vip_level` int DEFAULT 0;--> statement-breakpoint
CREATE INDEX `idx_users_is_admin` ON `users` (`is_admin`);--> statement-breakpoint
CREATE INDEX `idx_users_user_level` ON `users` (`user_level`);--> statement-breakpoint
CREATE INDEX `idx_users_vip_level` ON `users` (`vip_level`);