import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleDot,
  LayoutDashboard,
  Play,
  RotateCcw,
  Target,
  Trophy,
  XCircle,
  Zap
} from 'lucide-react';
import { DashboardPartidas } from './components/DashboardPartidas';
import { syncService } from './services/sync';
import { usePartidaStore } from './store/usePartidaStore';
import type { LadoPlacar, LadoQuadra, QualidadePasse, ResultadoJogada, TipoAtaque, TipoPasse, TipoSaque } from './store/usePartidaStore';
import { calcularAproveitamento, pontuadorAutomatico } from './utils/estatisticas';

type StatusConexao = 'conectando' | 'conectado' | 'erro';
type TelaAtiva = 'jogo' | 'dashboard';
type OrigemPendente = { lado: LadoQuadra; zona: number };

const qualidadesPasse: QualidadePasse[] = ['Perfeito', 'Bom', 'Ruim', 'Erro'];
const tiposPasse: TipoPasse[] = ['Manchete', 'Toque', 'Emergencia'];
const tiposSaque: TipoSaque[] = ['Viagem', 'Flutuante', 'Curto', 'Tatico'];
const tiposAtaque: TipoAtaque[] = ['Diagonal', 'Paralela', 'Centro', 'Largada'];
const resultadosJogada: ResultadoJogada[] = ['Ponto', 'Positiva', 'Neutra', 'Erro'];
const acoesComDestino = ['Saque', 'Passe', 'Ataque', 'Bloqueio', 'Defesa'];

const nomeLado: Record<LadoPlacar, string> = {
  nos: 'Nos',
  adversario: 'Adversarias'
};

const acoes = [
  { nome: 'Saque', icon: Zap },
  { nome: 'Passe', icon: CircleDot },
  { nome: 'Ataque', icon: Target },
  { nome: 'Bloqueio', icon: XCircle },
  { nome: 'Defesa', icon: CheckCircle2 }
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface ZonaQuadraProps {
  zona: number;
  lado: LadoQuadra;
  faseSetup: boolean;
  camisa: string;
  clicavel: boolean;
  selecionada: boolean;
  modoDestino: boolean;
  sacando: boolean;
  onChange: (val: string) => void;
  onClick: () => void;
}

function ZonaQuadra({ zona, lado, faseSetup, camisa, clicavel, selecionada, modoDestino, sacando, onChange, onClick }: ZonaQuadraProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!faseSetup && !clicavel}
      className={cx(
        'relative flex min-h-20 flex-col items-center justify-center rounded-lg border-2 p-2 text-center transition',
        lado === 'adversario' ? 'border-red-200/70 bg-red-50 text-slate-950' : 'border-sky-200/80 bg-sky-50 text-slate-950',
        selecionada && 'border-amber-300 ring-4 ring-amber-300/35',
        modoDestino && 'border-emerald-300 ring-4 ring-emerald-300/25',
        sacando && 'ring-4 ring-teal-300/50',
        clicavel || faseSetup ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default opacity-70'
      )}
    >
      <span className="text-xs font-black uppercase text-slate-500">{lado === 'adversario' ? 'ADV' : 'NOS'} Z{zona}</span>
      {sacando && (
        <span className="mt-1 rounded-full bg-teal-200 px-2 py-0.5 text-[10px] font-black text-teal-950">
          SAQUE
        </span>
      )}
      {faseSetup ? (
        <input
          type="text"
          inputMode="numeric"
          placeholder="No"
          value={camisa}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 h-9 w-16 rounded-md border-2 border-slate-300 bg-white px-2 text-center text-lg font-black text-slate-950 outline-none focus:border-blue-500"
        />
      ) : (
        <span className="mt-1 text-4xl font-black leading-none">{camisa || '?'}</span>
      )}
    </button>
  );
}

