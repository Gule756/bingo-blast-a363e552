# Habesha Bingo — Telegram Mini App

A synchronized multiplayer Bingo game built as a Telegram Mini App (TMA) with React, Vite, Tailwind CSS, and Framer Motion.

---

## 🎮 Game Flow

```
Welcome (Auth) → Lobby (30s) → Warning (5s) → Game → Game Over → Lobby (loop)
                      ↕
                   Deposit
```

1. **Welcome / Auth** — User verifies identity via simulated Telegram contact sharing.
2. **Lobby (30s)** — Browse 200 stacks, select one. If balance < 2 ETB, selection is disabled; user can navigate to Deposit.
3. **Warning (5s)** — Non-blocking toast at top. Users can still select stacks until timer hits 0.
4. **Game** — Numbers called every 3s. Players manually daub numbers. BINGO button disabled until ≥5 numbers daubed.
5. **Game Over** — Winner displayed (could be a dummy player for house edge). Auto-return to lobby in 10s.

---

## 📁 File Structure

```
src/
├── context/
│   └── GameContext.tsx        # React Context provider wrapping useGameState
├── hooks/
│   ├── useGameState.ts        # Central state machine: timers, phases, balance, daubing, bingo check
│   └── useTabSync.ts          # BroadcastChannel-based cross-tab player detection & sync
├── lib/
│   ├── haptic.ts              # Telegram WebApp HapticFeedback helpers (light/medium/heavy)
│   └── utils.ts               # Tailwind merge utility (cn)
├── types/
│   └── game.ts                # TypeScript types, constants (MIN_BET, DUMMY_NAMES), helpers
├── pages/
│   ├── Index.tsx              # Main page: GameProvider + GameRouter (phase switch)
│   └── NotFound.tsx           # 404 page
├── components/
│   └── game/
│       ├── WelcomeScreen.tsx  # Auth landing: "Verify Identity" with loading states
│       ├── DepositScreen.tsx  # TxHash submission + simulated verification
│       ├── LobbyScreen.tsx    # HUD bar + insufficient balance warning + stack grid
│       ├── LobbyGrid.tsx      # 200-stack grid (memoized cells, green/red/gray states)
│       ├── WarningOverlay.tsx # Non-blocking top toast with pulsing countdown
│       ├── GameScreen.tsx     # Main game: sidebar + caller + board + BINGO button
│       ├── NumberCaller.tsx   # Current + recent called numbers with animations
│       ├── BingoBoard.tsx     # 5×5 interactive grid with manual daubing
│       ├── BoardSidebar.tsx   # Full 1-75 number tracking board
│       ├── SpectatorCard.tsx  # "You are watching" card for non-players
│       ├── StatsBar.tsx       # Top HUD: balance, players, bet, call count
│       └── GameOverScreen.tsx # Winner display, prize, mini board recap, auto-return
├── index.css                  # Design tokens, custom component classes, gradients
├── App.tsx                    # Router setup, providers
└── main.tsx                   # Entry point
```

---

## 🔑 Key Features

### Server-Authoritative Model (Simulated)
- **Balance Management**: Real balance tracked in state. If < 2 ETB, "Join Game" is disabled with "Insufficient Balance" warning.
- **Bet Deduction**: Balance decremented when game starts (if player selected a stack).
- **Prize Distribution**: Winner gets `bet × players × 0.9` (10% house cut).

### House Edge (Dummy Players)
- **10% of rounds** are "rigged": a dummy player (from `DUMMY_NAMES` list) wins automatically after ~20 number calls.
- UI shows "User [Dummy_Name] has won!" — no prize for real players.

### Manual Gameplay (No Hints!)
- **No auto-daub**: Players must click each number manually.
- **No called-number highlighting**: The board does NOT show which numbers were called — players must pay attention to the caller.
- **Validation**: Only numbers that have been called can be daubed (server-side verified).
- **BINGO button disabled** until at least 5 numbers are daubed.
- **False claim = elimination**: Player's board grays out, they watch as spectator.

### Cross-Tab Player Detection
- Uses **BroadcastChannel API** to sync player count across browser tabs.
- Opening the preview in multiple tabs increases the player count in real time.
- Each tab announces itself with heartbeats; stale tabs are pruned after 5 seconds.

### Security Hardening
- **CSP (Content Security Policy)**: Strict meta tag blocks inline scripts, foreign origins, and framing.
- **Input Validation**: All user inputs (name, TxHash, numbers) validated with Zod schemas.
- **Sanitization**: HTML tags, JS protocol handlers, and event handlers stripped from all text input.
- **Rate Limiting**: Daubs limited to 10/sec, bingo claims to 2/5sec to prevent spam.
- **Integrity Check**: Before accepting a bingo claim, verifies all daubed numbers exist in called numbers (prevents DevTools manipulation).
- **Anti-XSS**: No `dangerouslySetInnerHTML` used anywhere; all text content is escaped by React.
- **X-Frame-Options**: DENY prevents clickjacking.
- **Referrer Policy**: strict-origin-when-cross-origin.

### Bingo Win Patterns
- Complete row, column, or diagonal
- Four corners

### Deposit System
- Users enter a TxHash (transaction hash).
- Simulated backend verification (80% success rate for demo).
- Successful deposit adds 50 ETB to balance.

### Telegram Integration
- **Haptic Feedback**: `hapticImpact()`, `hapticNotification()`, `hapticSelection()` — graceful no-op outside Telegram.
- **Auth**: Simulates `window.Telegram.WebApp` contact sharing.

### Warning System
- **Non-blocking**: Warning is a top toast/banner, NOT a full-screen overlay.
- Users can still select stacks during the 5-second warning.

---

## 🎨 Design System

| Token | Purpose |
|-------|---------|
| `--background` | Dark navy base |
| `--card` | Card surfaces |
| `--primary` | Blue accents |
| `--accent` | Green (selected, daubed, wins) |
| `--destructive` | Red (taken stacks, errors) |
| `--bingo-b/i/n/g/o` | Column header colors |
| `--cell-default/called/daubed/selected/taken` | Cell states |
| `--gradient-hero/winner/danger` | Gradient backgrounds |

---

## 🛠 Tech Stack

- **React 18** + **TypeScript** — Component architecture
- **Vite** — Build tool
- **Tailwind CSS** — Utility-first styling with custom design tokens
- **Framer Motion** — Animations (number caller, overlays, transitions)
- **Shadcn/ui** — Base UI components
- **Lucide React** — Icons

---

## 🚀 Running Locally

```bash
npm install
npm run dev
```

---

## 🔮 Backend Requirements (Future)

The frontend is designed to be "backend-ready." Replace mock logic with real API calls:

| Feature | Current (Mock) | Production |
|---------|---------------|------------|
| Auth | Simulated contact share | Telegram `initData` verification |
| Balance | In-memory state | Database `users.balance` |
| Stack selection | Local state | WebSocket `select_stack` |
| Number calling | `setInterval` | Server broadcast `NEW_NUMBER` |
| Bingo validation | Client-side check | Server-side verification |
| Deposit | Random success | TonCenter API / blockchain verification |
| Dummy players | Random 10% | Server-controlled bot accounts |

### Recommended Backend Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  telegram_id TEXT PRIMARY KEY,
  wallet_address TEXT,
  balance_etb DECIMAL DEFAULT 0,
  total_wins INT DEFAULT 0,
  is_dummy BOOLEAN DEFAULT false
);

-- Transactions
CREATE TABLE transactions (
  tx_hash TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(telegram_id),
  status TEXT DEFAULT 'pending', -- pending/verified/rejected
  amount DECIMAL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
