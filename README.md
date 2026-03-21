# Habesha Bingo — Synchronized Multiplayer Bingo Telegram Mini App

A professional-grade, real-time multiplayer Bingo game built as a Telegram Mini App (TMA). Players verify their identity via contact sharing, join a shared lobby, select cards from a 200-stack grid, and compete in synchronized Bingo rounds with manual daubing, pattern detection, and cross-tab multiplayer.

---

## 🎮 What It Can Do (Current Level)

### Authentication & Anti-Spam
- **Contact-based verification**: Players must share their name + phone number before entering the lobby
- **Database persistence**: All contacts are stored securely in the backend (Lovable Cloud) with RLS policies
- **One-step onboarding**: Welcome → Share Contact → Auto-enter Lobby

### The Infinite Game Loop
The game runs on a perpetual cycle:
1. **Lobby Phase (30s)** — Select a card from the 200-stack grid
2. **Warning Phase (5s)** — "Hurry! Game starting..." overlay with pulsing countdown
3. **Active Game** — Numbers called every 3s, players manually daub their cards
4. **Game Over / Reset** — Results displayed, auto-return to lobby in 10s

### Lobby & Card Selection
- **200-card grid** with color-coded states: available (gray), your pick (green), taken by others (red)
- **Toast notifications** on every action: "You selected card 42", "You changed card from 42 to 77", "You unselected card 42"
- **Cross-tab sync**: Stack occupancy and player counts sync across browser tabs via BroadcastChannel API

### Game Mechanics
- **Manual daubing only** — The system does NOT auto-mark called numbers. Players must pay attention and tap numbers themselves. This is the core skill element.
- **Toggle daub** — Players can select AND unselect numbers from their grid (tap to toggle)
- **Number caller** — Animated display showing current call (e.g., "N-37") with recent call history
- **Board sidebar** — Full 1-75 number board showing all called numbers at a glance

### Winning Patterns & Bingo Claim
Five winning patterns are detected:
| Pattern | Description |
|---------|-------------|
| **Row** | Any complete horizontal row |
| **Column** | Any complete vertical column |
| **Diagonal** | Either diagonal (top-left→bottom-right or top-right→bottom-left) |
| **Four Corners** | All 4 corner cells daubed |
| **Full House** | Every cell on the card daubed |

- **BINGO button** is disabled until ≥5 numbers are marked
- **Correct claim** → Winner screen with prize, winning card, and highlighted winning cells (blue, floating, animated)
- **False claim** → Player is **eliminated** (board goes blurry red with "ELIMINATED" overlay)

### Winner Perspective
- **If YOU win**: Shows "🎉 You Won!" with prize amount and your winning card with blue-highlighted winning cells
- **If someone else wins**: Shows "😔 Game Over! — [Player] wins!" with "Better luck next round" message
- **No winner**: Shows "Game Over! — No winner this round"

### Cross-Tab Multiplayer
- **BroadcastChannel API** syncs player count and stack occupancy across tabs in real-time
- **Heartbeat system** (2s interval) detects stale/closed tabs within 5 seconds
- **Stack locking** — Cards selected by other tabs appear red and cannot be selected
- Open the app in multiple tabs to simulate multiple players

### Security & Integrity
- **Input validation** with Zod schemas (player names, phone numbers, transaction hashes)
- **Rate limiting** on daub actions (10/sec) and bingo claims (2/5sec)
- **Game integrity verification** — All daubed numbers must exist in the called numbers list; cheating = elimination
- **XSS prevention** — All user inputs are sanitized with DOMPurify-style escaping
- **CSP headers** — Content Security Policy configured in index.html
- **RLS policies** — Database tables protected with Row-Level Security

### House Edge
- 10% chance per round that a "dummy" player wins (simulated house advantage)
- Dummy players have realistic Ethiopian names
- Prize pool = bet × players × 0.9 (10% house cut)

---

## 📁 File Structure

