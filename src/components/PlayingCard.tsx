import React from 'react';
import { PlayingCard as PlayingCardType } from '../../shared/types';
import {
  applyEnhancementLabel,
  rankToLabel,
  suitToSymbol,
} from '../../shared/engine';

interface PlayingCardProps {
  card: PlayingCardType;
  selected?: boolean;
  debuffed?: boolean;
  scoringActive?: boolean;
  popupText?: string | null;
  popupKind?: 'chips' | 'mult' | 'xmult' | 'money' | 'shatter';
  onClick?: () => void;
  compact?: boolean;
  disabled?: boolean;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  selected = false,
  debuffed = false,
  scoringActive = false,
  popupText = null,
  popupKind = 'chips',
  onClick,
  compact = false,
  disabled = false,
}) => {
  const isStone = card.enhancement === 'stone';
  const isRed = !isStone && (card.suit === 'hearts' || card.suit === 'diamonds');
  const rankStr = isStone ? 'STN' : rankToLabel(card.rank);
  const suitStr = isStone ? '◆' : suitToSymbol(card.suit);

  const enhancementBg: Record<string, string> = {
    none: 'bg-[#FBF9F5] border-slate-300',
    bonus: 'bg-sky-50 border-blue-400',
    mult: 'bg-rose-50 border-red-400',
    wild: 'bg-gradient-to-br from-rose-50 via-amber-50 to-emerald-50 border-amber-400',
    glass: 'bg-gradient-to-br from-cyan-50/90 to-slate-100/95 border-cyan-300',
    steel: 'bg-gradient-to-br from-slate-200 to-slate-300 border-slate-500',
    stone: 'bg-gradient-to-br from-stone-400 to-stone-500 border-stone-600 text-stone-900',
    gold: 'bg-gradient-to-br from-amber-100 via-yellow-200 to-amber-300 border-amber-500',
    lucky: 'bg-gradient-to-br from-emerald-50 to-amber-50 border-emerald-400',
  };

  const editionOverlay =
    card.edition === 'foil'
      ? 'edition-foil'
      : card.edition === 'holo'
      ? 'edition-holo'
      : card.edition === 'polychrome'
      ? 'edition-polychrome'
      : '';

  const sealColors: Record<string, string> = {
    red: 'bg-red-600 border-red-200',
    gold: 'bg-amber-500 border-amber-100',
    blue: 'bg-blue-600 border-blue-200',
    purple: 'bg-purple-600 border-purple-200',
  };

  const popupColors: Record<string, string> = {
    chips: 'bg-blue-600 text-white border-blue-300',
    mult: 'bg-red-600 text-white border-red-300',
    xmult: 'bg-red-700 text-amber-200 border-amber-300',
    money: 'bg-amber-500 text-slate-950 border-amber-200',
    shatter: 'bg-slate-800 text-cyan-200 border-cyan-400',
  };

  const suitColorClass = isStone
    ? 'text-stone-800'
    : card.enhancement === 'wild'
    ? 'text-amber-700'
    : isRed
    ? 'text-red-600'
    : 'text-slate-900';

  const sizeClass = compact
    ? 'w-[68px] h-[96px] rounded-lg'
    : 'w-[84px] sm:w-[92px] h-[120px] sm:h-[132px] rounded-xl';

  const enhLabel = applyEnhancementLabel(card.enhancement);

  return (
    <div className="relative group select-none">
      {popupText && (
        <div
          className={`absolute -top-8 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded-md border text-xs font-mono-num font-bold shadow-lg whitespace-nowrap animate-score-pop ${popupColors[popupKind]}`}
        >
          {popupText}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        title={[
          isStone ? 'Stone Card (+50 Chips)' : `${rankStr} of ${card.suit}`,
          enhLabel,
          card.edition !== 'none' ? `Edition: ${card.edition}` : '',
          card.seal !== 'none' ? `${card.seal} seal` : '',
          debuffed ? 'DEBUFFED by Boss Blind' : '',
        ]
          .filter(Boolean)
          .join(' · ')}
        className={`relative ${sizeClass} border-2 shadow-md transition-transform duration-150 ease-out flex flex-col justify-between p-1.5 sm:p-2 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          enhancementBg[card.enhancement] || enhancementBg.none
        } ${
          selected
            ? '-translate-y-5 ring-2 ring-amber-400 shadow-[0_12px_24px_rgba(0,0,0,0.5)] z-10'
            : scoringActive
            ? '-translate-y-3 ring-2 ring-blue-400 shadow-[0_10px_22px_rgba(37,99,235,0.45)] z-10'
            : 'hover:-translate-y-2'
        } ${debuffed ? 'opacity-65 grayscale-[45%]' : ''} ${
          disabled ? 'cursor-default' : 'cursor-pointer'
        }`}
      >
        {/* Edition shimmer */}
        {editionOverlay && (
          <div className={`pointer-events-none absolute inset-0 ${editionOverlay}`} />
        )}

        {/* Debuffed X */}
        {debuffed && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20 bg-red-950/35">
            <span className="text-4xl font-bold text-red-500 drop-shadow">✕</span>
          </div>
        )}

        {/* Seal */}
        {card.seal !== 'none' && (
          <div
            className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full border shadow-sm z-10 ${sealColors[card.seal]}`}
          />
        )}

        {/* Top-left rank + suit */}
        <div className={`relative z-10 flex flex-col items-center leading-none w-fit ${suitColorClass}`}>
          <span className={`${compact ? 'text-sm' : 'text-base sm:text-lg'} font-bold tracking-tight font-mono-num`}>
            {rankStr}
          </span>
          <span className={`${compact ? 'text-xs' : 'text-sm'} leading-none`}>{suitStr}</span>
        </div>

        {/* Center pip */}
        <div className={`relative z-10 flex flex-col items-center justify-center ${suitColorClass}`}>
          <span className={`${compact ? 'text-2xl' : 'text-3xl sm:text-4xl'} leading-none drop-shadow-xs`}>
            {isStone ? '🪨' : suitStr}
          </span>
          {card.enhancement !== 'none' && (
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider px-1 rounded bg-black/10 text-slate-900">
              {card.enhancement}
            </span>
          )}
        </div>

        {/* Bottom-right inverted rank + suit */}
        <div
          className={`relative z-10 flex flex-col items-center leading-none w-fit self-end rotate-180 ${suitColorClass}`}
        >
          <span className={`${compact ? 'text-sm' : 'text-base sm:text-lg'} font-bold tracking-tight font-mono-num`}>
            {rankStr}
          </span>
          <span className={`${compact ? 'text-xs' : 'text-sm'} leading-none`}>{suitStr}</span>
        </div>
      </button>
    </div>
  );
};
