import React from 'react';
import { RefreshCw, ArrowRight, Package, Tag } from 'lucide-react';
import { CONSUMABLE_MAP, JOKER_MAP } from '../../shared/catalog';
import { PlayerState } from '../../shared/types';

interface ShopPanelProps {
  self: PlayerState;
  onBuyItem: (slotId: string) => void;
  onBuyPack: (packId: string) => void;
  onPickBooster: (optionId: string) => void;
  onSkipBooster: () => void;
  onBuyVoucher: () => void;
  onReroll: () => void;
  onReadyNext: () => void;
}

export const ShopPanel: React.FC<ShopPanelProps> = ({
  self,
  onBuyItem,
  onBuyPack,
  onPickBooster,
  onSkipBooster,
  onBuyVoucher,
  onReroll,
  onReadyNext,
}) => {
  const rerollPrice = self.freeRerolls > 0 ? 0 : self.rerollCost;

  if (self.activeBooster) {
    return (
      <div className="w-full max-w-3xl mx-auto rounded-2xl bg-[#10181D]/95 border border-amber-400/30 p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">{self.activeBooster.packName}</h2>
            <p className="text-sm text-slate-300">
              {self.activeBooster.packKind === 'celestial'
                ? 'Choose 1 Planet card to immediately level up a Poker Hand'
                : 'Choose 1 card to add to your roster'}
            </p>
          </div>
          <button
            type="button"
            onClick={onSkipBooster}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-white/10 whitespace-nowrap shrink-0"
          >
            Skip Pack
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {self.activeBooster.options.map((opt) => {
            const isJoker = opt.kind === 'joker';
            const def = isJoker ? JOKER_MAP[opt.itemId] : CONSUMABLE_MAP[opt.itemId];
            if (!def) return null;

            return (
              <button
                key={opt.optionId}
                type="button"
                onClick={() => onPickBooster(opt.optionId)}
                className="group text-left rounded-xl bg-[#17232B] hover:bg-[#1E2E38] border border-white/15 hover:border-amber-400 p-4 transition-all flex flex-col justify-between gap-3 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-amber-300">
                      {isJoker ? (JOKER_MAP[opt.itemId]?.rarity || 'Joker') : (CONSUMABLE_MAP[opt.itemId]?.type.toUpperCase())}
                    </span>
                    {opt.edition !== 'none' && (
                      <span className="text-[10px] font-bold uppercase text-cyan-300">{opt.edition}</span>
                    )}
                  </div>
                  <div className="font-display text-lg font-bold text-white group-hover:text-amber-200">
                    {def.name}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">{def.description}</p>
                </div>
                <div className="pt-2 border-t border-white/10 text-xs font-semibold text-emerald-400">
                  {self.activeBooster?.packKind === 'celestial' ? 'Use Now' : 'Select Card'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl bg-[#0F171C]/95 border border-white/12 p-5 sm:p-6 shadow-2xl">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">The Shop</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Upgrade your Jokers, consumables, and deck before the next Blind
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReroll}
            disabled={self.money < rerollPrice}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reroll</span>
            <span className="font-mono-num text-amber-200">
              {rerollPrice === 0 ? 'FREE' : `$${rerollPrice}`}
            </span>
          </button>

          <button
            type="button"
            onClick={onReadyNext}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Next Blind</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Shop Cards */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Cards for sale */}
        <div className="md:col-span-7">
          <h3 className="text-xs font-semibold text-slate-400 mb-3">Cards &amp; Jokers</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {self.shopItems.map((item) => {
              const isJoker = item.kind === 'joker';
              const def = isJoker ? JOKER_MAP[item.itemId] : CONSUMABLE_MAP[item.itemId];
              if (!def) return null;
              const canAfford = self.money >= item.cost;

              return (
                <div
                  key={item.slotId}
                  className={`rounded-xl border p-3 flex flex-col justify-between gap-3 transition-colors ${
                    item.sold
                      ? 'bg-slate-900/40 border-white/5 opacity-45'
                      : 'bg-[#17232A] border-white/12'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400 mb-1">
                      <span>
                        {isJoker
                          ? JOKER_MAP[item.itemId]?.rarity
                          : CONSUMABLE_MAP[item.itemId]?.type === 'planet'
                          ? 'Planet'
                          : CONSUMABLE_MAP[item.itemId]?.type === 'hex'
                          ? 'PvP Hex'
                          : 'Tarot'}
                      </span>
                      {item.edition !== 'none' && (
                        <span className="text-cyan-300 font-semibold uppercase text-[10px]">
                          {item.edition}
                        </span>
                      )}
                    </div>
                    <div className="font-display text-base font-bold text-white leading-tight">
                      {def.name}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300 leading-snug">{def.description}</p>
                  </div>

                  <button
                    type="button"
                    disabled={item.sold || !canAfford}
                    onClick={() => onBuyItem(item.slotId)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-mono-num text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    {item.sold ? 'Sold' : `Buy $${item.cost}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Voucher + Booster Packs */}
        <div className="md:col-span-5 flex flex-col gap-4">
          {/* Voucher */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              <span>Run Voucher</span>
            </h3>
            {self.shopVoucher ? (
              <div className="rounded-xl bg-[#1A2030] border border-indigo-400/25 p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-base font-bold text-indigo-100">
                    {self.shopVoucher.name}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">{self.shopVoucher.description}</p>
                </div>
                <button
                  type="button"
                  disabled={self.money < self.shopVoucher.cost}
                  onClick={onBuyVoucher}
                  className="px-3.5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-mono-num text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  Buy ${self.shopVoucher.cost}
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-900/40 border border-white/5 p-3.5 text-xs text-slate-500">
                Voucher claimed for this round
              </div>
            )}
          </div>

          {/* Booster Packs */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              <span>Booster Packs</span>
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {self.shopPacks.length === 0 ? (
                <div className="rounded-xl bg-slate-900/40 border border-white/5 p-3 text-xs text-slate-500">
                  No packs remaining this shop
                </div>
              ) : (
                self.shopPacks.map((pack) => (
                  <div
                    key={pack.id}
                    className="rounded-xl bg-[#17232A] border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{pack.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{pack.description}</div>
                    </div>
                    <button
                      type="button"
                      disabled={self.money < pack.cost}
                      onClick={() => onBuyPack(pack.id)}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-mono-num text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Open ${pack.cost}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
