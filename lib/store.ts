import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Stats {
    messagesToday: number;
    aiResponses: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface AppState {
    // Config
    systemPrompt: string;
    activePreset: string;
    isAiActive: boolean;

    // Runtime State
    connectionStatus: ConnectionStatus;
    qrCode: string | null;
    stats: Stats;

    // Actions
    setSystemPrompt: (prompt: string) => void;
    setActivePreset: (preset: string) => void;
    toggleAiActive: () => void;
    setConnectionStatus: (status: ConnectionStatus) => void;
    setQrCode: (qr: string | null) => void;
    incrementMessages: () => void;
    incrementAiResponses: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            systemPrompt: `Você é um assistente de vendas experiente da NexusAI.
Seu objetivo é qualificar leads e agendar demonstrações.

TONALIDADE:
- Profissional mas acessível.
- Use emojis moderadamente.
- Seja conciso. Evite blocos de texto grandes.

REGRAS:
1. Nunca invente preços. Se perguntarem, direcione para o site.
2. Se o usuário estiver irritado, transfira para um humano digitando #HUMANO.`,
            activePreset: 'sales',
            isAiActive: false,
            connectionStatus: 'disconnected',
            qrCode: null,
            stats: {
                messagesToday: 0,
                aiResponses: 0,
            },

            setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
            setActivePreset: (preset) => set({ activePreset: preset }),
            toggleAiActive: () => set((state) => ({ isAiActive: !state.isAiActive })),
            setConnectionStatus: (status) => set({ connectionStatus: status }),
            setQrCode: (qr) => set({ qrCode: qr }),
            incrementMessages: () =>
                set((state) => ({
                    stats: { ...state.stats, messagesToday: state.stats.messagesToday + 1 },
                })),
            incrementAiResponses: () =>
                set((state) => ({
                    stats: { ...state.stats, aiResponses: state.stats.aiResponses + 1 },
                })),
        }),
        {
            name: 'nexus-ai-storage',
            partialize: (state) => ({
                systemPrompt: state.systemPrompt,
                activePreset: state.activePreset,
                isAiActive: state.isAiActive,
            }), // Only persist config
        }
    )
);
