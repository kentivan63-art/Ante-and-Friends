import { JOKER_MAP } from '../../shared/catalog';
import {
  cardMatchesSuit,
  isCardDebuffed,
  isFaceCard,
  rankToLabel,
  resolveEffectiveJokerId,
  suitToSymbol,
} from '../../shared/engine';
import {
  HandEvaluationResult,
  OwnedJoker,
  PlayingCard,
  PokerHandId,
} from '../../shared/types';

export interface JokerSynergyInfo {
  triggerStepLabel: string;
  orderTip: string;
  handInteractionTitle: string;
  handInteractionDetail: string;
  willTrigger: boolean;
}

function handContains(
  handId: PokerHandId,
  target: 'pair' | 'three' | 'two_pair' | 'straight' | 'flush' | 'four'
): boolean {
  switch (target) {
    case 'pair':
      return [
        'pair',
        'two_pair',
        'three_of_a_kind',
        'full_house',
        'four_of_a_kind',
        'five_of_a_kind',
        'flush_house',
        'flush_five',
      ].includes(handId);
    case 'two_pair':
      return ['two_pair', 'full_house', 'flush_house'].includes(handId);
    case 'three':
      return [
        'three_of_a_kind',
        'full_house',
        'four_of_a_kind',
        'five_of_a_kind',
        'flush_house',
        'flush_five',
      ].includes(handId);
    case 'four':
      return ['four_of_a_kind', 'five_of_a_kind', 'flush_five'].includes(handId);
    case 'straight':
      return ['straight', 'straight_flush'].includes(handId);
    case 'flush':
      return ['flush', 'straight_flush', 'flush_house', 'flush_five'].includes(handId);
  }
}

const ON_CARD_JOKERS = new Set([
  'greedy_joker',
  'lusty_joker',
  'wrathful_joker',
  'gluttonous_joker',
  'fibonacci',
  'scary_face',
  'even_steven',
  'odd_todd',
  'photograph',
]);

const XMULT_INDEPENDENT = new Set([
  'blackboard',
  'the_duo',
  'the_trio',
  'the_family',
  'cavendish',
  'constellation',
]);

const CHIPS_INDEPENDENT = new Set(['sly_joker', 'wily_joker', 'banner', 'bull']);

