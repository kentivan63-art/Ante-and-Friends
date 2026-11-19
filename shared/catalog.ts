import {
  BoosterPack,
  BossBlindDefinition,
  ConsumableDefinition,
  HandLevelInfo,
  JokerDefinition,
  PokerHandId,
  VoucherDefinition,
} from './types';

export const BASE_HAND_DEFS: Record<
  PokerHandId,
  { name: string; chips: number; mult: number; levelChips: number; levelMult: number; order: number }
> = {
  flush_five: { name: 'Flush Five', chips: 160, mult: 16, levelChips: 50, levelMult: 3, order: 1 },
  flush_house: { name: 'Flush House', chips: 140, mult: 14, levelChips: 40, levelMult: 4, order: 2 },
  five_of_a_kind: { name: 'Five of a Kind', chips: 120, mult: 12, levelChips: 35, levelMult: 3, order: 3 },
  straight_flush: { name: 'Straight Flush', chips: 100, mult: 8, levelChips: 40, levelMult: 4, order: 4 },
  four_of_a_kind: { name: 'Four of a Kind', chips: 60, mult: 7, levelChips: 30, levelMult: 3, order: 5 },
  full_house: { name: 'Full House', chips: 40, mult: 4, levelChips: 25, levelMult: 2, order: 6 },
  flush: { name: 'Flush', chips: 35, mult: 4, levelChips: 15, levelMult: 2, order: 7 },
  straight: { name: 'Straight', chips: 30, mult: 4, levelChips: 30, levelMult: 3, order: 8 },
  three_of_a_kind: { name: 'Three of a Kind', chips: 30, mult: 3, levelChips: 20, levelMult: 2, order: 9 },
  two_pair: { name: 'Two Pair', chips: 20, mult: 2, levelChips: 20, levelMult: 1, order: 10 },
  pair: { name: 'Pair', chips: 10, mult: 2, levelChips: 15, levelMult: 1, order: 11 },
  high_card: { name: 'High Card', chips: 5, mult: 1, levelChips: 10, levelMult: 1, order: 12 },
};

export function createInitialHandLevels(): Record<PokerHandId, HandLevelInfo> {
  const result = {} as Record<PokerHandId, HandLevelInfo>;
  (Object.keys(BASE_HAND_DEFS) as PokerHandId[]).forEach((id) => {
    const d = BASE_HAND_DEFS[id];
    result[id] = {
      id,
      name: d.name,
      level: 1,
      chips: d.chips,
      mult: d.mult,
      playedCount: 0,
    };
  });
  return result;
}

export const ANTE_BASE_CHIPS: Record<number, number> = {
  1: 300,
  2: 800,
  3: 2000,
  4: 5000,
  5: 11000,
  6: 20000,
  7: 35000,
  8: 50000,
};

export function getAnteBaseChips(ante: number): number {
  if (ANTE_BASE_CHIPS[ante]) return ANTE_BASE_CHIPS[ante];
  return Math.round(50000 * Math.pow(2.2, ante - 8));
}