```
src/
├── pages/
│   ├── Index.tsx              # Main game router — switches between phases
│   └── NotFound.tsx           # 404 page
│
├── components/game/
│   ├── WelcomeScreen.tsx      # Contact verification (name + phone input)
│   ├── DepositScreen.tsx      # ETB deposit with transaction hash verification
│   ├── LobbyScreen.tsx        # 200-stack grid with timer and stats bar
│   ├── LobbyGrid.tsx          # Virtualized grid of 200 selectable cards
│   ├── WarningOverlay.tsx     # "Hurry!" 5-second countdown overlay
│   ├── GameScreen.tsx         # Main game layout (board + sidebar + caller)
│   ├── BingoBoard.tsx         # 5×5 bingo card with manual daub toggles
│   ├── BoardSidebar.tsx       # Full 1-75 number tracking sidebar
│   ├── NumberCaller.tsx       # Animated current/recent number display
│   ├── StatsBar.tsx           # Top bar showing balance, players, bet, timer
│   ├── SpectatorCard.tsx      # Spectator mode info card
│   └── GameOverScreen.tsx     # Winner/loser screen with pattern highlights
│
├── hooks/
│   ├── useGameState.ts        # Central game state machine (all phases, logic)
│   ├── useTabSync.ts          # BroadcastChannel cross-tab player sync
│   ├── use-mobile.tsx         # Mobile viewport detection
│   └── use-toast.ts           # Toast notification hook
│
├── context/
│   └── GameContext.tsx         # React context provider wrapping useGameState
│
├── types/
│   └── game.ts                # All TypeScript types, constants, helpers
│
├── lib/
│   ├── security.ts            # Zod schemas, rate limiter, input sanitizer
│   ├── haptic.ts              # Telegram haptic feedback wrappers
│   └── utils.ts               # Tailwind merge utility
│
├── integrations/supabase/
│   ├── client.ts              # Auto-generated Supabase client
│   └── types.ts               # Auto-generated database types
│
├── index.css                  # Global styles, bingo color tokens, animations
├── main.tsx                   # App entry point with React Query + Router
└── App.tsx                    # Root router component

supabase/
├── config.toml                # Supabase project configuration
└── migrations/                # Database migrations (players table + RLS)
```

### What Each File Does

| File | Purpose |
|------|---------|
| `useGameState.ts` | The brain — manages the entire game state machine: phases (welcome→lobby→warning→game→gameover), card generation, number calling, daub validation, bingo pattern detection, winner determination, house edge logic |
| `useTabSync.ts` | Cross-tab multiplayer via BroadcastChannel. Broadcasts JOIN/LEAVE/PING/PONG/STACK_SELECT/STACK_DESELECT messages. Maintains active tab registry with heartbeat-based stale detection |
| `security.ts` | Input validation (Zod), rate limiting class, HTML sanitization, game integrity checker (verifies daubed numbers are actually called) |
| `game.ts` | Type definitions for all game entities + constants (BINGO_LETTERS, MIN_BET, DUMMY_NAMES, letter-color mappings) |
| `GameOverScreen.tsx` | Shows different UI based on perspective: "You Won!" with prize + blue highlighted winning cells vs "Game Over — X wins!" for losers |
| `BingoBoard.tsx` | Interactive 5×5 grid with toggle daubing. Shows elimination overlay (blurry red) on false claims |
| `LobbyGrid.tsx` | 200-card selection grid with green/red/gray states synced across tabs |

---

## 🛠 Tech Stack

| Technology | Usage |
|------------|-------|
| **React 18** + **Vite** | Frontend framework + build tool |
| **TypeScript** | Full type safety across all files |
| **Tailwind CSS** | Styling with custom bingo color tokens |
| **Framer Motion** | Animations (number caller, warning overlay, winner celebrations) |
| **Lovable Cloud (Supabase)** | Backend: player contact storage, RLS security |
| **BroadcastChannel API** | Cross-tab real-time player sync |
| **Zod** | Runtime input validation |
| **React Query** | Data fetching infrastructure |
| **shadcn/ui** | UI component library (toasts, buttons, inputs) |

---

## 🧪 How to Test Multiplayer

1. Open the preview URL in **3 separate browser tabs**
2. Verify with different names in each tab (e.g., Player1, Player2, Player3)
3. In the lobby, select different cards — you should see:
   - Your card turns **green**
   - Cards selected by other tabs turn **red** (taken)
   - Player count updates in the stats bar
4. Let the timer run out → all tabs enter the game simultaneously
5. Manually daub numbers as they're called
6. Click BINGO when you think you have a pattern
7. Winner sees "🎉 You Won!" — other tabs see "😔 Game Over! — [Name] wins!"

---

## 🔒 Security Summary

- ✅ Zod-validated inputs (names, phones, hashes, numbers)
- ✅ Rate-limited actions (daub: 10/sec, claim: 2/5sec)
- ✅ Game integrity verification on bingo claims
- ✅ HTML/XSS sanitization on all user inputs
- ✅ CSP meta tag in index.html
- ✅ RLS policies on all database tables
- ✅ No auto-daubing (prevents AFK wins)
- ✅ Elimination on false bingo claims (anti-spam)

---

## 🔮 Backend Requirements (Future)

The frontend is designed to be "backend-ready." Replace mock logic with real API calls:

| Feature | Current (Mock) | Production |
|---------|---------------|------------|
| Auth | Simulated contact share | Telegram `initData` verification |
| Balance | In-memory state | Database `users.balance` |
| Stack selection | BroadcastChannel | WebSocket `select_stack` |
| Number calling | `setInterval` | Server broadcast `NEW_NUMBER` |
| Bingo validation | Client-side check | Server-side verification |
| Deposit | Random success | TonCenter API / blockchain verification |
| Dummy players | Random 10% | Server-controlled bot accounts |
