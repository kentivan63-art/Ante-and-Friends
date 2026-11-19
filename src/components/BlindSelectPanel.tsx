import React from 'react';
import { Swords, Play, FastForward, Skull } from 'lucide-react';
import { getAnteBaseChips } from '../../shared/catalog';
import { PlayerState, RoomPublicState } from '../../shared/types';

interface BlindSelectPanelProps {
  room: RoomPublicState;
  self: PlayerState;
  onSelectBlind: (action: 'play' | 'skip') => void;
}

export const BlindSelectPanel: React.FC<BlindSelectPanelProps> = ({
  room,
  self,
  onSelectBlind,
}) => {
  const baseChips = getAnteBaseChips(room.ante);
  const cards = [
    {
      index: 0,
      title: 'Small Blind',
      target: Math.round(baseChips * 1.0),
      reward: '$3',
      rule: 'Standard blind · No modifier',
      canSkip: true,
    },
    {
      index: 1,
      title: 'Big Blind',
      target: Math.round(baseChips * 1.5),
      reward: '$4',
      rule: 'Higher chip target · No modifier',
      canSkip: true,
    },
    {
      index: 2,
      title: room.currentBoss.name,
      target: Math.round(baseChips * room.currentBoss.multiplier),
      reward: room.settings.mode === 'versus' ? '$5 + $5 PvP Bounty' : '$5',
      rule: room.currentBoss.description,
      canSkip: false,
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      {room.lastBossShowdown && (
        <div className="rounded-xl bg-[#1A1420]/95 border border-amber-400/35 p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-amber-300 font-display font-bold text-lg">
              <Swords className="w-5 h-5" />
              <span>
                Ante {room.lastBossShowdown.ante} Boss Showdown — {room.lastBossShowdown.bossName}
              </span>
            </div>
            <span className="text-xs text-slate-300">
              Top Scorer: <strong className="text-emerald-300">{room.lastBossShowdown.winnerName} (+$5)</strong>
              {room.lastBossShowdown.loserNames.length > 0 && (
                <>
                  {' · '}Lost ♥: <strong className="text-rose-400">{room.lastBossShowdown.loserNames.join(', ')}</strong>
                </>
              )}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {room.lastBossShowdown.standings.map((st, idx) => (
              <div
                key={st.playerId}
                className="rounded-lg bg-black/30 px-3 py-2 flex items-center justify-between text-xs border border-white/5"
              >
                <span className="text-slate-200 truncate">
                  {idx + 1}. {st.playerName}
                </span>
                <span className="font-mono-num font-bold text-amber-300">
                  {st.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-[#0F171C]/95 border border-white/12 p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Ante {room.ante} of {room.settings.maxAntes}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select the active Blind to deal your hand, or skip Small/Big Blinds for a Tag bonus
            </p>
          </div>
          {self.pendingHexes.length > 0 && (
            <div className="text-xs text-rose-300 font-medium">
              Active Hexes: {self.pendingHexes.map((h) => h.name).join(', ')}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((c) => {
            const isCurrent = room.blindIndex === c.index;
            const isPast = room.blindIndex > c.index;
            const isBoss = c.index === 2;

            return (
              <div
                key={c.index}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-4 transition-all ${
                  isCurrent
                    ? isBoss
                      ? 'bg-[#251319] border-rose-400/70 shadow-[0_0_24px_rgba(244,63,94,0.18)]'
                      : 'bg-[#152724] border-amber-400/80 shadow-[0_0_24px_rgba(245,158,11,0.15)]'
                    : isPast
                    ? 'bg-slate-900/45 border-white/5 opacity-50'
                    : 'bg-[#141D24] border-white/10 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>{isBoss ? 'Boss Blind' : `Round ${c.index + 1}`}</span>
                    <span>{isPast ? 'Cleared' : isCurrent ? 'Active' : 'Upcoming'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isBoss && <Skull className="w-5 h-5 text-rose-400 shrink-0" />}
                    <h3 className="font-display text-xl font-bold text-white">{c.title}</h3>
                  </div>

                  <div className="mt-3 rounded-lg bg-black/35 border border-white/10 p-3">
                    <div className="text-[11px] text-slate-400">Score at least</div>
                    <div className="text-2xl font-mono-num font-bold text-rose-400 mt-0.5">
                      {c.target.toLocaleString()}
                    </div>
                    <div className="text-xs text-amber-300 font-mono-num mt-1">
                      Reward: {c.reward}
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-300 leading-relaxed">{c.rule}</p>
                </div>

                {isCurrent ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectBlind('play')}
                      className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Play Blind</span>
                    </button>
                    {c.canSkip && (
                      <button
                        type="button"
                        onClick={() => onSelectBlind('skip')}
                        className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                        <span>Skip Blind for Tag</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs font-medium text-slate-500">
                    {isPast ? 'Completed' : 'Locked until prior blind clears'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