export const JOKER_CATALOG: JokerDefinition[] = [
  {
    id: 'joker',
    name: 'Joker',
    rarity: 'Common',
    cost: 2,
    description: '+4 Mult',
    accentColor: '#dc2626',
  },
  {
    id: 'greedy_joker',
    name: 'Greedy Joker',
    rarity: 'Common',
    cost: 5,
    description: 'Played cards with Diamond suit give +3 Mult when scored',
    accentColor: '#ea580c',
  },
  {
    id: 'lusty_joker',
    name: 'Lusty Joker',
    rarity: 'Common',
    cost: 5,
    description: 'Played cards with Heart suit give +3 Mult when scored',
    accentColor: '#e11d48',
  },
  {
    id: 'wrathful_joker',
    name: 'Wrathful Joker',
    rarity: 'Common',
    cost: 5,
    description: 'Played cards with Spade suit give +3 Mult when scored',
    accentColor: '#334155',
  },
  {
    id: 'gluttonous_joker',
    name: 'Gluttonous Joker',
    rarity: 'Common',
    cost: 5,
    description: 'Played cards with Club suit give +3 Mult when scored',
    accentColor: '#059669',
  },
  {
    id: 'jolly_joker',
    name: 'Jolly Joker',
    rarity: 'Common',
    cost: 3,
    description: '+8 Mult if played hand contains a Pair',
    accentColor: '#db2777',
  },
  {
    id: 'zany_joker',
    name: 'Zany Joker',
    rarity: 'Common',
    cost: 4,
    description: '+12 Mult if played hand contains a Three of a Kind',
    accentColor: '#7c3aed',
  },
  {
    id: 'mad_joker',
    name: 'Mad Joker',
    rarity: 'Common',
    cost: 4,
    description: '+10 Mult if played hand contains a Two Pair',
    accentColor: '#be123c',
  },
  {
    id: 'crazy_joker',
    name: 'Crazy Joker',
    rarity: 'Common',
    cost: 4,
    description: '+12 Mult if played hand contains a Straight',
    accentColor: '#b45309',
  },
  {
    id: 'droll_joker',
    name: 'Droll Joker',
    rarity: 'Common',
    cost: 4,
    description: '+10 Mult if played hand contains a Flush',
    accentColor: '#0284c7',
  },
  {
    id: 'sly_joker',
    name: 'Sly Joker',
    rarity: 'Common',
    cost: 3,
    description: '+50 Chips if played hand contains a Pair',
    accentColor: '#2563eb',
  },
  {
    id: 'wily_joker',
    name: 'Wily Joker',
    rarity: 'Common',
    cost: 4,
    description: '+100 Chips if played hand contains a Three of a Kind',
    accentColor: '#1d4ed8',
  },
  {
    id: 'half_joker',
    name: 'Half Joker',
    rarity: 'Common',
    cost: 5,
    description: '+20 Mult if played hand contains 3 or fewer cards',
    accentColor: '#dc2626',
  },
  {
    id: 'banner',
    name: 'Banner',
    rarity: 'Common',
    cost: 5,
    description: '+30 Chips for each remaining discard',
    accentColor: '#0369a1',
  },
  {
    id: 'mystic_summit',
    name: 'Mystic Summit',
    rarity: 'Common',
    cost: 5,
    description: '+15 Mult when 0 discards remaining',
    accentColor: '#9333ea',
  },
  {
    id: 'scary_face',
    name: 'Scary Face',
    rarity: 'Common',
    cost: 4,
    description: 'Played face cards (J, Q, K) give +30 Chips when scored',
    accentColor: '#1e293b',
  },
  {
    id: 'abstract_joker',
    name: 'Abstract Joker',
    rarity: 'Common',
    cost: 4,
    description: '+3 Mult for each Joker card you own',
    accentColor: '#c026d3',
  },
  {
    id: 'even_steven',
    name: 'Even Steven',
    rarity: 'Common',
    cost: 4,
    description: 'Played even rank cards (2, 4, 6, 8, 10) give +4 Mult when scored',
    accentColor: '#e11d48',
  },
  {
    id: 'odd_todd',
    name: 'Odd Todd',
    rarity: 'Common',
    cost: 4,
    description: 'Played odd rank cards (A, 3, 5, 7, 9) give +31 Chips when scored',
    accentColor: '#2563eb',
  },
  {
    id: 'splash',
    name: 'Splash',
    rarity: 'Common',
    cost: 3,
    description: 'Every played card counts in scoring',
    accentColor: '#0891b2',
  },
  {
    id: 'photograph',
    name: 'Photograph',
    rarity: 'Common',
    cost: 5,
    description: 'First played face card gives ×2 Mult when scored',
    accentColor: '#ca8a04',
  },
  {
    id: 'cavendish',
    name: 'Cavendish',
    rarity: 'Common',
    cost: 4,
    description: '×3 Mult (1 in 1000 chance to expire at end of round)',
    accentColor: '#eab308',
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci',
    rarity: 'Uncommon',
    cost: 8,
    description: 'Each played Ace, 2, 3, 5, or 8 gives +8 Mult when scored',
    accentColor: '#d97706',
  },
  {
    id: 'blackboard',
    name: 'Blackboard',
    rarity: 'Uncommon',
    cost: 6,
    description: '×3 Mult if all cards held in hand are Spades or Clubs',
    accentColor: '#0f172a',
  },
  {
    id: 'bull',
    name: 'Bull',
    rarity: 'Uncommon',
    cost: 6,
    description: '+2 Chips for each $1 you have',
    accentColor: '#2563eb',
  },
  {
    id: 'bootstraps',
    name: 'Bootstraps',
    rarity: 'Uncommon',
    cost: 7,
    description: '+2 Mult for every $5 you have',
    accentColor: '#b91c1c',
  },
  {
    id: 'constellation',
    name: 'Constellation',
    rarity: 'Uncommon',
    cost: 6,
    description: 'Gains ×0.15 Mult every time a Planet card is used',
    accentColor: '#0284c7',
  },
  {
    id: 'mime',
    name: 'Mime',
    rarity: 'Uncommon',
    cost: 5,
    description: 'Retrigger all card held-in-hand abilities',
    accentColor: '#475569',
  },
  {
    id: 'the_duo',
    name: 'The Duo',
    rarity: 'Rare',
    cost: 8,
    description: '×2 Mult if played hand contains a Pair',
    accentColor: '#be185d',
  },
  {
    id: 'the_trio',
    name: 'The Trio',
    rarity: 'Rare',
    cost: 8,
    description: '×3 Mult if played hand contains a Three of a Kind',
    accentColor: '#7e22ce',
  },
  {
    id: 'the_family',
    name: 'The Family',
    rarity: 'Rare',
    cost: 8,
    description: '×4 Mult if played hand contains a Four of a Kind',
    accentColor: '#9f1239',
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    rarity: 'Rare',
    cost: 10,
    description: 'Copies ability of Joker to the right',
    accentColor: '#1d4ed8',
  },
];

