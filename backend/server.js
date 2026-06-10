import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { deck } from './deck.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Game Rooms State
const rooms = {};

// Helper to generate a unique 6-character room ID
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  do {
    result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[result]); // Ensure uniqueness
  return result;
}

// Fisher-Yates Shuffle Algorithm
function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Helper to sanitize room state for clients (hide opponent cards)
function getSanitizedRoomState(roomId, clientSocketId) {
  const room = rooms[roomId];
  if (!room) return null;

  return {
    id: room.id,
    status: room.status,
    limboCount: room.limbo.length,
    activePlayerId: room.activePlayerId,
    selectedAttribute: room.selectedAttribute,
    roundStatus: room.roundStatus, // 'choosing' | 'revealing' | 'resolved'
    players: room.players.map(p => {
      const isSelf = p.id === clientSocketId;
      return {
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isReady: p.isReady,
        isBot: p.isBot || false,
        cardCount: p.cards.length,
        isEliminated: p.cards.length === 0,
        // Only send the top card if it's the player themselves, or if the round is resolved
        topCard: (isSelf && p.cards.length > 0) ? p.cards[0] : null
      };
    }),
    roundResults: room.roundResults // Only populated in 'resolved' status
  };
}

// Helper to broadcast room update to all players inside a room
function broadcastRoomUpdate(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.players.forEach(p => {
    io.to(p.id).emit('roomUpdated', getSanitizedRoomState(roomId, p.id));
  });
}

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Create Room
  socket.on('createRoom', ({ name }) => {
    const Nickname = (name || 'Metaleiro').trim().substring(0, 15);
    const roomId = generateRoomId();

    rooms[roomId] = {
      id: roomId,
      status: 'lobby', // 'lobby' | 'playing' | 'finished'
      players: [
        {
          id: socket.id,
          name: Nickname,
          isHost: true,
          isReady: false,
          cards: []
        }
      ],
      limbo: [],
      activePlayerId: null,
      selectedAttribute: null,
      roundStatus: 'choosing',
      roundResults: null,
      deck: [...deck]
    };

    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    broadcastRoomUpdate(roomId);
    console.log(`Room created: ${roomId} by host: ${Nickname} (${socket.id})`);
  });

  // 2. Join Room
  socket.on('joinRoom', ({ roomId, name }) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
    const Nickname = (name || 'Headbanger').trim().substring(0, 15);
    const room = rooms[cleanRoomId];

    if (!room) {
      socket.emit('errorMsg', { message: 'Room not found!' });
      return;
    }

    if (room.status !== 'lobby') {
      socket.emit('errorMsg', { message: 'The game has already started!' });
      return;
    }

    if (room.players.length >= 4) {
      socket.emit('errorMsg', { message: 'Room is full! (Maximum 4 players)' });
      return;
    }

    // Add player
    room.players.push({
      id: socket.id,
      name: Nickname,
      isHost: false,
      isReady: false,
      cards: []
    });

    socket.join(cleanRoomId);
    broadcastRoomUpdate(cleanRoomId);
    console.log(`User ${Nickname} joined room ${cleanRoomId}`);
  });

  // 3. Start Game
  socket.on('startGame', () => {
    // Find room the user is hosting
    let roomId = null;
    let room = null;
    for (const id in rooms) {
      const host = rooms[id].players.find(p => p.id === socket.id && p.isHost);
      if (host) {
        roomId = id;
        room = rooms[id];
        break;
      }
    }

    if (!room) {
      socket.emit('errorMsg', { message: 'Only the Host can start the game!' });
      return;
    }

    if (room.players.length < 2) {
      socket.emit('errorMsg', { message: 'At least 2 players are required to start!' });
      return;
    }

    // Shuffle and distribute cards
    const shuffledDeck = shuffle(room.deck);

    // Each player gets exactly 12 cards
    room.players.forEach((p, idx) => {
      p.cards = shuffledDeck.slice(idx * 12, (idx + 1) * 12);
      p.isReady = false;
    });

    // Remainder cards are discarded automatically as they are not in any player's deck.
    room.limbo = [];
    room.status = 'playing';
    room.roundStatus = 'choosing';
    room.selectedAttribute = null;
    room.roundResults = null;

    // Pick a random player to start
    const randomPlayer = room.players[Math.floor(Math.random() * room.players.length)];
    room.activePlayerId = randomPlayer.id;

    console.log(`Game started in room ${roomId}. Active player: ${randomPlayer.name}`);
    broadcastRoomUpdate(roomId);

    // If starting player is a bot, trigger its choice
    if (randomPlayer.isBot) {
      botChooseAttribute(roomId);
    }
  });

  // 4. Select Attribute (Active Player)
  socket.on('selectAttribute', ({ attribute }) => {
    let roomId = null;
    let room = null;
    for (const id in rooms) {
      const playerInRoom = rooms[id].players.find(p => p.id === socket.id);
      if (playerInRoom) {
        roomId = id;
        room = rooms[id];
        break;
      }
    }

    if (!room || room.status !== 'playing' || room.roundStatus !== 'choosing') return;

    if (room.activePlayerId !== socket.id) {
      socket.emit('errorMsg', { message: "It's not your turn to choose the attribute!" });
      return;
    }

    const validAttributes = ['year', 'heaviness', 'complexity', 'influence', 'duration'];
    if (!validAttributes.includes(attribute)) {
      socket.emit('errorMsg', { message: 'Invalid attribute!' });
      return;
    }

    room.selectedAttribute = attribute;
    room.roundStatus = 'revealing';

    // Bots and eliminated players are automatically ready. Human players need to click reveal.
    room.players.forEach(p => {
      p.isReady = p.isBot || p.cards.length === 0;
    });

    console.log(`Room ${roomId}: ${attribute} selected by active player.`);

    // Check if all active players are ready (e.g. if other players are bots)
    const activePlayers = room.players.filter(p => p.cards.length > 0);
    const allReady = activePlayers.every(p => p.isReady);

    if (allReady) {
      resolveRound(roomId);
    } else {
      broadcastRoomUpdate(roomId);
    }
  });

  // 5. Reveal Card (Ready to compare)
  socket.on('revealCard', () => {
    let roomId = null;
    let room = null;
    let player = null;
    for (const id in rooms) {
      const p = rooms[id].players.find(pl => pl.id === socket.id);
      if (p) {
        roomId = id;
        room = rooms[id];
        player = p;
        break;
      }
    }

    if (!player) return;

    if (!room || room.status !== 'playing' || room.roundStatus !== 'revealing') return;
    if (player.cards.length === 0) return; // Eliminated players don't play

    player.isReady = true;

    // Check if all non-eliminated players are ready
    const activePlayers = room.players.filter(p => p.cards.length > 0);
    const allReady = activePlayers.every(p => p.isReady);

    if (allReady) {
      resolveRound(roomId);
    } else {
      broadcastRoomUpdate(roomId);
    }
  });

  // 6. Request next round (Proceed)
  socket.on('nextRound', () => {
    let roomId = null;
    let room = null;
    for (const id in rooms) {
      const p = rooms[id].players.find(pl => pl.id === socket.id);
      if (p) {
        roomId = id;
        room = rooms[id];
        break;
      }
    }

    if (!room || room.status !== 'playing' || room.roundStatus !== 'resolved') return;

    // We allow any connected human player (even if eliminated) to click nextRound to avoid getting stuck when watching bots
    startNextRound(roomId);
  });

  // Handle Disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);

      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        console.log(`Removing player ${player.name} from room ${roomId}`);

        // Remove player
        room.players.splice(playerIndex, 1);

        if (room.players.length === 0) {
          // Delete room if empty
          console.log(`Room ${roomId} is empty. Deleting...`);
          delete rooms[roomId];
        } else {
          // Assign new host if host disconnected
          if (player.isHost) {
            room.players[0].isHost = true;
            console.log(`Player ${room.players[0].name} is now the host of room ${roomId}`);
          }

          // If game is in progress, we might need to resolve rounds or check win conditions
          if (room.status === 'playing') {
            // Check if active player disconnected
            if (room.activePlayerId === socket.id) {
              const nextActive = room.players.find(p => p.cards.length > 0);
              if (nextActive) {
                room.activePlayerId = nextActive.id;
                // If new active is bot, trigger choice
                if (nextActive.isBot && room.roundStatus === 'choosing') {
                  botChooseAttribute(roomId);
                }
              }
            }

            // Check if room is no longer playable (less than 2 players left)
            const alivePlayers = room.players.filter(p => p.cards.length > 0);
            if (alivePlayers.length <= 1) {
              room.status = 'finished';
              room.roundStatus = 'resolved';
              room.roundResults = {
                gameOver: true,
                winnerName: alivePlayers.length === 1 ? alivePlayers[0].name : 'None (Everyone left)',
                winnerId: alivePlayers.length === 1 ? alivePlayers[0].id : null,
                cardsReveal: {},
                limboCount: room.limbo.length,
                isTie: false,
                reason: 'Players disconnected.'
              };
            } else {
              // If we were in the middle of waiting for reveals, check if remaining are ready
              if (room.roundStatus === 'revealing') {
                const allReady = alivePlayers.every(p => p.isReady);
                if (allReady) {
                  resolveRound(roomId);
                  return; // resolveRound does its own broadcast
                }
              }
            }
          }

          broadcastRoomUpdate(roomId);
        }
      }
    }
  });

  // 7. Add Bot (Host only)
  socket.on('addBot', () => {
    let roomId = null;
    let room = null;
    for (const id in rooms) {
      const host = rooms[id].players.find(p => p.id === socket.id && p.isHost);
      if (host) {
        roomId = id;
        room = rooms[id];
        break;
      }
    }

    if (!room || room.status !== 'lobby') return;

    if (room.players.length >= 4) {
      socket.emit('errorMsg', { message: 'Room is full! (Maximum 4 players)' });
      return;
    }

    const botNames = [
      'Ozzy Bot 🎸',
      'Dio Bot 🎤',
      'Lemmy Bot ♠️',
      'Bruce Bot 🤘',
      'Hetfield Bot ⚡',
      'Halford Bot 🏍️',
      'Mustaine Bot 🌪️',
      'Anselmo Bot ☠️'
    ];
    let botName = '';
    for (const name of shuffle(botNames)) {
      if (!room.players.some(p => p.name === name)) {
        botName = name;
        break;
      }
    }
    if (!botName) {
      botName = `Headbanger Bot ${room.players.length}`;
    }

    const botId = `bot_${Math.floor(Math.random() * 1000000)}`;
    room.players.push({
      id: botId,
      name: botName,
      isHost: false,
      isReady: true,
      cards: [],
      isBot: true
    });

    broadcastRoomUpdate(roomId);
    console.log(`Bot ${botName} added to room ${roomId}`);
  });

  // 8. Remove Player/Bot (Host only)
  socket.on('removePlayer', ({ playerId }) => {
    let roomId = null;
    let room = null;
    for (const id in rooms) {
      const host = rooms[id].players.find(p => p.id === socket.id && p.isHost);
      if (host) {
        roomId = id;
        room = rooms[id];
        break;
      }
    }

    if (!room || room.status !== 'lobby') return;

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      // Only allow host to remove bots
      if (player.isBot) {
        room.players.splice(playerIndex, 1);
        broadcastRoomUpdate(roomId);
        console.log(`Bot ${player.name} removed from room ${roomId}`);
      }
    }
  });
});

