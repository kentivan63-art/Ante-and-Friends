import { BASE_HAND_DEFS, JOKER_MAP } from './catalog';
import {
  ActiveHexEffect,
  Edition,
  Enhancement,
  HandEvaluationResult,
  HandLevelInfo,
  OwnedJoker,
  PlayingCard,
  PokerHandId,
  Rank,
  Suit,
  ScoreStepEvent,
} from './types';

export const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

let idCounter = 1;
export function nextId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createStandardDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: nextId('card'),
        rank,
        suit,
        enhancement: 'none',
        edition: 'none',
        seal: 'none',
      });
    }
  }
  return shuffleArray(deck);
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function rankToLabel(rank: Rank): string {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

export function suitToSymbol(suit: Suit): string {
  switch (suit) {
    case 'spades':
      return '♠';
    case 'hearts':
      return '♥';
    case 'clubs':
      return '♣';
    case 'diamonds':
      return '♦';
  }
}

export function getCardChipValue(card: PlayingCard): number {
  if (card.enhancement === 'stone') return 50 + (card.bonusChips || 0);
  let base = 0;
  if (card.rank === 14) base = 11;
  else if (card.rank >= 10) base = 10;
  else base = card.rank;
  return base + (card.bonusChips || 0);
}

export function isFaceCard(card: PlayingCard): boolean {
  if (card.enhancement === 'stone') return false;
  return card.rank === 11 || card.rank === 12 || card.rank === 13;
}

export function cardMatchesSuit(card: PlayingCard, suit: Suit): boolean {
  if (card.enhancement === 'stone') return false;
  if (card.enhancement === 'wild') return true;
  return card.suit === suit;
}

export function isCardDebuffed(card: PlayingCard, bossId: string | null): boolean {
  if (!bossId || card.enhancement === 'stone') return false;
  if (bossId === 'the_club') return card.suit === 'clubs' || card.enhancement === 'wild';
  if (bossId === 'the_goad') return card.suit === 'spades' || card.enhancement === 'wild';
  if (bossId === 'the_window') return card.suit === 'diamonds' || card.enhancement === 'wild';
  if (bossId === 'the_head') return card.suit === 'hearts' || card.enhancement === 'wild';
  return false;
}

/**
 * Resolves the effective jokerId for each slot, handling Blueprint chains.
 */
export function resolveEffectiveJokerId(jokers: OwnedJoker[], index: number): string {
  const visited = new Set<number>();
  let curr = index;
  while (curr < jokers.length && !visited.has(curr)) {
    visited.add(curr);
    const j = jokers[curr];
    if (j.jokerId !== 'blueprint') {
      return j.jokerId;
    }
    curr += 1;
  }
  return jokers[index]?.jokerId ?? 'joker';
}

export function evaluateHand(
  playedCards: PlayingCard[],
  jokers: OwnedJoker[],
  handLevels: Record<PokerHandId, HandLevelInfo>
): HandEvaluationResult {
  if (playedCards.length === 0) {
    const info = handLevels.high_card;
    return {
      handId: 'high_card',
      displayName: 'High Card',
      scoringCardIds: [],
      baseChips: info.chips,
      baseMult: info.mult,
      level: info.level,
    };
  }

  const hasSplash = jokers.some((_, idx) => resolveEffectiveJokerId(jokers, idx) === 'splash');
  const stoneCards = playedCards.filter((c) => c.enhancement === 'stone');
  const regularCards = playedCards.filter((c) => c.enhancement !== 'stone');

  // If only stone cards played
  if (regularCards.length === 0) {
    const info = handLevels.high_card;
    return {
      handId: 'high_card',
      displayName: info.name,
      scoringCardIds: playedCards.map((c) => c.id),
      baseChips: info.chips,
      baseMult: info.mult,
      level: info.level,
    };
  }

  // Group by rank
  const rankGroups = new Map<Rank, PlayingCard[]>();
  for (const c of regularCards) {
    const list = rankGroups.get(c.rank) || [];
    list.push(c);
    rankGroups.set(c.rank, list);
  }

  const groupsSorted = Array.from(rankGroups.entries()).sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return b[0] - a[0];
  });

  // Check Flush (5 non-stone cards all matching at least one common suit)
  let isFlush = false;
  if (regularCards.length === 5) {
    for (const s of SUITS) {
      if (regularCards.every((c) => cardMatchesSuit(c, s))) {
        isFlush = true;
        break;
      }
    }
  }

  // Check Straight (5 non-stone cards with consecutive ranks)
  let isStraight = false;
  let isRoyal = false;
  if (regularCards.length === 5 && rankGroups.size === 5) {
    const ranksAsc = regularCards.map((c) => c.rank).sort((a, b) => a - b);
    const consecutive = ranksAsc.every((r, i) => i === 0 || r === ranksAsc[i - 1] + 1);
    const aceLow =
      ranksAsc[0] === 2 &&
      ranksAsc[1] === 3 &&
      ranksAsc[2] === 4 &&
      ranksAsc[3] === 5 &&
      ranksAsc[4] === 14;
    if (consecutive || aceLow) {
      isStraight = true;
      if (ranksAsc[0] === 10 && ranksAsc[4] === 14) {
        isRoyal = true;
      }
    }
  }

  const topCount = groupsSorted[0]?.[1].length ?? 0;
  const secondCount = groupsSorted[1]?.[1].length ?? 0;

  let handId: PokerHandId = 'high_card';
  let displayName = handLevels.high_card.name;
  let coreScoring: PlayingCard[] = [];

  if (topCount >= 5 && isFlush) {
    handId = 'flush_five';
    coreScoring = regularCards;
  } else if (topCount === 3 && secondCount === 2 && isFlush) {
    handId = 'flush_house';
    coreScoring = regularCards;
  } else if (topCount >= 5) {
    handId = 'five_of_a_kind';
    coreScoring = groupsSorted[0][1];
  } else if (isStraight && isFlush) {
    handId = 'straight_flush';
    coreScoring = regularCards;
  } else if (topCount === 4) {
    handId = 'four_of_a_kind';
    coreScoring = groupsSorted[0][1];
  } else if (topCount === 3 && secondCount === 2) {
    handId = 'full_house';
    coreScoring = [...groupsSorted[0][1], ...groupsSorted[1][1]];
  } else if (isFlush) {
    handId = 'flush';
    coreScoring = regularCards;
  } else if (isStraight) {
    handId = 'straight';
    coreScoring = regularCards;
  } else if (topCount === 3) {
    handId = 'three_of_a_kind';
    coreScoring = groupsSorted[0][1];
  } else if (topCount === 2 && secondCount === 2) {
    handId = 'two_pair';
    coreScoring = [...groupsSorted[0][1], ...groupsSorted[1][1]];
  } else if (topCount === 2) {
    handId = 'pair';
    coreScoring = groupsSorted[0][1];
  } else {
    handId = 'high_card';
    // Highest single card
    const highest = [...regularCards].sort((a, b) => b.rank - a.rank)[0];
    coreScoring = highest ? [highest] : [];
  }

  const info = handLevels[handId];
  displayName = handId === 'straight_flush' && isRoyal ? 'Royal Flush' : info.name;

  const scoringSet = new Set<string>(coreScoring.map((c) => c.id));
  for (const s of stoneCards) scoringSet.add(s.id);
  if (hasSplash) {
    for (const c of playedCards) scoringSet.add(c.id);
  }

  return {
    handId,
    displayName,
    scoringCardIds: playedCards.filter((c) => scoringSet.has(c.id)).map((c) => c.id),
    baseChips: info.chips,
    baseMult: info.mult,
    level: info.level,
  };
}

