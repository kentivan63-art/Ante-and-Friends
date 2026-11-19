import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, HelpCircle } from 'lucide-react';
import { JOKER_MAP } from '../../shared/catalog';
import { OwnedJoker } from '../../shared/types';
import { JokerSynergyInfo } from '../utils/jokerHelper';

interface JokerCardProps {
  joker: OwnedJoker;
  index: number;
  total: number;
  activeStep?: boolean;
  popupText?: string | null;
  synergy?: JokerSynergyInfo;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onSell?: () => void;
  canReorder?: boolean;
}

export const JokerCard: React.FC<JokerCardProps> = ({
  joker,
  index,
  total,
  activeStep = false,
  popupText = null,
  synergy,
  onMoveLeft,
  onMoveRight,
  onSell,
  canReorder = true,
}) => {
  const [cardHovered, setCardHovered] = useState(false);
  const [helperHovered, setHelperHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    left: number;
    top: number;
    placeAbove: boolean;
  } | null>(null);

  const def = JOKER_MAP[joker.jokerId];

  const showSynergy = Boolean(helperHovered && synergy);
  const showStandardTooltip = Boolean(cardHovered && !helperHovered);
  const isAnyTooltipVisible = showSynergy || showStandardTooltip;

  useLayoutEffect(() => {
    if (!isAnyTooltipVisible || !cardRef.current) {
      setPopoverPos(null);
      return;
    }

    const updatePosition = () => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const width = showSynergy ? 272 : 216;
      const centerX = rect.left + rect.width / 2;
      const clampedLeft = Math.max(
        12,
        Math.min(centerX - width / 2, window.innerWidth - width - 12)
      );
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < 240 && rect.top > spaceBelow;
      const top = placeAbove ? rect.top - 8 : rect.bottom + 8;

      setPopoverPos({ left: clampedLeft, top, placeAbove });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isAnyTooltipVisible, showSynergy]);

  if (!def) return null;

  const editionOverlay =
    joker.edition === 'foil'
      ? 'edition-foil'
      : joker.edition === 'holo'
      ? 'edition-holo'
      : joker.edition === 'polychrome'
      ? 'edition-polychrome'
      : '';

  const rarityBorder =
    def.rarity === 'Rare'
      ? 'border-rose-400'
      : def.rarity === 'Uncommon'
      ? 'border-emerald-400'
      : 'border-slate-300';

  const scalingLabel =
    joker.jokerId === 'constellation' && joker.scalingValue > 1
      ? ` (Currently ×${joker.scalingValue})`
      : '';

  return (
    <div className="relative group flex flex-col items-center">
      {popupText && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded-md bg-red-600 border border-amber-300 text-white text-xs font-mono-num font-bold shadow-lg whitespace-nowrap animate-score-pop">
          {popupText}
        </div>
      )}

      <div
        ref={cardRef}
        onMouseEnter={() => setCardHovered(true)}
        onMouseLeave={() => {
          setCardHovered(false);
          setHelperHovered(false);
        }}
        className={`relative w-[92px] sm:w-[102px] h-[132px] sm:h-[144px] rounded-xl border-2 bg-[#161E24] text-slate-100 shadow-lg flex flex-col justify-between p-2 overflow-hidden transition-transform duration-150 ${rarityBorder} ${
          activeStep ? '-translate-y-2 ring-2 ring-amber-400 scale-[1.03]' : 'hover:-translate-y-1'
        }`}
      >
        {editionOverlay && (
          <div className={`pointer-events-none absolute inset-0 ${editionOverlay}`} />
        )}

        {/* Top header */}
        <div className="relative z-10 flex items-center justify-between gap-1">
          <span className="text-[10px] font-semibold tracking-tight text-slate-300 truncate">
            {def.rarity}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {joker.edition !== 'none' && (
              <span className="text-[9px] font-bold uppercase px-1 rounded bg-white/15 text-amber-200">
                {joker.edition === 'polychrome' ? 'Poly' : joker.edition}
              </span>
            )}
            {synergy && (
              <button
                type="button"
                aria-label={`Show trigger order and hand synergy for ${def.name}`}
                onMouseEnter={() => setHelperHovered(true)}
                onMouseLeave={() => setHelperHovered(false)}
                onFocus={() => setHelperHovered(true)}
                onBlur={() => setHelperHovered(false)}
                onClick={(e) => e.stopPropagation()}
                className="p-0.5 rounded-full bg-white/10 hover:bg-amber-400/25 text-slate-300 hover:text-amber-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Center stylized Joker badge */}
        <div
          className="relative z-10 mx-auto w-12 h-12 rounded-lg flex items-center justify-center border border-white/15 shadow-inner text-lg font-display font-bold text-white"
          style={{ backgroundColor: def.accentColor }}
        >
          {def.name.slice(0, 2).toUpperCase()}
        </div>

        {/* Name */}
        <div className="relative z-10 text-center">
          <div className="text-[11px] font-bold leading-tight text-white truncate">{def.name}</div>
          {joker.jokerId === 'constellation' && (
            <div className="text-[10px] font-mono-num text-cyan-300">×{joker.scalingValue}</div>
          )}
        </div>
      </div>

      {/* Portal-mounted Tooltips (always above all table containers & backdrop-blur layers) */}
      {typeof document !== 'undefined' &&
        popoverPos &&
        showStandardTooltip &&
        createPortal(
          <div
            role="tooltip"
            style={{
              left: `${popoverPos.left}px`,
              top: `${popoverPos.top}px`,
              transform: popoverPos.placeAbove ? 'translateY(-100%)' : undefined,
            }}
            className="pointer-events-none fixed z-[9999] w-[216px] rounded-lg bg-[#0D1418] border border-white/15 p-2.5 shadow-2xl text-left"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-white">{def.name}</span>
              <span className="text-[10px] text-slate-400">{def.rarity}</span>
            </div>
            <p className="text-xs text-slate-200 leading-snug">
              {def.description}
              {scalingLabel}
            </p>
            {joker.edition !== 'none' && (
              <p className="mt-1 text-[11px] text-amber-300 font-medium">
                {joker.edition === 'foil' && 'Foil: +50 Chips'}
                {joker.edition === 'holo' && 'Holographic: +10 Mult'}
                {joker.edition === 'polychrome' && 'Polychrome: ×1.5 Mult'}
              </p>
            )}
          </div>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        popoverPos &&
        showSynergy &&
        synergy &&
        createPortal(
          <div
            role="tooltip"
            style={{
              left: `${popoverPos.left}px`,
              top: `${popoverPos.top}px`,
              transform: popoverPos.placeAbove ? 'translateY(-100%)' : undefined,
            }}
            className="pointer-events-none fixed z-[9999] w-[272px] rounded-xl bg-[#0B1216] border border-amber-400/50 p-3 shadow-2xl text-left"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 mb-2">
              <span className="text-xs font-bold text-white truncate">{def.name}</span>
              <span className="text-[10px] font-mono-num text-slate-400 shrink-0">
                Slot #{index + 1}
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                {synergy.triggerStepLabel}
              </div>
              <p className="text-[11px] text-slate-200 leading-snug">{synergy.orderTip}</p>
            </div>

            <div className="border-t border-white/10 pt-2 mt-2 space-y-0.5">
              <div
                className={`text-[11px] font-bold ${
                  synergy.willTrigger ? 'text-emerald-300' : 'text-slate-300'
                }`}
              >
                {synergy.handInteractionTitle}
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                {synergy.handInteractionDetail}
              </p>
            </div>
          </div>,
          document.body
        )}

      {/* Action bar under Joker */}
      {(canReorder || onSell) && (
        <div className="mt-1 flex items-center gap-1 opacity-85 group-hover:opacity-100">
          {canReorder && index > 0 && onMoveLeft && (
            <button
              type="button"
              onClick={onMoveLeft}
              title="Move Left"
              className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-white/10"
            >
              <ArrowLeft className="w-3 h-3" />
            </button>
          )}
          {onSell && (
            <button
              type="button"
              onClick={onSell}
              className="px-2 py-0.5 rounded bg-amber-600/90 hover:bg-amber-500 text-white text-[10px] font-mono-num font-bold whitespace-nowrap"
            >
              Sell ${joker.sellValue}
            </button>
          )}
          {canReorder && index < total - 1 && onMoveRight && (
            <button
              type="button"
              onClick={onMoveRight}
              title="Move Right"
              className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-white/10"
            >
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
