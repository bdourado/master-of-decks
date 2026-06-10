import { ref, onMounted, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

// Retrieve the socket URL from Vite environment variables
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export function useSocket() {
    const socket = ref(null);
    const isConnected = ref(false);

    /**
     * Initializes the socket connection and sets up global status listeners
     */
    const connect = () => {
        if (socket.value?.connected) return;

        socket.value = io(SOCKET_URL, {
            autoConnect: true,
            transports: ['websocket'], // Forces WebSocket transport layer directly
        });

        socket.value.on('connect', () => {
            isConnected.value = true;
        });

        socket.value.on('disconnect', () => {
            isConnected.value = false;
        });
    };

    /**
     * Disconnects the current socket instance safely
     */
    const disconnect = () => {
        if (socket.value) {
            socket.value.disconnect();
        }
    };

    /**
     * Emits a payload to a specific event on the server
     * @param {string} event - The name of the event
     * @param {any} data - The payload to be sent
     */
    const emit = (event, data) => {
        if (socket.value) {
            socket.value.emit(event, data);
        } else {
            console.warn(`Socket is not connected. Cannot emit event: ${event}`);
        }
    };

    /**
     * Registers an event listener that automatically cleans up when the component unmounts
     * @param {string} event - The name of the event to listen to
     * @param {Function} callback - The execution block when the event triggers
     */
    const on = (event, callback) => {
        onMounted(() => {
            if (!socket.value) connect();
            socket.value?.on(event, callback);
        });

        // Automatically unregisters the event to prevent memory leaks across views
        onUnmounted(() => {
            socket.value?.off(event, callback);
        });
    };

    // Auto-connect when the composable is instantiated within a component
    onMounted(() => {
        connect();
    });

    // Optional global cleanup when the component hosting the socket unmounts
    onUnmounted(() => {
        disconnect();
    });

    return {
        socket,
        isConnected,
        connect,
        disconnect,
        emit,
        on
    };
}