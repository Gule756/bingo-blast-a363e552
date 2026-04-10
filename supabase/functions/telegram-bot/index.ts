import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.99.3/cors";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
    };
    text?: string;
    contact?: {
      phone_number: string;
      first_name: string;
      last_name?: string;
      user_id: number;
    };
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data: string;
  };
}

interface CommandContext {
  update: TelegramUpdate;
  user: TelegramUpdate['message']['from'];
  chat: TelegramUpdate['message']['chat'];
  text: string;
  args: string[];
  isPrivate: boolean;
}

type CommandHandler = (ctx: CommandContext, supabase: any) => Promise<any>;

const COMMANDS: Record<string, CommandHandler> = {
  '/start': handleStart,
  '/register': handleRegister,
  '/play': handlePlay,
  '/balance': handleBalance,
  '/deposit': handleDeposit,
  '/withdraw': handleWithdraw,
  '/transfer': handleTransfer,
  '/invite': handleInvite,
  '/instructions': handleInstructions,
  '/cancel': handleCancel,
  '/help': handleHelp,
};

// Command Handlers
async function handleStart(ctx: CommandContext, supabase: any) {
  const { user, chat, args } = ctx;
  
  // Check if user is already registered
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_user_id', user.id)
    .single();

  if (player) {
    if (player.is_verified) {
      return {
        text: `Welcome back, ${player.name}! ${player.first_name}! ${player.last_name}!\n\n` +
              `Your balance: ${player.balance} ETB\n` +
              `Total wins: ${player.total_wins}\n\n` +
              `Use /play to start a game or /balance for more options.`,
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Play Now', web_app: { url: `${getMiniAppUrl()}?action=play&userId=${player.id}` } }],
            [{ text: 'View Balance', web_app: { url: `${getMiniAppUrl()}?action=balance&userId=${player.id}` } }],
            [{ text: 'Deposit', web_app: { url: `${getMiniAppUrl()}?action=deposit&userId=${player.id}` } }]
          ]
        }
      };
    } else {
      return {
        text: `Welcome back, ${player.name}!\n\n` +
              `Please complete your verification by sharing your contact.`,
        reply_markup: {
          keyboard: [[{ text: 'Share Contact', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      };
    }
  }

  return {
    text: `Welcome to Habesha Bingo, ${user.first_name}! ${user.last_name}!\n\n` +
          `I'm your bingo assistant. To get started:\n\n` +
          `1. Register with /register\n` +
          `2. Deposit funds with /deposit\n` +
          `3. Start playing with /play\n\n` +
          `Use /help for all commands.`,
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Register Now', callback_data: 'register' }],
        [{ text: 'How to Play', callback_data: 'instructions' }]
      ]
    }
  };
}

