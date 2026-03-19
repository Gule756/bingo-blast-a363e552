import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Cross-tab player synchronization using BroadcastChannel API.
 * Each tab announces itself and responds to pings to maintain an accurate player count.
 */

interface TabMessage {
  type: 'JOIN' | 'LEAVE' | 'PING' | 'PONG' | 'PLAYER_JOINED' | 'PLAYER_LEFT';
  tabId: string;
  playerName?: string;
  isPlayer?: boolean;
  timestamp: number;
}

const CHANNEL_NAME = 'habesha-bingo-sync';
const HEARTBEAT_INTERVAL = 2000;
const STALE_TIMEOUT = 5000;

export function useTabSync(playerName: string, isInGame: boolean) {
  const tabId = useRef(`tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [activeTabs, setActiveTabs] = useState<Map<string, { name: string; isPlayer: boolean; lastSeen: number }>>(new Map());
  const channelRef = useRef<BroadcastChannel | null>(null);

  const broadcast = useCallback((msg: Omit<TabMessage, 'tabId' | 'timestamp'>) => {
    try {
      channelRef.current?.postMessage({
        ...msg,
        tabId: tabId.current,
        timestamp: Date.now(),
      });
    } catch {
      // BroadcastChannel may not be available
    }
  }, []);

  useEffect(() => {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (event: MessageEvent<TabMessage>) => {
        const msg = event.data;
        if (!msg || !msg.tabId || msg.tabId === tabId.current) return;

        setActiveTabs(prev => {
          const next = new Map(prev);
          switch (msg.type) {
            case 'JOIN':
            case 'PONG':
              next.set(msg.tabId, {
                name: msg.playerName || 'Unknown',
                isPlayer: msg.isPlayer || false,
                lastSeen: Date.now(),
              });
              break;
            case 'LEAVE':
              next.delete(msg.tabId);
              break;
            case 'PING':
              // Respond to pings
              broadcast({ type: 'PONG', playerName, isPlayer: isInGame });
              next.set(msg.tabId, {
                name: msg.playerName || 'Unknown',
                isPlayer: msg.isPlayer || false,
                lastSeen: Date.now(),
              });
              break;
          }
          return next;
        });
      };

      // Announce self
      broadcast({ type: 'JOIN', playerName, isPlayer: isInGame });
      // Ping to discover others
      broadcast({ type: 'PING', playerName, isPlayer: isInGame });

      // Heartbeat
      const heartbeat = setInterval(() => {
        broadcast({ type: 'PING', playerName, isPlayer: isInGame });
        // Prune stale tabs
        setActiveTabs(prev => {
          const next = new Map(prev);
          const now = Date.now();
          for (const [id, info] of next) {
            if (now - info.lastSeen > STALE_TIMEOUT) next.delete(id);
          }
          return next;
        });
      }, HEARTBEAT_INTERVAL);

      // Cleanup
      return () => {
        broadcast({ type: 'LEAVE' });
        clearInterval(heartbeat);
        channel.close();
        channelRef.current = null;
      };
    } catch {
      // BroadcastChannel not supported - fallback to single tab
      return undefined;
    }
  }, [playerName, isInGame, broadcast]);

  // Total players = other tabs + self
  const totalPlayers = activeTabs.size + 1;
  const activePlayerNames = Array.from(activeTabs.values())
    .filter(t => t.isPlayer)
    .map(t => t.name);

  return { totalPlayers, activePlayerNames, tabId: tabId.current };
}
