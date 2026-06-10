<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  initialRoomId: {
    type: String,
    default: ''
  },
  errorMsg: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['createRoom', 'joinRoom']);

const nickname = ref(localStorage.getItem('mop_nickname') || '');
const roomId = ref(props.initialRoomId);

onMounted(() => {
  // Pre-fill nickname if stored
  if (props.initialRoomId) {
    roomId.value = props.initialRoomId;
  }
});

// Watch for initialRoomId changes (e.g. after navigation)
watch(() => props.initialRoomId, (newRoomId) => {
  roomId.value = newRoomId;
});

const handleCreate = () => {
  if (!nickname.value.trim()) return;
  localStorage.setItem('mop_nickname', nickname.value.trim());
  emit('createRoom', nickname.value.trim());
};

const handleJoin = () => {
  if (!nickname.value.trim() || !roomId.value.trim()) return;
  localStorage.setItem('mop_nickname', nickname.value.trim());
  emit('joinRoom', {
    roomId: roomId.value.trim().toUpperCase(),
    name: nickname.value.trim()
  });
};
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 px-4 relative overflow-hidden">
    <!-- Grunge/Metal Background Accents -->
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.15)_0%,transparent_70%)] pointer-events-none"></div>
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-red-900/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-900/10 rounded-full blur-3xl pointer-events-none"></div>

    <div class="w-full max-w-md z-10">
      <!-- Title -->
      <div class="text-center mb-8">
        <h1 class="text-5xl md:text-6xl font-extrabold uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 drop-shadow-[0_4px_12px_rgba(220,38,38,0.5)] font-mono italic">
          MASTER OF DECKS
        </h1>
        <p class="text-zinc-500 text-xs tracking-[0.3em] uppercase mt-2 font-semibold">
          Ultimate Album Clash
        </p>
      </div>

      <!-- Main Form Card -->
      <div class="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-md relative overflow-hidden">
        <!-- Orange/Red metallic top bar decoration -->
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500"></div>

        <div v-if="errorMsg" class="mb-4 p-3 bg-red-950/60 border border-red-800 text-red-400 text-sm rounded-lg flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{{ errorMsg }}</span>
        </div>

        <div class="space-y-4">
          <!-- Nickname Field -->
          <div>
            <label class="block text-zinc-400 text-xs uppercase tracking-wider font-bold mb-2">Your Nickname</label>
            <input
              v-model="nickname"
              type="text"
              placeholder="Ex: Hetfield, Dio, Lemmy..."
              maxlength="15"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all font-mono placeholder-zinc-700"
            />
          </div>

          <!-- Divider -->
          <div class="relative py-2 flex items-center justify-center">
            <div class="border-t border-zinc-800 w-full"></div>
            <span class="absolute bg-zinc-900 px-3 text-xs text-zinc-600 uppercase tracking-widest">Choose Mode</span>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-3">
            <!-- Create Room -->
            <button
              @click="handleCreate"
              :disabled="!nickname.trim()"
              class="w-full bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl shadow-lg hover:shadow-red-900/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-sm tracking-wider uppercase font-mono border border-red-800"
            >
              Create New Game
            </button>

            <!-- Room ID Input for Join -->
            <div class="pt-2">
              <label class="block text-zinc-400 text-xs uppercase tracking-wider font-bold mb-2">Room Code (6 Characters)</label>
              <div class="flex gap-2">
                <input
                  v-model="roomId"
                  type="text"
                  placeholder="EX: A1B2C3"
                  maxlength="6"
                  class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-center text-zinc-100 uppercase font-mono tracking-widest placeholder-zinc-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
                <button
                  @click="handleJoin"
                  :disabled="!nickname.trim() || !roomId.trim() || roomId.length < 6"
                  class="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-950 font-extrabold px-4 rounded-xl transition-all shadow-lg hover:shadow-amber-500/20 text-sm uppercase font-mono border border-amber-500/30"
                >
                  Join Game
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Instructions or footer details -->
      <div class="mt-8 text-center text-zinc-600 text-xs space-y-1 font-mono">
        <p>HEADBANG with up to 4 players in real time.</p>
        <p>50 LEGENDARY ALBUMS. 5 BRUTAL ATTRIBUTES.</p>
        <p class="text-zinc-700 text-[10px] mt-4">Developed by Bruno Moura Dourado</p>
      </div>
    </div>
  </div>
</template>
