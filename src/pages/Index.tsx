import { GameProvider, useGame } from '@/context/GameContext';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { DepositScreen } from '@/components/game/DepositScreen';
import { LobbyScreen } from '@/components/game/LobbyScreen';
import { WarningOverlay } from '@/components/game/WarningOverlay';
import { GameScreen } from '@/components/game/GameScreen';
import { GameOverScreen } from '@/components/game/GameOverScreen';
import { AnimatePresence } from 'framer-motion';

function GameRouter() {
  const {
    state, canAffordBet, daubedCount,
    authenticate, submitDeposit, resetDeposit,
    selectStack, daubNumber, claimBingo, returnToLobby, setPhase,
  } = useGame();

  switch (state.phase) {
    case 'welcome':
      return <WelcomeScreen onAuthenticate={authenticate} />;

    case 'deposit':
      return (
        <DepositScreen
          balance={state.user.balance}
          status={state.depositStatus}
          onSubmit={submitDeposit}
          onReset={resetDeposit}
          onBack={() => setPhase('lobby')}
        />
      );

    case 'lobby':
    case 'warning':
      return (
        <>
          <LobbyScreen
            timer={state.timer}
            selectedStack={state.selectedStack}
            occupiedStacks={state.occupiedStacks}
            user={state.user}
            stats={state.stats}
            canAffordBet={canAffordBet}
            onSelect={selectStack}
            onDeposit={() => setPhase('deposit')}
          />
          <AnimatePresence>
            {state.phase === 'warning' && <WarningOverlay timer={state.timer} />}
          </AnimatePresence>
        </>
      );

    case 'game':
      return (
        <GameScreen
          state={state}
          daubedCount={daubedCount}
          onDaub={daubNumber}
          onClaim={claimBingo}
          onClose={returnToLobby}
        />
      );

    case 'gameover':
      return (
        <GameOverScreen
          winner={state.winner}
          card={state.bingoCard}
          daubedNumbers={state.daubedNumbers}
          stats={state.stats}
          balance={state.user.balance}
          onReturn={returnToLobby}
        />
      );
  }
}

export default function Index() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}
