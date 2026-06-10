# 🤘 MASTER OF DECKS — Ultimate Album Clash

**Master of Decks** is a real-time online multiplayer card game inspired by the classic "Top Trumps" mechanics, focusing on the **50 greatest Heavy Metal albums of all time**. The game is designed for up to 4 players to battle for riff supremacy directly from their own devices (desktop or smartphone).

The application architecture utilizes **WebSockets** to ensure instant synchronization across all screens. When the current player chooses an attribute, all other connected browsers react in real-time.

---

## 🚀 Tech Stack

This project is structured as a **Monorepo**, split into two main sections:

* **Frontend (Client):**
    * [Vue 3](https://vuejs.org/) (Composition API using `<script setup>`)
    * [Tailwind CSS](https://tailwindcss.com/) (Responsive styling with a dark/metal aesthetic)
    * [Socket.io-Client](https://socket.io/docs/v4/client-api/) (WebSocket connection handler in the browser)
* **Backend (Server):**
    * [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
    * [Socket.io](https://socket.io/) (Room management, active connection tracking, and game engine logic)

---

## 🎮 Game Rules & Mechanics

1.  **Fair Distribution:** The starting deck consists of **50 iconic albums**. When the game begins, the server shuffles the cards (Fisher-Yates Algorithm) and deals exactly **12 cards to each of the 4 players** (2 cards are discarded to maintain a balanced split).
2.  **Restricted Visibility:** Players can only see the card currently at the top of their deck.
3.  **Attribute Selection:** The active player chooses one of the 5 brutal attributes from their card. All other devices are locked out, waiting for the decision.
    * 📅 **Release Year** (*Special Rule:* The **LOWEST** value wins, giving old-school classics a heavy advantage).
    * ⚡ **Heaviness / Aggression** (Scale 1-100 / Highest wins).
    * 🧠 **Complexity / Technicality** (Scale 1-100 / Highest wins).
    * 🏆 **Influence Factor** (Scale 1-100 / Highest wins).
    * ⏳ **Total Duration** (In minutes / Highest wins).
4.  **The Card Limbo (Tiebreaker):** If there is a tie for the highest value, all cards played in that round are sent to the **Limbo** (a temporary neutral zone). The active player retains the right to choose the next attribute using their next card. Whoever wins the following round takes both the new cards and all cards accumulated in Limbo.
5.  **Victory Condition:** Any player who reaches 0 cards is eliminated (and moves into spectator mode). The match ends when a single metalhead captures all 50 cards in the game.