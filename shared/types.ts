export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 12=Q, 13=K, 14=A

export type Enhancement =
  | 'none'
  | 'bonus'
  | 'mult'
  | 'wild'
  | 'glass'
  | 'steel'
  | 'stone'
  | 'gold'
  | 'lucky';

export type Edition = 'none' | 'foil' | 'holo' | 'polychrome';

export type Seal = 'none' | 'red' | 'gold' | 'blue' | 'purple';

export interface PlayingCard {
  id: string;
  rank: Rank;
  suit: Suit;
  enhancement: Enhancement;
  edition: Edition;
  seal: Seal;
  bonusChips?: number; // permanent extra chips (e.g. Hiker if added)
}

export type PokerHandId =
  | 'flush_five'
  | 'flush_house'
  | 'five_of_a_kind'
  | 'straight_flush'
  | 'four_of_a_kind'
  | 'full_house'
  | 'flush'
  | 'straight'
  | 'three_of_a_kind'
  | 'two_pair'
  | 'pair'
  | 'high_card';

export interface HandLevelInfo {
  id: PokerHandId;
  name: string;
  level: number;
  chips: number;
  mult: number;
  playedCount: number;
}

export type JokerRarity = 'Common' | 'Uncommon' | 'Rare';

export interface JokerDefinition {
  id: string;
  name: string;
  rarity: JokerRarity;
  cost: number;
  description: string;
  accentColor: string;
}

export interface OwnedJoker {
  instanceId: string;
  jokerId: string;
  edition: Edition;
  sellValue: number;
  scalingValue: number; // e.g. Constellation XMult (starts 1.0), Ride the Bus, etc.
}

export type ConsumableType = 'planet' | 'tarot' | 'hex';

export interface ConsumableDefinition {
  id: string;
  type: ConsumableType;
  name: string;
  cost: number;
  description: string;
  targetHand?: PokerHandId;
  minSelect?: number;
  maxSelect?: number;
  requiresEnemyTarget?: boolean;
}

export interface OwnedConsumable {
  instanceId: string;
  consumableId: string;
  sellValue: number;
}

export interface VoucherDefinition {
  id: string;
  name: string;
  cost: number;
  description: string;
}

export interface BoosterPack {
  id: string;
  kind: 'arcana' | 'celestial' | 'buffoon';
  name: string;
  cost: number;
  description: string;
  choicesCount: number;
}

export interface ShopItem {
  slotId: string;
  kind: 'joker' | 'consumable';
  itemId: string;
  edition: Edition;
  cost: number;
  sold: boolean;
}

export interface ActiveBoosterSession {
  packKind: 'arcana' | 'celestial' | 'buffoon';
  packName: string;
  options: Array<{
    optionId: string;
    kind: 'joker' | 'consumable';
    itemId: string;
    edition: Edition;
  }>;
}

export type BlindType = 'small' | 'big' | 'boss';

export interface BossBlindDefinition {
  id: string;
  name: string;
  description: string;
  multiplier: number;
}

export interface ScoreStepEvent {
  stepId: string;
  sourceType: 'base' | 'card' | 'held_card' | 'joker' | 'boss' | 'hex';
  sourceId?: string; // card id or joker instanceId
  label: string;
  deltaChips?: number;
  deltaMult?: number;
  xMult?: number;
  deltaMoney?: number;
  runningChips: number;
  runningMult: number;
  shattered?: boolean;
}

export interface HandEvaluationResult {
  handId: PokerHandId;
  displayName: string;
  scoringCardIds: string[];
  baseChips: number;
  baseMult: number;
  level: number;
}

export type PlayerPhase =
  | 'blind_select'
  | 'playing_blind'
  | 'round_clear'
  | 'shop'
  | 'waiting_next'
  | 'eliminated';

export interface ActiveHexEffect {
  id: string;
  name: string;
  fromPlayerName: string;
  kind: 'target_boost' | 'minus_discard' | 'halve_next_mult';
}

