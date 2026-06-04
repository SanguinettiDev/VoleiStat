import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type QualidadePasse = 'Perfeito' | 'Bom' | 'Ruim' | 'Erro';
export type LadoPlacar = 'nos' | 'adversario';
export type LadoQuadra = 'nos' | 'adversario';
export type TipoPasse = 'Manchete' | 'Toque' | 'Emergencia';
export type TipoSaque = 'Viagem' | 'Flutuante' | 'Curto' | 'Tatico';
export type TipoAtaque = 'Diagonal' | 'Paralela' | 'Centro' | 'Largada';
export type ResultadoJogada = 'Ponto' | 'Positiva' | 'Neutra' | 'Erro';

export interface DetalhesJogada {
  ladoOrigem?: LadoQuadra;
  zonaDestino?: number;
  ladoDestino?: LadoQuadra;
  tipoPasse?: TipoPasse;
  tipoSaque?: TipoSaque;
  tipoAtaque?: TipoAtaque;
  resultado?: ResultadoJogada;
}

export interface PlacarSet {
  set: number;
  nos: number;
  adversario: number;
  vencedor: LadoPlacar;
}

export interface Jogada {
  id: string;
  id_partida: string;
  set: number;
  acao: string;
  zona: number;
  camisa: string;
  timestamp: number;
  zona_origem?: number;
  lado_origem?: LadoQuadra;
  zona_destino?: number;
  lado_destino?: LadoQuadra;
  qualidade_passe?: QualidadePasse;
  tipo_passe?: TipoPasse;
  tipo_saque?: TipoSaque;
  tipo_ataque?: TipoAtaque;
  resultado?: ResultadoJogada;
}

interface PartidaState {
  partida: { id: string } | null;
  jogadas: Jogada[];
  timeEmQuadra: Record<number, string>;
  timeAdversarioEmQuadra: Record<number, string>;
  setAtual: number;
  placarAtual: Record<LadoPlacar, number>;
  setsVencidos: Record<LadoPlacar, number>;
  historicoSets: PlacarSet[];
  sacadorAtual: LadoPlacar | null;
  partidaEncerrada: boolean;
  vencedorPartida: LadoPlacar | null;
  acaoPendente: string | null;
  qualidadePassePendente: QualidadePasse | null;
  iniciarPartida: () => void;
  definirCamisa: (zona: number, camisa: string) => void;
  definirCamisaAdversaria: (zona: number, camisa: string) => void;
  definirSacador: (lado: LadoPlacar) => void;
  pontuar: (lado: LadoPlacar) => void;
  removerPonto: (lado: LadoPlacar) => void;
  prepararAcao: (acao: string) => void;
  definirQualidadePasse: (qualidade: QualidadePasse) => void;
  registrarJogadaNaQuadra: (zona: number, detalhes?: DetalhesJogada) => Jogada | null;
}

const zonasIniciais = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' };

function rodarFormacao(time: Record<number, string>) {
  return {
    1: time[2] ?? '',
    2: time[3] ?? '',
    3: time[4] ?? '',
    4: time[5] ?? '',
    5: time[6] ?? '',
    6: time[1] ?? ''
  };
}

function alvoDoSet(setAtual: number) {
  return setAtual === 5 ? 15 : 25;
}

function vencedorDoSet(setAtual: number, placar: Record<LadoPlacar, number>): LadoPlacar | null {
  const alvo = alvoDoSet(setAtual);
  const diferenca = Math.abs(placar.nos - placar.adversario);

  if (diferenca < 2) return null;
  if (placar.nos >= alvo && placar.nos > placar.adversario) return 'nos';
  if (placar.adversario >= alvo && placar.adversario > placar.nos) return 'adversario';

  return null;
}