async function handleRegister(ctx: CommandContext, supabase: any) {
  const { user, chat, args } = ctx;
  
  // Check for referral code in args
  let referralCode = null;
  if (args.length > 0 && args[0].startsWith('ref_')) {
    referralCode = args[0].replace('ref_', '');
  }
  
  const { data: existingPlayer } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_user_id', user.id)
    .single();

  if (existingPlayer) {
    if (existingPlayer.is_verified) {
      return {
        text: `✅ **Already Registered!**\n\n` +
              `Welcome back, ${existingPlayer.name}!\n` +
              `💰 Balance: ${existingPlayer.balance} ETB\n` +
              `🏆 Total Wins: ${existingPlayer.total_wins}\n\n` +
              `Use /play to start a game or /balance for more options.`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Play Bingo', web_app: { url: `${getMiniAppUrl()}?action=play&userId=${existingPlayer.id}` } }],
            [{ text: '💰 Check Balance', callback_data: 'balance' }]
          ]
        }
      };
    } else {
      return {
        text: `⏳ **Verification Required**\n\n` +
              `Hi ${existingPlayer.name}! Please share your contact to complete verification.`,
        reply_markup: {
          keyboard: [[{ text: '📱 Share Contact', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      };
    }
  }

  // Check if phone number already exists (prevent bonus farming)
  const tgUser = getTelegramUser();
  const phone = tgUser?.phone_number;

  if (phone) {
    const { data: phoneExists } = await supabase
      .from('players')
      .select('id, phone, is_verified')
      .eq('phone', phone)
      .neq('telegram_user_id', user.id)
      .single();

    if (phoneExists && phoneExists.is_verified) {
      return {
        text: `⚠️ **Phone Already Registered**\n\n` +
              `This phone number is already registered with another account. ` +
              `Each phone number can only be used once for the welcome bonus.\n\n` +
              `Please use a different phone number or contact support.`,
        reply_markup: {
          inline_keyboard: [[{ text: '📞 Contact Support', callback_data: 'support' }]]
        }
      };
    }
  }

  const telegramId = `tg_${user.id}`;
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || `Player_${user.id}`;

  const { data: player, error } = await supabase
    .from('players')
    .upsert({
      telegram_id: telegramId,
      name: displayName,
      telegram_user_id: user.id,
      is_verified: false,
      balance: 0,
      total_wins: 0,
      referred_by: referralCode
    }, { onConflict: 'telegram_id' })
    .select()
    .single();

  if (error) {
    return {
      text: '❌ Registration failed. Please try again later.'
    };
  }

  const welcomeText = referralCode 
    ? `🎉 **Welcome to Habesha Bingo, ${displayName}!**\n\n` +
      `You were referred by a friend! 🤝\n\n` +
      `📋 **Next Steps:**\n` +
      `1. Share your contact to verify\n` +
      `2. Get 10 ETB welcome bonus\n` +
      `3. Your friend gets 10 ETB bonus too!\n\n` +
      `Let's get started! 🚀`
    : `🎉 **Welcome to Habesha Bingo, ${displayName}!**\n\n` +
      `📋 **Next Steps:**\n` +
      `1. Share your contact to verify\n` +
      `2. Get 10 ETB welcome bonus\n` +
      `3. Start playing and winning!\n\n` +
      `Let's get started! 🚀`;

  return {
    text: welcomeText,
    reply_markup: {
      keyboard: [[{ text: '📱 Share Contact', request_contact: true }]],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  };
}

async function handlePlay(ctx: CommandContext, supabase: any) {
  const { user } = ctx;
  
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_user_id', user.id)
    .single();

  if (!player) {
    return {
      text: 'Please register first with /register',
      reply_markup: {
        inline_keyboard: [[{ text: 'Register', callback_data: 'register' }]]
      }
    };
  }

  if (!player.is_verified) {
    return {
      text: 'Please complete verification by sharing your contact.',
      reply_markup: {
        keyboard: [[{ text: 'Share Contact', request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    };
  }

  return {
    text: `Opening game lobby...\n\n` +
          `Your balance: ${player.balance} ETB`,
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Play Now', web_app: { url: `${getMiniAppUrl()}?action=play&userId=${player.id}` } }]
      ]
    }
  };
}

async function handleBalance(ctx: CommandContext, supabase: any) {
  const { user } = ctx;
  
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_user_id', user.id)
    .single();

  if (!player) {
    return {
      text: 'Please register first with /register',
      reply_markup: {
        inline_keyboard: [[{ text: 'Register Now', callback_data: 'register' }]]
      }
    };
  }

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('player_id', player.id)
    .order('created_at', { ascending: false })
    .limit(5);

  let transactionText = '';
  if (transactions && transactions.length > 0) {
    transactionText = '\n\nRecent transactions:\n' + 
      transactions.map(t => `${t.type === 'deposit' ? '+' : '-'}${t.amount} ETB - ${t.type}`).join('\n');
  }

  return {
    text: `💰 **Your Current Balance:** ${player.balance} ETB\n\n` +
          `📊 **Statistics:**\n` +
          `• Total Wins: ${player.total_wins}\n` +
          `• Games Played: ${player.games_played || 0}\n` +
          `• Referral Bonus: ${player.referral_bonus_earned || 0} ETB${transactionText}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💳 Deposit', web_app: { url: `${getMiniAppUrl()}?action=deposit&userId=${player.id}` } },
          { text: '💸 Withdraw', web_app: { url: `${getMiniAppUrl()}?action=withdraw&userId=${player.id}` } }
        ],
        [
          { text: '💸 Transfer', web_app: { url: `${getMiniAppUrl()}?action=transfer&userId=${player.id}` } },
          { text: '🎮 Play Bingo', web_app: { url: `${getMiniAppUrl()}?action=play&userId=${player.id}` } }
        ]
      ]
    }
  };
}

async function handleDeposit(ctx: CommandContext, supabase: any) {
  const { user } = ctx;
  
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_user_id', user.id)
    .single();

  if (!player) {
    return {
      text: 'Please register first with /register'
    };
  }

  return {
    text: `Deposit Funds\n\n` +
          `Current Balance: ${player.balance} ETB\n\n` +
          `Choose deposit amount:`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '50 ETB', callback_data: `deposit_50` },
          { text: '100 ETB', callback_data: `deposit_100` }
        ],
        [
          { text: '200 ETB', callback_data: `deposit_200` },
          { text: '500 ETB', callback_data: `deposit_500` }
        ],
        [{ text: 'Custom Amount', web_app: { url: `${getMiniAppUrl()}?action=deposit&userId=${player.id}` } }]
      ]
    }
  };
}

async function handleWithdraw(ctx: CommandContext, supabase: any) {
  const { user } = ctx;
  
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_user_id', user.id)
    .single();

  if (!player) {
    return {
      text: 'Please register first with /register'
    };
  }

  if (player.balance < 50) {
    return {
      text: `Insufficient balance for withdrawal.\n\n` +
            `Current balance: ${player.balance} ETB\n` +
            `Minimum withdrawal: 50 ETB`
    };
  }

  return {
    text: `Withdraw Funds\n\n` +
          `Current Balance: ${player.balance} ETB\n\n` +
          `Available withdrawal amounts:`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '50 ETB', callback_data: `withdraw_50` },
          { text: '100 ETB', callback_data: `withdraw_100` }
        ],
        [
          { text: '200 ETB', callback_data: `withdraw_200` },
          { text: 'All', callback_data: `withdraw_all` }
        ],
        [{ text: 'Custom Amount', web_app: { url: `${getMiniAppUrl()}?action=withdraw&userId=${player.id}` } }]
      ]
    }
  };
}

async function handleTransfer(ctx: CommandContext, supabase: any) {
  const { user, args } = ctx;
  
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_user_id', user.id)
    .single();

  if (!player) {
    return {
      text: 'Please register first with /register'
    };
  }

  if (args.length < 2) {
    return {
      text: `Transfer Funds\n\n` +
            `Usage: /transfer <amount> <username_or_phone>\n` +
            `Example: /transfer 100 @username\n` +
            `Example: /transfer 100 +251912345678\n\n` +
            `Or use the web app for easier transfers.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Transfer via Web App', web_app: { url: `${getMiniAppUrl()}?action=transfer&userId=${player.id}` } }]
        ]
      }
    };
  }

  return {
    text: `Transfer feature available in web app.\n\n` +
          `Click below to transfer funds:`,
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Transfer Funds', web_app: { url: `${getMiniAppUrl()}?action=transfer&userId=${player.id}` } }]
      ]
    }
  };
}

