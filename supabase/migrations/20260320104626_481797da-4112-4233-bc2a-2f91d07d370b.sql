
-- Create table for storing verified player contacts
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (registration)
CREATE POLICY "Anyone can register" ON public.players FOR INSERT WITH CHECK (true);

-- Players can read their own record
CREATE POLICY "Players can read own record" ON public.players FOR SELECT USING (true);
