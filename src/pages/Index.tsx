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
      if (result.totalSelected === 1) {
        toast({ title: `✅ You selected card ${result.cardId}` });
      } else {
        toast({ title: `✅ You chose a ${ordinal(result.totalSelected)} card: ${result.cardId}` });
      }
    } else if (result.action === 'unselected') {
      toast({ title: `↩️ You unselected card ${result.cardId}` });
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
            selectedStacks={state.selectedStacks}
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
          winningCells={state.winningCells}
          winningCardId={state.winningCardId}
          cards={state.bingoCards}
          daubedNumbers={state.daubedNumbers}
          stats={state.stats}
          balance={state.user.balance}
          currentPlayerName={state.user.name}
          onReturn={returnToLobby}
        />
      );
  }
}

function ordinal(n: number): string {
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export default function Index() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}
