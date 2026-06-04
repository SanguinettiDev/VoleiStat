import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, BarChart3, CalendarClock, Gauge, ListChecks, Trophy, Users } from 'lucide-react';
import { syncService } from '../services/sync';
import type { PartidaResumo } from '../services/sync';
import type { Jogada, LadoPlacar } from '../store/usePartidaStore';
import { calcularAproveitamento, contarPorAcao, pontuadorAutomatico } from '../utils/estatisticas';

interface DashboardPartidasProps {
  onVoltar: () => void;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatarData(data: string | null) {
  if (!data) return 'Sem data';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(data));
}

function contarPontosEstimados(jogadas: Jogada[]) {
  return jogadas.reduce<Record<LadoPlacar, number>>((placar, jogada) => {
    const pontuador = pontuadorAutomatico(jogada);
    if (!pontuador) return placar;

    return { ...placar, [pontuador]: placar[pontuador] + 1 };
  }, { nos: 0, adversario: 0 });
}

function contarSets(jogadas: Jogada[]) {
  return new Set(jogadas.map((jogada) => jogada.set)).size;
}

export function DashboardPartidas({ onVoltar }: DashboardPartidasProps) {
  const [partidas, setPartidas] = useState<PartidaResumo[]>([]);
  const [partidaSelecionada, setPartidaSelecionada] = useState<PartidaResumo | null>(null);
  const [jogadas, setJogadas] = useState<Jogada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregarPartidas() {
      try {
        setCarregando(true);
        setErro(null);
        const lista = await syncService.listarPartidas();
        if (!ativo) return;

        setPartidas(lista);
        setPartidaSelecionada(lista[0] ?? null);
      } catch (error) {
        if (!ativo) return;
        const mensagem = error instanceof Error ? error.message : 'Falha ao carregar partidas';
        setErro(mensagem);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregarPartidas();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarJogadas() {
      if (!partidaSelecionada) {
        setJogadas([]);
        return;
      }

      try {
        setErro(null);
        const lista = await syncService.listarJogadasDaPartida(partidaSelecionada.id);
        if (ativo) setJogadas(lista);
      } catch (error) {
        if (!ativo) return;
        const mensagem = error instanceof Error ? error.message : 'Falha ao carregar jogadas';
        setErro(mensagem);
        setJogadas([]);
      }
    }

    void carregarJogadas();

    return () => {
      ativo = false;
    };
  }, [partidaSelecionada]);

  const aproveitamentoNos = calcularAproveitamento(jogadas, 'nos');
  const aproveitamentoAdversario = calcularAproveitamento(jogadas, 'adversario');
  const acoesNos = contarPorAcao(jogadas, 'nos');
  const pontosEstimados = contarPontosEstimados(jogadas);
  const jogadasNos = jogadas.filter((jogada) => (jogada.lado_origem ?? 'nos') === 'nos').length;
  const jogadasAdversario = jogadas.filter((jogada) => jogada.lado_origem === 'adversario').length;

  return (
    <div className="min-h-screen px-4 py-5 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-4">
        <header className="rounded-xl border border-slate-700 bg-slate-900/85 p-4 shadow-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal-300">Historico</p>
              <h1 className="mt-1 text-3xl font-black text-white">Dashboard de Partidas</h1>
              <span className="mt-1 block text-sm font-bold text-slate-300">{partidas.length} partidas salvas</span>
            </div>
            <button type="button" onClick={onVoltar} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao jogo
            </button>
          </div>
        </header>

        {erro && (
          <div className="rounded-xl border border-red-400/60 bg-red-950/70 px-4 py-3 text-center text-sm font-black text-red-100">
            {erro}
          </div>
        )}

        <main className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-slate-700 bg-slate-900/85 p-3 shadow-xl">
            <div className="mb-3 flex items-center gap-2 px-1 text-sm font-black uppercase text-slate-300">
              <CalendarClock className="h-4 w-4 text-teal-300" />
              Partidas
            </div>
            <div className="grid max-h-[calc(100vh-220px)] gap-2 overflow-auto pr-1">
              {carregando ? (
                <span className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-bold text-slate-300">Carregando partidas...</span>
              ) : partidas.length === 0 ? (
                <span className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-bold text-slate-300">Nenhuma partida salva.</span>
              ) : (
                partidas.map((partida, index) => (
                  <button
                    type="button"
                    key={partida.id}
                    onClick={() => setPartidaSelecionada(partida)}
                    className={cx(
                      'rounded-lg border-2 p-3 text-left transition',
                      partidaSelecionada?.id === partida.id
                        ? 'border-amber-300 bg-amber-100 text-slate-950 shadow-lg shadow-amber-950/10'
                        : 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-500'
                    )}
                  >
                    <strong className="block text-sm font-black">Partida {partidas.length - index}</strong>
                    <span className={cx('mt-1 block text-xs font-bold', partidaSelecionada?.id === partida.id ? 'text-slate-600' : 'text-slate-400')}>
                      {formatarData(partida.data)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={<ListChecks className="h-5 w-5" />} label="Jogadas" value={jogadas.length} />
              <MetricCard icon={<Users className="h-5 w-5" />} label="Nos" value={jogadasNos} />
              <MetricCard icon={<Users className="h-5 w-5" />} label="Adversarias" value={jogadasAdversario} />
              <MetricCard icon={<Trophy className="h-5 w-5" />} label="Sets com dados" value={contarSets(jogadas)} />
            </div>

            <section className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-950 shadow-xl">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  <Gauge className="h-5 w-5" />
                  <span className="text-xs font-black uppercase">Pontos por jogadas registradas</span>
                </div>
                <strong className="text-4xl font-black leading-none">{pontosEstimados.nos} x {pontosEstimados.adversario}</strong>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <StatsSection title="Aproveitamento nosso" icon={<BarChart3 className="h-5 w-5 text-teal-300" />}>
                <ListaAproveitamento linhas={aproveitamentoNos} />
              </StatsSection>

              <StatsSection title="Fundamentos nossos" icon={<ListChecks className="h-5 w-5 text-amber-300" />}>
                {acoesNos.length === 0 ? (
                  <EmptyState text="Sem jogadas nossas." />
                ) : (
                  <div className="grid gap-2">
                    {acoesNos.map((item) => (
                      <div key={item.acao} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
                        <span className="font-black text-white">{item.acao}</span>
                        <strong className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-950">{item.total}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </StatsSection>

              <StatsSection title="Aproveitamento adversario" icon={<BarChart3 className="h-5 w-5 text-red-300" />}>
                <ListaAproveitamento linhas={aproveitamentoAdversario} />
              </StatsSection>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-950 shadow-xl">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-black uppercase">{label}</span>
      </div>
      <strong className="mt-3 block text-4xl font-black leading-none">{value}</strong>
    </div>
  );
}

function StatsSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/85 p-4 shadow-xl">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-white">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <span className="block rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-center text-sm font-bold text-slate-300">
      {text}
    </span>
  );
}

function ListaAproveitamento({ linhas }: { linhas: ReturnType<typeof calcularAproveitamento> }) {
  if (linhas.length === 0) {
    return <EmptyState text="Sem dados." />;
  }

  return (
    <div className="grid gap-2">
      {linhas.map((linha) => (
        <div key={linha.chave} className="grid grid-cols-[minmax(120px,180px)_1fr_56px] items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
          <div className="min-w-0">
            <strong className="block truncate text-sm text-white">{linha.nome}</strong>
            <span className="text-xs font-bold text-slate-400">{linha.total} jogadas</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
            <span className="block h-full rounded-full bg-teal-300" style={{ width: `${linha.aproveitamento}%` }} />
          </div>
          <strong className="text-right text-sm text-amber-200">{linha.aproveitamento}%</strong>
        </div>
      ))}
    </div>
  );
}