function handContains(handId: PokerHandId, target: 'pair' | 'three' | 'two_pair' | 'straight' | 'flush' | 'four'): boolean {
  switch (target) {
    case 'pair':
      return ['pair', 'two_pair', 'three_of_a_kind', 'full_house', 'four_of_a_kind', 'five_of_a_kind', 'flush_house', 'flush_five'].includes(handId);
    case 'two_pair':
      return ['two_pair', 'full_house', 'flush_house'].includes(handId);
    case 'three':
      return ['three_of_a_kind', 'full_house', 'four_of_a_kind', 'five_of_a_kind', 'flush_house', 'flush_five'].includes(handId);
    case 'four':
      return ['four_of_a_kind', 'five_of_a_kind', 'flush_five'].includes(handId);
    case 'straight':
      return ['straight', 'straight_flush'].includes(handId);
    case 'flush':
      return ['flush', 'straight_flush', 'flush_house', 'flush_five'].includes(handId);
  }
}

export interface ScoringComputationResult {
  handEval: HandEvaluationResult;
  steps: ScoreStepEvent[];
  finalScore: number;
  moneyEarned: number;
  shatteredCardIds: string[];
  consumedHexIds: string[];
}

export function scorePlayedHand(params: {
  playedCards: PlayingCard[];
  heldCards: PlayingCard[];
  jokers: OwnedJoker[];
  handLevels: Record<PokerHandId, HandLevelInfo>;
  discardsLeft: number;
  money: number;
  bossId: string | null;
  pendingHexes: ActiveHexEffect[];
}): ScoringComputationResult {
  const { playedCards, heldCards, jokers, handLevels, discardsLeft, money, bossId, pendingHexes } = params;

  const handEval = evaluateHand(playedCards, jokers, handLevels);
  const steps: ScoreStepEvent[] = [];
  const shatteredCardIds: string[] = [];
  const consumedHexIds: string[] = [];

  let chips = handEval.baseChips;
  let mult = handEval.baseMult;
  let moneyEarned = 0;

  // Apply The Flint boss debuff
  if (bossId === 'the_flint') {
    chips = Math.max(1, Math.floor(chips / 2));
    mult = Math.max(1, Math.floor(mult / 2));
    steps.push({
      stepId: nextId('step'),
      sourceType: 'boss',
      label: 'The Flint: Halved Base',
      runningChips: chips,
      runningMult: mult,
    });
  } else {
    steps.push({
      stepId: nextId('step'),
      sourceType: 'base',
      label: `${handEval.displayName} Lv.${handEval.level}`,
      runningChips: chips,
      runningMult: mult,
    });
  }

  // Apply Fool's Gold hex if pending
  const foolsGold = pendingHexes.find((h) => h.kind === 'halve_next_mult');
  if (foolsGold) {
    mult = Math.max(1, Math.floor(mult / 2));
    consumedHexIds.push(foolsGold.id);
    steps.push({
      stepId: nextId('step'),
      sourceType: 'hex',
      label: `Hex: Fool's Gold (½ Mult)`,
      runningChips: chips,
      runningMult: mult,
    });
  }

  const scoringSet = new Set(handEval.scoringCardIds);
  const scoringCards = playedCards.filter((c) => scoringSet.has(c.id));
  let firstFaceTriggered = false;

  // Resolve effective joker ids once
  const effectiveJokers = jokers.map((j, idx) => ({
    instance: j,
    effectiveId: resolveEffectiveJokerId(jokers, idx),
  }));

  // 1. Score played cards left-to-right
  for (const card of scoringCards) {
    if (isCardDebuffed(card, bossId)) {
      steps.push({
        stepId: nextId('step'),
        sourceType: 'card',
        sourceId: card.id,
        label: `${card.enhancement === 'stone' ? 'Stone' : rankToLabel(card.rank) + suitToSymbol(card.suit)} Debuffed`,
        runningChips: chips,
        runningMult: mult,
      });
      continue;
    }

    const triggers = card.seal === 'red' ? 2 : 1;
    const isFirstFaceThisCard = isFaceCard(card) && !firstFaceTriggered;
    if (isFirstFaceThisCard) firstFaceTriggered = true;

    for (let t = 0; t < triggers; t++) {
      const cardLabel =
        card.enhancement === 'stone' ? 'Stone' : `${rankToLabel(card.rank)}${suitToSymbol(card.suit)}`;
      const retriggerSuffix = t > 0 ? ' (Red Seal)' : '';

      // Base card chips
      const baseChipGain = getCardChipValue(card);
      chips += baseChipGain;
      steps.push({
        stepId: nextId('step'),
        sourceType: 'card',
        sourceId: card.id,
        label: `${cardLabel}${retriggerSuffix}`,
        deltaChips: baseChipGain,
        runningChips: chips,
        runningMult: mult,
      });

      // Card Enhancements
      if (card.enhancement === 'bonus') {
        chips += 30;
        steps.push({
          stepId: nextId('step'),
          sourceType: 'card',
          sourceId: card.id,
          label: `Bonus Card`,
          deltaChips: 30,
          runningChips: chips,
          runningMult: mult,
        });
      } else if (card.enhancement === 'mult') {
        mult += 4;
        steps.push({
          stepId: nextId('step'),
          sourceType: 'card',
          sourceId: card.id,
          label: `Mult Card`,
          deltaMult: 4,
          runningChips: chips,
          runningMult: mult,
        });
      } else if (card.enhancement === 'glass') {
        mult = Number((mult * 2).toFixed(2));
        steps.push({
          stepId: nextId('step'),
          sourceType: 'card',
          sourceId: card.id,
          label: `Glass Card`,
          xMult: 2,
          runningChips: chips,
          runningMult: mult,
        });
      } else if (card.enhancement === 'lucky') {
        if (Math.random() < 0.2) {
          mult += 20;
          steps.push({
            stepId: nextId('step'),
            sourceType: 'card',
            sourceId: card.id,
            label: `Lucky! +20 Mult`,
            deltaMult: 20,
            runningChips: chips,
            runningMult: mult,
          });
        }
        if (Math.random() < 1 / 15) {
          moneyEarned += 20;
          steps.push({
            stepId: nextId('step'),
            sourceType: 'card',
            sourceId: card.id,
            label: `Lucky! +$20`,
            deltaMoney: 20,
            runningChips: chips,
            runningMult: mult,
          });
        }
      }

      // Card Editions
      if (card.edition === 'foil') {
        chips += 50;
        steps.push({
          stepId: nextId('step'),
          sourceType: 'card',
          sourceId: card.id,
          label: `Foil`,
          deltaChips: 50,
          runningChips: chips,
          runningMult: mult,
        });
      } else if (card.edition === 'holo') {
        mult += 10;
        steps.push({
          stepId: nextId('step'),
          sourceType: 'card',
          sourceId: card.id,
          label: `Holographic`,
          deltaMult: 10,
          runningChips: chips,
          runningMult: mult,
        });
      } else if (card.edition === 'polychrome') {
        mult = Number((mult * 1.5).toFixed(2));
        steps.push({
          stepId: nextId('step'),
          sourceType: 'card',
          sourceId: card.id,
          label: `Polychrome`,
          xMult: 1.5,
          runningChips: chips,
          runningMult: mult,
        });
      }

      // Gold Seal
      if (card.seal === 'gold') {
        moneyEarned += 3;
        steps.push({
          stepId: nextId('step'),
          sourceType: 'card',
          sourceId: card.id,
          label: `Gold Seal`,
          deltaMoney: 3,
          runningChips: chips,
          runningMult: mult,
        });
      }

      // On-Card-Scored Joker effects
      for (const { instance, effectiveId } of effectiveJokers) {
        const jName = JOKER_MAP[instance.jokerId]?.name || 'Joker';
        if (effectiveId === 'greedy_joker' && cardMatchesSuit(card, 'diamonds')) {
          mult += 3;
          steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: jName, deltaMult: 3, runningChips: chips, runningMult: mult });
        } else if (effectiveId === 'lusty_joker' && cardMatchesSuit(card, 'hearts')) {
          mult += 3;
          steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: jName, deltaMult: 3, runningChips: chips, runningMult: mult });
        } else if (effectiveId === 'wrathful_joker' && cardMatchesSuit(card, 'spades')) {
          mult += 3;
          steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: jName, deltaMult: 3, runningChips: chips, runningMult: mult });
        } else if (effectiveId === 'gluttonous_joker' && cardMatchesSuit(card, 'clubs')) {
          mult += 3;
          steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: jName, deltaMult: 3, runningChips: chips, runningMult: mult });
        } else if (effectiveId === 'fibonacci' && card.enhancement !== 'stone' && [14, 2, 3, 5, 8].includes(card.rank)) {
          mult += 8;
          steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: jName, deltaMult: 8, runningChips: chips, runningMult: mult });
        } else if (effectiveId === 'scary_face' && isFaceCard(card)) {
          chips += 30;
          steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: jName, deltaChips: 30, runningChips: chips, runningMult: mult });
        } else if (effectiveId === 'even_steven' && card.enhancement !== 'stone' && [2, 4, 6, 8, 10].includes(card.rank)) {
          mult += 4;
          steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: jName, deltaMult: 4, runningChips: chips, runningMult: mult });
        } else if (effectiveId === 'odd_todd' && card.enhancement !== 'stone' && [14, 3, 5, 7, 9].includes(card.rank)) {
          chips += 31;
          steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: jName, deltaChips: 31, runningChips: chips, runningMult: mult });
        } else if (effectiveId === 'photograph' && isFirstFaceThisCard) {
          mult = Number((mult * 2).toFixed(2));
          steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: jName, xMult: 2, runningChips: chips, runningMult: mult });
        }
      }
    }

    // Glass shatter check (once per played glass card)
    if (card.enhancement === 'glass' && Math.random() < 0.25) {
      shatteredCardIds.push(card.id);
      steps.push({
        stepId: nextId('step'),
        sourceType: 'card',
        sourceId: card.id,
        label: `${rankToLabel(card.rank)}${suitToSymbol(card.suit)} Shattered!`,
        shattered: true,
        runningChips: chips,
        runningMult: mult,
      });
    }
  }

  // 2. Held-in-hand triggers (Steel cards + Mime retrigger)
  const mimeCount = effectiveJokers.filter((e) => e.effectiveId === 'mime').length;
  for (const held of heldCards) {
    if (isCardDebuffed(held, bossId)) continue;
    if (held.enhancement === 'steel') {
      const triggers = (held.seal === 'red' ? 2 : 1) + mimeCount;
      for (let t = 0; t < triggers; t++) {
        mult = Number((mult * 1.5).toFixed(2));
        steps.push({
          stepId: nextId('step'),
          sourceType: 'held_card',
          sourceId: held.id,
          label: `Steel ${rankToLabel(held.rank)}${suitToSymbol(held.suit)}`,
          xMult: 1.5,
          runningChips: chips,
          runningMult: mult,
        });
      }
    }
  }

  // 3. Independent Jokers (left to right)
  for (let idx = 0; idx < effectiveJokers.length; idx++) {
    const { instance, effectiveId } = effectiveJokers[idx];
    const jName = JOKER_MAP[instance.jokerId]?.name || 'Joker';
    const isBlueprint = instance.jokerId === 'blueprint';
    const displayLabel = isBlueprint && effectiveId !== 'blueprint'
      ? `Blueprint (${JOKER_MAP[effectiveId]?.name || ''})`
      : jName;

    if (effectiveId === 'joker') {
      mult += 4;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaMult: 4, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'jolly_joker' && handContains(handEval.handId, 'pair')) {
      mult += 8;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaMult: 8, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'zany_joker' && handContains(handEval.handId, 'three')) {
      mult += 12;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaMult: 12, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'mad_joker' && handContains(handEval.handId, 'two_pair')) {
      mult += 10;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaMult: 10, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'crazy_joker' && handContains(handEval.handId, 'straight')) {
      mult += 12;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaMult: 12, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'droll_joker' && handContains(handEval.handId, 'flush')) {
      mult += 10;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaMult: 10, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'sly_joker' && handContains(handEval.handId, 'pair')) {
      chips += 50;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaChips: 50, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'wily_joker' && handContains(handEval.handId, 'three')) {
      chips += 100;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaChips: 100, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'half_joker' && playedCards.length <= 3) {
      mult += 20;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaMult: 20, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'banner' && discardsLeft > 0) {
      const gain = discardsLeft * 30;
      chips += gain;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaChips: gain, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'mystic_summit' && discardsLeft === 0) {
      mult += 15;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaMult: 15, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'abstract_joker') {
      const gain = jokers.length * 3;
      mult += gain;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaMult: gain, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'blackboard') {
      const allBlack =
        heldCards.length > 0 &&
        heldCards.every(
          (c) =>
            c.enhancement !== 'stone' &&
            (cardMatchesSuit(c, 'spades') || cardMatchesSuit(c, 'clubs'))
        );
      if (allBlack || heldCards.length === 0) {
        mult = Number((mult * 3).toFixed(2));
        steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, xMult: 3, runningChips: chips, runningMult: mult });
      }
    } else if (effectiveId === 'bull' && money > 0) {
      const gain = money * 2;
      chips += gain;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaChips: gain, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'bootstraps' && money >= 5) {
      const gain = Math.floor(money / 5) * 2;
      mult += gain;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, deltaMult: gain, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'constellation') {
      // Find the scaling value from the target joker if Blueprint is copying it
      const targetInstance =
        isBlueprint && idx + 1 < jokers.length ? jokers[idx + 1] : instance;
      const xVal = Math.max(1, targetInstance.scalingValue || 1);
      if (xVal > 1) {
        mult = Number((mult * xVal).toFixed(2));
        steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, xMult: xVal, runningChips: chips, runningMult: mult });
      }
    } else if (effectiveId === 'the_duo' && handContains(handEval.handId, 'pair')) {
      mult = Number((mult * 2).toFixed(2));
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, xMult: 2, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'the_trio' && handContains(handEval.handId, 'three')) {
      mult = Number((mult * 3).toFixed(2));
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, xMult: 3, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'the_family' && handContains(handEval.handId, 'four')) {
      mult = Number((mult * 4).toFixed(2));
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, xMult: 4, runningChips: chips, runningMult: mult });
    } else if (effectiveId === 'cavendish') {
      mult = Number((mult * 3).toFixed(2));
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: displayLabel, xMult: 3, runningChips: chips, runningMult: mult });
    }

    // Joker's own Edition
    if (instance.edition === 'foil') {
      chips += 50;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: `${jName} (Foil)`, deltaChips: 50, runningChips: chips, runningMult: mult });
    } else if (instance.edition === 'holo') {
      mult += 10;
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: `${jName} (Holo)`, deltaMult: 10, runningChips: chips, runningMult: mult });
    } else if (instance.edition === 'polychrome') {
      mult = Number((mult * 1.5).toFixed(2));
      steps.push({ stepId: nextId('step'), sourceType: 'joker', sourceId: instance.instanceId, label: `${jName} (Poly)`, xMult: 1.5, runningChips: chips, runningMult: mult });
    }
  }

  const finalScore = Math.max(0, Math.floor(chips * mult));
  return {
    handEval,
    steps,
    finalScore,
    moneyEarned,
    shatteredCardIds,
    consumedHexIds,
  };
}

