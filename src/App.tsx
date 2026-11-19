import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Music,
  BookOpen,
  LogOut,
  Heart,
  Crown,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { CONSUMABLE_MAP } from '../shared/catalog';
import {
  evaluateHand,
  isCardDebuffed,
  sortCardsByRank,
  sortCardsBySuit,
} from '../shared/engine';
import {
  ClientMessage,
  HandEvaluationResult,
  PlayerState,
  PlayingCard as PlayingCardType,
  RoomPublicState,
  RoomSettings,
  ScoreStepEvent,
  ServerMessage,
} from '../shared/types';
import { PlayingCard } from './components/PlayingCard';
import { JokerCard } from './components/JokerCard';
import { ShopPanel } from './components/ShopPanel';
import { BlindSelectPanel } from './components/BlindSelectPanel';
import { FriendsRail } from './components/FriendsRail';
import { LobbyScreen } from './components/LobbyScreen';
import { RunInfoModal } from './components/RunInfoModal';
import { sound } from './utils/sound';
import { getJokerSynergySummary } from './utils/jokerHelper';
import { getWebSocketUrl } from './utils/platform';

interface ScoringPlaybackState {
  handEval: HandEvaluationResult;
  playedCards: PlayingCardType[];
  steps: ScoreStepEvent[];
  currentStepIndex: number;
  runningChips: number;
  runningMult: number;
  finalScore: number;
  completed: boolean;
}

type CardExitKind = 'play' | 'discard';

const handCardVariants = {
  initial: (index: number) => ({
    opacity: 0,
    y: 22,
    x: 18,
    scale: 0.92,
    transition: { duration: 0.18, delay: Math.min(index * 0.025, 0.16), ease: [0.16, 1, 0.3, 1] as const },
  }),
  animate: (index: number) => ({
    opacity: 1,
    y: 0,
    x: 0,
    scale: 1,
    transition: { duration: 0.18, delay: Math.min(index * 0.02, 0.14), ease: [0.16, 1, 0.3, 1] as const },
  }),
  exit: (exitKind: CardExitKind) =>
    exitKind === 'play'
      ? {
          opacity: 0,
          y: -44,
          scale: 0.92,
          transition: { duration: 0.17, ease: [0.16, 1, 0.3, 1] as const },
        }
      : {
          opacity: 0,
          x: 34,
          y: 20,
          rotate: 6,
          scale: 0.88,
          transition: { duration: 0.17, ease: [0.16, 1, 0.3, 1] as const },
        },
};

