import { io } from 'socket.io-client';
import type { Jogada } from '../store/usePartidaStore';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface PartidaResumo {
  id: string;
  data: string | null;
  equipe_nos: string | null;
  equipe_adv: string | null;
}

interface JogadaErroPayload {
  id?: string;
  error: string;
}

interface SyncHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onConnectError?: (message: string) => void;
  onJogadaAck?: (id: string) => void;
  onJogadaError?: (payload: JogadaErroPayload) => void;
}

export const socket = io(SERVER_URL, {
  autoConnect: false,
});

export const syncService = {
  connect: (handlers: SyncHandlers = {}) => {
    const handleConnect = () => handlers.onConnect?.();
    const handleDisconnect = (reason: string) => handlers.onDisconnect?.(reason);
    const handleConnectError = (error: Error) => handlers.onConnectError?.(error.message);
    const handleJogadaAck = (id: string) => handlers.onJogadaAck?.(id);
    const handleJogadaError = (payload: JogadaErroPayload) => handlers.onJogadaError?.(payload);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('jogada:ack', handleJogadaAck);
    socket.on('jogada:error', handleJogadaError);
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('jogada:ack', handleJogadaAck);
      socket.off('jogada:error', handleJogadaError);
      socket.disconnect();
    };
  },

  enviarJogada: (jogada: Jogada) => {
    if (!socket.connected) return false;

    socket.emit('jogada:nova', jogada);
    return true;
  },

  listarPartidas: async (): Promise<PartidaResumo[]> => {
    const resposta = await fetch(`${SERVER_URL}/partidas`);
    if (!resposta.ok) throw new Error('Falha ao carregar partidas');

    return resposta.json();
  },

  listarJogadasDaPartida: async (idPartida: string): Promise<Jogada[]> => {
    const resposta = await fetch(`${SERVER_URL}/partidas/${idPartida}/jogadas`);
    if (!resposta.ok) throw new Error('Falha ao carregar jogadas da partida');

    return resposta.json();
  }
};