export interface PlayerState {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  lives: number;
  maxLives: number;
  eliminated: boolean;
  phase: PlayerPhase;
  money: number;
  score: number; // current blind score
  totalRunScore: number;
  bestHandScore: number;
  targetScore: number;
  handsLeft: number;
  discardsLeft: number;
  maxHands: number;
  maxDiscards: number;
  handSize: number;
  deck: PlayingCard[]; // remaining draw pile
  hand: PlayingCard[];
  discardPile: PlayingCard[];
  fullDeck: PlayingCard[]; // all cards owned in run
  jokers: OwnedJoker[];
  maxJokers: number;
  consumables: OwnedConsumable[];
  maxConsumables: number;
  vouchers: string[];
  handLevels: Record<PokerHandId, HandLevelInfo>;
  shopItems: ShopItem[];
  shopPacks: BoosterPack[];
  shopVoucher: VoucherDefinition | null;
  rerollCost: number;
  activeBooster: ActiveBoosterSession | null;
  pendingHexes: ActiveHexEffect[];
  lastHandPlayedId: PokerHandId | null;
  discountPercent: number;
  freeRerolls: number;
  nextBlindScoreMultiplier: number;
  roundSummary: {
    won: boolean;
    blindReward: number;
    handsBonus: number;
    interest: number;
    goldCardsBonus: number;
    totalEarned: number;
  } | null;
}

export interface PublicPlayerSummary {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  lives: number;
  maxLives: number;
  eliminated: boolean;
  phase: PlayerPhase;
  money: number;
  score: number;
  targetScore: number;
  totalRunScore: number;
  bestHandScore: number;
  handsLeft: number;
  discardsLeft: number;
  jokers: OwnedJoker[];
  pendingHexes: ActiveHexEffect[];
}

export type GameMode = 'versus' | 'race' | 'solo';

export interface RoomSettings {
  mode: GameMode;
  maxAntes: number;
  sabotageEnabled: boolean;
  startingLives: number;
}

export interface ActivityMessage {
  id: string;
  timestamp: number;
  kind: 'system' | 'score' | 'chat' | 'hex' | 'boss';
  senderName?: string;
  text: string;
}

export interface BossShowdownResult {
  ante: number;
  bossName: string;
  winnerId: string;
  winnerName: string;
  loserIds: string[];
  loserNames: string[];
  standings: Array<{
    playerId: string;
    playerName: string;
    score: number;
    cleared: boolean;
  }>;
}

export interface RoomPublicState {
  roomCode: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: RoomSettings;
  ante: number;
  blindIndex: number; // 0 = small, 1 = big, 2 = boss
  blindType: BlindType;
  baseTargetScore: number;
  currentBoss: BossBlindDefinition;
  players: PublicPlayerSummary[];
  activity: ActivityMessage[];
  lastBossShowdown: BossShowdownResult | null;
  winnerId: string | null;
  winnerName: string | null;
}

// Client -> Server WebSocket Messages
export type ClientMessage =
  | { type: 'create_room'; playerName: string; settings?: Partial<RoomSettings>; autoStart?: boolean }
  | { type: 'join_room'; roomCode: string; playerName: string; playerId?: string }
  | { type: 'update_settings'; settings: Partial<RoomSettings> }
  | { type: 'start_game' }
  | { type: 'select_blind'; action: 'play' | 'skip' }
  | { type: 'play_hand'; cardIds: string[] }
  | { type: 'discard_cards'; cardIds: string[] }
  | { type: 'reorder_hand'; cardIds: string[] }
  | { type: 'reorder_jokers'; instanceIds: string[] }
  | { type: 'continue_to_shop' }
  | { type: 'buy_shop_item'; slotId: string }
  | { type: 'buy_pack'; packId: string }
  | { type: 'pick_booster_option'; optionId: string }
  | { type: 'skip_booster' }
  | { type: 'buy_voucher' }
  | { type: 'reroll_shop' }
  | { type: 'sell_joker'; instanceId: string }
  | { type: 'sell_consumable'; instanceId: string }
  | { type: 'use_consumable'; instanceId: string; selectedCardIds?: string[]; targetPlayerId?: string }
  | { type: 'ready_next_blind' }
  | { type: 'send_chat'; text: string }
  | { type: 'restart_room' };

// Server -> Client WebSocket Messages
export type ServerMessage =
  | {
      type: 'room_sync';
      room: RoomPublicState;
      self: PlayerState;
    }
  | {
      type: 'hand_scored';
      handEval: HandEvaluationResult;
      playedCards: PlayingCard[];
      steps: ScoreStepEvent[];
      finalScore: number;
      blindCleared: boolean;
      blindFailed: boolean;
    }
  | {
      type: 'error';
      message: string;
    };
