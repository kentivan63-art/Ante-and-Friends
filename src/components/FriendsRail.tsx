import React, { useState } from 'react';
import { Heart, Send, Crosshair } from 'lucide-react';
import { JOKER_MAP } from '../../shared/catalog';
import { PublicPlayerSummary, RoomPublicState } from '../../shared/types';

interface FriendsRailProps {
  room: RoomPublicState;
  selfId: string;
  targetingHexName: string | null;
  onSelectHexTarget: (targetId: string) => void;
  onCancelHexTarget: () => void;
  onSendChat: (text: string) => void;
}

const phaseLabel: Record<string, string> = {
  blind_select: 'Choosing Blind',
  playing_blind: 'Playing Hand',
  round_clear: 'Round Clear',
  shop: 'In Shop',
  waiting_next: 'Ready',
  eliminated: 'Eliminated',
};

export const FriendsRail: React.FC<FriendsRailProps> = ({
  room,
  selfId,
  targetingHexName,
  onSelectHexTarget,
  onCancelHexTarget,
  onSendChat,
}) => {
  const [chatInput, setChatInput] = useState('');

  const sortedPlayers = [...room.players].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (room.status === 'playing' && b.score !== a.score) return b.score - a.score;
    return b.totalRunScore - a.totalRunScore;
  });

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  return (
    <aside className="w-full lg:w-[290px] shrink-0 flex flex-col gap-3 rounded-2xl bg-[#0D1519]/95 border border-white/10 p-3.5 shadow-xl h-full max-h-[calc(100vh-88px)]">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
        <h2 className="font-display text-base font-bold text-white">Table Standings</h2>
        <span className="text-xs text-slate-400 font-mono-num">
          {room.players.filter((p) => !p.eliminated).length}/{room.players.length} Active
        </span>
      </div>

      {targetingHexName && (
        <div className="rounded-lg bg-rose-950/80 border border-rose-400/50 p-2.5 text-xs flex items-center justify-between gap-2">
          <span className="text-rose-100">
            Click an opponent to cast <strong>{targetingHexName}</strong>
          </span>
          <button
            type="button"
            onClick={onCancelHexTarget}
            className="px-2 py-0.5 rounded bg-rose-800 hover:bg-rose-700 text-white text-[11px] font-semibold shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Player list */}
      <div className="space-y-2.5 overflow-y-auto pr-0.5 max-h-[340px]">
        {sortedPlayers.map((p: PublicPlayerSummary) => {
          const isMe = p.id === selfId;
          const pct = p.targetScore > 0 ? Math.min(100, Math.round((p.score / p.targetScore) * 100)) : 0;
          const canTarget = Boolean(targetingHexName && !isMe && !p.eliminated);

          return (
            <div
              key={p.id}
              onClick={canTarget ? () => onSelectHexTarget(p.id) : undefined}
              className={`rounded-xl border p-2.5 transition-colors ${
                canTarget
                  ? 'cursor-pointer bg-rose-950/40 border-rose-400 hover:bg-rose-900/50'
                  : isMe
                  ? 'bg-[#152522] border-amber-400/45'
                  : 'bg-[#121C22] border-white/10'
              } ${p.eliminated ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-bold text-white truncate">
                    {p.name}
                    {isMe ? ' (You)' : ''}
                  </span>
                  {canTarget && <Crosshair className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                </div>
                <span className="text-[11px] text-slate-300 whitespace-nowrap shrink-0">
                  {p.connected ? phaseLabel[p.phase] || p.phase : 'Offline'}
                </span>
              </div>

              {/* Stats row */}
              <div className="mt-1.5 flex items-center justify-between text-xs font-mono-num">
                <div className="flex items-center gap-2">
                  {room.settings.mode === 'versus' && (
                    <span className="inline-flex items-center gap-0.5 text-rose-400">
                      <Heart className="w-3 h-3 fill-current" />
                      {p.lives}
                    </span>
                  )}
                  <span className="text-amber-300 font-semibold">${p.money}</span>
                </div>
                <span className="text-slate-300">
                  {p.score.toLocaleString()} / {p.targetScore.toLocaleString()}
                </span>
              </div>

              {/* Score bar */}
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-black/50 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    pct >= 100 ? 'bg-emerald-400' : 'bg-blue-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Friend's mini Joker strip */}
              {p.jokers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.jokers.map((j) => {
                    const def = JOKER_MAP[j.jokerId];
                    if (!def) return null;
                    return (
                      <span
                        key={j.instanceId}
                        title={`${def.name}: ${def.description}`}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white border border-white/15 truncate max-w-[90px]"
                        style={{ backgroundColor: def.accentColor }}
                      >
                        {def.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Room Activity & Chat */}
      <div className="mt-auto pt-2 border-t border-white/10 flex flex-col min-h-[170px] max-h-[240px]">
        <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Table Feed</div>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
          {room.activity.map((act) => (
            <div key={act.id} className="leading-snug break-words">
              {act.kind === 'chat' ? (
                <p className="text-slate-200">
                  <span className="font-bold text-amber-300">{act.senderName}: </span>
                  {act.text}
                </p>
              ) : act.kind === 'hex' ? (
                <p className="text-rose-300">{act.text}</p>
              ) : act.kind === 'boss' ? (
                <p className="text-amber-300 font-medium">{act.text}</p>
              ) : act.kind === 'score' ? (
                <p className="text-sky-300">{act.text}</p>
              ) : (
                <p className="text-slate-400">{act.text}</p>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleChatSubmit} className="mt-2 flex items-center gap-1.5">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Message friends..."
            maxLength={140}
            className="flex-1 min-w-0 rounded-lg bg-black/40 border border-white/12 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            aria-label="Send message"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
};