async function handleInvite(ctx: CommandContext, supabase: any) {
  const { user } = ctx;
  
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_user_id', user.id)
    .single();

  if (!player) {
    return {
      text: 'Please register first with /register',
      reply_markup: {
        inline_keyboard: [[{ text: 'Register Now', callback_data: 'register' }]]
      }
    };
  }

  const botUsername = Deno.env.get('TELEGRAM_BOT_USERNAME') || 'habesha_bingo_bot';
  const inviteLink = `https://t.me/${botUsername}?start=ref_${player.telegram_user_id}`;

  // Get referral statistics
  const { data: referrals } = await supabase
    .from('players')
    .select('id, name, created_at')
    .eq('referred_by', player.telegram_user_id)
    .order('created_at', { ascending: false });

  const activeReferrals = referrals?.length || 0;
  const totalBonusEarned = player.referral_bonus_earned || 0;

  return {
    text: `🎉 **Invite Friends & Earn 10 ETB Each!**\n\n` +
          `Your referral link:\n` +
          `${inviteLink}\n\n` +
          `📊 **Your Referral Stats:**\n` +
          `• Friends Invited: ${activeReferrals}\n` +
          `• Bonus Earned: ${totalBonusEarned} ETB\n` +
          `• Bonus Per Friend: 10 ETB\n\n` +
          `💡 *Share your link and get paid when friends deposit!*`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📤 Share Link', url: inviteLink },
          { text: '📊 View Stats', web_app: { url: `${getMiniAppUrl()}?action=profile&userId=${player.id}` } }
        ]
      ]
    }
  };
}

async function handleInstructions(ctx: CommandContext, supabase: any) {
  return {
    text: `How to Play Habesha Bingo\n\n` +
          `1. Register with /register\n` +
          `2. Deposit funds with /deposit\n` +
          `3. Click /play to join a game\n` +
          `4. Select your stake amount\n` +
          `5. Choose your bingo cards (1-3 cards)\n` +
          `6. Wait for game to start\n` +
          `7. Daub numbers as they're called\n` +
          `8. Claim BINGO when you complete a pattern!\n\n` +
          `Winning Patterns:\n` +
          `5 in a row (horizontal, vertical, diagonal)\n` +
          `4 corners\n` +
          `Full house\n\n` +
          `Good luck!`,
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Play Now', callback_data: 'play' }],
        [{ text: 'View Balance', callback_data: 'balance' }]
      ]
    }
  };
}