// Bot decision making helper
function botChooseAttribute(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing' || room.roundStatus !== 'choosing') return;

  const bot = room.players.find(p => p.id === room.activePlayerId);
  if (!bot || !bot.isBot || bot.cards.length === 0) return;

  const card = bot.cards[0];
  const attrs = card.attributes;

  const currentYear = new Date().getFullYear();

  // Calculate relative strengths for all attributes
  // Scale attributes from 0 (weakest card in deck) to 1 (strongest card in deck)
  const strengths = {
    year: (currentYear - attrs.year) / (currentYear - 1970), // older is better
    heaviness: (attrs.heaviness - 58) / (98 - 58),
    complexity: (attrs.complexity - 40) / (98 - 40),
    influence: (attrs.influence - 80) / (100 - 80),
    duration: (attrs.duration - 29.0) / (77.3 - 29.0)
  };

  // Find the highest relative strength attribute
  let bestAttr = 'heaviness';
  let maxStrength = -1;
  for (const attr in strengths) {
    if (strengths[attr] > maxStrength) {
      maxStrength = strengths[attr];
      bestAttr = attr;
    }
  }

  // Small delay to simulate thinking
  setTimeout(() => {
    const currentRoom = rooms[roomId];
    if (currentRoom && currentRoom.status === 'playing' && currentRoom.roundStatus === 'choosing' && currentRoom.activePlayerId === bot.id) {
      currentRoom.selectedAttribute = bestAttr;
      currentRoom.roundStatus = 'revealing';

      // Bots are automatically ready, human players are not ready
      currentRoom.players.forEach(p => {
        p.isReady = p.isBot || p.cards.length === 0;
      });

      console.log(`Room ${roomId}: Bot ${bot.name} chose attribute "${bestAttr}"`);
      broadcastRoomUpdate(roomId);

      // If all players are ready (e.g. if there's only bots or other human is eliminated/ready)
      const activePlayers = currentRoom.players.filter(p => p.cards.length > 0);
      const allReady = activePlayers.every(p => p.isReady);
      if (allReady) {
        resolveRound(roomId);
      }
    }
  }, 1500);
}

