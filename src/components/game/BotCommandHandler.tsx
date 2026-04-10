import { useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { getCurrentAction, executeBotCommand } from '@/lib/telegram';

interface BotCommandHandlerProps {
  children: React.ReactNode;
}

export function BotCommandHandler({ children }: BotCommandHandlerProps) {
  const { state, setPhase, updateBalance } = useGame();

  useEffect(() => {
    // Check for bot command actions on every render
    const action = getCurrentAction();
    
    if (action.action !== 'welcome') {
      console.log('Bot command handler processing:', action);
      
      // Execute the appropriate action based on the command
      switch (action.action) {
        case 'play':
          if (state.user.id) {
            // User is authenticated, go to stake selection
            setPhase('stakeSelect');
          }
          break;
          
        case 'balance':
          if (state.user.id) {
            // Show profile with balance
            setPhase('profile');
          }
          break;
          
        case 'deposit':
          if (state.user.id) {
            // Go to deposit screen
            setPhase('deposit');
          }
          break;
          
        case 'withdraw':
          if (state.user.id) {
            // Go to withdrawal screen
            setPhase('withdraw');
          }
          break;
          
        case 'transfer':
          if (state.user.id) {
            // Go to profile where transfer options are available
            setPhase('profile');
          }
          break;
          
        case 'invite':
          // Handle invite action - could show invite modal or navigate
          executeBotCommand('invite_received');
          break;
          
        case 'instructions':
          // Show instructions - could show modal or navigate
          executeBotCommand('instructions_received');
          break;
          
        default:
          console.log('Unknown bot action in handler:', action.action);
          break;
      }
    }
  }, [state.user.id, setPhase]);

  return <>{children}</>;
}
