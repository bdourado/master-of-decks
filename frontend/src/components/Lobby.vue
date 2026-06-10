<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  roomId: {
    type: String,
    required: true
  },
  players: {
    type: Array,
    required: true
  },
  selfId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['startGame', 'leaveRoom', 'addBot', 'removePlayer']);

const copied = ref(false);

const shareLink = computed(() => {
  return `${window.location.origin}?room=${props.roomId}`;
});

const isHost = computed(() => {
  const me = props.players.find(p => p.id === props.selfId);
  return me ? me.isHost : false;
});

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
};
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 px-4 relative overflow-hidden select-none">
    <!-- Dark Metal Atmospheric background -->
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.08)_0%,transparent_70%)] pointer-events-none"></div>
    <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-red-900/5 rounded-full blur-3xl pointer-events-none"></div>

    <div class="w-full max-w-lg z-10 space-y-6">
      <!-- Header -->
      <div class="text-center">
        <span class="px-3 py-1 rounded-full text-[10px] font-bold bg-red-950 border border-red-800 text-red-400 tracking-widest uppercase">
          Backstage / Lobby
        </span>
        <h1 class="text-3xl font-extrabold uppercase tracking-tight text-zinc-100 mt-3 font-mono">
          Cranking the amps while we wait for the rest of the band to show up...
        </h1>
      </div>

      <!-- Main Room Card -->
      <div class="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden space-y-6">
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-amber-500"></div>

        <!-- Room ID Details -->
        <div class="text-center py-4 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
          <p class="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Room Code</p>
          <p class="text-4xl font-black font-mono tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 select-all">
            {{ roomId }}
          </p>
        </div>

        <!-- Share Link -->
        <div class="space-y-2">
          <label class="block text-zinc-400 text-xs uppercase tracking-wider font-bold">Invite Friends</label>
          <div class="flex gap-2">
            <input 
              type="text" 
              readonly 
              :value="shareLink"
              class="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-400 font-mono focus:outline-none select-all"
            />
            <button 
              @click="copyLink"
              class="px-5 rounded-xl font-bold text-xs uppercase font-mono tracking-wider transition-all duration-200 shrink-0 flex items-center gap-1.5 border cursor-pointer"
              :class="copied 
                ? 'bg-emerald-950 border-emerald-800 text-emerald-400' 
                : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-200'
              "
            >
              <svg v-if="copied" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
              <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
            </button>
          </div>
        </div>

        <!-- Player List -->
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <label class="text-zinc-400 text-xs uppercase tracking-wider font-bold">Band Members ({{ players.length }}/4)</label>
            <span class="text-[10px] font-mono text-zinc-500">Minimum 2 to start</span>
          </div>

          <div class="grid gap-2">
            <!-- Joined Players -->
            <div 
              v-for="p in players" 
              :key="p.id" 
              class="flex items-center justify-between px-4 py-3 bg-zinc-950/80 border rounded-xl"
              :class="p.id === selfId ? 'border-red-900/50 bg-red-950/5' : 'border-zinc-850'"
            >
              <div class="flex items-center gap-2.5">
                <!-- Avatar / Instrument -->
                <div class="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono text-sm font-bold text-zinc-400 shrink-0">
                  🎸
                </div>
                <div>
                  <span class="font-bold text-sm tracking-wide" :class="p.id === selfId ? 'text-red-400' : 'text-zinc-200'">
                    {{ p.name }}
                  </span>
                  <span v-if="p.id === selfId" class="text-[10px] text-zinc-500 font-mono ml-1.5">(Você)</span>
                </div>
              </div>

              <!-- Badges -->
              <div class="flex items-center">
                <span v-if="p.isBot" class="px-2 py-0.5 rounded bg-blue-950 border border-blue-900 text-blue-400 text-[10px] font-extrabold tracking-wider uppercase font-mono mr-1.5">
                  🤖 BOT
                </span>
                <span v-if="p.isHost" class="px-2 py-0.5 rounded bg-amber-950 border border-amber-900 text-amber-500 text-[10px] font-extrabold tracking-wider uppercase font-mono">
                  ★ LEADER
                </span>
                <span v-else-if="!p.isBot" class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-medium uppercase font-mono">
                  Pronto
                </span>
                
                <button 
                  v-if="isHost && p.isBot" 
                  @click="emit('removePlayer', p.id)"
                  class="ml-2 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 hover:border-red-700 text-red-400 p-1 w-6 h-6 rounded-lg text-xs font-bold font-mono transition-all inline-flex items-center justify-center cursor-pointer"
                  title="Remover Bot"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Empty slots -->
            <div 
              v-for="i in (4 - players.length)" 
              :key="'empty-' + i" 
              class="flex items-center justify-center py-3.5 border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20 text-zinc-700 text-xs font-mono select-none"
            >
              <span class="animate-pulse">Waiting for one more bandmate...</span>
            </div>
          </div>
        </div>

        <!-- Start/Action controls -->
        <div class="pt-4 space-y-3">
          <!-- Add Bot button for Host -->
          <div v-if="isHost && players.length < 4" class="pb-1">
            <button 
              @click="emit('addBot')"
              class="w-full bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 font-bold py-3.5 px-4 rounded-xl text-xs uppercase font-mono tracking-wider transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg cursor-pointer"
            >
              🤖 Add Metal Bot
            </button>
          </div>

          <!-- Start button for Host -->
          <div v-if="isHost">
            <button 
              @click="emit('startGame')"
              :disabled="players.length < 2"
              class="w-full bg-gradient-to-r from-red-700 to-orange-600 hover:from-red-600 hover:to-orange-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 disabled:border-zinc-850 disabled:cursor-not-allowed text-white font-extrabold py-4 px-4 rounded-xl shadow-xl hover:shadow-red-900/20 transition-all border border-red-800/50 uppercase tracking-widest text-sm font-mono"
            >
              START THE SHOW ⚡
            </button>
            <p v-if="players.length < 2" class="text-center text-[10px] text-red-500/80 font-mono mt-2">
              Invite at least one more player to kick off the chaos!
            </p>
          </div>

          <!-- Non-Host Status display -->
          <div v-else class="text-center py-3 bg-zinc-950/40 rounded-xl border border-zinc-850">
            <p class="text-xs text-zinc-400 font-mono animate-pulse">
              Waiting for the band leader to start the show...
            </p>
          </div>

          <button 
            @click="emit('leaveRoom')"
            class="w-full bg-transparent hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 font-bold py-2 rounded-xl text-xs uppercase font-mono tracking-wider transition-all cursor-pointer"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
