import { GameProvider, useGame } from '@/context/GameContext';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { DepositScreen } from '@/components/game/DepositScreen';
import { LobbyScreen } from '@/components/game/LobbyScreen';
import { WarningOverlay } from '@/components/game/WarningOverlay';
import { GameScreen } from '@/components/game/GameScreen';
import { GameOverScreen } from '@/components/game/GameOverScreen';
import { AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';

function GameRouter() {
  const {
    state, mergedOccupied, canAffordBet, daubedCount,
    authenticate, submitDeposit, resetDeposit,
    selectStack, daubNumber, claimBingo, returnToLobby, setPhase,
  } = useGame();

  const handleStackSelect = (id: number) => {
    const result = selectStack(id);
    if (!result) return;
    if (result.action === 'selected') {
      toast({ title: `✅ You selected card ${result.to}` });
    } else if (result.action === 'unselected') {
      toast({ title: `↩️ You unselected card ${result.from}` });
    } else if (result.action === 'changed') {
      toast({ title: `🔄 You changed card from ${result.from} to ${result.to}` });
    }
  };

  switch (state.phase) {
    case 'welcome':
      return <WelcomeScreen onAuthenticate={(name, phone) => authenticate(name, phone)} />;

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
            occupiedStacks={mergedOccupied}
            user={state.user}
            stats={state.stats}
            canAffordBet={canAffordBet}
            onSelect={handleStackSelect}
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
          winPattern={state.winPattern}
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