export default function App() {
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [self, setSelf] = useState<PlayerState | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [cardExitKind, setCardExitKind] = useState<CardExitKind>('play');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [showRunInfo, setShowRunInfo] = useState(false);
  const [targetingHexInstanceId, setTargetingHexInstanceId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<ScoringPlaybackState | null>(null);
  const [handsDropPulse, setHandsDropPulse] = useState(0);
  const [discardsDropPulse, setDiscardsDropPulse] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const animTimerRef = useRef<number | null>(null);
  const roomRef = useRef<RoomPublicState | null>(null);
  const selfRef = useRef<PlayerState | null>(null);
  const prevCountsRef = useRef<{ hands: number; discards: number; phase: string } | null>(null);

  roomRef.current = room;
  selfRef.current = self;

  const initialRoomCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase();
  }, []);

  const sendMessage = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const startScoringAnimation = useCallback(
    (
      handEval: HandEvaluationResult,
      playedCards: PlayingCardType[],
      steps: ScoreStepEvent[],
      finalScore: number,
      blindCleared: boolean
    ) => {
      if (animTimerRef.current) {
        window.clearTimeout(animTimerRef.current);
      }

      if (steps.length === 0) {
        setPlayback(null);
        return;
      }

      let idx = 0;
      let jokerComboCount = 0;
      let jokerMultTriggers = 0;

      const runStep = () => {
        if (idx >= steps.length) {
          setPlayback((prev) => (prev ? { ...prev, completed: true } : null));
          if (jokerMultTriggers > 0) {
            sound.playComboWin(jokerMultTriggers);
            if (blindCleared) {
              window.setTimeout(() => sound.playClearFanfare(), 240);
            }
          } else if (blindCleared) {
            sound.playClearFanfare();
          }
          animTimerRef.current = window.setTimeout(() => {
            setPlayback(null);
          }, 750);
          return;
        }

        const step = steps[idx];
        if (step.sourceType === 'joker') {
          if (step.xMult) {
            sound.playJokerXMult(jokerComboCount, step.xMult);
            jokerComboCount += 1;
            jokerMultTriggers += 1;
          } else if (step.deltaMult) {
            sound.playJokerAddMult(jokerComboCount);
            jokerComboCount += 1;
            jokerMultTriggers += 1;
          } else if (step.deltaChips) {
            sound.playJokerChips(jokerComboCount);
            jokerComboCount += 1;
          } else {
            sound.playChipTick(idx);
          }
        } else if (step.xMult) {
          sound.playMultSlam(idx);
        } else if (step.deltaMoney) {
          sound.playCoin();
        } else if (step.deltaMult) {
          sound.playJokerAddMult(0);
        } else {
          sound.playChipTick(idx);
        }

        setPlayback({
          handEval,
          playedCards,
          steps,
          currentStepIndex: idx,
          runningChips: step.runningChips,
          runningMult: step.runningMult,
          finalScore,
          completed: false,
        });

        idx += 1;
        animTimerRef.current = window.setTimeout(runStep, 220);
      };

      runStep();
    },
    []
  );

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const wsUrl = getWebSocketUrl();
    if (!wsUrl) {
      setErrorMsg('No server URL configured for mobile build. Set VITE_BACKEND_URL before syncing.');
      return;
    }
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const savedCode = sessionStorage.getItem('ante_room_code');
      const savedPlayerId = sessionStorage.getItem('ante_player_id');
      const savedName = sessionStorage.getItem('ante_player_name');
      if (savedCode && savedPlayerId && !roomRef.current) {
        ws.send(
          JSON.stringify({
            type: 'join_room',
            roomCode: savedCode,
            playerId: savedPlayerId,
            playerName: savedName || 'Player',
          })
        );
      }
    };

    ws.onmessage = (evt) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }

      if (msg.type === 'error') {
        setErrorMsg(msg.message);
        window.setTimeout(() => setErrorMsg(null), 4000);
        return;
      }

      if (msg.type === 'room_sync') {
        setRoom(msg.room);
        setSelf(msg.self);
        sessionStorage.setItem('ante_room_code', msg.room.roomCode);
        sessionStorage.setItem('ante_player_id', msg.self.id);
        sessionStorage.setItem('ante_player_name', msg.self.name);

        const url = new URL(window.location.href);
        if (msg.room.settings.mode !== 'solo' && url.searchParams.get('room') !== msg.room.roomCode) {
          url.searchParams.set('room', msg.room.roomCode);
          window.history.replaceState({}, '', url.toString());
        } else if (msg.room.settings.mode === 'solo' && url.searchParams.has('room')) {
          url.searchParams.delete('room');
          window.history.replaceState({}, '', url.toString());
        }

        // Prune selected cards no longer in hand
        const handIds = new Set(msg.self.hand.map((c) => c.id));
        setSelectedCardIds((prev) => prev.filter((id) => handIds.has(id)));
      }

      if (msg.type === 'hand_scored') {
        setSelectedCardIds([]);
        startScoringAnimation(
          msg.handEval,
          msg.playedCards,
          msg.steps,
          msg.finalScore,
          msg.blindCleared
        );
      }
    };

    ws.onclose = () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, 1500);
    };
  }, [startScoringAnimation]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
      sound.disposeMusic();
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  useEffect(() => {
    const unlock = () => {
      if (sound.musicEnabled && !sound.muted) {
        sound.unlockAndStartMusic();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const handleToggleMute = () => {
    const nextMuted = !muted;
    sound.setMuted(nextMuted);
    setMuted(nextMuted);
  };

  const handleToggleMusic = () => {
    const nextMusic = !musicEnabled;
    sound.setMusicEnabled(nextMusic);
    setMusicEnabled(nextMusic);
  };

  const handleLeaveRoom = () => {
    sessionStorage.removeItem('ante_room_code');
    sessionStorage.removeItem('ante_player_id');
    setRoom(null);
    setSelf(null);
    setSelectedCardIds([]);
    setTargetingHexInstanceId(null);
    setPlayback(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  };

  const handleCreateRoom = (playerName: string, settings: Partial<RoomSettings>) => {
    setErrorMsg(null);
    sendMessage({ type: 'create_room', playerName, settings });
  };

  const handleJoinRoom = (roomCode: string, playerName: string) => {
    setErrorMsg(null);
    sendMessage({ type: 'join_room', roomCode, playerName });
  };

  const toggleCardSelection = (cardId: string) => {
    if (playback) return;
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) {
        sound.playDeselect();
        return prev.filter((id) => id !== cardId);
      }
      if (prev.length >= 5) return prev;
      sound.playSelect(prev.length);
      return [...prev, cardId];
    });
  };

  const handleSortRank = () => {
    if (!self) return;
    const sorted = sortCardsByRank(self.hand);
    setSelf({ ...self, hand: sorted });
    sendMessage({ type: 'reorder_hand', cardIds: sorted.map((c) => c.id) });
  };

  const handleSortSuit = () => {
    if (!self) return;
    const sorted = sortCardsBySuit(self.hand);
    setSelf({ ...self, hand: sorted });
    sendMessage({ type: 'reorder_hand', cardIds: sorted.map((c) => c.id) });
  };

  const handleMoveJoker = (index: number, dir: -1 | 1) => {
    if (!self) return;
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= self.jokers.length) return;
    const copy = [...self.jokers];
    [copy[index], copy[nextIdx]] = [copy[nextIdx], copy[index]];
    setSelf({ ...self, jokers: copy });
    sendMessage({ type: 'reorder_jokers', instanceIds: copy.map((j) => j.instanceId) });
  };

  const handleUseConsumable = (instanceId: string, consumableId: string) => {
    const def = CONSUMABLE_MAP[consumableId];
    if (!def) return;
    if (def.type === 'hex') {
      setTargetingHexInstanceId(instanceId);
      return;
    }
    const minSel = def.minSelect ?? 0;
    const maxSel = def.maxSelect ?? 0;
    if (minSel > 0 && (selectedCardIds.length < minSel || selectedCardIds.length > maxSel)) {
      setErrorMsg(
        `Select ${minSel === maxSel ? minSel : `${minSel}-${maxSel}`} card(s) in your hand to use ${def.name}.`
      );
      window.setTimeout(() => setErrorMsg(null), 3500);
      return;
    }
    sound.playCoin();
    sendMessage({
      type: 'use_consumable',
      instanceId,
      selectedCardIds,
    });
  };

  const handleSelectHexTarget = (targetPlayerId: string) => {
    if (!targetingHexInstanceId) return;
    sound.playMultSlam(2);
    sendMessage({
      type: 'use_consumable',
      instanceId: targetingHexInstanceId,
      targetPlayerId,
    });
    setTargetingHexInstanceId(null);
  };

  // Live preview of selected hand
  const { selectedCards, heldCards, selectedHandPreview } = useMemo(() => {
    if (!self || self.phase !== 'playing_blind') {
      return {
        selectedCards: [] as PlayingCardType[],
        heldCards: [] as PlayingCardType[],
        selectedHandPreview: null as HandEvaluationResult | null,
      };
    }
    const idSet = new Set(selectedCardIds);
    const chosen = self.hand.filter((c) => idSet.has(c.id));
    const held = self.hand.filter((c) => !idSet.has(c.id));
    const evalRes = chosen.length > 0 ? evaluateHand(chosen, self.jokers, self.handLevels) : null;
    return {
      selectedCards: chosen,
      heldCards: held,
      selectedHandPreview: evalRes,
    };
  }, [self, selectedCardIds]);

  const bossId =
    room && room.blindIndex === 2 ? room.currentBoss.id : null;

  const activeStep = playback ? playback.steps[playback.currentStepIndex] : null;

  const targetingHexDef = useMemo(() => {
    if (!targetingHexInstanceId || !self) return null;
    const item = self.consumables.find((c) => c.instanceId === targetingHexInstanceId);
    return item ? CONSUMABLE_MAP[item.consumableId] : null;
  }, [targetingHexInstanceId, self]);

  const isSolo = room?.settings.mode === 'solo';
  const isBossStage = Boolean(
    room && room.status === 'playing' && room.blindIndex === 2 && self?.phase !== 'shop'
  );
  const hasActiveDebuff = Boolean(
    self && self.pendingHexes.length > 0 && self.phase === 'playing_blind'
  );
  const isDebuffedStage = isBossStage || hasActiveDebuff;

  useEffect(() => {
    sound.setMusicMood(isDebuffedStage ? 'boss' : 'normal');
  }, [isDebuffedStage]);

  useEffect(() => {
    if (!self) {
      prevCountsRef.current = null;
      setHandsDropPulse(0);
      setDiscardsDropPulse(0);
      return;
    }
    const prev = prevCountsRef.current;
    if (prev && prev.phase === 'playing_blind') {
      if (self.handsLeft < prev.hands) {
        setHandsDropPulse((n) => n + 1);
      }
      if (self.discardsLeft < prev.discards) {
        setDiscardsDropPulse((n) => n + 1);
      }
    }
    prevCountsRef.current = {
      hands: self.handsLeft,
      discards: self.discardsLeft,
      phase: self.phase,
    };
  }, [self?.handsLeft, self?.discardsLeft, self?.phase, self]);

  return (
    <MotionConfig reducedMotion="user">
    <div
      className={`min-h-screen flex flex-col text-slate-100 relative overflow-x-hidden transition-colors duration-700 ${
        isDebuffedStage ? 'bg-[#170912]' : 'bg-[#071914]'
      }`}
    >
      {/* Felt Table Backdrop */}
      <div
        className={`pointer-events-none fixed inset-0 bg-cover bg-center transition-opacity duration-700 ${
          isDebuffedStage ? 'opacity-25' : 'opacity-40'
        }`}
        style={{ backgroundImage: `url('/src/assets/images/balatro_felt_table_1794933721923.jpg')` }}
      />

      {/* Boss / Debuffed Stage Animated Swirling Shader Backdrop */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 overflow-hidden transition-opacity duration-700 ${
          isDebuffedStage ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="absolute -inset-[45%] animate-boss-swirl opacity-55"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, rgba(159, 18, 57, 0.35), rgba(15, 23, 42, 0.1) 25%, rgba(107, 33, 168, 0.32) 50%, rgba(15, 23, 42, 0.1) 75%, rgba(159, 18, 57, 0.35))',
          }}
        />
        <div
          className="absolute -inset-[40%] animate-boss-swirl-reverse opacity-45"
          style={{
            background:
              'radial-gradient(circle at 30% 35%, rgba(225, 29, 72, 0.28), transparent 45%), radial-gradient(circle at 72% 68%, rgba(147, 51, 234, 0.24), transparent 48%)',
          }}
        />
        <div
          className="absolute inset-0 animate-debuff-drift"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(190, 18, 60, 0.18), transparent 65%)',
          }}
        />
        <div
          className="absolute inset-0 animate-boss-vignette"
          style={{
            boxShadow: 'inset 0 0 140px 28px rgba(159, 18, 57, 0.55)',
          }}
        />
      </div>

      <div
        className={`pointer-events-none fixed inset-0 transition-opacity duration-700 ${
          isDebuffedStage
            ? 'bg-radial from-transparent via-[#160811]/55 to-[#090308]/92'
            : 'bg-radial from-transparent via-[#071914]/45 to-[#040D0A]/90'
        }`}
      />

      {/* Strict 3-Zone Top Bar */}
      <header className="relative z-30 h-14 px-4 sm:px-6 border-b border-white/10 bg-[#0A1317]/90 backdrop-blur-xs flex items-center justify-between gap-8">
        {/* Zone 1: Wordmark */}
        <div className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Ante &amp; Friends
        </div>

        {/* Zone 2: Clean unboxed metadata */}
        {room && self ? (
          <div className="hidden md:flex items-center gap-4 text-xs text-slate-300 font-medium whitespace-nowrap">
            {isSolo ? (
              <span>Solo Run</span>
            ) : (
              <>
                <span>
                  Room <strong className="font-mono-num text-amber-300">{room.roomCode}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  {room.settings.mode === 'versus' ? 'Versus Showdown' : 'Score Race'}
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono-num">
              Ante {room.ante}/{room.settings.maxAntes}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              {room.blindIndex === 0
                ? 'Small Blind'
                : room.blindIndex === 1
                ? 'Big Blind'
                : room.currentBoss.name}
            </span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-6 text-xs text-slate-400 whitespace-nowrap">
            <span>32 Jokers</span>
            <span>·</span>
            <span>12 Poker Hands</span>
            <span>·</span>
            <span>Solo &amp; Multiplayer</span>
          </div>
        )}

        {/* Zone 3: Primary Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {self && room?.status === 'playing' && (
            <button
              type="button"
              onClick={() => setShowRunInfo(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
              <span>Run Info</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleMusic}
            aria-label={musicEnabled ? 'Pause Music' : 'Play Music'}
            title={musicEnabled ? 'Music On' : 'Music Off'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
              musicEnabled && !muted
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-400/30'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-white/10'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{musicEnabled ? 'Music' : 'Muted'}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
            title={muted ? 'Unmute All Audio' : 'Mute All Audio'}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
          </button>
          {room && (
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 text-xs font-semibold border border-rose-500/30 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          )}
        </div>
      </header>

      {/* Error Toast */}
      {errorMsg && room && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-rose-950/95 border border-rose-400 text-xs font-semibold text-rose-100 shadow-2xl">
          {errorMsg}
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col">
        {!room || !self || room.status === 'lobby' ? (
          <LobbyScreen
            initialRoomCode={initialRoomCode}
            room={room}
            selfId={self?.id || null}
            errorMsg={errorMsg}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onUpdateSettings={(s) => sendMessage({ type: 'update_settings', settings: s })}
            onStartGame={() => sendMessage({ type: 'start_game' })}
            onLeaveRoom={handleLeaveRoom}
          />
        ) : (
          <div className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-4 flex flex-col lg:flex-row gap-4 items-stretch">
            {/* LEFT HUD COLUMN (Balatro Sideboard) */}
            <aside className="w-full lg:w-[270px] shrink-0 rounded-2xl bg-[#0D1519]/95 border border-white/10 p-4 shadow-xl flex flex-col gap-4">
              {/* Blind Info */}
              <div
                className={`rounded-xl border p-3.5 ${
                  room.blindIndex === 2
                    ? 'bg-[#261219] border-rose-500/40'
                    : 'bg-[#142220] border-amber-400/30'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {room.blindIndex === 0
                      ? 'Small Blind'
                      : room.blindIndex === 1
                      ? 'Big Blind'
                      : 'Boss Blind'}
                  </span>
                  <span className="font-mono-num">
                    Ante {room.ante}/{room.settings.maxAntes}
                  </span>
                </div>
                <div className="font-display text-xl font-bold text-white mt-0.5">
                  {room.blindIndex === 2
                    ? room.currentBoss.name
                    : room.blindIndex === 0
                    ? 'Small Blind'
                    : 'Big Blind'}
                </div>
                {room.blindIndex === 2 && (
                  <p className="text-xs text-rose-200 mt-1 leading-snug">
                    {room.currentBoss.description}
                  </p>
                )}

                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Target</span>
                  <span className="text-lg font-mono-num font-bold text-rose-400">
                    {(self.phase === 'playing_blind' ? self.targetScore : room.baseTargetScore).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Round Score */}
              <div className="rounded-xl bg-black/40 border border-white/10 p-3.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Round Score</span>
                  <span className="font-mono-num text-slate-300">
                    Total {self.totalRunScore.toLocaleString()}
                  </span>
                </div>
                <div className="text-3xl font-mono-num font-bold text-white mt-1 tracking-tight">
                  {self.score.toLocaleString()}
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      self.score >= self.targetScore ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        self.targetScore > 0 ? Math.round((self.score / self.targetScore) * 100) : 0
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Balatro Chips x Mult Calculator Box */}
              <div className="rounded-xl bg-[#121D24] border border-white/12 p-3.5">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-sm font-bold text-white truncate">
                    {playback
                      ? playback.handEval.displayName
                      : selectedHandPreview
                      ? selectedHandPreview.displayName
                      : 'Select Cards'}
                  </span>
                  {(playback || selectedHandPreview) && (
                    <span className="text-xs font-mono-num font-bold text-cyan-300 shrink-0">
                      Lv.{playback ? playback.handEval.level : selectedHandPreview?.level}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="rounded-lg bg-blue-600/90 border border-blue-400/50 py-2 px-2 text-right font-mono-num text-xl font-bold text-white shadow-inner">
                    {playback
                      ? playback.runningChips
                      : selectedHandPreview
                      ? selectedHandPreview.baseChips
                      : 0}
                  </div>
                  <span className="font-mono-num font-bold text-rose-400 text-lg">×</span>
                  <div className="rounded-lg bg-red-600/90 border border-red-400/50 py-2 px-2 text-left font-mono-num text-xl font-bold text-white shadow-inner">
                    {playback
                      ? playback.runningMult
                      : selectedHandPreview
                      ? selectedHandPreview.baseMult
                      : 0}
                  </div>
                </div>

                {activeStep && (
                  <div className="mt-2 text-center text-xs font-medium text-amber-300 truncate">
                    {activeStep.label}
                  </div>
                )}
              </div>

              {/* Hands, Discards, Cash, Lives */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="relative rounded-xl bg-black/35 border border-white/10 p-3 text-center overflow-hidden">
                  {handsDropPulse > 0 && (
                    <motion.div
                      key={`hands-ring-${handsDropPulse}`}
                      initial={{ opacity: 0.9 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-blue-400/80 bg-blue-500/15"
                    />
                  )}
                  {handsDropPulse > 0 && (
                    <motion.span
                      key={`hands-delta-${handsDropPulse}`}
                      initial={{ opacity: 1, y: 2, scale: 0.9 }}
                      animate={{ opacity: 0, y: -12, scale: 1.05 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      className="pointer-events-none absolute top-1.5 right-2 text-[11px] font-mono-num font-bold text-blue-300"
                    >
                      -1
                    </motion.span>
                  )}
                  <motion.div
                    key={`hands-label-${handsDropPulse}`}
                    initial={handsDropPulse > 0 ? { scale: 1.24, y: -2, color: '#93C5FD' } : false}
                    animate={{ scale: 1, y: 0, color: '#94A3B8' }}
                    transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                    className="text-[11px] font-semibold text-slate-400"
                  >
                    Hands
                  </motion.div>
                  <motion.div
                    key={`hands-val-${handsDropPulse}`}
                    initial={handsDropPulse > 0 ? { scale: 1.32, y: 3 } : false}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    className="text-2xl font-mono-num font-bold text-blue-400 mt-0.5"
                  >
                    {self.handsLeft}
                  </motion.div>
                </div>

                <div className="relative rounded-xl bg-black/35 border border-white/10 p-3 text-center overflow-hidden">
                  {discardsDropPulse > 0 && (
                    <motion.div
                      key={`discards-ring-${discardsDropPulse}`}
                      initial={{ opacity: 0.9 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-red-400/80 bg-red-500/15"
                    />
                  )}
                  {discardsDropPulse > 0 && (
                    <motion.span
                      key={`discards-delta-${discardsDropPulse}`}
                      initial={{ opacity: 1, y: 2, scale: 0.9 }}
                      animate={{ opacity: 0, y: -12, scale: 1.05 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      className="pointer-events-none absolute top-1.5 right-2 text-[11px] font-mono-num font-bold text-red-300"
                    >
                      -1
                    </motion.span>
                  )}
                  <motion.div
                    key={`discards-label-${discardsDropPulse}`}
                    initial={discardsDropPulse > 0 ? { scale: 1.24, y: -2, color: '#FCA5A5' } : false}
                    animate={{ scale: 1, y: 0, color: '#94A3B8' }}
                    transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                    className="text-[11px] font-semibold text-slate-400"
                  >
                    Discards
                  </motion.div>
                  <motion.div
                    key={`discards-val-${discardsDropPulse}`}
                    initial={discardsDropPulse > 0 ? { scale: 1.32, y: 3 } : false}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    className="text-2xl font-mono-num font-bold text-red-400 mt-0.5"
                  >
                    {self.discardsLeft}
                  </motion.div>
                </div>
                <div className="rounded-xl bg-black/35 border border-white/10 p-3 text-center">
                  <div className="text-[11px] text-slate-400">Bank</div>
                  <div className="text-2xl font-mono-num font-bold text-amber-400 mt-0.5">
                    ${self.money}
                  </div>
                </div>
                <div className="rounded-xl bg-black/35 border border-white/10 p-3 text-center">
                  <div className="text-[11px] text-slate-400">
                    {room.settings.mode === 'versus' ? 'Lives' : 'Deck'}
                  </div>
                  <div className="text-2xl font-mono-num font-bold text-rose-400 mt-0.5 flex items-center justify-center gap-1">
                    {room.settings.mode === 'versus' ? (
                      <>
                        <Heart className="w-4 h-4 fill-current" />
                        <span>{self.lives}</span>
                      </>
                    ) : (
                      <span className="text-slate-200">{self.deck.length}</span>
                    )}
                  </div>
                </div>
              </div>

              {self.pendingHexes.length > 0 && (
                <div className="rounded-xl bg-rose-950/70 border border-rose-400/40 p-3 text-xs text-rose-100">
                  <div className="font-bold mb-1">Active Hexes on You</div>
                  {self.pendingHexes.map((h) => (
                    <div key={h.id} className="text-[11px] text-rose-200">
                      • {h.name} (from {h.fromPlayerName})
                    </div>
                  ))}
                </div>
              )}
            </aside>

            {/* CENTER TABLE CANVAS */}
            <section className="flex-1 min-w-0 flex flex-col justify-between gap-4">
              {/* Top Shelf: Jokers (Left) & Consumables (Right) */}
              <div className="relative z-20 flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-black/30 border border-white/10 p-3.5 backdrop-blur-xs">
                {/* Joker Roster */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-2">
                    Jokers ({self.jokers.length}/{self.maxJokers}) · Left-to-right trigger order
                  </div>
                  <div className="flex flex-wrap items-start gap-2.5 min-h-[144px]">
                    {self.jokers.map((j, idx) => {
                      const isTriggering =
                        activeStep?.sourceType === 'joker' &&
                        activeStep.sourceId === j.instanceId;
                      let popup: string | null = null;
                      if (isTriggering && activeStep) {
                        if (activeStep.deltaChips) popup = `+${activeStep.deltaChips}`;
                        else if (activeStep.deltaMult) popup = `+${activeStep.deltaMult} Mult`;
                        else if (activeStep.xMult) popup = `×${activeStep.xMult}`;
                      }
                      const synergy = getJokerSynergySummary({
                        joker: j,
                        index: idx,
                        allJokers: self.jokers,
                        selectedCards,
                        heldCards,
                        handEval: selectedHandPreview,
                        discardsLeft: self.discardsLeft,
                        money: self.money,
                        bossId,
                      });
                      return (
                        <JokerCard
                          key={j.instanceId}
                          joker={j}
                          index={idx}
                          total={self.jokers.length}
                          activeStep={isTriggering}
                          popupText={popup}
                          synergy={synergy}
                          canReorder={!playback}
                          onMoveLeft={() => handleMoveJoker(idx, -1)}
                          onMoveRight={() => handleMoveJoker(idx, 1)}
                          onSell={
                            self.phase === 'shop' || self.phase === 'playing_blind' || self.phase === 'blind_select'
                              ? () => sendMessage({ type: 'sell_joker', instanceId: j.instanceId })
                              : undefined
                          }
                        />
                      );
                    })}
                    {Array.from({ length: Math.max(0, self.maxJokers - self.jokers.length) }).map(
                      (_, emptyIdx) => (
                        <div
                          key={`empty-joker-${emptyIdx}`}
                          className="w-[92px] sm:w-[102px] h-[132px] sm:h-[144px] rounded-xl border border-dashed border-white/12 bg-black/20 flex items-center justify-center text-[11px] text-slate-600"
                        >
                          Joker Slot
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Consumable Roster */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-2">
                    Consumables ({self.consumables.length}/{self.maxConsumables})
                  </div>
                  <div className="flex items-start gap-2.5 min-h-[144px]">
                    {self.consumables.map((c) => {
                      const def = CONSUMABLE_MAP[c.consumableId];
                      if (!def) return null;
                      const bgClass =
                        def.type === 'planet'
                          ? 'border-cyan-400/60 bg-[#0F2430]'
                          : def.type === 'hex'
                          ? 'border-rose-400/60 bg-[#29121B]'
                          : 'border-purple-400/60 bg-[#1F152D]';

                      return (
                        <div key={c.instanceId} className="flex flex-col items-center">
                          <div
                            title={def.description}
                            className={`w-[96px] h-[132px] sm:h-[144px] rounded-xl border-2 p-2 flex flex-col justify-between shadow-lg ${bgClass}`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-300">
                              {def.type}
                            </span>
                            <div>
                              <div className="font-display text-xs font-bold text-white leading-tight">
                                {def.name}
                              </div>
                              <p className="text-[10px] text-slate-300 mt-1 leading-tight line-clamp-4">
                                {def.description}
                              </p>
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUseConsumable(c.instanceId, c.consumableId)}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Use
                            </button>
                            <button
                              type="button"
                              onClick={() => sendMessage({ type: 'sell_consumable', instanceId: c.instanceId })}
                              className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-mono-num font-bold cursor-pointer"
                            >
                              ${c.sellValue}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {Array.from({
                      length: Math.max(0, self.maxConsumables - self.consumables.length),
                    }).map((_, i) => (
                      <div
                        key={`empty-cons-${i}`}
                        className="w-[96px] h-[132px] sm:h-[144px] rounded-xl border border-dashed border-white/12 bg-black/20 flex items-center justify-center text-[11px] text-slate-600 text-center px-2"
                      >
                        Tarot / Planet
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* MIDDLE TABLE ARENA */}
              <div className="flex-1 flex flex-col items-center justify-center py-2">
                {playback ? (
                  /* Active Scoring Stage */
                  <div className="w-full flex flex-col items-center gap-4 py-4">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {playback.playedCards.map((card, idx) => {
                        const isScoring = playback.handEval.scoringCardIds.includes(card.id);
                        const isCurrent =
                          activeStep?.sourceType === 'card' && activeStep.sourceId === card.id;

                        let popup: string | null = null;
                        let popupKind: 'chips' | 'mult' | 'xmult' | 'money' | 'shatter' = 'chips';
                        if (isCurrent && activeStep) {
                          if (activeStep.shattered) {
                            popup = 'Shattered!';
                            popupKind = 'shatter';
                          } else if (activeStep.deltaMoney) {
                            popup = `+$${activeStep.deltaMoney}`;
                            popupKind = 'money';
                          } else if (activeStep.xMult) {
                            popup = `×${activeStep.xMult}`;
                            popupKind = 'xmult';
                          } else if (activeStep.deltaMult) {
                            popup = `+${activeStep.deltaMult} Mult`;
                            popupKind = 'mult';
                          } else if (activeStep.deltaChips) {
                            popup = `+${activeStep.deltaChips}`;
                            popupKind = 'chips';
                          }
                        }

                        return (
                          <motion.div
                            key={card.id}
                            initial={{ opacity: 0, y: 26, scale: 0.92 }}
                            animate={{ opacity: isScoring ? 1 : 0.45, y: isScoring ? 0 : 8, scale: 1 }}
                            transition={{
                              duration: 0.18,
                              delay: idx * 0.03,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                          >
                            <PlayingCard
                              card={card}
                              scoringActive={isCurrent}
                              debuffed={isCardDebuffed(card, bossId)}
                              popupText={popup}
                              popupKind={popupKind}
                              disabled
                            />
                          </motion.div>
                        );
                      })}
                    </div>

                    {playback.completed && (
                      <div className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-mono-num text-xl font-bold shadow-xl animate-score-pop">
                        +{playback.finalScore.toLocaleString()} Chips!
                      </div>
                    )}
                  </div>
                ) : room.status === 'finished' ? (
                  isSolo ? (
                    <div className="w-full max-w-lg rounded-2xl bg-[#0F181D]/95 border border-amber-400/50 p-6 sm:p-8 shadow-2xl text-center space-y-5">
                      <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                        <Crown className="w-8 h-8" />
                      </div>
                      <div>
                        <div className={`text-xs font-semibold ${room.winnerId ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {room.winnerId ? `Ante ${room.settings.maxAntes} Defeated` : `Defeated on Ante ${room.ante}`}
                        </div>
                        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-1">
                          {room.winnerId ? 'Solo Run Victory!' : 'Game Over'}
                        </h2>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-left">
                        <div className="rounded-xl bg-black/35 border border-white/10 p-3.5">
                          <div className="text-xs text-slate-400">Best Hand</div>
                          <div className="font-mono-num text-lg font-bold text-amber-300 mt-0.5">
                            {self.bestHandScore.toLocaleString()}
                          </div>
                        </div>
                        <div className="rounded-xl bg-black/35 border border-white/10 p-3.5">
                          <div className="text-xs text-slate-400">Total Run Score</div>
                          <div className="font-mono-num text-lg font-bold text-white mt-0.5">
                            {self.totalRunScore.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => sendMessage({ type: 'restart_room' })}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Play Again</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleLeaveRoom}
                          className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-white/10 cursor-pointer"
                        >
                          Main Menu
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-2xl rounded-2xl bg-[#0F181D]/95 border border-amber-400/50 p-6 sm:p-8 shadow-2xl text-center space-y-5">
                      <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                        <Crown className="w-8 h-8" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-amber-300">Match Complete</div>
                        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-1">
                          {room.winnerName} Wins!
                        </h2>
                      </div>

                      <div className="space-y-2 text-left">
                        {[...room.players]
                          .sort((a, b) => b.totalRunScore - a.totalRunScore)
                          .map((p, i) => (
                            <div
                              key={p.id}
                              className="rounded-xl bg-black/35 border border-white/10 px-4 py-3 flex items-center justify-between text-sm"
                            >
                              <span className="font-semibold text-white">
                                {i + 1}. {p.name}
                                {p.eliminated ? ' (Eliminated)' : ''}
                              </span>
                              <span className="font-mono-num text-amber-300 font-bold">
                                {p.totalRunScore.toLocaleString()} total · Best {p.bestHandScore.toLocaleString()}
                              </span>
                            </div>
                          ))}
                      </div>

                      {self.isHost ? (
                        <button
                          type="button"
                          onClick={() => sendMessage({ type: 'restart_room' })}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Play Again</span>
                        </button>
                      ) : (
                        <p className="text-xs text-slate-400">Waiting for Host to start a new match...</p>
                      )}
                    </div>
                  )
                ) : self.phase === 'eliminated' ? (
                  <div className="w-full max-w-lg rounded-2xl bg-[#1B1015]/95 border border-rose-500/40 p-6 text-center space-y-3 shadow-2xl">
                    <h2 className="font-display text-2xl font-bold text-rose-300">You Were Eliminated</h2>
                    <p className="text-sm text-slate-300">
                      You ran out of Hearts! Watch the remaining friends finish the run in the Standings rail.
                    </p>
                    <div className="font-mono-num text-xs text-slate-400">
                      Best Hand: {self.bestHandScore.toLocaleString()} · Total Run Score: {self.totalRunScore.toLocaleString()}
                    </div>
                  </div>
                ) : self.phase === 'blind_select' ? (
                  <BlindSelectPanel
                    room={room}
                    self={self}
                    onSelectBlind={(action) => sendMessage({ type: 'select_blind', action })}
                  />
                ) : self.phase === 'round_clear' && self.roundSummary ? (
                  <div className="w-full max-w-md rounded-2xl bg-[#0F181D]/95 border border-amber-400/40 p-6 shadow-2xl space-y-4">
                    <div className="text-center">
                      <div className="text-xs font-semibold text-emerald-400">
                        {self.roundSummary.won ? 'Blind Defeated!' : 'Blind Missed (-1 Heart)'}
                      </div>
                      <h2 className="font-display text-3xl font-bold text-white mt-0.5">Cash Out</h2>
                    </div>

                    <div className="space-y-2 border-y border-white/10 py-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-300">Blind Reward</span>
                        <span className="font-mono-num font-bold text-amber-300">
                          +${self.roundSummary.blindReward}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Remaining Hands ($1 each)</span>
                        <span className="font-mono-num font-bold text-blue-300">
                          +${self.roundSummary.handsBonus}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Interest ($1 per $5 held)</span>
                        <span className="font-mono-num font-bold text-amber-300">
                          +${self.roundSummary.interest}
                        </span>
                      </div>
                      {self.roundSummary.goldCardsBonus > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-300">Gold Cards in Hand</span>
                          <span className="font-mono-num font-bold text-amber-300">
                            +${self.roundSummary.goldCardsBonus}
                          </span>
                        </div>
                      )}
                      {!self.roundSummary.won && (
                        <div className="flex justify-between">
                          <span className="text-slate-300">Salvage Cash</span>
                          <span className="font-mono-num font-bold text-amber-300">+$1</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playCoin();
                        sendMessage({ type: 'continue_to_shop' });
                      }}
                      className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base transition-colors cursor-pointer"
                    >
                      Cash Out +${self.roundSummary.totalEarned} &amp; Visit Shop
                    </button>
                  </div>
                ) : self.phase === 'shop' ? (
                  <ShopPanel
                    self={self}
                    onBuyItem={(slotId) => {
                      sound.playCoin();
                      sendMessage({ type: 'buy_shop_item', slotId });
                    }}
                    onBuyPack={(packId) => {
                      sound.playCoin();
                      sendMessage({ type: 'buy_pack', packId });
                    }}
                    onPickBooster={(optionId) => {
                      sound.playSelect(2);
                      sendMessage({ type: 'pick_booster_option', optionId });
                    }}
                    onSkipBooster={() => sendMessage({ type: 'skip_booster' })}
                    onBuyVoucher={() => {
                      sound.playCoin();
                      sendMessage({ type: 'buy_voucher' });
                    }}
                    onReroll={() => {
                      sound.playSelect(0);
                      sendMessage({ type: 'reroll_shop' });
                    }}
                    onReadyNext={() => sendMessage({ type: 'ready_next_blind' })}
                  />
                ) : self.phase === 'waiting_next' ? (
                  <div className="w-full max-w-lg rounded-2xl bg-[#0F181D]/95 border border-white/12 p-6 text-center space-y-3 shadow-2xl">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h2 className="font-display text-2xl font-bold text-white">Ready for Next Blind</h2>
                    <p className="text-sm text-slate-300">
                      Waiting for friends to finish shopping ({room.players.filter((p) => p.phase === 'waiting_next').length}/
                      {room.players.filter((p) => !p.eliminated && p.connected).length} ready)
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-300/80 text-sm">
                    Select up to 5 cards from your hand to play a Poker Hand or Discard
                  </div>
                )}
              </div>

              {/* BOTTOM PLAYER HAND & ACTIONS */}
              {self.phase === 'playing_blind' && (
                <div className="rounded-2xl bg-black/30 border border-white/10 p-4 backdrop-blur-xs space-y-4">
                  {/* Hand of cards */}
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 min-h-[140px]">
                    <AnimatePresence mode="popLayout" custom={cardExitKind}>
                      {self.hand.map((card, idx) => {
                        const isHeldTrigger =
                          activeStep?.sourceType === 'held_card' && activeStep.sourceId === card.id;
                        return (
                          <motion.div
                            key={card.id}
                            layout="position"
                            custom={cardExitKind === 'discard' ? 'discard' : idx}
                            initial={{ opacity: 0, y: 22, x: 18, scale: 0.92 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              x: 0,
                              scale: 1,
                              transition: {
                                duration: 0.18,
                                delay: Math.min(idx * 0.022, 0.15),
                                ease: [0.16, 1, 0.3, 1],
                              },
                            }}
                            exit={
                              cardExitKind === 'play'
                                ? handCardVariants.exit('play')
                                : handCardVariants.exit('discard')
                            }
                          >
                            <PlayingCard
                              card={card}
                              selected={selectedCardIds.includes(card.id)}
                              debuffed={isCardDebuffed(card, bossId)}
                              scoringActive={isHeldTrigger}
                              popupText={isHeldTrigger ? '×1.5 Mult' : null}
                              popupKind="xmult"
                              disabled={Boolean(playback)}
                              onClick={() => toggleCardSelection(card.id)}
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={Boolean(playback) || selectedCardIds.length === 0 || self.handsLeft <= 0}
                      onClick={() => {
                        setCardExitKind('play');
                        sendMessage({ type: 'play_hand', cardIds: selectedCardIds });
                      }}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Play Hand ({selectedCardIds.length}/5)
                    </button>

                    <div className="flex items-center gap-1.5 rounded-xl bg-black/40 border border-white/10 p-1">
                      <button
                        type="button"
                        onClick={handleSortRank}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <span>Rank</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSortSuit}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <span>Suit</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={
                        Boolean(playback) || selectedCardIds.length === 0 || self.discardsLeft <= 0
                      }
                      onClick={() => {
                        setCardExitKind('discard');
                        sound.playDeselect();
                        sendMessage({ type: 'discard_cards', cardIds: selectedCardIds });
                      }}
                      className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Discard ({self.discardsLeft})
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* RIGHT FRIENDS RAIL (multiplayer only) */}
            {!isSolo && (
              <FriendsRail
                room={room}
                selfId={self.id}
                targetingHexName={targetingHexDef?.name || null}
                onSelectHexTarget={handleSelectHexTarget}
                onCancelHexTarget={() => setTargetingHexInstanceId(null)}
                onSendChat={(text) => sendMessage({ type: 'send_chat', text })}
              />
            )}
          </div>
        )}
      </main>

      {showRunInfo && self && (
        <RunInfoModal self={self} onClose={() => setShowRunInfo(false)} />
      )}
    </div>
    </MotionConfig>
  );
}
