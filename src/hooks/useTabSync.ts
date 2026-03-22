import { useState, useEffect, useCallback, useRef } from 'react';

interface TabMessage {
  type: 'JOIN' | 'LEAVE' | 'PING' | 'PONG' | 'STACK_SELECT' | 'STACK_DESELECT';
  tabId: string;
  playerName?: string;
  isPlayer?: boolean;
  stackId?: number;
  timestamp: number;
}

const CHANNEL_NAME = 'habesha-bingo-sync';
const HEARTBEAT_INTERVAL = 2000;
const STALE_TIMEOUT = 5000;

export function useTabSync(playerName: string, isInGame: boolean) {
  const tabId = useRef(`tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [activeTabs, setActiveTabs] = useState<Map<string, { name: string; isPlayer: boolean; lastSeen: number; stackIds: Set<number> }>>(new Map());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const currentStacksRef = useRef<Set<number>>(new Set());

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

  // Broadcast stack selection/deselection to other tabs
  const broadcastStackSelect = useCallback((stackId: number, selected: boolean) => {
    if (selected) {
      currentStacksRef.current.add(stackId);
      broadcast({ type: 'STACK_SELECT', stackId, playerName });
    } else {
      currentStacksRef.current.delete(stackId);
      broadcast({ type: 'STACK_DESELECT', stackId });
    }
  }, [broadcast, playerName]);

  useEffect(() => {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (event: MessageEvent<TabMessage>) => {
        const msg = event.data;
        if (!msg || !msg.tabId || msg.tabId === tabId.current) return;

        setActiveTabs(prev => {
          const next = new Map(prev);
          const existing = next.get(msg.tabId);

          switch (msg.type) {
            case 'JOIN':
            case 'PONG':
              next.set(msg.tabId, {
                name: msg.playerName || 'Unknown',
                isPlayer: msg.isPlayer || false,
                lastSeen: Date.now(),
                stackIds: existing?.stackIds ?? new Set(),
              });
              break;
            case 'LEAVE':
              next.delete(msg.tabId);
              break;
            case 'PING':
              broadcast({ type: 'PONG', playerName, isPlayer: isInGame });
              next.set(msg.tabId, {
                name: msg.playerName || 'Unknown',
                isPlayer: msg.isPlayer || false,
                lastSeen: Date.now(),
                stackIds: existing?.stackIds ?? new Set(),
              });
              break;
            case 'STACK_SELECT':
              if (msg.stackId != null) {
                const entry = existing || {
                  name: msg.playerName || 'Unknown',
                  isPlayer: false,
                  lastSeen: Date.now(),
                  stackIds: new Set<number>(),
                };
                const ids = new Set(entry.stackIds);
                ids.add(msg.stackId);
                next.set(msg.tabId, { ...entry, stackIds: ids, lastSeen: Date.now() });
              }
              break;
            case 'STACK_DESELECT':
              if (existing && msg.stackId != null) {
                const ids = new Set(existing.stackIds);
                ids.delete(msg.stackId);
                next.set(msg.tabId, { ...existing, stackIds: ids, lastSeen: Date.now() });
              }
              break;
          }
          return next;
        });
      };

      broadcast({ type: 'JOIN', playerName, isPlayer: isInGame });
      broadcast({ type: 'PING', playerName, isPlayer: isInGame });

      const heartbeat = setInterval(() => {
        broadcast({ type: 'PING', playerName, isPlayer: isInGame });
        setActiveTabs(prev => {
          const next = new Map(prev);
          const now = Date.now();
          for (const [id, info] of next) {
            if (now - info.lastSeen > STALE_TIMEOUT) next.delete(id);
          }
          return next;
        });
      }, HEARTBEAT_INTERVAL);

      return () => {
        broadcast({ type: 'LEAVE' });
        for (const sid of currentStacksRef.current) {
          broadcast({ type: 'STACK_DESELECT', stackId: sid });
        }
        clearInterval(heartbeat);
        channel.close();
        channelRef.current = null;
      };
    } catch {
      return undefined;
    }
  }, [playerName, isInGame, broadcast]);

  // Occupied stacks from OTHER tabs
  const occupiedByOthers = new Set<number>();
  for (const [, info] of activeTabs) {
    for (const sid of info.stackIds) {
      occupiedByOthers.add(sid);
    }
  }

  const totalPlayers = activeTabs.size + 1;

  return { totalPlayers, occupiedByOthers, broadcastStackSelect, tabId: tabId.current };
}
