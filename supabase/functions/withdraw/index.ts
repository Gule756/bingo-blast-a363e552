import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.99.3/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const WithdrawSchema = z.object({
  player_id: z.string().uuid(),
  amount: z.number().positive().max(1000000),
  wallet_address: z.string().min(10).max(128),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = WithdrawSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { player_id, amount, wallet_address } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check balance
    const { data: player } = await supabase
      .from("players")
      .select("balance")
      .eq("id", player_id)
      .single();

    if (!player || player.balance < amount) {
      return new Response(JSON.stringify({ error: "Insufficient funds" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lock funds: subtract immediately
    const newBalance = player.balance - amount;
    await supabase.from("players").update({ balance: newBalance }).eq("id", player_id);

    // Create pending withdrawal transaction
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        player_id,
        amount,
        type: "withdrawal",
        status: "pending",
        wallet_address,
        chain: "ethereum",
      })
      .select()
      .single();

    if (txErr) {
      // Rollback balance
      await supabase.from("players").update({ balance: player.balance }).eq("id", player_id);
      return new Response(JSON.stringify({ error: txErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      status: "pending",
      new_balance: newBalance,
      transaction_id: tx.id,
      message: "Withdrawal submitted. Funds are locked pending admin approval.",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
