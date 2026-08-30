# Deploy do Guitar Livre — Vercel + Render

## 1. GitHub

Crie um repositório vazio chamado `guitar-livre` e envie esta pasta inteira.

```bash
git init
git add .
git commit -m "Production release"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/guitar-livre.git
git push -u origin main
```

## 2. Render — Backend

1. Render → New → Web Service.
2. Conecte o repositório `guitar-livre`.
3. Escolha Docker.
4. Dockerfile: `backend/Dockerfile`.
5. Docker context: `backend`.
6. Health check: `/api/health`.
7. Depois do deploy, copie a URL do serviço, por exemplo `https://guitar-livre-api.onrender.com`.

### Variáveis

`CORS_ORIGINS` deve ser a URL final da Vercel, sem barra no final.

`STORAGE_ROOT` pode permanecer `/app/storage` para testes. Para produção com persistência, adicione um Persistent Disk no Render montado em `/data` e altere para `/data/storage`.

## 3. Vercel — Frontend

1. Vercel → Add New → Project.
2. Importe o repositório `guitar-livre`.
3. Root Directory: `frontend`.
4. Framework: Vite.
5. Build Command: `npm run build`.
6. Output Directory: `dist`.
7. Adicione a variável `VITE_API_URL` com a URL do Render.
8. Deploy.

Depois copie a URL da Vercel e coloque essa URL em `CORS_ORIGINS` no Render.

## 4. Novo deploy após alterar CORS

Depois de salvar `CORS_ORIGINS`, faça redeploy do serviço do Render se ele não fizer isso automaticamente.

## Atenção ao storage

O Guitar Livre gera `video.mp4`, `master.ogg` e charts durante o processamento. Não versionamos esses arquivos no GitHub. Um serviço Render sem disco persistente pode perder esses dados quando o filesystem for recriado. Para uso público real, configure armazenamento persistente antes de liberar o upload para muitas pessoas.
