<script setup>
import { computed } from 'vue';

const props = defineProps({
  roomState: {
    type: Object,
    required: true
  },
  selfId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['selectAttribute', 'revealCard', 'nextRound', 'leaveRoom']);

const me = computed(() => {
  return props.roomState.players.find(p => p.id === props.selfId);
});

const opponents = computed(() => {
  return props.roomState.players.filter(p => p.id !== props.selfId);
});

const isMyTurn = computed(() => {
  return props.roomState.activePlayerId === props.selfId;
});

const activePlayerName = computed(() => {
  const active = props.roomState.players.find(p => p.id === props.roomState.activePlayerId);
  return active ? active.name : '';
});

const myTopCard = computed(() => {
  return me.value ? me.value.topCard : null;
});

const isMeEliminated = computed(() => {
  return me.value ? me.value.isEliminated : true;
});

const hasRevealed = computed(() => {
  return me.value ? me.value.isReady : false;
});

// Attribute translation helpers
const attrLabels = {
  year: 'Release Year',
  heaviness: 'Heaviness / Aggression',
  complexity: 'Complexity / Technique',
  influence: 'Influence Factor',
  duration: 'Total Duration'
};

const getAttrValueFormatted = (key, value) => {
  if (key === 'duration') return `${value} min`;
  if (key === 'year') return value;
  return value;
};

// Calculate progress bar percentage
const getAttrPercentage = (key, value) => {
  if (key === 'year') {
    // 1970 is 100%, 2026 is 0% (older is better)
    const min = 1970;
    const max = 2026;
    const pct = ((max - value) / (max - min)) * 100;
    return Math.max(0, Math.min(100, pct));
  }
  if (key === 'duration') {
    // Map to maximum of 90 minutes
    return Math.max(0, Math.min(100, (value / 90) * 100));
  }
  // scale 1-100
  return Math.max(0, Math.min(100, value));
};

const getOpponentRevealData = (oppId) => {
  if (props.roomState.roundStatus !== 'resolved' || !props.roomState.roundResults) return null;
  return props.roomState.roundResults.cardsReveal[oppId] || null;
};
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col select-none relative overflow-x-hidden pb-12">
    <!-- Dark Metal Atmospheric overlay -->
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.05)_0%,transparent_50%)] pointer-events-none"></div>

    <!-- Header bar -->
    <header class="w-full bg-zinc-900/80 border-b border-zinc-800/80 backdrop-blur-md px-4 py-3 z-10 flex justify-between items-center shrink-0">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 font-mono italic">
          MASTER OF DECKS
        </h2>
        <span class="text-xs text-zinc-500 font-mono hidden md:inline">|</span>
        <span class="text-xs bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-400 font-mono tracking-wider hidden md:inline">
          SALA: {{ roomState.id }}
        </span>
      </div>

      <button 
        @click="emit('leaveRoom')"
        class="text-xs bg-zinc-950 border border-zinc-850 hover:bg-zinc-850 hover:text-red-400 text-zinc-400 px-3 py-1.5 rounded-lg font-mono transition-all uppercase"
      >
        Leave Room
      </button>
    </header>

    <!-- Limbo / Stakes Bar -->
    <div class="w-full bg-zinc-950 py-2 border-b border-zinc-900 shrink-0 px-4">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <!-- Limbo counter -->
        <div class="flex items-center gap-2">
          <span class="text-lg">💀</span>
          <span class="text-xs text-zinc-500 uppercase tracking-widest font-bold">Limbo:</span>
          <span 
            class="font-mono text-sm font-black px-2 py-0.5 rounded"
            :class="roomState.limboCount > 0 
              ? 'bg-red-950/80 border border-red-800 text-red-500 animate-pulse' 
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
            "
          >
            {{ roomState.limboCount }} {{ roomState.limboCount === 1 ? 'card' : 'cards' }}
          </span>
        </div>

        <!-- Room ID for mobile -->
        <div class="md:hidden">
          <span class="text-xs bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850 text-zinc-400 font-mono tracking-wider">
            ROOM: {{ roomState.id }}
          </span>
        </div>

        <!-- Scores overview -->
        <div class="flex gap-2.5 items-center">
          <span class="text-xs text-zinc-500 uppercase tracking-widest font-bold hidden sm:inline">Deck:</span>
          <div class="flex gap-1.5">
            <span 
              v-for="p in roomState.players" 
              :key="p.id" 
              class="text-xs px-2 py-0.5 rounded font-mono border"
              :class="p.id === selfId 
                ? 'bg-red-950/30 border-red-900 text-red-400' 
                : p.isEliminated 
                  ? 'bg-zinc-950 border-zinc-900 text-zinc-700 line-through' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              "
            >
              {{ p.name.split(' ')[0] }}: {{ p.cardCount }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main board container -->
    <main class="flex-1 w-full max-w-7xl mx-auto px-4 py-4 flex flex-col md:grid md:grid-cols-12 gap-6 items-stretch min-h-0">
      
      <!-- OPPONENTS COLUMN (TOP ON MOBILE, LEFT/RIGHT ON DESKTOP) -->
      <section class="md:col-span-4 flex flex-col gap-4">
        <h3 class="text-zinc-500 text-xs uppercase tracking-widest font-bold">Opponents</h3>
        
        <div class="flex flex-col gap-3">
          <div 
            v-for="opp in opponents" 
            :key="opp.id" 
            class="bg-zinc-900/90 border rounded-xl p-4 flex flex-col gap-3 transition-all relative overflow-hidden"
            :class="[
              opp.isEliminated ? 'border-zinc-900 opacity-40 bg-zinc-950' : 'border-zinc-800',
              roomState.activePlayerId === opp.id && roomState.roundStatus === 'choosing' ? 'ring-1 ring-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : ''
            ]"
          >
            <!-- Orange top light if active choosing -->
            <div v-if="roomState.activePlayerId === opp.id && roomState.roundStatus === 'choosing'" class="absolute top-0 left-0 right-0 h-0.5 bg-amber-500 animate-pulse"></div>

            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-base">{{ opp.isEliminated ? '☠️' : (opp.isBot ? '🤖' : '🎸') }}</span>
                <div>
                  <h4 class="font-bold text-sm tracking-wide" :class="opp.isEliminated ? 'text-zinc-500 line-through' : 'text-zinc-200'">
                    {{ opp.name }}
                  </h4>
                  <span v-if="opp.isHost" class="text-[9px] text-amber-500 font-bold uppercase tracking-wider mr-1">Leader</span>
                  <span v-if="opp.isBot" class="text-[9px] text-blue-400 font-bold uppercase tracking-wider">Bot</span>
                </div>
              </div>

              <!-- Deck count pill -->
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] text-zinc-500 font-mono">Cards:</span>
                <span class="text-xs font-mono font-bold px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded">
                  {{ opp.cardCount }}
                </span>
              </div>
            </div>

            <!-- Status Indicator / Card State -->
            <div v-if="!opp.isEliminated" class="mt-1">
              <!-- Choosing Status -->
              <div v-if="roomState.roundStatus === 'choosing'" class="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                <span v-if="roomState.activePlayerId === opp.id" class="flex h-2 w-2 relative">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span>{{ roomState.activePlayerId === opp.id ? 'Choosing attribute...' : 'Waiting for turn...' }}</span>
              </div>

              <!-- Revealing Status -->
              <div v-else-if="roomState.roundStatus === 'revealing'" class="flex items-center justify-between text-xs font-mono">
                <span class="text-zinc-500">Choice:</span>
                <span 
                  class="px-2.5 py-0.5 rounded text-[10px] font-bold border"
                  :class="opp.isReady 
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' 
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 animate-pulse'
                  "
                >
                  {{ opp.isReady ? 'READY / REVEALED' : 'WAITING' }}
                </span>
              </div>

              <!-- Resolved Status (REVEAL CARD DETAILS) -->
              <div v-else-if="roomState.roundStatus === 'resolved' && getOpponentRevealData(opp.id)" class="bg-zinc-950/80 border border-zinc-850 rounded-lg p-2.5 space-y-2">
                <div class="flex items-center gap-2">
                  <img 
                    :src="getOpponentRevealData(opp.id).card.cover"
                    alt="Cover"
                    class="w-10 h-10 object-cover rounded border border-zinc-800 shrink-0"
                  />
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-zinc-300 truncate">{{ getOpponentRevealData(opp.id).card.album }}</p>
                    <p class="text-[10px] text-zinc-500 truncate">{{ getOpponentRevealData(opp.id).card.band }}</p>
                  </div>
                </div>

                <div class="flex justify-between items-center text-xs font-mono border-t border-zinc-900 pt-1.5">
                  <span class="text-zinc-500 text-[10px] uppercase truncate max-w-[120px]">
                    {{ attrLabels[roomState.selectedAttribute] }}:
                  </span>
                  <span 
                    class="font-black text-xs"
                    :class="roomState.roundResults.winnerId === opp.id ? 'text-amber-400' : 'text-zinc-300'"
                  >
                    {{ getAttrValueFormatted(roomState.selectedAttribute, getOpponentRevealData(opp.id).value) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ACTIVE GAME BOARD COLUMN -->
      <section class="md:col-span-8 flex flex-col justify-between gap-6">
        
        <!-- ROUND STATUS NOTIFICATION BOX -->
        <div class="bg-zinc-900/50 border border-zinc-850 rounded-2xl p-4 text-center backdrop-blur-sm relative overflow-hidden shrink-0">
          <div v-if="roomState.roundStatus === 'choosing'">
            <div v-if="isMyTurn && !isMeEliminated" class="space-y-1">
              <h4 class="text-amber-500 font-extrabold tracking-widest text-sm uppercase font-mono animate-pulse">
                ⚡ Your turn to choose ⚡
              </h4>
              <p class="text-zinc-400 text-xs">Select the best attribute of your card by clicking it!</p>
            </div>
            <div v-else class="space-y-1">
              <h4 class="text-zinc-400 font-bold tracking-widest text-sm uppercase font-mono">
                TURN OF {{ activePlayerName.toUpperCase() }}
              </h4>
              <p class="text-zinc-500 text-xs">The opponent is deciding which attribute to dispute...</p>
            </div>
          </div>

          <div v-else-if="roomState.roundStatus === 'revealing'">
            <div class="space-y-2">
              <p class="text-xs text-zinc-400 font-mono">
                Attribute in play: 
                <span class="text-amber-400 font-black px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded ml-1">
                  {{ attrLabels[roomState.selectedAttribute] }}
                </span>
              </p>

              <!-- Reveal Action Button -->
              <div v-if="!isMeEliminated && !hasRevealed">
                <button 
                  @click="emit('revealCard')"
                  class="bg-gradient-to-r from-red-700 to-orange-600 hover:from-red-600 hover:to-orange-500 text-white font-extrabold text-xs uppercase tracking-widest px-8 py-3 rounded-xl border border-red-800 shadow-lg shadow-red-950/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all font-mono cursor-pointer"
                >
                  REVEAL MY CARD 🔥
                </button>
              </div>
              <div v-else-if="isMeEliminated">
                <p class="text-xs text-zinc-500 font-mono animate-pulse">You were eliminated. Waiting for reveal...</p>
              </div>
              <div v-else>
                <p class="text-xs text-zinc-400 font-mono animate-pulse">You revealed! Waiting for the rest of the band...</p>
              </div>
            </div>
          </div>

          <div v-else-if="roomState.roundStatus === 'resolved' && roomState.roundResults">
            <div class="space-y-3">
              <!-- Round winner announcement -->
              <div>
                <h4 
                  class="font-black text-xl tracking-wide uppercase font-mono"
                  :class="roomState.roundResults.isTie ? 'text-zinc-400' : (roomState.roundResults.winnerId === selfId ? 'text-emerald-400' : 'text-red-500')"
                >
                  {{ roomState.roundResults.isTie ? 'TIE!' : `${roomState.roundResults.winnerName} WINS THE ROUND!` }}
                </h4>
                <p class="text-zinc-400 text-xs mt-1 font-mono max-w-xl mx-auto">{{ roomState.roundResults.reason }}</p>
              </div>

              <!-- Next Round / Game Over actions -->
              <div class="flex justify-center gap-3">
                <div v-if="roomState.roundResults.gameOver">
                  <h3 class="text-amber-500 font-black text-2xl uppercase tracking-widest animate-bounce">
                    🏆 {{ roomState.roundResults.gameWinner }} IS THE MASTER OF DECKS! 🏆
                  </h3>
                  <button 
                    @click="emit('leaveRoom')"
                    class="mt-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-extrabold text-xs uppercase tracking-wider px-8 py-3 rounded-xl transition-all font-mono"
                  >
                    Back to Main Menu
                  </button>
                </div>

                <div v-else-if="!isMeEliminated">
                  <button 
                    @click="emit('nextRound')"
                    class="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-extrabold text-xs uppercase tracking-wider px-8 py-3.5 rounded-xl hover:border-zinc-500 transition-all font-mono flex items-center gap-2 cursor-pointer"
                  >
                    Next Round ➔
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- MY CARD / BOARD SECTION -->
        <div class="flex-1 flex items-center justify-center min-h-[300px]">
          <!-- Spectator Mode -->
            <div v-if="isMeEliminated" class="text-center space-y-4 max-w-sm">
            <span class="text-5xl block">💀</span>
            <h3 class="text-xl font-bold uppercase tracking-wider text-zinc-500 font-mono">You've Been Eliminated!</h3>
            <p class="text-zinc-600 text-xs">Your deck has run out of cards. But relax, you can keep watching the clash as a spectator in the crowd.</p>
          </div>

          <!-- My active card -->
          <div 
            v-else-if="myTopCard" 
            class="w-full max-w-sm bg-zinc-900 border rounded-2xl p-5 shadow-2xl relative overflow-hidden transition-all duration-300 flex flex-col justify-between"
            :class="[
              isMyTurn && roomState.roundStatus === 'choosing' 
                ? 'border-amber-500 shadow-[0_0_35px_rgba(245,158,11,0.2)]' 
                : 'border-zinc-800',
              roomState.roundStatus === 'resolved' 
                ? (roomState.roundResults?.winnerId === selfId ? 'border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.2)]' : 'border-red-900/30 opacity-70')
                : ''
            ]"
          >
            <!-- Orange/red/green glowing indicator bar depending on state -->
            <div 
              class="absolute top-0 left-0 right-0 h-1.5 transition-colors duration-300"
              :class="[
                roomState.roundStatus === 'resolved'
                  ? (roomState.roundResults?.winnerId === selfId ? 'bg-emerald-500' : 'bg-red-900/30')
                  : (isMyTurn && roomState.roundStatus === 'choosing' ? 'bg-amber-500' : 'bg-zinc-800')
              ]"
            ></div>

            <!-- Card Header: Title and Band -->
            <div class="mb-3">
              <span class="text-[9px] font-mono tracking-widest text-zinc-500 uppercase font-black">MY TOP CARD</span>
              <h3 class="text-xl font-black text-zinc-100 uppercase tracking-tight truncate leading-tight mt-0.5">
                {{ myTopCard.album }}
              </h3>
              <p class="text-xs text-red-500 font-bold tracking-wide uppercase truncate mt-0.5">
                {{ myTopCard.band }}
              </p>
            </div>

            <!-- Card Image -->
            <div class="relative h-44 w-full bg-zinc-950 rounded-xl overflow-hidden mb-4 border border-zinc-800 shrink-0">
              <img 
                :src="myTopCard.cover"
                :alt="myTopCard.album"
                class="w-full h-full object-cover select-none"
              />
              <!-- Small Floating Card Count badge -->
              <div class="absolute bottom-2 right-2 px-2.5 py-1 bg-zinc-950/90 border border-zinc-800 rounded-lg text-[10px] font-mono font-bold text-zinc-300 backdrop-blur">
                Deck: {{ me.cardCount }}
              </div>
            </div>

            <!-- Attributes -->
            <div class="space-y-2.5">
              <div 
                v-for="(val, key) in myTopCard.attributes"
                :key="key"
                @click="isMyTurn && roomState.roundStatus === 'choosing' && emit('selectAttribute', key)"
                class="group flex flex-col gap-1 rounded-xl p-2 transition-all"
                :class="[
                  isMyTurn && roomState.roundStatus === 'choosing' 
                    ? 'cursor-pointer hover:bg-zinc-850 hover:shadow-inner border border-transparent hover:border-zinc-800' 
                    : 'border border-transparent',
                  roomState.selectedAttribute === key
                    ? 'bg-amber-950/30 border-amber-900/60 ring-1 ring-amber-500/20'
                    : 'bg-zinc-950/40'
                ]"
              >
                <!-- Attribute Labels & Value -->
                <div class="flex justify-between items-center text-xs">
                  <span 
                    class="font-mono text-[10px] font-bold uppercase transition-colors"
                    :class="[
                      roomState.selectedAttribute === key ? 'text-amber-400' : 'text-zinc-400',
                      isMyTurn && roomState.roundStatus === 'choosing' ? 'group-hover:text-amber-400' : ''
                    ]"
                  >
                    {{ attrLabels[key] }}
                    <span v-if="key === 'year'" class="text-[8px] text-zinc-600 lowercase ml-0.5">(Lowest wins)</span>
                  </span>
                  <span 
                    class="font-black font-mono text-xs transition-colors"
                    :class="roomState.selectedAttribute === key ? 'text-amber-400' : 'text-zinc-200'"
                  >
                    {{ getAttrValueFormatted(key, val) }}
                  </span>
                </div>

                <!-- Progress Bar -->
                <div class="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-950/60">
                  <div 
                    class="h-full rounded-full transition-all duration-500"
                    :class="[
                      roomState.selectedAttribute === key 
                        ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' 
                        : (isMyTurn && roomState.roundStatus === 'choosing' ? 'bg-zinc-700 group-hover:bg-amber-600/70' : 'bg-zinc-700')
                    ]"
                    :style="{ width: `${getAttrPercentage(key, val)}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
