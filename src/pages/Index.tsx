import { GameProvider, useGame } from '@/context/GameContext';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { StakeSelectionScreen } from '@/components/game/StakeSelectionScreen';
import { DepositScreen } from '@/components/game/DepositScreen';
import { WithdrawalScreen } from '@/components/game/WithdrawalScreen';
import { LobbyScreen } from '@/components/game/LobbyScreen';
import { WarningOverlay } from '@/components/game/WarningOverlay';
import { GameScreen } from '@/components/game/GameScreen';
import { GameOverScreen } from '@/components/game/GameOverScreen';
import { ProfileScreen } from '@/components/game/ProfileScreen';
import { AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';

function GameRouter() {
  const {
    state, mergedOccupied, canAffordBet, daubedCount,
    authenticate, selectStake, createGame, joinGame,
    selectStack, daubNumber, claimBingo, returnToLobby, setPhase,
    updateBalance, logout,
  } = useGame();

  const handleStackSelect = (id: number) => {
    const result = selectStack(id);
    if (!result) return;
    if (result.action === 'selected') {
      if (result.totalSelected === 1) {
        toast({ title: `✅ You selected card ${result.cardId}` });
      } else if (result.totalSelected === 2) {
        toast({ title: `✅ You selected a second card ${result.cardId}` });
      } else if (result.totalSelected === 3) {
        toast({ title: `✅ You selected a third card ${result.cardId}` });
      }
    } else if (result.action === 'unselected') {
      toast({ title: `↩️ You unselected card ${result.cardId}` });
    }
  };

  switch (state.phase) {
    case 'welcome':
      return <WelcomeScreen onAuthenticate={(name, phone) => authenticate(name, phone)} />;

    case 'stakeSelect':
      return (
        <StakeSelectionScreen
          balance={state.user.balance}
          userName={state.user.name}
          onSelectStake={selectStake}
          onCreateGame={(stake, countdown) => createGame(stake, countdown)}
          onJoinGame={(gameId, stake) => joinGame(gameId, stake)}
          onDeposit={() => setPhase('deposit')}
          onProfile={() => setPhase('profile')}
          onLogout={logout}
        />
      );

    case 'profile':
      return (
        <ProfileScreen
          user={state.user}
          onBack={() => setPhase('stakeSelect')}
          onDeposit={() => setPhase('deposit')}
          onWithdraw={() => setPhase('withdraw')}
          onBalanceUpdate={updateBalance}
        />
      );

    case 'deposit':
      return (
        <DepositScreen
          balance={state.user.balance}
          userId={state.user.id}
          onBalanceUpdate={updateBalance}
          onBack={() => setPhase('stakeSelect')}
        />
      );

    case 'withdraw':
      return (
        <WithdrawalScreen
          balance={state.user.balance}
          userId={state.user.id}
          onBalanceUpdate={updateBalance}
          onBack={() => setPhase('stakeSelect')}
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
          winnerCount={state.winnerCount}
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

export default function Index() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}
