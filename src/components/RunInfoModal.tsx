import React from 'react';
import { X } from 'lucide-react';
import { BASE_HAND_DEFS } from '../../shared/catalog';
import { PlayerState, PokerHandId } from '../../shared/types';

interface RunInfoModalProps {
  self: PlayerState;
  onClose: () => void;
}

export const RunInfoModal: React.FC<RunInfoModalProps> = ({ self, onClose }) => {
  const orderedHands = (Object.keys(BASE_HAND_DEFS) as PokerHandId[]).sort(
    (a, b) => BASE_HAND_DEFS[a].order - BASE_HAND_DEFS[b].order
  );

  const suitCounts = {
    spades: self.deck.filter((c) => c.suit === 'spades' && c.enhancement !== 'stone').length,
    hearts: self.deck.filter((c) => c.suit === 'hearts' && c.enhancement !== 'stone').length,
    clubs: self.deck.filter((c) => c.suit === 'clubs' && c.enhancement !== 'stone').length,
    diamonds: self.deck.filter((c) => c.suit === 'diamonds' && c.enhancement !== 'stone').length,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#10181D] border border-white/15 p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Run Info &amp; Poker Hands</h2>
            <p className="text-xs text-slate-400">
              Current Planet levels and remaining draw pile composition ({self.deck.length} cards left in deck)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Run Info"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Remaining Deck Suits */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-black/35 border border-white/10 py-2">
            <span className="text-lg text-slate-100">♠</span>
            <div className="text-xs font-mono-num font-bold text-slate-200">{suitCounts.spades}</div>
          </div>
          <div className="rounded-lg bg-black/35 border border-white/10 py-2">
            <span className="text-lg text-red-500">♥</span>
            <div className="text-xs font-mono-num font-bold text-slate-200">{suitCounts.hearts}</div>
          </div>
          <div className="rounded-lg bg-black/35 border border-white/10 py-2">
            <span className="text-lg text-emerald-400">♣</span>
            <div className="text-xs font-mono-num font-bold text-slate-200">{suitCounts.clubs}</div>
          </div>
          <div className="rounded-lg bg-black/35 border border-white/10 py-2">
            <span className="text-lg text-orange-400">♦</span>
            <div className="text-xs font-mono-num font-bold text-slate-200">{suitCounts.diamonds}</div>
          </div>
        </div>

        {/* Poker Hand Table */}
        <div className="mt-4 divide-y divide-white/8 border border-white/10 rounded-xl overflow-hidden bg-black/25">
          {orderedHands.map((id) => {
            const h = self.handLevels[id];
            return (
              <div key={id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono-num text-xs font-bold text-cyan-300 w-10">
                    Lv.{h.level}
                  </span>
                  <span className="font-semibold text-white">{h.name}</span>
                </div>
                <div className="flex items-center gap-4 font-mono-num text-xs">
                  <span className="px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold">
                    {h.chips}
                  </span>
                  <span className="text-slate-500">×</span>
                  <span className="px-2 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-500/30 font-bold">
                    {h.mult}
                  </span>
                  <span className="text-slate-400 w-14 text-right">#{h.playedCount}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
