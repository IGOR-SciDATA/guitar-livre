# Guitar Livre

Jogo de ritmo web com frontend React/Vite e API FastAPI.

## Estrutura

- `frontend/`: React + Vite
- `backend/`: FastAPI, processamento de áudio, charts, Enchor e FFmpeg
- `backend/storage/`: dados gerados em runtime; músicas não são versionadas

## Rodar localmente

### Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

O processamento também exige FFmpeg e, para a busca no Enchor, Chromium/Chrome.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Copie `frontend/.env.example` para `.env` se precisar alterar a URL da API.

## Deploy

### Backend no Render

O projeto inclui `render.yaml` e `backend/Dockerfile`. O serviço Docker instala FFmpeg, Chromium/Chromedriver e Deno, necessários ao processor atual.

Configure no Render:

- `CORS_ORIGINS=https://SEU-PROJETO.vercel.app`
- `STORAGE_ROOT=/data/storage` quando usar um Persistent Disk montado em `/data`

Sem Persistent Disk, o filesystem do serviço é efêmero: músicas, usuários, rankings e configurações podem ser perdidos em redeploy/restart. Para um lançamento público real, use armazenamento persistente.

### Frontend na Vercel

Defina a variável de ambiente:

`VITE_API_URL=https://SEU-SERVICO.onrender.com`

Build command: `npm run build`

Output directory: `dist`

## Importante

Não envie `venv/`, `node_modules/`, `.env` ou arquivos de músicas/vídeos gerados para o GitHub.
