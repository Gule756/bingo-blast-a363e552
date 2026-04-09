
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS telegram_user_id bigint UNIQUE,
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