export const JOKER_MAP: Record<string, JokerDefinition> = Object.fromEntries(
  JOKER_CATALOG.map((j) => [j.id, j])
);

export const PLANET_CATALOG: ConsumableDefinition[] = [
  { id: 'pluto', type: 'planet', name: 'Pluto', cost: 3, description: 'Level up High Card (+10 Chips, +1 Mult)', targetHand: 'high_card' },
  { id: 'mercury', type: 'planet', name: 'Mercury', cost: 3, description: 'Level up Pair (+15 Chips, +1 Mult)', targetHand: 'pair' },
  { id: 'uranus', type: 'planet', name: 'Uranus', cost: 3, description: 'Level up Two Pair (+20 Chips, +1 Mult)', targetHand: 'two_pair' },
  { id: 'venus', type: 'planet', name: 'Venus', cost: 3, description: 'Level up Three of a Kind (+20 Chips, +2 Mult)', targetHand: 'three_of_a_kind' },
  { id: 'saturn', type: 'planet', name: 'Saturn', cost: 3, description: 'Level up Straight (+30 Chips, +3 Mult)', targetHand: 'straight' },
  { id: 'jupiter', type: 'planet', name: 'Jupiter', cost: 3, description: 'Level up Flush (+15 Chips, +2 Mult)', targetHand: 'flush' },
  { id: 'earth', type: 'planet', name: 'Earth', cost: 3, description: 'Level up Full House (+25 Chips, +2 Mult)', targetHand: 'full_house' },
  { id: 'mars', type: 'planet', name: 'Mars', cost: 3, description: 'Level up Four of a Kind (+30 Chips, +3 Mult)', targetHand: 'four_of_a_kind' },
  { id: 'neptune', type: 'planet', name: 'Neptune', cost: 3, description: 'Level up Straight Flush (+40 Chips, +4 Mult)', targetHand: 'straight_flush' },
  { id: 'planet_x', type: 'planet', name: 'Planet X', cost: 3, description: 'Level up Five of a Kind (+35 Chips, +3 Mult)', targetHand: 'five_of_a_kind' },
  { id: 'ceres', type: 'planet', name: 'Ceres', cost: 3, description: 'Level up Flush House (+40 Chips, +4 Mult)', targetHand: 'flush_house' },
  { id: 'eris', type: 'planet', name: 'Eris', cost: 3, description: 'Level up Flush Five (+50 Chips, +3 Mult)', targetHand: 'flush_five' },
];