export function getJokerSynergySummary(params: {
  joker: OwnedJoker;
  index: number;
  allJokers: OwnedJoker[];
  selectedCards: PlayingCard[];
  heldCards: PlayingCard[];
  handEval: HandEvaluationResult | null;
  discardsLeft: number;
  money: number;
  bossId: string | null;
}): JokerSynergyInfo {
  const {
    joker,
    index,
    allJokers,
    selectedCards,
    heldCards,
    handEval,
    discardsLeft,
    money,
    bossId,
  } = params;

  const isBlueprint = joker.jokerId === 'blueprint';
  const effectiveId = resolveEffectiveJokerId(allJokers, index);
  const rightNeighbor = index + 1 < allJokers.length ? allJokers[index + 1] : null;
  const rightName = rightNeighbor ? JOKER_MAP[rightNeighbor.jokerId]?.name : null;

  // 1. Determine Trigger Step & Order Tip
  let triggerStepLabel = `Step 4 · Slot ${index + 1} of ${allJokers.length}`;
  let orderTip = '';

  if (isBlueprint) {
    if (!rightNeighbor || effectiveId === 'blueprint') {
      triggerStepLabel = `Step 4 · Slot ${index + 1} (No right target)`;
      orderTip = 'Move Blueprint to the LEFT of a strong Joker (especially ×Mult) to copy its ability.';
    } else {
      triggerStepLabel = `Copies ${rightName} (Slot ${index + 2})`;
      orderTip = `Blueprint acts as a second ${rightName} at Slot ${index + 1}. Keep it left of your best ×Mult or scaling Joker.`;
    }
  } else if (effectiveId === 'splash') {
    triggerStepLabel = 'Step 1 · Passive Scoring Rule';
    orderTip = 'Applies before cards score so every played card counts, boosting On-Card Jokers like Scary Face or Fibonacci.';
  } else if (effectiveId === 'mime') {
    triggerStepLabel = 'Step 3 · Held-in-Hand Retrigger';
    orderTip = 'Triggers after played cards score, retriggering held Steel cards before Step 4 Jokers run.';
  } else if (ON_CARD_JOKERS.has(effectiveId)) {
    triggerStepLabel = 'Step 2 · Triggers Per Scoring Card';
    orderTip =
      effectiveId === 'photograph'
        ? 'Fires during Step 2 on your 1st scoring face card (before Step 4 +Mult Jokers, so Glass/Mult cards before it boost it).'
        : 'Fires left-to-right on each matching scoring card in Step 2; Red Seals trigger it twice.';
  } else if (XMULT_INDEPENDENT.has(effectiveId)) {
    triggerStepLabel = `Step 4 · Independent ×Mult (Slot ${index + 1}/${allJokers.length})`;
    orderTip =
      'Place to the RIGHT of +Mult Jokers so ×Mult multiplies the higher accumulated Mult.';
  } else if (CHIPS_INDEPENDENT.has(effectiveId)) {
    triggerStepLabel = `Step 4 · Independent +Chips (Slot ${index + 1}/${allJokers.length})`;
    orderTip =
      'Adds Chips in Step 4; Chips and Mult multiply at the end, so slot position relative to Mult Jokers does not change total score.';
  } else {
    triggerStepLabel = `Step 4 · Independent +Mult (Slot ${index + 1}/${allJokers.length})`;
    orderTip =
      'Place to the LEFT of ×Mult Jokers (like The Duo, Blackboard, or Polychrome) so they multiply this +Mult.';
  }

  if (joker.edition !== 'none') {
    const edDesc =
      joker.edition === 'foil'
        ? 'Foil (+50 Chips)'
        : joker.edition === 'holo'
        ? 'Holo (+10 Mult)'
        : 'Polychrome (×1.5 Mult)';
    orderTip += ` ${edDesc} fires right after Slot ${index + 1}.`;
  }

  // 2. Live Interaction with Currently Selected Hand
  if (isBlueprint && (!rightNeighbor || effectiveId === 'blueprint')) {
    return {
      triggerStepLabel,
      orderTip,
      handInteractionTitle: 'Waiting for Target',
      handInteractionDetail: 'Place another Joker immediately to the right of Blueprint to copy it.',
      willTrigger: false,
    };
  }

  const hasSelection = selectedCards.length > 0 && handEval !== null;

  if (!hasSelection) {
    // Provide helpful idle summary
    if (effectiveId === 'banner') {
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: 'Current Bonus',
        handInteractionDetail: `Grants +${discardsLeft * 30} Chips right now (${discardsLeft} discards left).`,
        willTrigger: discardsLeft > 0,
      };
    }
    if (effectiveId === 'mystic_summit') {
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: discardsLeft === 0 ? 'Ready (+15 Mult)' : 'Inactive',
        handInteractionDetail:
          discardsLeft === 0
            ? '0 discards remaining — will grant +15 Mult on your next hand.'
            : `${discardsLeft} discard(s) left — requires 0 discards remaining.`,
        willTrigger: discardsLeft === 0,
      };
    }
    if (effectiveId === 'bull') {
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: 'Current Bonus',
        handInteractionDetail: `Grants +${Math.max(0, money) * 2} Chips right now ($${money} banked).`,
        willTrigger: money > 0,
      };
    }
    if (effectiveId === 'bootstraps') {
      const gain = Math.floor(Math.max(0, money) / 5) * 2;
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: 'Current Bonus',
        handInteractionDetail: `Grants +${gain} Mult right now ($${money} banked).`,
        willTrigger: gain > 0,
      };
    }
    if (effectiveId === 'constellation') {
      const source = isBlueprint && rightNeighbor ? rightNeighbor : joker;
      const xVal = Math.max(1, source.scalingValue || 1);
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: 'Current Scaling',
        handInteractionDetail:
          xVal > 1
            ? `Currently ×${xVal} Mult (use Planet cards to grow +0.15×).`
            : 'Currently ×1.0 Mult — use Planet cards to start scaling.',
        willTrigger: xVal > 1,
      };
    }
    if (effectiveId === 'abstract_joker') {
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: 'Current Bonus',
        handInteractionDetail: `Grants +${allJokers.length * 3} Mult across your ${allJokers.length} Joker(s).`,
        willTrigger: true,
      };
    }
    return {
      triggerStepLabel,
      orderTip,
      handInteractionTitle: 'Selected Hand Preview',
      handInteractionDetail: 'Select cards in your hand to preview how this Joker interacts with them.',
      willTrigger: false,
    };
  }

  // Evaluate against selectedCards & handEval
  const scoringSet = new Set(handEval.scoringCardIds);
  const scoringCards = selectedCards.filter((c) => scoringSet.has(c.id));
  const activeScoringCards = scoringCards.filter((c) => !isCardDebuffed(c, bossId));
  const debuffedCount = scoringCards.length - activeScoringCards.length;

  const formatCard = (c: PlayingCard) =>
    c.enhancement === 'stone' ? 'Stone' : `${rankToLabel(c.rank)}${suitToSymbol(c.suit)}`;

  // On-card matching helper
  const countCardTriggers = (predicate: (c: PlayingCard) => boolean) => {
    const matched = activeScoringCards.filter(predicate);
    const triggers = matched.reduce((acc, c) => acc + (c.seal === 'red' ? 2 : 1), 0);
    return { matched, triggers };
  };

  switch (effectiveId) {
    case 'splash': {
      const nonCore = selectedCards.length - (handEval.handId === 'high_card' ? 1 : 0);
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: `Active on ${handEval.displayName}`,
        handInteractionDetail:
          nonCore > 0
            ? `Forces all ${selectedCards.length} selected cards to score instead of skipping kickers.`
            : `All ${selectedCards.length} selected cards already score in this ${handEval.displayName}.`,
        willTrigger: true,
      };
    }

    case 'mime': {
      const steelHeld = heldCards.filter(
        (c) => c.enhancement === 'steel' && !isCardDebuffed(c, bossId)
      );
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: steelHeld.length > 0 ? `Retriggers ${steelHeld.length} Steel Card(s)` : 'No Held Steel Cards',
        handInteractionDetail:
          steelHeld.length > 0
            ? `Will retrigger ${steelHeld.map(formatCard).join(', ')} in hand for extra ×1.5 Mult.`
            : 'Keep Steel cards unselected in hand for Mime to retrigger their ×1.5 Mult.',
        willTrigger: steelHeld.length > 0,
      };
    }

    case 'greedy_joker':
    case 'lusty_joker':
    case 'wrathful_joker':
    case 'gluttonous_joker': {
      const suitMap = {
        greedy_joker: 'diamonds',
        lusty_joker: 'hearts',
        wrathful_joker: 'spades',
        gluttonous_joker: 'clubs',
      } as const;
      const targetSuit = suitMap[effectiveId];
      const { matched, triggers } = countCardTriggers((c) => cardMatchesSuit(c, targetSuit));
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: triggers > 0 ? `Triggers +${triggers * 3} Mult` : 'No Matching Scoring Cards',
        handInteractionDetail:
          triggers > 0
            ? `${matched.map(formatCard).join(', ')} will trigger ${triggers}× for +${triggers * 3} Mult.`
            : `None of the scoring cards in this ${handEval.displayName} match ${targetSuit}.${
                debuffedCount > 0 ? ` (${debuffedCount} debuffed by Boss)` : ''
              }`,
        willTrigger: triggers > 0,
      };
    }

    case 'fibonacci': {
      const { matched, triggers } = countCardTriggers(
        (c) => c.enhancement !== 'stone' && [14, 2, 3, 5, 8].includes(c.rank)
      );
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: triggers > 0 ? `Triggers +${triggers * 8} Mult` : 'No Fibonacci Cards',
        handInteractionDetail:
          triggers > 0
            ? `${matched.map(formatCard).join(', ')} trigger ${triggers}× for +${triggers * 8} Mult.`
            : 'Include scoring A, 2, 3, 5, or 8 cards to trigger +8 Mult each.',
        willTrigger: triggers > 0,
      };
    }

    case 'scary_face': {
      const { matched, triggers } = countCardTriggers((c) => isFaceCard(c));
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: triggers > 0 ? `Triggers +${triggers * 30} Chips` : 'No Scoring Face Cards',
        handInteractionDetail:
          triggers > 0
            ? `${matched.map(formatCard).join(', ')} trigger ${triggers}× for +${triggers * 30} Chips.`
            : 'Include scoring J, Q, or K cards to trigger +30 Chips each.',
        willTrigger: triggers > 0,
      };
    }

    case 'even_steven': {
      const { matched, triggers } = countCardTriggers(
        (c) => c.enhancement !== 'stone' && [2, 4, 6, 8, 10].includes(c.rank)
      );
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: triggers > 0 ? `Triggers +${triggers * 4} Mult` : 'No Scoring Even Cards',
        handInteractionDetail:
          triggers > 0
            ? `${matched.map(formatCard).join(', ')} trigger ${triggers}× for +${triggers * 4} Mult.`
            : 'Include scoring 2, 4, 6, 8, or 10 cards for +4 Mult each.',
        willTrigger: triggers > 0,
      };
    }

    case 'odd_todd': {
      const { matched, triggers } = countCardTriggers(
        (c) => c.enhancement !== 'stone' && [14, 3, 5, 7, 9].includes(c.rank)
      );
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: triggers > 0 ? `Triggers +${triggers * 31} Chips` : 'No Scoring Odd Cards',
        handInteractionDetail:
          triggers > 0
            ? `${matched.map(formatCard).join(', ')} trigger ${triggers}× for +${triggers * 31} Chips.`
            : 'Include scoring A, 3, 5, 7, or 9 cards for +31 Chips each.',
        willTrigger: triggers > 0,
      };
    }

    case 'photograph': {
      const firstFace = activeScoringCards.find((c) => isFaceCard(c));
      const repeats = firstFace?.seal === 'red' ? 2 : 1;
      const multGain = Math.pow(2, repeats);
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: firstFace ? `Triggers ×${multGain} Mult` : 'No Scoring Face Card',
        handInteractionDetail: firstFace
          ? `1st scoring face card (${formatCard(firstFace)}) multiplies Mult by ×${multGain}.`
          : 'Needs at least one scoring J, Q, or K to trigger ×2 Mult.',
        willTrigger: Boolean(firstFace),
      };
    }

    case 'joker':
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: 'Always Active (+4 Mult)',
        handInteractionDetail: `Adds +4 Mult to this ${handEval.displayName} in Slot ${index + 1}.`,
        willTrigger: true,
      };

    case 'jolly_joker': {
      const ok = handContains(handEval.handId, 'pair');
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (+8 Mult)' : 'Inactive',
        handInteractionDetail: ok
          ? `${handEval.displayName} contains a Pair — grants +8 Mult.`
          : `Selected ${handEval.displayName} does not contain a Pair.`,
        willTrigger: ok,
      };
    }

    case 'sly_joker': {
      const ok = handContains(handEval.handId, 'pair');
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (+50 Chips)' : 'Inactive',
        handInteractionDetail: ok
          ? `${handEval.displayName} contains a Pair — grants +50 Chips.`
          : `Selected ${handEval.displayName} does not contain a Pair.`,
        willTrigger: ok,
      };
    }

    case 'zany_joker': {
      const ok = handContains(handEval.handId, 'three');
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (+12 Mult)' : 'Inactive',
        handInteractionDetail: ok
          ? `${handEval.displayName} contains Three of a Kind — grants +12 Mult.`
          : `Selected ${handEval.displayName} does not contain Three of a Kind.`,
        willTrigger: ok,
      };
    }

    case 'wily_joker': {
      const ok = handContains(handEval.handId, 'three');
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (+100 Chips)' : 'Inactive',
        handInteractionDetail: ok
          ? `${handEval.displayName} contains Three of a Kind — grants +100 Chips.`
          : `Selected ${handEval.displayName} does not contain Three of a Kind.`,
        willTrigger: ok,
      };
    }

    case 'mad_joker': {
      const ok = handContains(handEval.handId, 'two_pair');
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (+10 Mult)' : 'Inactive',
        handInteractionDetail: ok
          ? `${handEval.displayName} contains Two Pair — grants +10 Mult.`
          : `Selected ${handEval.displayName} does not contain Two Pair.`,
        willTrigger: ok,
      };
    }

    case 'crazy_joker': {
      const ok = handContains(handEval.handId, 'straight');
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (+12 Mult)' : 'Inactive',
        handInteractionDetail: ok
          ? `${handEval.displayName} contains a Straight — grants +12 Mult.`
          : `Selected ${handEval.displayName} does not contain a Straight.`,
        willTrigger: ok,
      };
    }

    case 'droll_joker': {
      const ok = handContains(handEval.handId, 'flush');
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (+10 Mult)' : 'Inactive',
        handInteractionDetail: ok
          ? `${handEval.displayName} contains a Flush — grants +10 Mult.`
          : `Selected ${handEval.displayName} does not contain a Flush.`,
        willTrigger: ok,
      };
    }

    case 'half_joker': {
      const ok = selectedCards.length <= 3;
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (+20 Mult)' : 'Inactive (Too Many Cards)',
        handInteractionDetail: ok
          ? `${selectedCards.length} card(s) selected (≤ 3) — grants +20 Mult.`
          : `${selectedCards.length} cards selected; play 3 or fewer cards to trigger +20 Mult.`,
        willTrigger: ok,
      };
    }

    case 'banner':
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: discardsLeft > 0 ? `Active (+${discardsLeft * 30} Chips)` : 'Inactive',
        handInteractionDetail:
          discardsLeft > 0
            ? `${discardsLeft} discard(s) left — grants +${discardsLeft * 30} Chips.`
            : '0 discards left — grants +0 Chips.',
        willTrigger: discardsLeft > 0,
      };

    case 'mystic_summit':
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: discardsLeft === 0 ? 'Active (+15 Mult)' : 'Inactive',
        handInteractionDetail:
          discardsLeft === 0
            ? '0 discards remaining — grants +15 Mult.'
            : `${discardsLeft} discard(s) left — spend all discards first to activate.`,
        willTrigger: discardsLeft === 0,
      };

    case 'abstract_joker':
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: `Active (+${allJokers.length * 3} Mult)`,
        handInteractionDetail: `Grants +${allJokers.length * 3} Mult (+3 per owned Joker).`,
        willTrigger: true,
      };

    case 'blackboard': {
      const blockers = heldCards.filter(
        (c) =>
          c.enhancement === 'stone' ||
          !(cardMatchesSuit(c, 'spades') || cardMatchesSuit(c, 'clubs'))
      );
      const ok = blockers.length === 0;
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (×3 Mult)' : 'Blocked by Held Cards',
        handInteractionDetail: ok
          ? heldCards.length === 0
            ? 'No cards left in hand — grants ×3 Mult.'
            : `All ${heldCards.length} remaining card(s) in hand are ♠/♣ — grants ×3 Mult!`
          : `Remaining in hand: ${blockers.slice(0, 3).map(formatCard).join(', ')}${
              blockers.length > 3 ? ` +${blockers.length - 3} more` : ''
            } block Blackboard.`,
        willTrigger: ok,
      };
    }

    case 'the_duo': {
      const ok = handContains(handEval.handId, 'pair');
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (×2 Mult)' : 'Inactive',
        handInteractionDetail: ok
          ? `${handEval.displayName} contains a Pair — multiplies Mult by ×2.`
          : `Needs a Pair or better (${handEval.displayName} won't trigger it).`,
        willTrigger: ok,
      };
    }

    case 'the_trio': {
      const ok = handContains(handEval.handId, 'three');
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (×3 Mult)' : 'Inactive',
        handInteractionDetail: ok
          ? `${handEval.displayName} contains Three of a Kind — multiplies Mult by ×3.`
          : `Needs Three of a Kind or better (${handEval.displayName} won't trigger it).`,
        willTrigger: ok,
      };
    }

    case 'the_family': {
      const ok = handContains(handEval.handId, 'four');
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: ok ? 'Active (×4 Mult)' : 'Inactive',
        handInteractionDetail: ok
          ? `${handEval.displayName} contains Four of a Kind — multiplies Mult by ×4.`
          : `Needs Four of a Kind or Five of a Kind.`,
        willTrigger: ok,
      };
    }

    case 'cavendish':
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: 'Active (×3 Mult)',
        handInteractionDetail: `Multiplies Mult by ×3 on your ${handEval.displayName}.`,
        willTrigger: true,
      };

    case 'bull':
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: money > 0 ? `Active (+${money * 2} Chips)` : 'Inactive ($0)',
        handInteractionDetail: `Grants +${Math.max(0, money) * 2} Chips from your $${money} bank.`,
        willTrigger: money > 0,
      };

    case 'bootstraps': {
      const gain = Math.floor(Math.max(0, money) / 5) * 2;
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: gain > 0 ? `Active (+${gain} Mult)` : 'Inactive (<$5)',
        handInteractionDetail: `Grants +${gain} Mult from $${money} banked (+2 per $5).`,
        willTrigger: gain > 0,
      };
    }

    case 'constellation': {
      const source = isBlueprint && rightNeighbor ? rightNeighbor : joker;
      const xVal = Math.max(1, source.scalingValue || 1);
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: xVal > 1 ? `Active (×${xVal} Mult)` : '×1.0 Mult (Unscaled)',
        handInteractionDetail:
          xVal > 1
            ? `Multiplies Mult by ×${xVal} in Slot ${index + 1}.`
            : 'Use Planet cards to grow this multiplier (+0.15× each).',
        willTrigger: xVal > 1,
      };
    }

    default:
      return {
        triggerStepLabel,
        orderTip,
        handInteractionTitle: 'Active',
        handInteractionDetail: 'Evaluated during scoring.',
        willTrigger: true,
      };
  }
}
