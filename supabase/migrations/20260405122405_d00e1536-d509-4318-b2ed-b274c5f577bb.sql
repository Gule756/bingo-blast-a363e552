
-- Allow edge functions (service role) to update player balances and transaction statuses
CREATE POLICY "Service can update players" ON public.players FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Service can update transactions" ON public.transactions FOR UPDATE TO public USING (true) WITH CHECK (true);