export function rollRandomEdition(chance = 0.08): Edition {
  const r = Math.random();
  if (r > chance) return 'none';
  const sub = Math.random();
  if (sub < 0.5) return 'foil';
  if (sub < 0.85) return 'holo';
  return 'polychrome';
}

export function applyEnhancementLabel(enh: Enhancement): string {
  switch (enh) {
    case 'bonus': return '+30 Chips';
    case 'mult': return '+4 Mult';
    case 'wild': return 'Any Suit';
    case 'glass': return '×2 Mult (1/4 break)';
    case 'steel': return '×1.5 Mult in hand';
    case 'stone': return '+50 Chips (No rank/suit)';
    case 'gold': return '+$3 if held at end';
    case 'lucky': return '1/5 +20 Mult, 1/15 +$20';
    default: return '';
  }
}

export function sortCardsByRank(cards: PlayingCard[]): PlayingCard[] {
  const suitOrder: Record<Suit, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
  return [...cards].sort((a, b) => {
    if (a.enhancement === 'stone' && b.enhancement !== 'stone') return 1;
    if (b.enhancement === 'stone' && a.enhancement !== 'stone') return -1;
    if (b.rank !== a.rank) return b.rank - a.rank;
    return suitOrder[a.suit] - suitOrder[b.suit];
  });
}

export function sortCardsBySuit(cards: PlayingCard[]): PlayingCard[] {
  const suitOrder: Record<Suit, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
  return [...cards].sort((a, b) => {
    if (a.enhancement === 'stone' && b.enhancement !== 'stone') return 1;
    if (b.enhancement === 'stone' && a.enhancement !== 'stone') return -1;
    if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
    return b.rank - a.rank;
  });
}