async function handleCancel(ctx: CommandContext, supabase: any) {
  return {
    text: 'Action cancelled. Use /help to see available commands.',
    reply_markup: {
      remove_keyboard: true
    }
  };
}

async function handleHelp(ctx: CommandContext, supabase: any) {
  return {
    text: `Habesha Bingo Commands\n\n` +
          `Account Commands:\n` +
          `/start - Start or return to main menu\n` +
          `/register - Create your account\n` +
          `/balance - Check your balance and transactions\n\n` +
          `Game Commands:\n` +
          `/play - Start a new game\n` +
          `/instructions - How to play\n\n` +
          `Financial Commands:\n` +
          `/deposit - Add funds to your account\n` +
          `/withdraw - Withdraw your winnings\n` +
          `/transfer - Send funds to other players\n\n` +
          `Social Commands:\n` +
          `/invite - Invite friends and earn bonuses\n` +
          `/cancel - Cancel current action\n` +
          `/help - Show this help message`,
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Play Now', callback_data: 'play' }],
        [{ text: 'Register', callback_data: 'register' }]
      ]
    }
  };
}

// Helper functions
function getMiniAppUrl(): string {
  const baseUrl = Deno.env.get('MINI_APP_URL') || 'https://your-domain.com';
  return baseUrl;
}

function parseCommand(text: string): { command: string; args: string[] } {
  const parts = text.trim().split(' ');
  return {
    command: parts[0]?.toLowerCase() || '',
    args: parts.slice(1)
  };
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();
    
    // Handle callback queries (button presses)
    if (update.callback_query) {
      return handleCallbackQuery(update.callback_query);
    }

    // Handle messages
    if (update.message) {
      return handleMessage(update.message);
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error('Error handling update:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  async function handleMessage(message: TelegramUpdate['message']) {
    if (!message.text) return new Response("ok");

    const { command, args } = parseCommand(message.text);
    
    // Handle contact sharing
    if (message.contact) {
      return handleContactSharing(message);
    }

    // Handle commands
    if (COMMANDS[command]) {
      const ctx: CommandContext = {
        update: { update_id: 0, message },
        user: message.from,
        chat: message.chat,
        text: message.text,
        args,
        isPrivate: message.chat.type === 'private'
      };

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      const response = await COMMANDS[command](ctx, supabase);
      return sendTelegramMessage(message.chat.id, response);
    }

    return new Response("ok");
  }

  async function handleCallbackQuery(callbackQuery: TelegramUpdate['callback_query']) {
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    // Handle callback actions
    if (data === 'register') {
      const ctx: CommandContext = {
        update: { update_id: 0, callback_query },
        user: callbackQuery.from,
        chat: { id: userId, type: 'private' },
        text: '/register',
        args: [],
        isPrivate: true
      };

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      const response = await handleRegister(ctx, supabase);
      return sendTelegramMessage(userId, response);
    }

    // Handle other callbacks
    return new Response("ok");
  }

  async function handleContactSharing(message: TelegramUpdate['message']) {
    if (!message.contact) return new Response("ok");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify contact belongs to the same user
    if (message.contact.user_id !== message.from.id) {
      return sendTelegramMessage(message.chat.id, {
        text: 'Security alert: Contact does not match your account.'
      });
    }

    // Update player with contact info
    const { data: player, error } = await supabase
      .from('players')
      .update({
        phone: message.contact.phone_number,
        is_verified: true
      })
      .eq('telegram_user_id', message.from.id)
      .select()
      .single();

    if (error) {
      return sendTelegramMessage(message.chat.id, {
        text: 'Verification failed. Please try again.'
      });
    }

    return sendTelegramMessage(message.chat.id, {
      text: `Verification complete! Welcome, ${player.name}!\n\n` +
            `Your balance: ${player.balance} ETB\n\n` +
            `You can now start playing with /play`,
      reply_markup: {
        remove_keyboard: true
      }
    });
  }

  async function sendTelegramMessage(chatId: number, message: any) {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        ...message,
        parse_mode: "HTML"
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return new Response("ok", {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
