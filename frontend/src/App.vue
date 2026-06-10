<script setup>
import { ref, onMounted } from 'vue';
import { useSocket } from '@/composables';
import { Home, Lobby, GameBoard } from '@/components';

// 1. Initialize the socket composable (extracting isConnected)
const { socket, isConnected, connect, emit: socketEmit, on: socketOn } = useSocket();

const selfId = ref('');
const roomId = ref('');
const initialRoomId = ref('');
const roomState = ref(null);
const errorMsg = ref('');

onMounted(() => {
  // Parse room ID from URL query parameters (e.g. ?room=XYZABC)
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoom = urlParams.get('room');
  if (urlRoom) {
    initialRoomId.value = urlRoom.trim().toUpperCase();
    roomId.value = urlRoom.trim().toUpperCase();
  }
});

// 2. Set up real-time socket event listeners for the game lifecycle
socketOn('connect', () => {
  if (socket.value) {
    selfId.value = socket.value.id;
    console.log('Connected to socket server:', selfId.value);
  }
});

socketOn('roomCreated', ({ roomId: newRoomId }) => {
  roomId.value = newRoomId;
  errorMsg.value = '';
  // Update URL query parameters without reloading
  const newUrl = `${window.location.origin}?room=${newRoomId}`;
  window.history.pushState({ path: newUrl }, '', newUrl);
});

socketOn('roomUpdated', (state) => {
  roomState.value = state;
  if (state) {
    roomId.value = state.id;
    // Ensure URL is set to current room
    const newUrl = `${window.location.origin}?room=${state.id}`;
    if (window.location.search !== `?room=${state.id}`) {
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  }
});

socketOn('errorMsg', ({ message }) => {
  errorMsg.value = message;
  // Clear room states if failed to join/start
  if (!roomState.value) {
    roomId.value = '';
    window.history.pushState({ path: window.location.origin }, '', window.location.origin);
  }
  // Auto-clear error message after 5 seconds
  setTimeout(() => {
    if (errorMsg.value === message) {
      errorMsg.value = '';
    }
  }, 5000);
});

socketOn('disconnect', () => {
  console.log('Disconnected from socket server');
});

// Helper wrapper to handle asynchronous connection safety before emitting
const safeEmit = (event, payload) => {
  connect(); // Ensures connection is active

  const checkAndEmit = () => {
    if (socket.value && socket.value.connected) {
      socketEmit(event, payload);
    } else {
      setTimeout(checkAndEmit, 50);
    }
  };
  checkAndEmit();
};

// 3. Action handlers utilizing the composable ecosystem
const handleCreateRoom = (nickname) => {
  safeEmit('createRoom', { name: nickname });
};

const handleJoinRoom = ({ roomId: joinId, name }) => {
  safeEmit('joinRoom', { roomId: joinId, name });
};

const handleStartGame = () => {
  socketEmit('startGame');
};

const handleAddBot = () => {
  socketEmit('addBot');
};

const handleRemovePlayer = (playerId) => {
  socketEmit('removePlayer', { playerId });
};

const handleSelectAttribute = (attribute) => {
  socketEmit('selectAttribute', { attribute });
};

const handleRevealCard = () => {
  socketEmit('revealCard');
};

const handleNextRound = () => {
  socketEmit('nextRound');
};

const handleLeaveRoom = () => {
  selfId.value = '';
  roomId.value = '';
  roomState.value = null;
  errorMsg.value = '';

  // Reset URL
  window.history.pushState({ path: window.location.origin }, '', window.location.origin);
};
</script>

<template>
  <div class="bg-zinc-950 min-h-screen text-zinc-100 font-sans antialiased relative">

    <div v-if="!isConnected" class="fixed top-0 left-0 right-0 z-50 bg-red-950/90 border-b border-red-800 text-red-400 p-3 text-center text-xs font-mono tracking-wider uppercase backdrop-blur-md flex items-center justify-center gap-2 shadow-lg dynamic-pulse">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18" />
      </svg>
      <span>Connection lost. Attempting to reconnect to the server...</span>
    </div>

    <div :class="{ 'pt-12': !isConnected }" class="transition-all duration-300">
      <Home
          v-if="!roomState"
          :initialRoomId="initialRoomId"
          :errorMsg="errorMsg"
          @createRoom="handleCreateRoom"
          @joinRoom="handleJoinRoom"
      />

      <Lobby
          v-else-if="roomState.status === 'lobby'"
          :roomId="roomId"
          :players="roomState.players"
          :selfId="selfId"
          @startGame="handleStartGame"
          @leaveRoom="handleLeaveRoom"
          @addBot="handleAddBot"
          @removePlayer="handleRemovePlayer"
      />

      <GameBoard
          v-else
          :roomState="roomState"
          :selfId="selfId"
          @selectAttribute="handleSelectAttribute"
          @revealCard="handleRevealCard"
          @nextRound="handleNextRound"
          @leaveRoom="handleLeaveRoom"
      />
    </div>
  </div>
</template>

<style>
/* Smooth global transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Brutal flashing animation for connection warnings */
@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
.dynamic-pulse {
  animation: pulse-warning 2.5s infinite ease-in-out;
}
</style>