export const TAROT_CATALOG: ConsumableDefinition[] = [
  { id: 'the_magician', type: 'tarot', name: 'The Magician', cost: 3, description: 'Enhance up to 2 selected cards to Lucky Cards', minSelect: 1, maxSelect: 2 },
  { id: 'the_empress', type: 'tarot', name: 'The Empress', cost: 3, description: 'Enhance up to 2 selected cards to Mult Cards (+4 Mult)', minSelect: 1, maxSelect: 2 },
  { id: 'the_hierophant', type: 'tarot', name: 'The Hierophant', cost: 3, description: 'Enhance up to 2 selected cards to Bonus Cards (+30 Chips)', minSelect: 1, maxSelect: 2 },
  { id: 'the_lovers', type: 'tarot', name: 'The Lovers', cost: 3, description: 'Enhance 1 selected card into a Wild Card', minSelect: 1, maxSelect: 1 },
  { id: 'the_chariot', type: 'tarot', name: 'The Chariot', cost: 3, description: 'Enhance 1 selected card into a Steel Card (×1.5 Mult in hand)', minSelect: 1, maxSelect: 1 },
  { id: 'justice', type: 'tarot', name: 'Justice', cost: 3, description: 'Enhance 1 selected card into a Glass Card (×2 Mult, may break)', minSelect: 1, maxSelect: 1 },
  { id: 'the_devil', type: 'tarot', name: 'The Devil', cost: 3, description: 'Enhance 1 selected card into a Gold Card (+$3 if held)', minSelect: 1, maxSelect: 1 },
  { id: 'the_tower', type: 'tarot', name: 'The Tower', cost: 3, description: 'Enhance 1 selected card into a Stone Card (+50 Chips)', minSelect: 1, maxSelect: 1 },
  { id: 'strength', type: 'tarot', name: 'Strength', cost: 3, description: 'Increase rank of up to 2 selected cards by 1', minSelect: 1, maxSelect: 2 },
  { id: 'the_hanged_man', type: 'tarot', name: 'The Hanged Man', cost: 3, description: 'Destroy up to 2 selected cards permanently', minSelect: 1, maxSelect: 2 },
  { id: 'death', type: 'tarot', name: 'Death', cost: 3, description: 'Select 2 cards: converts the left card into the right card', minSelect: 2, maxSelect: 2 },
  { id: 'the_hermit', type: 'tarot', name: 'The Hermit', cost: 3, description: 'Doubles your money (up to +$20)', minSelect: 0, maxSelect: 0 },
  { id: 'temperance', type: 'tarot', name: 'Temperance', cost: 3, description: 'Gives the total sell value of all current Jokers (max $50)', minSelect: 0, maxSelect: 0 },
  { id: 'the_star', type: 'tarot', name: 'The Star', cost: 3, description: 'Convert up to 3 selected cards to Diamonds', minSelect: 1, maxSelect: 3 },
  { id: 'the_moon', type: 'tarot', name: 'The Moon', cost: 3, description: 'Convert up to 3 selected cards to Clubs', minSelect: 1, maxSelect: 3 },
  { id: 'the_sun', type: 'tarot', name: 'The Sun', cost: 3, description: 'Convert up to 3 selected cards to Hearts', minSelect: 1, maxSelect: 3 },
  { id: 'the_world', type: 'tarot', name: 'The World', cost: 3, description: 'Convert up to 3 selected cards to Spades', minSelect: 1, maxSelect: 3 },
  { id: 'wheel_of_fortune', type: 'tarot', name: 'Wheel of Fortune', cost: 3, description: '1 in 4 chance to add Foil, Holo, or Polychrome to a random Joker', minSelect: 0, maxSelect: 0 },
];

