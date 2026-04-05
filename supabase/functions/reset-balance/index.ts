import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.99.3/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const ResetSchema = z.object({
  player_id: z.string().uuid(),
  password: z.string(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = ResetSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { player_id, password } = parsed.data;

    // Only allow for test account with correct password
    if (password !== "123456") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify this is the Gule test account
    const { data: player } = await supabase
      .from("players")
      .select("name")
      .eq("id", player_id)
      .single();

    if (!player || player.name.toLowerCase() !== "gule") {
      return new Response(JSON.stringify({ error: "Reset only available for test account" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("players").update({ balance: 1000000 }).eq("id", player_id);

    return new Response(JSON.stringify({ success: true, new_balance: 1000000 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