export default function App() {
  const [statusConexao, setStatusConexao] = useState<StatusConexao>('conectando');
  const [mensagemSync, setMensagemSync] = useState<string | null>(null);
  const [telaAtiva, setTelaAtiva] = useState<TelaAtiva>('jogo');
  const [faseSetup, setFaseSetup] = useState(true);
  const [origemPendente, setOrigemPendente] = useState<OrigemPendente | null>(null);
  const [tipoPassePendente, setTipoPassePendente] = useState<TipoPasse>('Manchete');
  const [tipoSaquePendente, setTipoSaquePendente] = useState<TipoSaque>('Viagem');
  const [tipoAtaquePendente, setTipoAtaquePendente] = useState<TipoAtaque>('Diagonal');
  const [resultadoPendente, setResultadoPendente] = useState<ResultadoJogada>('Positiva');

  const {
    partida,
    jogadas,
    iniciarPartida,
    timeEmQuadra,
    timeAdversarioEmQuadra,
    setAtual,
    placarAtual,
    setsVencidos,
    historicoSets,
    sacadorAtual,
    partidaEncerrada,
    vencedorPartida,
    definirCamisa,
    definirCamisaAdversaria,
    definirSacador,
    pontuar,
    removerPonto,
    prepararAcao,
    acaoPendente,
    qualidadePassePendente,
    definirQualidadePasse,
    registrarJogadaNaQuadra
  } = usePartidaStore();

  useEffect(() => syncService.connect({
    onConnect: () => {
      setStatusConexao('conectado');
      setMensagemSync(null);
    },
    onDisconnect: () => {
      setStatusConexao('conectando');
      setMensagemSync('Conexao perdida. Tentando reconectar...');
    },
    onConnectError: (message) => {
      setStatusConexao('erro');
      setMensagemSync(`Nao foi possivel conectar ao servidor: ${message}`);
    },
    onJogadaAck: () => setMensagemSync(null),
    onJogadaError: ({ error }) => {
      setMensagemSync(`Falha ao salvar jogada: ${error}`);
    }
  }), []);

  const zonasAdversarioFundo = [1, 6, 5];
  const zonasAdversarioAtaque = [2, 3, 4];
  const zonasNosAtaque = [4, 3, 2];
  const zonasNosDefesa = [5, 6, 1];
  const destinoEsperado: LadoQuadra = origemPendente
    ? acaoPendente === 'Passe' || acaoPendente === 'Defesa'
      ? origemPendente.lado
      : origemPendente.lado === 'nos'
        ? 'adversario'
        : 'nos'
    : 'nos';
  const precisaDestino = Boolean(acaoPendente && acoesComDestino.includes(acaoPendente));
  const podeEscolherOrigem = Boolean(acaoPendente && !origemPendente);
  const podeEscolherDestino = Boolean(acaoPendente && origemPendente && precisaDestino);
  const linhasAproveitamento = calcularAproveitamento(jogadas);
  const melhorJogada = linhasAproveitamento[0] ?? null;
  const piorJogada = linhasAproveitamento.length > 1
    ? linhasAproveitamento[linhasAproveitamento.length - 1]
    : null;

  const textoStatusJogada = partidaEncerrada
    ? `Partida encerrada: ${nomeLado[vencedorPartida ?? 'nos']} venceu`
    : acaoPendente
      ? acaoPendente === 'Passe' && !qualidadePassePendente
        ? 'Selecione a qualidade do passe'
        : !origemPendente
          ? `Registrando ${acaoPendente.toUpperCase()}: selecione quem fez a acao`
          : `Origem ${origemPendente.lado === 'nos' ? 'NOS' : 'ADV'} Z${origemPendente.zona}. Selecione para onde a acao foi`
      : 'Aguardando nova jogada...';

  const handleCliqueQuadra = (lado: LadoQuadra, zona: number) => {
    if (faseSetup || partidaEncerrada) return;

    if (!acaoPendente) {
      alert('Selecione uma acao primeiro!');
      return;
    }

    if (acaoPendente === 'Passe' && !qualidadePassePendente) {
      alert('Selecione a qualidade do passe primeiro!');
      return;
    }

    if (!origemPendente) {
      setOrigemPendente({ lado, zona });
      return;
    }

    if (lado !== destinoEsperado) {
      alert(destinoEsperado === 'adversario'
        ? 'Selecione uma zona da quadra adversaria como destino.'
        : 'Selecione uma zona do nosso lado como destino.');
      return;
    }

    const payload = registrarJogadaNaQuadra(origemPendente.zona, {
      ladoOrigem: origemPendente.lado,
      zonaDestino: zona,
      ladoDestino: lado,
      ...(acaoPendente === 'Passe' ? { tipoPasse: tipoPassePendente } : {}),
      ...(acaoPendente === 'Saque' ? { tipoSaque: tipoSaquePendente } : {}),
      ...(acaoPendente === 'Ataque' ? { tipoAtaque: tipoAtaquePendente } : {}),
      ...(acaoPendente !== 'Passe' ? { resultado: resultadoPendente } : {})
    });
    setOrigemPendente(null);

    if (payload) {
      const ladoPontuador = pontuadorAutomatico(payload);
      if (ladoPontuador) pontuar(ladoPontuador);

      if (!syncService.enviarJogada(payload)) {
        setMensagemSync('Sem conexao com o servidor. A jogada nao foi enviada.');
      }
    }
  };

  const limparRascunhoJogada = () => {
    setOrigemPendente(null);
    setTipoPassePendente('Manchete');
    setTipoSaquePendente('Viagem');
    setTipoAtaquePendente('Diagonal');
    setResultadoPendente('Positiva');
  };

  const handlePrepararAcao = (acao: string) => {
    limparRascunhoJogada();
    prepararAcao(acao);
  };

  const handlePontuar = (lado: LadoPlacar) => {
    limparRascunhoJogada();
    pontuar(lado);
  };

  if (statusConexao !== 'conectado') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 shadow-2xl">
          <Activity className="mx-auto mb-4 h-9 w-9 text-teal-300" />
          <h2 className="text-2xl font-black text-white">{statusConexao === 'erro' ? 'Sem conexao com o servidor' : 'Conectando ao servidor...'}</h2>
          {mensagemSync && <p className="mt-3 max-w-xl text-sm font-semibold text-red-200">{mensagemSync}</p>}
        </div>
      </div>
    );
  }

  if (telaAtiva === 'dashboard') {
    return <DashboardPartidas onVoltar={() => setTelaAtiva('jogo')} />;
  }

  if (!partida) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900/85 p-8 shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-400 text-slate-950">
            <Trophy className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-black text-white">VoleiStat Web</h1>
          <p className="mt-3 text-base font-semibold text-slate-300">Sistema de analise em tempo real</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={iniciarPartida} className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-3 font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400">
              <Play className="h-5 w-5" />
              Iniciar Nova Partida
            </button>
            <button type="button" onClick={() => setTelaAtiva('dashboard')} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-5 py-3 font-black text-white transition hover:bg-slate-600">
              <LayoutDashboard className="h-5 w-5" />
              Dashboard de Partidas
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-5 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[minmax(0,1fr)_560px] xl:items-start">
        <section className="grid gap-4">
          <header className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase text-teal-300">{faseSetup ? 'Configuracao inicial' : `Set ${setAtual}`}</p>
                <h2 className="mt-1 text-2xl font-black text-white">{faseSetup ? 'Defina as titulares' : 'Painel de Controle'}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setTelaAtiva('dashboard')} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-600">
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </button>
                {faseSetup && (
                  <button type="button" onClick={() => setFaseSetup(false)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-black text-emerald-950 transition hover:bg-emerald-400">
                    <Play className="h-4 w-4" />
                    Ir para o Jogo
                  </button>
                )}
              </div>
            </div>
          </header>

          <section className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-950 shadow-xl">
            <div className="grid grid-cols-[1fr_82px_1fr] items-center gap-3">
              <ScoreCard nome="Nos" pontos={placarAtual.nos} sets={setsVencidos.nos} tone="emerald" />
              <div className="flex h-24 flex-col items-center justify-center border-x border-slate-300 text-center">
                <span className="text-xs font-black uppercase text-slate-500">SET</span>
                <strong className="text-4xl font-black">{setAtual}</strong>
              </div>
              <ScoreCard nome="Adversarias" pontos={placarAtual.adversario} sets={setsVencidos.adversario} tone="red" />
            </div>

            {!faseSetup && (
              <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div className="rounded-lg bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm">
                  Sacando: <span className="text-slate-950">{sacadorAtual ? nomeLado[sacadorAtual] : 'Definir'}</span>
                </div>
                <button type="button" disabled={partidaEncerrada} onClick={() => definirSacador('nos')} className={cx('rounded-lg px-4 py-2 text-sm font-black text-white transition', sacadorAtual === 'nos' ? 'bg-emerald-600' : 'bg-slate-600 hover:bg-slate-500')}>
                  Nos
                </button>
                <button type="button" disabled={partidaEncerrada} onClick={() => definirSacador('adversario')} className={cx('rounded-lg px-4 py-2 text-sm font-black text-white transition', sacadorAtual === 'adversario' ? 'bg-red-600' : 'bg-slate-600 hover:bg-slate-500')}>
                  Adv
                </button>
              </div>
            )}

            {!faseSetup && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button type="button" disabled={partidaEncerrada} onClick={() => handlePontuar('nos')} className="rounded-lg bg-emerald-600 px-3 py-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:opacity-50">
                  + Ponto nosso
                </button>
                <button type="button" disabled={partidaEncerrada} onClick={() => removerPonto('nos')} className="rounded-lg bg-slate-600 px-3 py-3 text-sm font-black text-white transition hover:bg-slate-500 disabled:opacity-50">
                  - Nosso
                </button>
                <button type="button" disabled={partidaEncerrada} onClick={() => handlePontuar('adversario')} className="rounded-lg bg-red-600 px-3 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-50">
                  + Ponto adv
                </button>
                <button type="button" disabled={partidaEncerrada} onClick={() => removerPonto('adversario')} className="rounded-lg bg-slate-600 px-3 py-3 text-sm font-black text-white transition hover:bg-slate-500 disabled:opacity-50">
                  - Adv
                </button>
              </div>
            )}

            {historicoSets.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {historicoSets.map((setFechado) => (
                  <span key={setFechado.set} className="rounded-full bg-slate-200 px-3 py-1 text-sm font-black text-slate-700">
                    Set {setFechado.set}: {setFechado.nos} x {setFechado.adversario}
                  </span>
                ))}
              </div>
            )}
          </section>

          {!faseSetup && (
            <LiveDashboard
              linhas={linhasAproveitamento}
              melhor={melhorJogada}
              pior={piorJogada}
            />
          )}

          {!faseSetup && !partidaEncerrada && (
            <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl">
              <div className="flex flex-wrap justify-center gap-2">
                {acoes.map(({ nome, icon: Icon }) => (
                  <button
                    type="button"
                    key={nome}
                    onClick={() => handlePrepararAcao(nome)}
                    className={cx(
                      'inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition',
                      acaoPendente === nome ? 'bg-amber-300 text-slate-950 shadow-lg shadow-amber-950/20' : 'bg-blue-600 text-white hover:bg-blue-500'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {nome}
                  </button>
                ))}
              </div>
            </section>
          )}

          <ActionOptions
            acaoPendente={acaoPendente}
            partidaEncerrada={partidaEncerrada}
            qualidadePassePendente={qualidadePassePendente}
            tipoPassePendente={tipoPassePendente}
            tipoSaquePendente={tipoSaquePendente}
            tipoAtaquePendente={tipoAtaquePendente}
            resultadoPendente={resultadoPendente}
            definirQualidadePasse={definirQualidadePasse}
            setTipoPassePendente={setTipoPassePendente}
            setTipoSaquePendente={setTipoSaquePendente}
            setTipoAtaquePendente={setTipoAtaquePendente}
            setResultadoPendente={setResultadoPendente}
          />

          {origemPendente && !partidaEncerrada && (
            <div className="text-center">
              <button type="button" onClick={() => setOrigemPendente(null)} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-600">
                <RotateCcw className="h-4 w-4" />
                Trocar origem
              </button>
            </div>
          )}

          {!faseSetup && (
            <div className={cx('rounded-xl border px-4 py-3 text-center text-sm font-black shadow-lg', partidaEncerrada ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' : 'border-amber-300/40 bg-amber-300/10 text-amber-200')}>
              {textoStatusJogada}
            </div>
          )}

          {mensagemSync && (
            <div className="rounded-xl border border-red-400/60 bg-red-950/70 px-4 py-3 text-center text-sm font-black text-red-100">
              {mensagemSync}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-orange-200/60 bg-court p-3 shadow-2xl">
          <span className="mb-2 block text-center text-xs font-black uppercase text-orange-50">Adversarias</span>
          <div className="grid grid-cols-3 gap-2">
            {zonasAdversarioFundo.map((zona) => (
              <ZonaQuadra
                key={`adv-fundo-${zona}`}
                zona={zona}
                lado="adversario"
                faseSetup={faseSetup}
                camisa={timeAdversarioEmQuadra[zona]}
                clicavel={podeEscolherOrigem || (podeEscolherDestino && destinoEsperado === 'adversario')}
                selecionada={origemPendente?.lado === 'adversario' && origemPendente.zona === zona}
                modoDestino={podeEscolherDestino && destinoEsperado === 'adversario'}
                sacando={sacadorAtual === 'adversario' && zona === 1}
                onChange={(val) => definirCamisaAdversaria(zona, val)}
                onClick={() => handleCliqueQuadra('adversario', zona)}
              />
            ))}
          </div>

          <div className="my-2 h-1 rounded-full bg-orange-50/90" />

          <div className="grid grid-cols-3 gap-2">
            {zonasAdversarioAtaque.map((zona) => (
              <ZonaQuadra
                key={`adv-ataque-${zona}`}
                zona={zona}
                lado="adversario"
                faseSetup={faseSetup}
                camisa={timeAdversarioEmQuadra[zona]}
                clicavel={podeEscolherOrigem || (podeEscolherDestino && destinoEsperado === 'adversario')}
                selecionada={origemPendente?.lado === 'adversario' && origemPendente.zona === zona}
                modoDestino={podeEscolherDestino && destinoEsperado === 'adversario'}
                sacando={sacadorAtual === 'adversario' && zona === 1}
                onChange={(val) => definirCamisaAdversaria(zona, val)}
                onClick={() => handleCliqueQuadra('adversario', zona)}
              />
            ))}
          </div>

          <div className="my-3 rounded-md bg-slate-100 py-2 text-center text-sm font-black text-slate-950 shadow">
            REDE
          </div>

          <div className="grid grid-cols-3 gap-2">
            {zonasNosAtaque.map((zona) => (
              <ZonaQuadra
                key={`nos-ataque-${zona}`}
                zona={zona}
                lado="nos"
                faseSetup={faseSetup}
                camisa={timeEmQuadra[zona]}
                clicavel={podeEscolherOrigem || (podeEscolherDestino && destinoEsperado === 'nos')}
                selecionada={origemPendente?.lado === 'nos' && origemPendente.zona === zona}
                modoDestino={podeEscolherDestino && destinoEsperado === 'nos'}
                sacando={sacadorAtual === 'nos' && zona === 1}
                onChange={(val) => definirCamisa(zona, val)}
                onClick={() => handleCliqueQuadra('nos', zona)}
              />
            ))}
          </div>

          <div className="my-2 h-1 rounded-full bg-orange-50/90" />

          <div className="grid grid-cols-3 gap-2">
            {zonasNosDefesa.map((zona) => (
              <ZonaQuadra
                key={`nos-defesa-${zona}`}
                zona={zona}
                lado="nos"
                faseSetup={faseSetup}
                camisa={timeEmQuadra[zona]}
                clicavel={podeEscolherOrigem || (podeEscolherDestino && destinoEsperado === 'nos')}
                selecionada={origemPendente?.lado === 'nos' && origemPendente.zona === zona}
                modoDestino={podeEscolherDestino && destinoEsperado === 'nos'}
                sacando={sacadorAtual === 'nos' && zona === 1}
                onChange={(val) => definirCamisa(zona, val)}
                onClick={() => handleCliqueQuadra('nos', zona)}
              />
            ))}
          </div>
          <span className="mt-2 block text-center text-xs font-black uppercase text-orange-50">Nos</span>
        </section>
      </div>
    </div>
  );
}

function ScoreCard({ nome, pontos, sets, tone }: { nome: string; pontos: number; sets: number; tone: 'emerald' | 'red' }) {
  return (
    <div className="grid min-w-0 place-items-center gap-1">
      <span className={cx('text-sm font-black uppercase', tone === 'emerald' ? 'text-emerald-700' : 'text-red-700')}>{nome}</span>
      <strong className="text-6xl font-black leading-none text-slate-950">{pontos}</strong>
      <span className="text-sm font-black text-slate-500">Sets {sets}</span>
    </div>
  );
}

function LiveDashboard({
  linhas,
  melhor,
  pior
}: {
  linhas: ReturnType<typeof calcularAproveitamento>;
  melhor: ReturnType<typeof calcularAproveitamento>[number] | null;
  pior: ReturnType<typeof calcularAproveitamento>[number] | null;
}) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl">
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard label="Melhor aproveitamento" value={melhor ? melhor.nome : 'Sem dados'} detail={melhor ? `${melhor.aproveitamento}% em ${melhor.total} jogadas` : 'Registre jogadas para calcular'} icon={<Trophy className="h-5 w-5" />} />
        <SummaryCard label="Menor aproveitamento" value={pior ? pior.nome : 'Sem dados'} detail={pior ? `${pior.aproveitamento}% em ${pior.total} jogadas` : 'Precisa de pelo menos dois tipos'} icon={<Activity className="h-5 w-5" />} />
      </div>

      <div className="mt-4 grid gap-2">
        {linhas.length === 0 ? (
          <span className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-center text-sm font-black text-slate-300">
            Nenhuma jogada do nosso time registrada ainda.
          </span>
        ) : (
          linhas.map((linha) => (
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
          ))
        )}
      </div>
    </section>
  );
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-950 shadow">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-black uppercase">{label}</span>
      </div>
      <strong className="mt-2 block text-lg font-black leading-tight">{value}</strong>
      <span className="mt-1 block text-sm font-bold text-slate-600">{detail}</span>
    </div>
  );
}

function ActionOptions({
  acaoPendente,
  partidaEncerrada,
  qualidadePassePendente,
  tipoPassePendente,
  tipoSaquePendente,
  tipoAtaquePendente,
  resultadoPendente,
  definirQualidadePasse,
  setTipoPassePendente,
  setTipoSaquePendente,
  setTipoAtaquePendente,
  setResultadoPendente
}: {
  acaoPendente: string | null;
  partidaEncerrada: boolean;
  qualidadePassePendente: QualidadePasse | null;
  tipoPassePendente: TipoPasse;
  tipoSaquePendente: TipoSaque;
  tipoAtaquePendente: TipoAtaque;
  resultadoPendente: ResultadoJogada;
  definirQualidadePasse: (qualidade: QualidadePasse) => void;
  setTipoPassePendente: (tipo: TipoPasse) => void;
  setTipoSaquePendente: (tipo: TipoSaque) => void;
  setTipoAtaquePendente: (tipo: TipoAtaque) => void;
  setResultadoPendente: (resultado: ResultadoJogada) => void;
}) {
  if (!acaoPendente || partidaEncerrada) return null;

  return (
    <section className="grid gap-2">
      {acaoPendente === 'Saque' && (
        <OptionGroup values={tiposSaque} selected={tipoSaquePendente} onSelect={setTipoSaquePendente} accent="teal" />
      )}
      {acaoPendente === 'Passe' && (
        <>
          <OptionGroup values={qualidadesPasse} selected={qualidadePassePendente} onSelect={definirQualidadePasse} accent="amber" />
          <OptionGroup values={tiposPasse} selected={tipoPassePendente} onSelect={setTipoPassePendente} accent="teal" />
        </>
      )}
      {acaoPendente === 'Ataque' && (
        <OptionGroup values={tiposAtaque} selected={tipoAtaquePendente} onSelect={setTipoAtaquePendente} accent="teal" />
      )}
      {acaoPendente !== 'Passe' && (
        <OptionGroup values={resultadosJogada} selected={resultadoPendente} onSelect={setResultadoPendente} accent="amber" />
      )}
    </section>
  );
}

function OptionGroup<T extends string>({
  values,
  selected,
  onSelect,
  accent
}: {
  values: T[];
  selected: T | null;
  onSelect: (value: T) => void;
  accent: 'amber' | 'teal';
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {values.map((value) => (
        <button
          type="button"
          key={value}
          onClick={() => onSelect(value)}
          className={cx(
            'rounded-lg px-4 py-2.5 text-sm font-black transition',
            selected === value
              ? accent === 'amber'
                ? 'bg-amber-300 text-slate-950'
                : 'bg-teal-300 text-slate-950'
              : 'bg-slate-700 text-white hover:bg-slate-600'
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
