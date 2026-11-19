import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  BASE_HAND_DEFS,
  BOOSTER_PACKS,
  BOSS_BLINDS,
  CONSUMABLE_MAP,
  HEX_CATALOG,
  JOKER_CATALOG,
  JOKER_MAP,
  PLANET_CATALOG,
  TAROT_CATALOG,
  VOUCHER_CATALOG,
  VOUCHER_MAP,
  createInitialHandLevels,
  getAnteBaseChips,
} from './shared/catalog';
import {
  createStandardDeck,
  nextId,
  rollRandomEdition,
  scorePlayedHand,
  shuffleArray,
  sortCardsByRank,
} from './shared/engine';
import {
  ActiveBoosterSession,
  ActivityMessage,
  BlindType,
  ClientMessage,
  Edition,
  OwnedConsumable,
  OwnedJoker,
  PlayerState,
  PlayingCard,
  PokerHandId,
  PublicPlayerSummary,
  RoomPublicState,
  RoomSettings,
  ServerMessage,
  ShopItem,
} from './shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface InternalRoom {
  roomCode: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: RoomSettings;
  ante: number;
  blindIndex: number;
  currentBossIndex: number;
  players: Map<string, PlayerState>;
  activity: ActivityMessage[];
  lastBossShowdown: RoomPublicState['lastBossShowdown'];
  winnerId: string | null;
  winnerName: string | null;
}

const rooms = new Map<string, InternalRoom>();
const socketToPlayer = new Map<WebSocket, { roomCode: string; playerId: string }>();
const playerToSocket = new Map<string, WebSocket>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function getBlindType(blindIndex: number): BlindType {
  if (blindIndex === 0) return 'small';
  if (blindIndex === 1) return 'big';
  return 'boss';
}

function getBlindMultiplier(blindIndex: number, bossMultiplier: number): number {
  if (blindIndex === 0) return 1.0;
  if (blindIndex === 1) return 1.5;
  return bossMultiplier;
}

function getBlindReward(blindIndex: number): number {
  if (blindIndex === 0) return 3;
  if (blindIndex === 1) return 4;
  return 5;
}

function addActivity(
  room: InternalRoom,
  kind: ActivityMessage['kind'],
  text: string,
  senderName?: string
) {
  room.activity.push({
    id: nextId('act'),
    timestamp: Date.now(),
    kind,
    senderName,
    text,
  });
  if (room.activity.length > 40) {
    room.activity = room.activity.slice(-40);
  }
}

function createFreshPlayer(id: string, name: string, isHost: boolean, startingLives: number): PlayerState {
  const fullDeck = createStandardDeck();
  return {
    id,
    name,
    connected: true,
    isHost,
    lives: startingLives,
    maxLives: startingLives,
    eliminated: false,
    phase: 'blind_select',
    money: 4,
    score: 0,
    totalRunScore: 0,
    bestHandScore: 0,
    targetScore: 300,
    handsLeft: 4,
    discardsLeft: 3,
    maxHands: 4,
    maxDiscards: 3,
    handSize: 8,
    deck: [],
    hand: [],
    discardPile: [],
    fullDeck,
    jokers: [],
    maxJokers: 5,
    consumables: [],
    maxConsumables: 2,
    vouchers: [],
    handLevels: createInitialHandLevels(),
    shopItems: [],
    shopPacks: [],
    shopVoucher: null,
    rerollCost: 5,
    activeBooster: null,
    pendingHexes: [],
    lastHandPlayedId: null,
    discountPercent: 0,
    freeRerolls: 0,
    nextBlindScoreMultiplier: 1,
    roundSummary: null,
  };
}

function resetPlayerForNewRun(player: PlayerState, startingLives: number): PlayerState {
  return createFreshPlayer(player.id, player.name, player.isHost, startingLives);
}

function rollShopJoker(excludeIds: Set<string>): { jokerId: string; edition: Edition; cost: number } {
  const r = Math.random();
  const targetRarity = r < 0.68 ? 'Common' : r < 0.92 ? 'Uncommon' : 'Rare';
  let pool = JOKER_CATALOG.filter((j) => j.rarity === targetRarity && !excludeIds.has(j.id));
  if (pool.length === 0) {
    pool = JOKER_CATALOG.filter((j) => !excludeIds.has(j.id));
  }
  if (pool.length === 0) pool = JOKER_CATALOG;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const edition = rollRandomEdition(0.09);
  const editionCost = edition === 'foil' ? 2 : edition === 'holo' ? 3 : edition === 'polychrome' ? 5 : 0;
  return {
    jokerId: chosen.id,
    edition,
    cost: chosen.cost + editionCost,
  };
}

function applyDiscount(baseCost: number, discountPercent: number): number {
  if (discountPercent <= 0) return baseCost;
  return Math.max(1, Math.floor(baseCost * (1 - discountPercent / 100)));
}

