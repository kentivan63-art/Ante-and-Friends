import React, { useState } from 'react';
import { Copy, Check, Users, Swords, Trophy, Play } from 'lucide-react';
import { GameMode, RoomPublicState, RoomSettings } from '../../shared/types';

interface LobbyScreenProps {
  initialRoomCode: string;
  room: RoomPublicState | null;
  selfId: string | null;
  errorMsg: string | null;
  onCreateRoom: (playerName: string, settings: Partial<RoomSettings>) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onUpdateSettings: (settings: Partial<RoomSettings>) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  initialRoomCode,
  room,
  selfId,
  errorMsg,
  onCreateRoom,
  onJoinRoom,
  onUpdateSettings,
  onStartGame,
  onLeaveRoom,
}) => {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [mode, setMode] = useState<GameMode>('versus');
  const [sabotage, setSabotage] = useState(true);
  const [maxAntes, setMaxAntes] = useState(8);
  const [soloAntes, setSoloAntes] = useState<4 | 8>(8);
  const [copied, setCopied] = useState(false);

  const isHost = Boolean(room?.players.find((p) => p.id === selfId)?.isHost);

  const handleCopyInvite = () => {
    if (!room) return;
    const url = `${window.location.origin}?room=${room.roomCode}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Waiting Room View once joined/created
  if (room) {
    return (
      <div className="min-h-[calc(100vh-68px)] flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl rounded-2xl bg-[#0F181D]/95 border border-white/12 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div>
              <div className="text-xs text-slate-400">Room Lobby</div>
              <div className="flex items-center gap-3 mt-1">
                <h1 className="font-display text-3xl font-bold text-white tracking-tight">
                  Room <span className="font-mono-num text-amber-400">{room.roomCode}</span>
                </h1>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-white/10 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Invite Copied' : 'Copy Invite Link'}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onLeaveRoom}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-white/10 cursor-pointer"
            >
              Leave Room
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Players */}
            <div className="md:col-span-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Players at the Table ({room.players.length}/6)</span>
                </h2>
              </div>
              <div className="space-y-2">
                {room.players.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                      p.id === selfId
                        ? 'bg-[#152522] border-amber-400/50'
                        : 'bg-[#141E24] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-white">{p.name}</span>
                      {p.id === selfId && (
                        <span className="text-xs text-amber-300">You</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">
                      {p.isHost ? 'Host' : 'Player'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Share the invite link or room code <strong className="font-mono-num text-amber-300">{room.roomCode}</strong> with friends so they can join before you deal.
              </p>
            </div>

            {/* Match Rules */}
            <div className="md:col-span-6 flex flex-col justify-between gap-4 rounded-xl bg-[#131C22] border border-white/10 p-5">
              <div className="space-y-4">
                <h2 className="font-display text-lg font-bold text-white">Match Rules</h2>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Game Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => onUpdateSettings({ mode: 'versus' })}
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        room.settings.mode === 'versus'
                          ? 'bg-rose-950/60 border-rose-400 text-white'
                          : 'bg-black/25 border-white/10 text-slate-400'
                      } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Swords className="w-3.5 h-3.5 text-rose-400" />
                        <span>Versus Showdown</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Lives system + Boss Blind PvP duels
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => onUpdateSettings({ mode: 'race' })}
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        room.settings.mode === 'race'
                          ? 'bg-sky-950/60 border-sky-400 text-white'
                          : 'bg-black/25 border-white/10 text-slate-400'
                      } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Trophy className="w-3.5 h-3.5 text-sky-400" />
                        <span>Score Race</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        No elimination, highest total chips wins
                      </p>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Run Length</label>
                    <div className="flex gap-2">
                      {[4, 8].map((a) => (
                        <button
                          key={a}
                          type="button"
                          disabled={!isHost}
                          onClick={() => onUpdateSettings({ maxAntes: a })}
                          className={`flex-1 py-2 rounded-lg border text-xs font-mono-num font-bold ${
                            room.settings.maxAntes === a
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-black/25 text-slate-300 border-white/10'
                          } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          {a} Antes
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">PvP Sabotage Hexes</label>
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => onUpdateSettings({ sabotageEnabled: !room.settings.sabotageEnabled })}
                      className={`w-full py-2 px-3 rounded-lg border text-xs font-bold ${
                        room.settings.sabotageEnabled
                          ? 'bg-emerald-600/80 border-emerald-400 text-white'
                          : 'bg-black/25 border-white/10 text-slate-400'
                      } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      {room.settings.sabotageEnabled ? 'Enabled in Shop' : 'Off (Pure Skill)'}
                    </button>
                  </div>
                </div>
              </div>

              {isHost ? (
                <button
                  type="button"
                  onClick={onStartGame}
                  className="w-full py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Match</span>
                </button>
              ) : (
                <div className="py-3 text-center text-sm text-slate-400 border border-white/10 rounded-xl bg-black/20">
                  Waiting for Host to start the match...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Title Menu & Join/Create Screen
  return (
    <div className="min-h-[calc(100vh-68px)] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Title & Rules Card */}
        <div className="lg:col-span-6 rounded-2xl bg-[#0F181D]/95 border border-white/12 p-6 sm:p-8 shadow-2xl flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-amber-400/40 bg-slate-900 shrink-0 flex items-center justify-center">
                <img
                  src="/src/assets/images/joker_crest_emblem_1794933722782.jpg"
                  alt="Ante & Friends Joker Crest"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight text-balance">
                  Ante &amp; Friends
                </h1>
                <p className="text-sm text-amber-300 font-medium mt-0.5">
                  Multiplayer Roguelike Poker Deckbuilder
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Play illegal poker hands, stack synergies across 32 Jokers, level up hands with Planet cards, enhance your deck with Tarots, and outscore your friends in live Boss Blind showdowns.
            </p>

            <div className="mt-6 space-y-3 pt-5 border-t border-white/10 text-xs text-slate-300">
              <div className="flex items-start gap-3">
                <span className="font-mono-num font-bold text-blue-400 shrink-0">01.</span>
                <span>
                  <strong className="text-white">Chips × Mult Engine:</strong> Every poker hand starts with base Chips and Mult. Scored cards trigger left-to-right, then Jokers multiply your total.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-mono-num font-bold text-amber-400 shrink-0">02.</span>
                <span>
                  <strong className="text-white">Shop Between Blinds:</strong> Earn cash from Blinds, unused hands, and $1 interest per $5 held. Buy Jokers, Packs, Vouchers, and PvP Hexes.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-mono-num font-bold text-rose-400 shrink-0">03.</span>
                <span>
                  <strong className="text-white">Boss Showdowns:</strong> At the end of every Ante, everyone faces the same Boss Blind modifier. Highest score steals a +$5 bounty; lowest loses a heart.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Create / Join Form */}
        <div className="lg:col-span-6 rounded-2xl bg-[#0F181D]/95 border border-white/12 p-6 sm:p-8 shadow-2xl flex flex-col justify-between gap-5">
          <div className="space-y-5">
            {errorMsg && (
              <div className="rounded-lg bg-rose-950/80 border border-rose-400/50 px-4 py-2.5 text-xs text-rose-100">
                {errorMsg}
              </div>
            )}

            <div>
              <label htmlFor="player-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Your Name at the Table
              </label>
              <input
                id="player-name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter nickname..."
                maxLength={18}
                className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Solo Run */}
            <div className="rounded-xl bg-[#142220] border border-emerald-400/25 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white">Solo Run</h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Classic single-player run to Ante {soloAntes} — no waiting lobby
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-black/40 border border-white/10">
                  {([4, 8] as const).map((antes) => (
                    <button
                      key={antes}
                      type="button"
                      onClick={() => setSoloAntes(antes)}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono-num font-bold transition-colors cursor-pointer ${
                        soloAntes === antes
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {antes} Antes
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onCreateRoom(playerName || 'Solo Player', {
                    mode: 'solo',
                    maxAntes: soloAntes,
                    sabotageEnabled: false,
                  })
                }
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Solo ({soloAntes} Antes)</span>
              </button>
            </div>

            {/* Join Existing Room */}
            <div className="rounded-xl bg-[#141F26] border border-white/10 p-4 space-y-3">
              <h2 className="text-sm font-bold text-white">Join a Friend&apos;s Room</h2>
              <div className="flex gap-2.5">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  maxLength={6}
                  className="flex-1 rounded-lg bg-black/45 border border-white/15 px-3.5 py-2.5 font-mono-num text-sm uppercase tracking-widest text-amber-300 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => onJoinRoom(joinCode, playerName || 'Player')}
                  disabled={!joinCode.trim()}
                  className="px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Join Table
                </button>
              </div>
            </div>

            {/* Create New Room */}
            <div className="rounded-xl bg-[#141F26] border border-white/10 p-4 space-y-3">
              <h2 className="text-sm font-bold text-white">Host a Multiplayer Room</h2>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'versus' ? 'race' : 'versus')}
                  className="py-2 px-2.5 rounded-lg bg-black/35 border border-white/12 text-slate-200 hover:border-amber-400/50 font-medium cursor-pointer"
                >
                  {mode === 'versus' ? 'Mode: Versus' : 'Mode: Race'}
                </button>
                <button
                  type="button"
                  onClick={() => setMaxAntes(maxAntes === 8 ? 4 : 8)}
                  className="py-2 px-2.5 rounded-lg bg-black/35 border border-white/12 text-slate-200 hover:border-amber-400/50 font-mono-num font-medium cursor-pointer"
                >
                  {maxAntes} Antes
                </button>
                <button
                  type="button"
                  onClick={() => setSabotage(!sabotage)}
                  className="py-2 px-2.5 rounded-lg bg-black/35 border border-white/12 text-slate-200 hover:border-amber-400/50 font-medium cursor-pointer"
                >
                  Hexes: {sabotage ? 'On' : 'Off'}
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  onCreateRoom(playerName || 'Host', {
                    mode,
                    maxAntes,
                    sabotageEnabled: sabotage,
                  })
                }
                className="w-full py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Create Room &amp; Invite Friends
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
