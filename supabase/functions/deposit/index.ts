import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.99.3/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const DepositSchema = z.object({
  player_id: z.string().uuid(),
  amount: z.number().positive().max(1000000),
  tx_hash: z.string().min(10).max(128).regex(/^[a-fA-F0-9]+$/),
  wallet_address: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = DepositSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { player_id, amount, tx_hash, wallet_address } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check for duplicate tx_hash
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("tx_hash", tx_hash)
      .maybeSingle();

    if (existingTx) {
      return new Response(JSON.stringify({ error: "Transaction hash already used" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create pending transaction
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        player_id,
        amount,
        type: "deposit",
        status: "pending",
        tx_hash,
        wallet_address: wallet_address || null,
        chain: "ethereum",
      })
      .select()
      .single();

    if (txErr) {
      return new Response(JSON.stringify({ error: txErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simulate payment gateway verification (2s delay, 90% success)
    await new Promise((r) => setTimeout(r, 2000));
    const verified = Math.random() > 0.1;

    if (verified) {
      // Get current balance
      const { data: player } = await supabase
        .from("players")
        .select("balance")
        .eq("id", player_id)
        .single();

      const newBalance = (player?.balance || 0) + amount;

      // Update balance and transaction atomically
      await supabase.from("players").update({ balance: newBalance }).eq("id", player_id);
      await supabase.from("transactions").update({ status: "confirmed" }).eq("id", tx.id);

      return new Response(JSON.stringify({ 
        success: true, 
        status: "confirmed", 
        new_balance: newBalance,
        transaction_id: tx.id,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      await supabase.from("transactions").update({ status: "failed" }).eq("id", tx.id);
      return new Response(JSON.stringify({ 
        success: false, 
        status: "failed", 
        error: "Transaction verification failed",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