function generateShopForPlayer(player: PlayerState, room: InternalRoom) {
  const slotsCount = player.vouchers.includes('overstock') ? 3 : 2;
  const ownedJokerIds = new Set(player.jokers.map((j) => j.jokerId));
  const shopItems: ShopItem[] = [];

  for (let i = 0; i < slotsCount; i++) {
    const rollType = Math.random();
    if (rollType < 0.65) {
      const rolled = rollShopJoker(ownedJokerIds);
      ownedJokerIds.add(rolled.jokerId);
      shopItems.push({
        slotId: nextId('slot'),
        kind: 'joker',
        itemId: rolled.jokerId,
        edition: rolled.edition,
        cost: applyDiscount(rolled.cost, player.discountPercent),
        sold: false,
      });
    } else if (room.settings.sabotageEnabled && room.players.size > 1 && Math.random() < 0.25) {
      const hex = HEX_CATALOG[Math.floor(Math.random() * HEX_CATALOG.length)];
      shopItems.push({
        slotId: nextId('slot'),
        kind: 'consumable',
        itemId: hex.id,
        edition: 'none',
        cost: applyDiscount(hex.cost, player.discountPercent),
        sold: false,
      });
    } else {
      const pool = Math.random() < 0.5 ? TAROT_CATALOG : PLANET_CATALOG;
      const cons = pool[Math.floor(Math.random() * pool.length)];
      shopItems.push({
        slotId: nextId('slot'),
        kind: 'consumable',
        itemId: cons.id,
        edition: 'none',
        cost: applyDiscount(cons.cost, player.discountPercent),
        sold: false,
      });
    }
  }

  player.shopItems = shopItems;
  player.shopPacks = BOOSTER_PACKS.map((p) => ({
    ...p,
    cost: applyDiscount(p.cost, player.discountPercent),
  }));

  // Offer a random unowned voucher on Small/Big or every shop
  const availableVouchers = VOUCHER_CATALOG.filter((v) => !player.vouchers.includes(v.id));
  if (availableVouchers.length > 0) {
    const v = availableVouchers[Math.floor(Math.random() * availableVouchers.length)];
    player.shopVoucher = {
      ...v,
      cost: applyDiscount(v.cost, player.discountPercent),
    };
  } else {
    player.shopVoucher = null;
  }

  player.rerollCost = 5;
}

function getRoomPublicState(room: InternalRoom): RoomPublicState {
  const currentBoss = BOSS_BLINDS[room.currentBossIndex % BOSS_BLINDS.length];
  const baseTargetScore = Math.round(
    getAnteBaseChips(room.ante) * getBlindMultiplier(room.blindIndex, currentBoss.multiplier)
  );
  const players: PublicPlayerSummary[] = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    connected: p.connected,
    isHost: p.isHost,
    lives: p.lives,
    maxLives: p.maxLives,
    eliminated: p.eliminated,
    phase: p.phase,
    money: p.money,
    score: p.score,
    targetScore: p.targetScore,
    totalRunScore: p.totalRunScore,
    bestHandScore: p.bestHandScore,
    handsLeft: p.handsLeft,
    discardsLeft: p.discardsLeft,
    jokers: p.jokers,
    pendingHexes: p.pendingHexes,
  }));

  return {
    roomCode: room.roomCode,
    status: room.status,
    settings: room.settings,
    ante: room.ante,
    blindIndex: room.blindIndex,
    blindType: getBlindType(room.blindIndex),
    baseTargetScore,
    currentBoss,
    players,
    activity: room.activity,
    lastBossShowdown: room.lastBossShowdown,
    winnerId: room.winnerId,
    winnerName: room.winnerName,
  };
}

