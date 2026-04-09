import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.99.3/cors";

// Validate Telegram WebApp initData using HMAC-SHA256
async function validateInitData(initData: string, botToken: string): Promise<boolean> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  params.delete("hash");
  const dataCheckArr = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  const dataCheckString = dataCheckArr.join("\n");

  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const secretHash = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));
  
  const dataKey = await crypto.subtle.importKey(
    "raw",
    secretHash,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", dataKey, encoder.encode(dataCheckString));

  const hexHash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return hexHash === hash;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { initData, contact } = await req.json();

    if (!initData || typeof initData !== "string") {
      return new Response(JSON.stringify({ error: "Missing initData" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate initData
    const isValid = await validateInitData(initData, botToken);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid initData signature" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract user from initData
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) {
      return new Response(JSON.stringify({ error: "No user in initData" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tgUser = JSON.parse(userStr);
    const telegramUserId = tgUser.id;
    const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ");
    const telegramId = `tg_${telegramUserId}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if contact verification is being submitted
    let phone: string | null = null;
    let isVerified = false;

    if (contact && contact.phone_number && contact.user_id) {
      // Validate: contact.user_id must match the Telegram user from initData
      if (contact.user_id !== telegramUserId) {
        return new Response(JSON.stringify({ error: "Contact user_id mismatch - possible spoofing" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      phone = contact.phone_number;
      isVerified = true;
    }

    // Upsert player
    const upsertData: Record<string, unknown> = {
      telegram_id: telegramId,
      name: displayName || `Player_${telegramUserId}`,
      telegram_user_id: telegramUserId,
    };

    if (phone) upsertData.phone = phone;
    if (isVerified) upsertData.is_verified = true;

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .upsert(upsertData, { onConflict: "telegram_id" })
      .select("id, name, phone, balance, total_wins, is_verified, telegram_user_id")
      .single();

    if (playerErr) {
      return new Response(JSON.stringify({ error: playerErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      player: {
        id: player.id,
        name: player.name,
        phone: player.phone,
        balance: player.balance,
        totalWins: player.total_wins,
        isVerified: player.is_verified,
        telegramUserId: player.telegram_user_id,
      },
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