// Proceed to next round helper
function startNextRound(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing' || room.roundStatus !== 'resolved') return;

  if (room.nextRoundTimeout) {
    clearTimeout(room.nextRoundTimeout);
    delete room.nextRoundTimeout;
  }

  room.roundStatus = 'choosing';
  room.selectedAttribute = null;
  room.roundResults = null;
  room.players.forEach(p => {
    p.isReady = false;
  });

  console.log(`Room ${roomId}: proceeding to next round.`);
  broadcastRoomUpdate(roomId);

  // If the next active player is a bot, trigger its choice
  const nextActive = room.players.find(p => p.id === room.activePlayerId);
  if (nextActive && nextActive.isBot) {
    botChooseAttribute(roomId);
  }
}

// Resolve the round comparison
function resolveRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const activePlayers = room.players.filter(p => p.cards.length > 0);
  const attribute = room.selectedAttribute;

  // Track values
  let winnerId = null;
  let bestValue = attribute === 'year' ? Infinity : -Infinity;
  let tiedPlayerIds = [];

  const cardsReveal = {};

  activePlayers.forEach(p => {
    const card = p.cards[0];
    const val = card.attributes[attribute];
    cardsReveal[p.id] = {
      playerName: p.name,
      card: card,
      value: val
    };

    if (attribute === 'year') {
      if (val < bestValue) {
        bestValue = val;
        winnerId = p.id;
        tiedPlayerIds = [p.id];
      } else if (val === bestValue) {
        winnerId = null;
        tiedPlayerIds.push(p.id);
      }
    } else {
      if (val > bestValue) {
        bestValue = val;
        winnerId = p.id;
        tiedPlayerIds = [p.id];
      } else if (val === bestValue) {
        winnerId = null;
        tiedPlayerIds.push(p.id);
      }
    }
  });

  const isTie = tiedPlayerIds.length > 1;
  const playedCards = activePlayers.map(p => p.cards[0]);

  let roundWinnerName = '';
  let reason = '';

  if (isTie) {
    // TIE: cards go to Limbo
    activePlayers.forEach(p => {
      const card = p.cards.shift();
      room.limbo.push(card);
    });
    roundWinnerName = 'Tie!';
    reason = `Tie on value ${bestValue}. The cards went to Limbo!`;
    // Active player remains the same unless they were eliminated (had only 1 card and it went to limbo)
    const currentActiveStillAlive = room.players.find(p => p.id === room.activePlayerId && p.cards.length > 0);
    if (!currentActiveStillAlive) {
      const nextActive = room.players.find(p => p.cards.length > 0);
      if (nextActive) {
        room.activePlayerId = nextActive.id;
      }
    }
  } else {
    // WINNER TAKES ALL
    const winnerPlayer = room.players.find(p => p.id === winnerId);
    roundWinnerName = winnerPlayer.name;

    // Collect all cards played plus limbo
    const cardsToWinner = [];
    activePlayers.forEach(p => {
      cardsToWinner.push(p.cards.shift());
    });
    cardsToWinner.push(...room.limbo);

    // Append to winner's deck
    winnerPlayer.cards.push(...cardsToWinner);
    room.limbo = []; // clear limbo

    room.activePlayerId = winnerId;
    reason = `${winnerPlayer.name} won the round with the attribute "${attribute}" and took the cards!`;
  }

  // Check for eliminations and game over
  const remainingPlayers = room.players.filter(p => p.cards.length > 0);
  const eliminatedPlayers = room.players.filter(p => p.cards.length === 0).map(p => p.name);

  let gameOver = false;
  let gameWinnerName = '';
  let gameWinnerId = null;

  if (remainingPlayers.length === 1) {
    gameOver = true;
    gameWinnerName = remainingPlayers[0].name;
    gameWinnerId = remainingPlayers[0].id;
    room.status = 'finished';
  }

  room.roundStatus = 'resolved';
  room.roundResults = {
    winnerId: isTie ? null : winnerId,
    winnerName: roundWinnerName,
    isTie,
    bestValue,
    attribute,
    cardsReveal,
    limboCount: room.limbo.length,
    reason,
    gameOver,
    gameWinner: gameWinnerName,
    gameWinnerId,
    eliminated: eliminatedPlayers
  };

  console.log(`Room ${roomId} resolved: Winner is ${roundWinnerName}. Game Over: ${gameOver}`);
  broadcastRoomUpdate(roomId);

  // Auto-advance if the game is not over and the next player is a bot
  if (!gameOver) {
    if (room.nextRoundTimeout) {
      clearTimeout(room.nextRoundTimeout);
    }
    const nextActive = room.players.find(p => p.id === room.activePlayerId);
    if (nextActive && nextActive.isBot) {
      room.nextRoundTimeout = setTimeout(() => {
        if (rooms[roomId] && rooms[roomId].roundStatus === 'resolved') {
          startNextRound(roomId);
        }
      }, 5000);
    }
  }
}

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
