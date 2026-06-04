# Deploy do VoleiStat

## Backend

Recomendado: Render ou Railway.

Variaveis obrigatorias:

```env
DATABASE_URL=postgresql://...
CLIENT_ORIGIN=https://url-do-frontend
```

Comandos:

```bash
npm ci
npm start
```

Health check:

```text
/health
```

## Frontend

Recomendado: Vercel.

Variavel obrigatoria:

```env
VITE_API_URL=https://url-do-backend
```

Comandos:

```bash
npm ci
npm run build
```

Diretorio de saida:

```text
dist
```

## Ordem correta

1. Suba o backend primeiro.
2. Copie a URL publica do backend.
3. Configure `VITE_API_URL` no frontend.
4. Suba o frontend.
5. Volte no backend e configure `CLIENT_ORIGIN` com a URL publica do frontend.