export const HEX_CATALOG: ConsumableDefinition[] = [
  {
    id: 'hex_taxman',
    type: 'hex',
    name: 'Tax Collector',
    cost: 4,
    description: 'Target rival loses $5 immediately',
    requiresEnemyTarget: true,
  },
  {
    id: 'hex_jinx',
    type: 'hex',
    name: 'The Jinx',
    cost: 5,
    description: 'Target rival’s next Blind target increases by +20%',
    requiresEnemyTarget: true,
  },
  {
    id: 'hex_slick',
    type: 'hex',
    name: 'Slick Fingers',
    cost: 5,
    description: 'Target rival starts next Blind with -1 Discard',
    requiresEnemyTarget: true,
  },
  {
    id: 'hex_fools_gold',
    type: 'hex',
    name: "Fool's Gold",
    cost: 6,
    description: 'Halves Base Mult on target rival’s next played hand',
    requiresEnemyTarget: true,
  },
];

export const ALL_CONSUMABLES: ConsumableDefinition[] = [
  ...PLANET_CATALOG,
  ...TAROT_CATALOG,
  ...HEX_CATALOG,
];

export const CONSUMABLE_MAP: Record<string, ConsumableDefinition> = Object.fromEntries(
  ALL_CONSUMABLES.map((c) => [c.id, c])
);

export const VOUCHER_CATALOG: VoucherDefinition[] = [
  { id: 'overstock', name: 'Overstock', cost: 10, description: '+1 card slot available in Shop' },
  { id: 'clearance_sale', name: 'Clearance Sale', cost: 10, description: 'All cards and packs in Shop are 25% off' },
  { id: 'grabber', name: 'Grabber', cost: 10, description: 'Permanently gain +1 Hand per round' },
  { id: 'wasteful', name: 'Wasteful', cost: 10, description: 'Permanently gain +1 Discard per round' },
  { id: 'paint_brush', name: 'Paint Brush', cost: 10, description: '+1 Hand Size permanently' },
  { id: 'antimatter_lite', name: 'Extra Slot', cost: 14, description: '+1 Joker Slot permanently' },
];

export const VOUCHER_MAP: Record<string, VoucherDefinition> = Object.fromEntries(
  VOUCHER_CATALOG.map((v) => [v.id, v])
);

export const BOOSTER_PACKS: BoosterPack[] = [
  {
    id: 'arcana_pack',
    kind: 'arcana',
    name: 'Arcana Pack',
    cost: 4,
    description: 'Choose 1 of 3 Tarot cards to add to your consumables',
    choicesCount: 3,
  },
  {
    id: 'celestial_pack',
    kind: 'celestial',
    name: 'Celestial Pack',
    cost: 4,
    description: 'Choose 1 of 3 Planet cards to add or use immediately',
    choicesCount: 3,
  },
  {
    id: 'buffoon_pack',
    kind: 'buffoon',
    name: 'Buffoon Pack',
    cost: 4,
    description: 'Choose 1 of 3 Joker cards to add to your roster',
    choicesCount: 3,
  },
];

export const BOSS_BLINDS: BossBlindDefinition[] = [
  { id: 'the_wall', name: 'The Wall', description: 'Extra large Blind (3× base chips)', multiplier: 3.0 },
  { id: 'the_needle', name: 'The Needle', description: 'Play only 1 Hand this round', multiplier: 1.0 },
  { id: 'the_water', name: 'The Water', description: 'Start with 0 Discards', multiplier: 2.0 },
  { id: 'the_flint', name: 'The Flint', description: 'Base Chips and Mult are halved', multiplier: 2.0 },
  { id: 'the_club', name: 'The Club', description: 'All Club cards are debuffed', multiplier: 2.0 },
  { id: 'the_goad', name: 'The Goad', description: 'All Spade cards are debuffed', multiplier: 2.0 },
  { id: 'the_window', name: 'The Window', description: 'All Diamond cards are debuffed', multiplier: 2.0 },
  { id: 'the_head', name: 'The Head', description: 'All Heart cards are debuffed', multiplier: 2.0 },
  { id: 'the_psychic', name: 'The Psychic', description: 'Must play exactly 5 cards', multiplier: 2.0 },
  { id: 'the_manacle', name: 'The Manacle', description: '-1 Hand Size for this round', multiplier: 2.0 },
];

export const BOSS_BLIND_MAP: Record<string, BossBlindDefinition> = Object.fromEntries(
  BOSS_BLINDS.map((b) => [b.id, b])
);