function sendToSocket(ws: WebSocket | undefined, msg: ServerMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastRoom(room: InternalRoom) {
  const publicState = getRoomPublicState(room);
  for (const player of room.players.values()) {
    const sock = playerToSocket.get(player.id);
    if (sock) {
      sendToSocket(sock, {
        type: 'room_sync',
        room: publicState,
        self: player,
      });
    }
  }
}

function checkAndAdvanceRoomIfReady(room: InternalRoom) {
  if (room.status !== 'playing') return;
  const activePlayers = Array.from(room.players.values()).filter(
    (p) => !p.eliminated && p.connected
  );
  if (activePlayers.length === 0) return;

  const allReady = activePlayers.every((p) => p.phase === 'waiting_next');
  if (!allReady) return;

  // Reset one-shop coupon discounts after leaving shop
  for (const p of room.players.values()) {
    p.discountPercent = p.vouchers.includes('clearance_sale') ? 25 : 0;
  }

  // If Boss Blind just ended, resolve Boss Showdown!
  if (room.blindIndex === 2) {
    const currentBoss = BOSS_BLINDS[room.currentBossIndex % BOSS_BLINDS.length];
    const contenders = Array.from(room.players.values()).filter((p) => !p.eliminated || p.score > 0);
    const aliveBefore = Array.from(room.players.values()).filter((p) => !p.eliminated);

    if (room.settings.mode === 'versus' && aliveBefore.length >= 2) {
      const sorted = [...aliveBefore].sort((a, b) => b.score - a.score);
      const topPlayer = sorted[0];
      const minScore = sorted[sorted.length - 1].score;
      const maxScore = topPlayer.score;

      const loserIds: string[] = [];
      const loserNames: string[] = [];

      // Winner gets $5 bounty
      topPlayer.money += 5;

      // Lowest scorer(s) lose 1 extra life if there wasn't an exact all-way tie
      if (minScore < maxScore) {
        for (const p of aliveBefore) {
          if (p.score === minScore) {
            p.lives = Math.max(0, p.lives - 1);
            if (p.lives === 0) {
              p.eliminated = true;
              p.phase = 'eliminated';
            }
            loserIds.push(p.id);
            loserNames.push(p.name);
          }
        }
      }

      room.lastBossShowdown = {
        ante: room.ante,
        bossName: currentBoss.name,
        winnerId: topPlayer.id,
        winnerName: topPlayer.name,
        loserIds,
        loserNames,
        standings: sorted.map((p) => ({
          playerId: p.id,
          playerName: p.name,
          score: p.score,
          cleared: p.score >= p.targetScore,
        })),
      };

      addActivity(
        room,
        'boss',
        `Boss Showdown (${currentBoss.name}): ${topPlayer.name} won +$5 bounty${
          loserNames.length > 0 ? ` · ${loserNames.join(', ')} lost ♥` : ' · Tie!'
        }`
      );
    }

    // Check win conditions
    const survivors = Array.from(room.players.values()).filter((p) => !p.eliminated);
    if (room.settings.mode === 'versus' && room.players.size >= 2 && survivors.length <= 1) {
      const champ = survivors[0] || contenders.sort((a, b) => b.totalRunScore - a.totalRunScore)[0];
      room.status = 'finished';
      room.winnerId = champ?.id || null;
      room.winnerName = champ?.name || null;
      addActivity(room, 'system', `${room.winnerName} is the Last Player Standing!`);
      broadcastRoom(room);
      return;
    }

    if (room.ante >= room.settings.maxAntes) {
      const pool = survivors.length > 0 ? survivors : Array.from(room.players.values());
      const champ = [...pool].sort((a, b) => b.totalRunScore - a.totalRunScore)[0];
      room.status = 'finished';
      room.winnerId = champ?.id || null;
      room.winnerName = champ?.name || null;
      addActivity(
        room,
        'system',
        `Run Complete! ${room.winnerName} wins with ${champ?.totalRunScore.toLocaleString()} total chips!`
      );
      broadcastRoom(room);
      return;
    }

    // Advance Ante
    room.ante += 1;
    room.blindIndex = 0;
    room.currentBossIndex = (room.currentBossIndex + 1) % BOSS_BLINDS.length;
    addActivity(room, 'system', `Ante ${room.ante} begins! Next Boss: ${BOSS_BLINDS[room.currentBossIndex].name}`);
  } else {
    room.blindIndex += 1;
    room.lastBossShowdown = null;
  }

  for (const p of room.players.values()) {
    if (!p.eliminated) {
      p.phase = 'blind_select';
      p.score = 0;
      p.roundSummary = null;
    }
  }
  broadcastRoom(room);
}

function levelUpHand(player: PlayerState, handId: PokerHandId, levels = 1) {
  const def = BASE_HAND_DEFS[handId];
  const info = player.handLevels[handId];
  info.level += levels;
  info.chips += def.levelChips * levels;
  info.mult += def.levelMult * levels;

  // Trigger Constellation scaling
  for (const j of player.jokers) {
    if (j.jokerId === 'constellation') {
      j.scalingValue = Number(((j.scalingValue || 1) + 0.15 * levels).toFixed(2));
    }
  }
}

function startBlindForPlayer(player: PlayerState, room: InternalRoom) {
  const isBoss = room.blindIndex === 2;
  const currentBoss = BOSS_BLINDS[room.currentBossIndex % BOSS_BLINDS.length];
  const baseChips = getAnteBaseChips(room.ante);
  const mult = getBlindMultiplier(room.blindIndex, currentBoss.multiplier);

  let target = Math.round(baseChips * mult * player.nextBlindScoreMultiplier);
  player.nextBlindScoreMultiplier = 1;

  // Consume Jinx & Minus Discard hexes
  const jinxes = player.pendingHexes.filter((h) => h.kind === 'target_boost');
  for (const _j of jinxes) {
    target = Math.round(target * 1.2);
  }
  const minusDiscards = player.pendingHexes.filter((h) => h.kind === 'minus_discard').length;
  player.pendingHexes = player.pendingHexes.filter(
    (h) => h.kind !== 'target_boost' && h.kind !== 'minus_discard'
  );

  player.targetScore = target;
  player.score = 0;
  player.roundSummary = null;
  player.lastHandPlayedId = null;

  const bossId = isBoss ? currentBoss.id : null;
  player.handsLeft = bossId === 'the_needle' ? 1 : player.maxHands;
  player.discardsLeft =
    bossId === 'the_water' ? 0 : Math.max(0, player.maxDiscards - minusDiscards);

  const effectiveHandSize = Math.max(
    4,
    player.handSize - (bossId === 'the_manacle' ? 1 : 0)
  );

  const shuffled = shuffleArray(player.fullDeck);
  player.hand = sortCardsByRank(shuffled.slice(0, effectiveHandSize));
  player.deck = shuffled.slice(effectiveHandSize);
  player.discardPile = [];
  player.phase = 'playing_blind';
}

function handleMessage(ws: WebSocket, raw: string) {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === 'create_room') {
    const cleanName = (msg.playerName || 'Player 1').trim().slice(0, 18) || 'Player 1';
    const roomCode = generateRoomCode();
    const playerId = nextId('player');
    const isSolo = msg.settings?.mode === 'solo';
    const settings: RoomSettings = {
      mode: msg.settings?.mode || 'versus',
      maxAntes: msg.settings?.maxAntes || 8,
      sabotageEnabled: isSolo ? false : (msg.settings?.sabotageEnabled ?? true),
      startingLives: isSolo ? 1 : (msg.settings?.startingLives || 4),
    };

    const player = createFreshPlayer(playerId, cleanName, true, settings.startingLives);
    const room: InternalRoom = {
      roomCode,
      status: isSolo || msg.autoStart ? 'playing' : 'lobby',
      settings,
      ante: 1,
      blindIndex: 0,
      currentBossIndex: Math.floor(Math.random() * BOSS_BLINDS.length),
      players: new Map([[playerId, player]]),
      activity: [],
      lastBossShowdown: null,
      winnerId: null,
      winnerName: null,
    };
    addActivity(
      room,
      'system',
      isSolo ? `${cleanName} started a Solo Run` : `${cleanName} created room ${roomCode}`
    );
    rooms.set(roomCode, room);

    socketToPlayer.set(ws, { roomCode, playerId });
    playerToSocket.set(playerId, ws);
    broadcastRoom(room);
    return;
  }

  if (msg.type === 'join_room') {
    const code = (msg.roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      sendToSocket(ws, { type: 'error', message: `Room "${code}" not found.` });
      return;
    }

    // Check reconnect by playerId
    if (msg.playerId && room.players.has(msg.playerId)) {
      const existing = room.players.get(msg.playerId)!;
      existing.connected = true;
      socketToPlayer.set(ws, { roomCode: code, playerId: existing.id });
      playerToSocket.set(existing.id, ws);
      broadcastRoom(room);
      return;
    }

    if (room.status !== 'lobby') {
      sendToSocket(ws, { type: 'error', message: 'Game is already in progress in that room.' });
      return;
    }

    if (room.players.size >= 6) {
      sendToSocket(ws, { type: 'error', message: 'Room is full (max 6 players).' });
      return;
    }

    const cleanName = (msg.playerName || `Player ${room.players.size + 1}`).trim().slice(0, 18);
    const playerId = nextId('player');
    const player = createFreshPlayer(playerId, cleanName, false, room.settings.startingLives);
    room.players.set(playerId, player);

    socketToPlayer.set(ws, { roomCode: code, playerId });
    playerToSocket.set(playerId, ws);
    addActivity(room, 'system', `${cleanName} joined the table`);
    broadcastRoom(room);
    return;
  }

  const session = socketToPlayer.get(ws);
  if (!session) return;
  const room = rooms.get(session.roomCode);
  if (!room) return;
  const player = room.players.get(session.playerId);
  if (!player) return;

  switch (msg.type) {
    case 'update_settings': {
      if (!player.isHost || room.status !== 'lobby') return;
      room.settings = { ...room.settings, ...msg.settings };
      for (const p of room.players.values()) {
        p.lives = room.settings.startingLives;
        p.maxLives = room.settings.startingLives;
      }
      broadcastRoom(room);
      break;
    }

    case 'start_game': {
      if (!player.isHost || room.status !== 'lobby') return;
      room.status = 'playing';
      room.ante = 1;
      room.blindIndex = 0;
      room.currentBossIndex = Math.floor(Math.random() * BOSS_BLINDS.length);
      room.lastBossShowdown = null;
      room.winnerId = null;
      room.winnerName = null;
      for (const [pid, p] of room.players.entries()) {
        room.players.set(pid, resetPlayerForNewRun(p, room.settings.startingLives));
      }
      addActivity(
        room,
        'system',
        `Match started (${room.settings.mode === 'versus' ? 'Versus Showdown' : 'Score Race'} · ${room.settings.maxAntes} Antes)`
      );
      broadcastRoom(room);
      break;
    }

    case 'restart_room': {
      if (!player.isHost) return;
      const isSolo = room.settings.mode === 'solo';
      room.status = isSolo ? 'playing' : 'lobby';
      room.ante = 1;
      room.blindIndex = 0;
      room.currentBossIndex = Math.floor(Math.random() * BOSS_BLINDS.length);
      room.lastBossShowdown = null;
      room.winnerId = null;
      room.winnerName = null;
      for (const [pid, p] of room.players.entries()) {
        room.players.set(pid, resetPlayerForNewRun(p, room.settings.startingLives));
      }
      addActivity(room, 'system', isSolo ? 'Started a new Solo Run' : 'Returned to lobby for a new run');
      broadcastRoom(room);
      break;
    }

    case 'send_chat': {
      const clean = (msg.text || '').trim().slice(0, 140);
      if (!clean) return;
      addActivity(room, 'chat', clean, player.name);
      broadcastRoom(room);
      break;
    }

    case 'select_blind': {
      if (room.status !== 'playing' || player.phase !== 'blind_select' || player.eliminated) return;
      if (msg.action === 'skip') {
        if (room.blindIndex === 2) {
          sendToSocket(ws, { type: 'error', message: 'Cannot skip a Boss Blind!' });
          return;
        }
        const tagRoll = Math.floor(Math.random() * 4);
        let tagDesc = '';
        if (tagRoll === 0) {
          player.money += 8;
          tagDesc = 'Economy Tag (+$8)';
        } else if (tagRoll === 1) {
          const commonHands: PokerHandId[] = ['pair', 'two_pair', 'three_of_a_kind', 'straight', 'flush', 'full_house'];
          const picked = commonHands[Math.floor(Math.random() * commonHands.length)];
          levelUpHand(player, picked, 2);
          tagDesc = `Orbital Tag (+2 Lvls to ${BASE_HAND_DEFS[picked].name})`;
        } else if (tagRoll === 2) {
          player.freeRerolls += 2;
          tagDesc = 'D6 Tag (+2 Free Shop Rerolls)';
        } else {
          player.discountPercent = Math.max(player.discountPercent, 25);
          tagDesc = 'Coupon Tag (25% Off Next Shop)';
        }
        player.phase = 'waiting_next';
        addActivity(room, 'system', `${player.name} skipped blind for ${tagDesc}`);
        broadcastRoom(room);
        checkAndAdvanceRoomIfReady(room);
      } else {
        startBlindForPlayer(player, room);
        broadcastRoom(room);
      }
      break;
    }

    case 'reorder_hand': {
      const map = new Map(player.hand.map((c) => [c.id, c]));
      const reordered: PlayingCard[] = [];
      for (const id of msg.cardIds) {
        const found = map.get(id);
        if (found) {
          reordered.push(found);
          map.delete(id);
        }
      }
      for (const rest of map.values()) reordered.push(rest);
      player.hand = reordered;
      broadcastRoom(room);
      break;
    }

    case 'reorder_jokers': {
      const map = new Map(player.jokers.map((j) => [j.instanceId, j]));
      const reordered: OwnedJoker[] = [];
      for (const id of msg.instanceIds) {
        const found = map.get(id);
        if (found) {
          reordered.push(found);
          map.delete(id);
        }
      }
      for (const rest of map.values()) reordered.push(rest);
      player.jokers = reordered;
      broadcastRoom(room);
      break;
    }

    case 'discard_cards': {
      if (player.phase !== 'playing_blind' || player.discardsLeft <= 0) return;
      const idSet = new Set(msg.cardIds);
      if (idSet.size === 0 || idSet.size > 5) return;

      const discarded = player.hand.filter((c) => idSet.has(c.id));
      if (discarded.length === 0) return;

      // Purple seal check: creates Tarot if room in consumables
      for (const d of discarded) {
        if (d.seal === 'purple' && player.consumables.length < player.maxConsumables) {
          const tarot = TAROT_CATALOG[Math.floor(Math.random() * TAROT_CATALOG.length)];
          player.consumables.push({
            instanceId: nextId('cons'),
            consumableId: tarot.id,
            sellValue: 1,
          });
        }
      }

      player.hand = player.hand.filter((c) => !idSet.has(c.id));
      player.discardPile.push(...discarded);
      player.discardsLeft -= 1;

      const bossId =
        room.blindIndex === 2
          ? BOSS_BLINDS[room.currentBossIndex % BOSS_BLINDS.length].id
          : null;
      const effectiveHandSize = Math.max(4, player.handSize - (bossId === 'the_manacle' ? 1 : 0));
      const needed = Math.max(0, effectiveHandSize - player.hand.length);
      const drawn = player.deck.slice(0, needed);
      player.deck = player.deck.slice(needed);
      player.hand.push(...drawn);
      broadcastRoom(room);
      break;
    }

    case 'play_hand': {
      if (player.phase !== 'playing_blind' || player.handsLeft <= 0) return;
      const bossId =
        room.blindIndex === 2
          ? BOSS_BLINDS[room.currentBossIndex % BOSS_BLINDS.length].id
          : null;

      // Keep order from player.hand (or order sent)
      const selectedIds = new Set(msg.cardIds);
      const playedCards = player.hand.filter((c) => selectedIds.has(c.id));
      if (playedCards.length === 0 || playedCards.length > 5) return;

      if (bossId === 'the_psychic' && player.hand.length >= 5 && playedCards.length !== 5) {
        sendToSocket(ws, {
          type: 'error',
          message: 'The Psychic: You must play exactly 5 cards!',
        });
        return;
      }

      const heldCards = player.hand.filter((c) => !selectedIds.has(c.id));

      const result = scorePlayedHand({
        playedCards,
        heldCards,
        jokers: player.jokers,
        handLevels: player.handLevels,
        discardsLeft: player.discardsLeft,
        money: player.money,
        bossId,
        pendingHexes: player.pendingHexes,
      });

      player.handLevels[result.handEval.handId].playedCount += 1;
      player.lastHandPlayedId = result.handEval.handId;
      player.score += result.finalScore;
      player.totalRunScore += result.finalScore;
      if (result.finalScore > player.bestHandScore) {
        player.bestHandScore = result.finalScore;
      }
      player.money += result.moneyEarned;
      player.handsLeft -= 1;

      // Remove consumed hexes
      if (result.consumedHexIds.length > 0) {
        const cSet = new Set(result.consumedHexIds);
        player.pendingHexes = player.pendingHexes.filter((h) => !cSet.has(h.id));
      }

      // Remove shattered glass cards permanently from fullDeck
      const shatteredSet = new Set(result.shatteredCardIds);
      if (shatteredSet.size > 0) {
        player.fullDeck = player.fullDeck.filter((c) => !shatteredSet.has(c.id));
      }

      // Move non-shattered played cards to discardPile
      player.hand = heldCards;
      player.discardPile.push(...playedCards.filter((c) => !shatteredSet.has(c.id)));

      if (result.finalScore >= 1000) {
        addActivity(
          room,
          'score',
          `${player.name} scored ${result.finalScore.toLocaleString()} (${result.handEval.displayName})`
        );
      }

      const blindCleared = player.score >= player.targetScore;
      const blindFailed = !blindCleared && player.handsLeft <= 0;

      if (blindCleared) {
        const blindReward = getBlindReward(room.blindIndex);
        const handsBonus = player.handsLeft;
        const interest = Math.min(5, Math.floor(player.money / 5));
        let goldCardsBonus = 0;

        for (const held of player.hand) {
          if (held.enhancement === 'gold') goldCardsBonus += 3;
          if (held.seal === 'blue' && player.consumables.length < player.maxConsumables && player.lastHandPlayedId) {
            const matchingPlanet = PLANET_CATALOG.find((pl) => pl.targetHand === player.lastHandPlayedId);
            if (matchingPlanet) {
              player.consumables.push({
                instanceId: nextId('cons'),
                consumableId: matchingPlanet.id,
                sellValue: 1,
              });
            }
          }
        }

        // Cavendish 1-in-1000 expire check
        player.jokers = player.jokers.filter(
          (j) => !(j.jokerId === 'cavendish' && Math.random() < 0.001)
        );

        const totalEarned = blindReward + handsBonus + interest + goldCardsBonus;
        player.money += totalEarned;
        player.roundSummary = {
          won: true,
          blindReward,
          handsBonus,
          interest,
          goldCardsBonus,
          totalEarned,
        };
        player.phase = 'round_clear';
      } else if (blindFailed) {
        if (room.settings.mode === 'solo') {
          player.lives = 0;
          player.eliminated = true;
          player.phase = 'eliminated';
          room.status = 'finished';
          room.winnerId = null;
          room.winnerName = null;
        } else if (room.settings.mode === 'versus') {
          player.lives = Math.max(0, player.lives - 1);
          if (player.lives === 0) {
            player.eliminated = true;
            addActivity(room, 'system', `${player.name} ran out of lives and was eliminated!`);
          } else {
            addActivity(room, 'system', `${player.name} failed the blind (-1 ♥, ${player.lives} left)`);
          }
        }
        player.money += 1;
        player.roundSummary = {
          won: false,
          blindReward: 0,
          handsBonus: 0,
          interest: 0,
          goldCardsBonus: 0,
          totalEarned: 1,
        };
        player.phase = player.eliminated ? 'eliminated' : 'round_clear';
      } else {
        // Draw back up to handSize
        const effectiveHandSize = Math.max(4, player.handSize - (bossId === 'the_manacle' ? 1 : 0));
        const needed = Math.max(0, effectiveHandSize - player.hand.length);
        const drawn = player.deck.slice(0, needed);
        player.deck = player.deck.slice(needed);
        player.hand.push(...drawn);
      }

      sendToSocket(ws, {
        type: 'hand_scored',
        handEval: result.handEval,
        playedCards,
        steps: result.steps,
        finalScore: result.finalScore,
        blindCleared,
        blindFailed,
      });

      broadcastRoom(room);
      if (player.eliminated) {
        checkAndAdvanceRoomIfReady(room);
      }
      break;
    }

    case 'continue_to_shop': {
      if (player.phase !== 'round_clear' || player.eliminated) return;
      generateShopForPlayer(player, room);
      player.phase = 'shop';
      broadcastRoom(room);
      break;
    }

    case 'buy_shop_item': {
      if (player.phase !== 'shop') return;
      const item = player.shopItems.find((s) => s.slotId === msg.slotId && !s.sold);
      if (!item) return;
      if (player.money < item.cost) {
        sendToSocket(ws, { type: 'error', message: 'Not enough money!' });
        return;
      }

      if (item.kind === 'joker') {
        if (player.jokers.length >= player.maxJokers) {
          sendToSocket(ws, { type: 'error', message: 'Joker slots full! Sell one first.' });
          return;
        }
        player.money -= item.cost;
        item.sold = true;
        player.jokers.push({
          instanceId: nextId('jok'),
          jokerId: item.itemId,
          edition: item.edition,
          sellValue: Math.max(1, Math.floor(item.cost / 2)),
          scalingValue: 1,
        });
      } else {
        if (player.consumables.length >= player.maxConsumables) {
          sendToSocket(ws, { type: 'error', message: 'Consumable slots full! Use or sell one first.' });
          return;
        }
        player.money -= item.cost;
        item.sold = true;
        player.consumables.push({
          instanceId: nextId('cons'),
          consumableId: item.itemId,
          sellValue: Math.max(1, Math.floor(item.cost / 2)),
        });
      }
      broadcastRoom(room);
      break;
    }

    case 'buy_pack': {
      if (player.phase !== 'shop' || player.activeBooster) return;
      const pack = player.shopPacks.find((p) => p.id === msg.packId);
      if (!pack) return;
      if (player.money < pack.cost) {
        sendToSocket(ws, { type: 'error', message: 'Not enough money!' });
        return;
      }
      player.money -= pack.cost;
      player.shopPacks = player.shopPacks.filter((p) => p.id !== pack.id);

      const options: ActiveBoosterSession['options'] = [];
      const used = new Set<string>();
      for (let i = 0; i < pack.choicesCount; i++) {
        if (pack.kind === 'buffoon') {
          const rolled = rollShopJoker(used);
          used.add(rolled.jokerId);
          options.push({
            optionId: nextId('opt'),
            kind: 'joker',
            itemId: rolled.jokerId,
            edition: rolled.edition,
          });
        } else if (pack.kind === 'celestial') {
          const pool = PLANET_CATALOG.filter((p) => !used.has(p.id));
          const pick = pool[Math.floor(Math.random() * pool.length)] || PLANET_CATALOG[0];
          used.add(pick.id);
          options.push({
            optionId: nextId('opt'),
            kind: 'consumable',
            itemId: pick.id,
            edition: 'none',
          });
        } else {
          const pool = TAROT_CATALOG.filter((t) => !used.has(t.id));
          const pick = pool[Math.floor(Math.random() * pool.length)] || TAROT_CATALOG[0];
          used.add(pick.id);
          options.push({
            optionId: nextId('opt'),
            kind: 'consumable',
            itemId: pick.id,
            edition: 'none',
          });
        }
      }

      player.activeBooster = {
        packKind: pack.kind,
        packName: pack.name,
        options,
      };
      broadcastRoom(room);
      break;
    }

    case 'pick_booster_option': {
      if (!player.activeBooster) return;
      const opt = player.activeBooster.options.find((o) => o.optionId === msg.optionId);
      if (!opt) return;

      if (opt.kind === 'joker') {
        if (player.jokers.length >= player.maxJokers) {
          sendToSocket(ws, { type: 'error', message: 'Joker slots full! Sell a Joker or Skip.' });
          return;
        }
        const def = JOKER_MAP[opt.itemId];
        player.jokers.push({
          instanceId: nextId('jok'),
          jokerId: opt.itemId,
          edition: opt.edition,
          sellValue: Math.max(1, Math.floor((def?.cost || 4) / 2)),
          scalingValue: 1,
        });
      } else {
        const def = CONSUMABLE_MAP[opt.itemId];
        if (def?.type === 'planet' && def.targetHand) {
          // Celestial pack uses Planet card immediately!
          levelUpHand(player, def.targetHand, 1);
        } else {
          if (player.consumables.length >= player.maxConsumables) {
            sendToSocket(ws, { type: 'error', message: 'Consumable slots full! Sell/use one or Skip.' });
            return;
          }
          player.consumables.push({
            instanceId: nextId('cons'),
            consumableId: opt.itemId,
            sellValue: 1,
          });
        }
      }
      player.activeBooster = null;
      broadcastRoom(room);
      break;
    }

    case 'skip_booster': {
      player.activeBooster = null;
      broadcastRoom(room);
      break;
    }

    case 'buy_voucher': {
      if (player.phase !== 'shop' || !player.shopVoucher) return;
      const v = player.shopVoucher;
      if (player.money < v.cost) {
        sendToSocket(ws, { type: 'error', message: 'Not enough money!' });
        return;
      }
      player.money -= v.cost;
      player.vouchers.push(v.id);
      if (v.id === 'clearance_sale') player.discountPercent = Math.max(player.discountPercent, 25);
      if (v.id === 'grabber') player.maxHands += 1;
      if (v.id === 'wasteful') player.maxDiscards += 1;
      if (v.id === 'paint_brush') player.handSize += 1;
      if (v.id === 'antimatter_lite') player.maxJokers += 1;
      player.shopVoucher = null;
      broadcastRoom(room);
      break;
    }

    case 'reroll_shop': {
      if (player.phase !== 'shop') return;
      const actualCost = player.freeRerolls > 0 ? 0 : player.rerollCost;
      if (player.money < actualCost) {
        sendToSocket(ws, { type: 'error', message: 'Not enough money to reroll!' });
        return;
      }
      if (player.freeRerolls > 0) {
        player.freeRerolls -= 1;
      } else {
        player.money -= actualCost;
        player.rerollCost += 1;
      }
      const prevVoucher = player.shopVoucher;
      const prevPacks = player.shopPacks;
      const prevReroll = player.rerollCost;
      generateShopForPlayer(player, room);
      player.shopVoucher = prevVoucher;
      player.shopPacks = prevPacks;
      player.rerollCost = prevReroll;
      broadcastRoom(room);
      break;
    }

    case 'sell_joker': {
      const idx = player.jokers.findIndex((j) => j.instanceId === msg.instanceId);
      if (idx === -1) return;
      const [removed] = player.jokers.splice(idx, 1);
      player.money += removed.sellValue;
      broadcastRoom(room);
      break;
    }

    case 'sell_consumable': {
      const idx = player.consumables.findIndex((c) => c.instanceId === msg.instanceId);
      if (idx === -1) return;
      const [removed] = player.consumables.splice(idx, 1);
      player.money += removed.sellValue;
      broadcastRoom(room);
      break;
    }

    case 'use_consumable': {
      const idx = player.consumables.findIndex((c) => c.instanceId === msg.instanceId);
      if (idx === -1) return;
      const item = player.consumables[idx];
      const def = CONSUMABLE_MAP[item.consumableId];
      if (!def) return;

      if (def.type === 'planet' && def.targetHand) {
        levelUpHand(player, def.targetHand, 1);
        player.consumables.splice(idx, 1);
        broadcastRoom(room);
        return;
      }

      if (def.type === 'hex') {
        if (!msg.targetPlayerId || msg.targetPlayerId === player.id) {
          sendToSocket(ws, { type: 'error', message: 'Select an opponent in the Friends Rail first!' });
          return;
        }
        const target = room.players.get(msg.targetPlayerId);
        if (!target || target.eliminated) {
          sendToSocket(ws, { type: 'error', message: 'Invalid target player.' });
          return;
        }
        if (def.id === 'hex_taxman') {
          target.money = Math.max(0, target.money - 5);
        } else if (def.id === 'hex_jinx') {
          target.pendingHexes.push({
            id: nextId('hex'),
            name: def.name,
            fromPlayerName: player.name,
            kind: 'target_boost',
          });
        } else if (def.id === 'hex_slick') {
          target.pendingHexes.push({
            id: nextId('hex'),
            name: def.name,
            fromPlayerName: player.name,
            kind: 'minus_discard',
          });
        } else if (def.id === 'hex_fools_gold') {
          target.pendingHexes.push({
            id: nextId('hex'),
            name: def.name,
            fromPlayerName: player.name,
            kind: 'halve_next_mult',
          });
        }
        player.consumables.splice(idx, 1);
        addActivity(room, 'hex', `${player.name} cast ${def.name} on ${target.name}!`);
        broadcastRoom(room);
        return;
      }

      // Tarot handling
      const selectedIds = msg.selectedCardIds || [];
      const minSel = def.minSelect ?? 0;
      const maxSel = def.maxSelect ?? 0;

      if (minSel > 0 && (selectedIds.length < minSel || selectedIds.length > maxSel)) {
        sendToSocket(ws, {
          type: 'error',
          message: `Select ${minSel === maxSel ? minSel : `${minSel}-${maxSel}`} card(s) in hand to use ${def.name}.`,
        });
        return;
      }

      if (def.id === 'the_hermit') {
        const gain = Math.min(20, Math.max(0, player.money));
        player.money += gain;
      } else if (def.id === 'temperance') {
        const totalSell = player.jokers.reduce((acc, j) => acc + j.sellValue, 0);
        player.money += Math.min(50, totalSell);
      } else if (def.id === 'wheel_of_fortune') {
        const eligible = player.jokers.filter((j) => j.edition === 'none');
        if (eligible.length === 0) {
          sendToSocket(ws, { type: 'error', message: 'You need an un-editioned Joker to use Wheel of Fortune!' });
          return;
        }
        if (Math.random() < 0.25) {
          const picked = eligible[Math.floor(Math.random() * eligible.length)];
          const eds: Edition[] = ['foil', 'holo', 'polychrome'];
          picked.edition = eds[Math.floor(Math.random() * eds.length)];
          addActivity(room, 'system', `${player.name} hit ${picked.edition.toUpperCase()} on Wheel of Fortune!`);
        } else {
          addActivity(room, 'system', `${player.name}'s Wheel of Fortune said "Nope!"`);
        }
      } else {
        // Card-targeting tarots (only valid when cards are in hand, i.e. playing_blind)
        const handMap = new Map(player.hand.map((c) => [c.id, c]));
        const targets = selectedIds.map((id) => handMap.get(id)).filter(Boolean) as PlayingCard[];
        if (targets.length < minSel) {
          sendToSocket(ws, { type: 'error', message: `Use ${def.name} during a Blind while holding cards!` });
          return;
        }

        if (def.id === 'the_magician') targets.forEach((c) => (c.enhancement = 'lucky'));
        else if (def.id === 'the_empress') targets.forEach((c) => (c.enhancement = 'mult'));
        else if (def.id === 'the_hierophant') targets.forEach((c) => (c.enhancement = 'bonus'));
        else if (def.id === 'the_lovers') targets.forEach((c) => (c.enhancement = 'wild'));
        else if (def.id === 'the_chariot') targets.forEach((c) => (c.enhancement = 'steel'));
        else if (def.id === 'justice') targets.forEach((c) => (c.enhancement = 'glass'));
        else if (def.id === 'the_devil') targets.forEach((c) => (c.enhancement = 'gold'));
        else if (def.id === 'the_tower') targets.forEach((c) => (c.enhancement = 'stone'));
        else if (def.id === 'the_star') targets.forEach((c) => (c.suit = 'diamonds'));
        else if (def.id === 'the_moon') targets.forEach((c) => (c.suit = 'clubs'));
        else if (def.id === 'the_sun') targets.forEach((c) => (c.suit = 'hearts'));
        else if (def.id === 'the_world') targets.forEach((c) => (c.suit = 'spades'));
        else if (def.id === 'strength') {
          targets.forEach((c) => {
            c.rank = c.rank === 14 ? 2 : ((c.rank + 1) as PlayingCard['rank']);
          });
        } else if (def.id === 'the_hanged_man') {
          const rmIds = new Set(targets.map((c) => c.id));
          player.hand = player.hand.filter((c) => !rmIds.has(c.id));
          player.fullDeck = player.fullDeck.filter((c) => !rmIds.has(c.id));
        } else if (def.id === 'death' && targets.length === 2) {
          const [left, right] = targets;
          left.rank = right.rank;
          left.suit = right.suit;
          left.enhancement = right.enhancement;
          left.edition = right.edition;
          left.seal = right.seal;
          left.bonusChips = right.bonusChips;
        }
      }

      player.consumables.splice(idx, 1);
      broadcastRoom(room);
      break;
    }

    case 'ready_next_blind': {
      if (player.phase !== 'shop' || player.eliminated) return;
      player.activeBooster = null;
      player.phase = 'waiting_next';
      broadcastRoom(room);
      checkAndAdvanceRoomIfReady(room);
      break;
    }
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
      const info = socketToPlayer.get(ws);
      socketToPlayer.delete(ws);
      if (!info) return;
      const room = rooms.get(info.roomCode);
      if (!room) return;
      const p = room.players.get(info.playerId);
      if (p) {
        p.connected = false;
        playerToSocket.delete(p.id);
        // Transfer host if needed
        if (p.isHost) {
          const nextHost = Array.from(room.players.values()).find((other) => other.connected);
          if (nextHost) {
            p.isHost = false;
            nextHost.isHost = true;
          }
        }
        broadcastRoom(room);
        checkAndAdvanceRoomIfReady(room);
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Ante & Friends server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
