import type { Jogada, LadoPlacar } from '../store/usePartidaStore';

export interface LinhaAproveitamento {
  chave: string;
  nome: string;
  total: number;
  aproveitamento: number;
}

export function ladoOposto(lado: LadoPlacar): LadoPlacar {
  return lado === 'nos' ? 'adversario' : 'nos';
}

export function pontuadorAutomatico(jogada: Jogada): LadoPlacar | null {
  const ladoOrigem = jogada.lado_origem ?? 'nos';

  if (jogada.acao === 'Passe' && jogada.qualidade_passe === 'Erro') {
    return ladoOposto(ladoOrigem);
  }

  if (jogada.resultado === 'Ponto') return ladoOrigem;
  if (jogada.resultado === 'Erro') return ladoOposto(ladoOrigem);

  return null;
}

export function notaDaJogada(jogada: Jogada) {
  if (jogada.acao === 'Passe') {
    if (jogada.qualidade_passe === 'Perfeito') return 100;
    if (jogada.qualidade_passe === 'Bom') return 75;
    if (jogada.qualidade_passe === 'Ruim') return 35;
    return 0;
  }

  if (jogada.resultado === 'Ponto') return 100;
  if (jogada.resultado === 'Positiva') return 75;
  if (jogada.resultado === 'Neutra') return 45;
  if (jogada.resultado === 'Erro') return 0;

  return 50;
}

export function nomeTipoJogada(jogada: Jogada) {
  if (jogada.acao === 'Passe') return `Passe ${jogada.tipo_passe ?? 'sem tipo'}`;
  if (jogada.acao === 'Saque') return `Saque ${jogada.tipo_saque ?? 'sem tipo'}`;
  if (jogada.acao === 'Ataque') return `Ataque ${jogada.tipo_ataque ?? 'sem tipo'}`;
  return jogada.acao;
}

export function calcularAproveitamento(jogadas: Jogada[], lado: LadoPlacar = 'nos') {
  const grupos = new Map<string, { nome: string; total: number; soma: number }>();

  for (const jogada of jogadas.filter((item) => (item.lado_origem ?? 'nos') === lado)) {
    const nome = nomeTipoJogada(jogada);
    const grupo = grupos.get(nome) ?? { nome, total: 0, soma: 0 };
    grupo.total += 1;
    grupo.soma += notaDaJogada(jogada);
    grupos.set(nome, grupo);
  }

  return [...grupos.entries()]
    .map(([chave, grupo]) => ({
      chave,
      nome: grupo.nome,
      total: grupo.total,
      aproveitamento: Math.round(grupo.soma / grupo.total)
    }))
    .sort((a, b) => b.aproveitamento - a.aproveitamento || b.total - a.total);
}

export function contarPorAcao(jogadas: Jogada[], lado: LadoPlacar = 'nos') {
  const contagem = new Map<string, number>();

  for (const jogada of jogadas.filter((item) => (item.lado_origem ?? 'nos') === lado)) {
    contagem.set(jogada.acao, (contagem.get(jogada.acao) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([acao, total]) => ({ acao, total }))
    .sort((a, b) => b.total - a.total || a.acao.localeCompare(b.acao));
}