export const usePartidaStore = create<PartidaState>((set, get) => ({
  partida: null,
  jogadas: [],
  timeEmQuadra: zonasIniciais,
  timeAdversarioEmQuadra: zonasIniciais,
  setAtual: 1,
  placarAtual: { nos: 0, adversario: 0 },
  setsVencidos: { nos: 0, adversario: 0 },
  historicoSets: [],
  sacadorAtual: null,
  partidaEncerrada: false,
  vencedorPartida: null,
  acaoPendente: null,
  qualidadePassePendente: null,

  iniciarPartida: () => set({
    partida: { id: uuidv4() },
    jogadas: [],
    timeEmQuadra: { ...zonasIniciais },
    timeAdversarioEmQuadra: { ...zonasIniciais },
    setAtual: 1,
    placarAtual: { nos: 0, adversario: 0 },
    setsVencidos: { nos: 0, adversario: 0 },
    historicoSets: [],
    sacadorAtual: null,
    partidaEncerrada: false,
    vencedorPartida: null,
    acaoPendente: null,
    qualidadePassePendente: null
  }),

  definirCamisa: (zona, camisa) => set((state) => ({
    timeEmQuadra: { ...state.timeEmQuadra, [zona]: camisa }
  })),

  definirCamisaAdversaria: (zona, camisa) => set((state) => ({
    timeAdversarioEmQuadra: { ...state.timeAdversarioEmQuadra, [zona]: camisa }
  })),

  definirSacador: (lado) => set({ sacadorAtual: lado }),

  pontuar: (lado) => set((state) => {
    if (state.partidaEncerrada) return state;

    const ganhouSaque = state.sacadorAtual !== null && state.sacadorAtual !== lado;
    const timeEmQuadra = ganhouSaque && lado === 'nos'
      ? rodarFormacao(state.timeEmQuadra)
      : state.timeEmQuadra;
    const timeAdversarioEmQuadra = ganhouSaque && lado === 'adversario'
      ? rodarFormacao(state.timeAdversarioEmQuadra)
      : state.timeAdversarioEmQuadra;
    const placarAtualizado = {
      ...state.placarAtual,
      [lado]: state.placarAtual[lado] + 1
    };
    const vencedorSet = vencedorDoSet(state.setAtual, placarAtualizado);

    if (!vencedorSet) {
      return {
        placarAtual: placarAtualizado,
        sacadorAtual: lado,
        timeEmQuadra,
        timeAdversarioEmQuadra
      };
    }

    const setsVencidos = {
      ...state.setsVencidos,
      [vencedorSet]: state.setsVencidos[vencedorSet] + 1
    };
    const partidaEncerrada = setsVencidos[vencedorSet] >= 3;
    const setFechado: PlacarSet = {
      set: state.setAtual,
      nos: placarAtualizado.nos,
      adversario: placarAtualizado.adversario,
      vencedor: vencedorSet
    };

    return {
      placarAtual: partidaEncerrada ? placarAtualizado : { nos: 0, adversario: 0 },
      setsVencidos,
      historicoSets: [...state.historicoSets, setFechado],
      setAtual: partidaEncerrada ? state.setAtual : state.setAtual + 1,
      sacadorAtual: partidaEncerrada ? lado : null,
      timeEmQuadra,
      timeAdversarioEmQuadra,
      partidaEncerrada,
      vencedorPartida: partidaEncerrada ? vencedorSet : null,
      acaoPendente: null,
      qualidadePassePendente: null
    };
  }),

  removerPonto: (lado) => set((state) => {
    if (state.partidaEncerrada || state.placarAtual[lado] === 0) return state;

    return {
      placarAtual: {
        ...state.placarAtual,
        [lado]: state.placarAtual[lado] - 1
      }
    };
  }),

  prepararAcao: (acao) => set({ acaoPendente: acao, qualidadePassePendente: null }),

  definirQualidadePasse: (qualidade) => set({ qualidadePassePendente: qualidade }),

  registrarJogadaNaQuadra: (zona, detalhes = {}) => {
    const state = get();
    if (!state.partida || !state.acaoPendente) return null;
    if (state.acaoPendente === 'Passe' && !state.qualidadePassePendente) return null;

    const ladoOrigem = detalhes.ladoOrigem ?? 'nos';
    const timeOrigem = ladoOrigem === 'adversario'
      ? state.timeAdversarioEmQuadra
      : state.timeEmQuadra;
    const camisa = timeOrigem[zona] || 'Sem Camisa';
    const qualidadePasse = state.acaoPendente === 'Passe'
      ? state.qualidadePassePendente
      : null;

    const novaJogada: Jogada = {
      id: uuidv4(),
      id_partida: state.partida.id,
      set: state.setAtual,
      acao: state.acaoPendente,
      zona: zona,
      camisa: camisa,
      timestamp: Date.now(),
      zona_origem: zona,
      lado_origem: ladoOrigem,
      ...(detalhes.zonaDestino ? { zona_destino: detalhes.zonaDestino } : {}),
      ...(detalhes.ladoDestino ? { lado_destino: detalhes.ladoDestino } : {}),
      ...(qualidadePasse ? { qualidade_passe: qualidadePasse } : {}),
      ...(detalhes.tipoPasse ? { tipo_passe: detalhes.tipoPasse } : {}),
      ...(detalhes.tipoSaque ? { tipo_saque: detalhes.tipoSaque } : {}),
      ...(detalhes.tipoAtaque ? { tipo_ataque: detalhes.tipoAtaque } : {}),
      ...(detalhes.resultado ? { resultado: detalhes.resultado } : {})
    };

    set((prevState) => ({
      jogadas: [...prevState.jogadas, novaJogada],
      acaoPendente: null,
      qualidadePassePendente: null
    }));

    return novaJogada;
  }
}));
