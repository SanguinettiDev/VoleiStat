// server.js, Backend Node.js + Express + Socket.io + PostgreSQL
const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');

if (!process.env.DATABASE_URL) {
  console.error('[Server] DATABASE_URL nao configurada');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : '*';

// Configuracao de CORS e Middleware
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Configuracao do PostgreSQL para o Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function validarJogada(jogada) {
  return Boolean(
    jogada &&
      typeof jogada.id === 'string' &&
      typeof jogada.id_partida === 'string' &&
      Number.isInteger(jogada.set) &&
      typeof jogada.acao === 'string' &&
      Number.isInteger(jogada.zona) &&
      typeof jogada.camisa === 'string' &&
      Number.isFinite(jogada.timestamp)
  );
}

async function setupDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS partidas (
      id          TEXT PRIMARY KEY,
      data        TIMESTAMPTZ,
      equipe_nos  TEXT,
      equipe_adv  TEXT,
      payload     JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS jogadas (
      id              TEXT PRIMARY KEY,
      id_partida      TEXT REFERENCES partidas(id) ON DELETE CASCADE,
      set_num         INTEGER,
      acao            TEXT,
      timestamp_unix  BIGINT,
      payload         JSONB,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE jogadas ALTER COLUMN timestamp_unix TYPE BIGINT;

    CREATE INDEX IF NOT EXISTS idx_jogadas_partida ON jogadas(id_partida);
    CREATE INDEX IF NOT EXISTS idx_jogadas_acao    ON jogadas(acao);
  `);
  console.log('[DB] Tabelas verificadas ou criadas com sucesso');
}

// Configuracao do Socket.io
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  console.log(`[Socket] Cliente web conectado: ${socket.id}`);

  socket.on('jogada:nova', async (jogada) => {
    try {
      if (!validarJogada(jogada)) {
        socket.emit('jogada:error', {
          id: jogada?.id,
          error: 'Payload de jogada invalido',
        });
        return;
      }

      await pool.query(
        `INSERT INTO partidas (id, data, equipe_nos, equipe_adv, payload)
         VALUES ($1, NOW(), $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [jogada.id_partida, 'N/A', 'N/A', JSON.stringify({})]
      );

      await pool.query(
        `INSERT INTO jogadas (id, id_partida, set_num, acao, timestamp_unix, payload)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          jogada.id,
          jogada.id_partida,
          jogada.set,
          jogada.acao,
          jogada.timestamp,
          JSON.stringify(jogada),
        ]
      );

      socket.emit('jogada:ack', jogada.id);
      console.log(`[Socket] Jogada salva: ${jogada.id} | Acao: ${jogada.acao}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao salvar jogada';

      socket.emit('jogada:error', {
        id: jogada?.id,
        error: errorMessage,
      });
      console.error('[Socket] Erro ao salvar jogada:', errorMessage);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Cliente desconectado: ${socket.id}`);
  });
});

// Rotas da API REST
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'voleistat-backend' });
});

app.get('/partidas', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, data, equipe_nos, equipe_adv FROM partidas ORDER BY created_at DESC LIMIT 50'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/partidas/:id/jogadas', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT payload FROM jogadas WHERE id_partida = $1 ORDER BY timestamp_unix ASC',
      [req.params.id]
    );
    res.json(rows.map((r) => r.payload));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/partidas/:id/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         acao,
         payload->>'qualidade_passe' AS qualidade,
         COUNT(*) AS total
       FROM jogadas
       WHERE id_partida = $1
       GROUP BY acao, qualidade
       ORDER BY acao, qualidade`,
      [req.params.id]
    );

    const stats = {};
    for (const row of rows) {
      if (!stats[row.acao]) stats[row.acao] = {};
      stats[row.acao][row.qualidade ?? 'sem_classificacao'] = parseInt(row.total);
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inicializacao do Servidor
const PORT = process.env.PORT || 3001;

setupDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`[Server] VoleiStat backend rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Server] Falha ao inicializar banco de dados:', err);
    process.exit(1);
  });
