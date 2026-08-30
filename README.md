# 🎸 Guitar Livre

> Um jogo de ritmo inspirado em Guitar Hero e Clone Hero, desenvolvido para rodar diretamente no navegador.

O **Guitar Livre** transforma músicas em experiências jogáveis de ritmo, permitindo ao jogador adicionar músicas, utilizar charts da comunidade ou gerar charts automaticamente através do processamento de áudio.

O projeto foi desenvolvido com foco em uma gameplay simples, bonita, rápida e responsiva, buscando trazer para o navegador uma experiência próxima dos clássicos jogos de ritmo.

---

## 🎮 Sobre o projeto

O Guitar Livre nasceu com a proposta de levar uma experiência de jogo de ritmo para a web.

Em vez de depender exclusivamente de um cliente desktop, o projeto utiliza tecnologias web para executar a gameplay diretamente no navegador.

### Fluxo principal

```text
Usuário
   │
   ▼
Frontend React
   │
   │ URL da música
   ▼
Backend FastAPI
   │
   ▼
Processamento
   │
   ├── Download da música
   ├── Busca de chart
   ├── Parser de charts
   ├── Geração de chart
   ├── Processamento de áudio
   └── Masterização
   │
   ▼
Storage
   │
   ├── metadata.json
   ├── master.ogg
   ├── chart_easy.json
   ├── chart_medium.json
   ├── chart_hard.json
   └── chart_expert.json
   │
   ▼
Gameplay
   │
   ▼
🎸 Guitar Livre
```

---

# ✨ Funcionalidades

## 🎵 Sistema de músicas

- Adição de músicas através de URL do YouTube.
- Tratamento de URLs do YouTube.
- Extração de metadados.
- Download da música.
- Processamento automático.
- Biblioteca de músicas.
- Organização por artista.
- Thumbnail.
- Duração da música.
- Processamento em segundo plano.

---

## 🎼 Sistema de charts

O Guitar Livre possui suporte para charts provenientes da comunidade.

O sistema trabalha com arquivos e formatos utilizados em jogos de ritmo, incluindo:

- `.mid`
- `.chart`
- `.zip`

As charts podem ser convertidas para o formato utilizado internamente pelo jogo.

### Dificuldades suportadas

```text
Easy
Medium
Hard
Expert
```

Cada dificuldade pode possuir seu próprio arquivo:

```text
chart_easy.json
chart_medium.json
chart_hard.json
chart_expert.json
```

---

# 🎸 Gameplay

O jogo utiliza cinco lanes:

```text
🟢 Verde
🔴 Vermelho
🟡 Amarelo
🔵 Azul
🟠 Laranja
```

### Teclas padrão

```text
A → Verde
S → Vermelho
D → Amarelo
F → Azul
G → Laranja
```

O jogador também pode remapear as teclas através da tela de configurações.

A gameplay possui suporte para:

- Notas simples
- Notas simultâneas
- Sustains
- Sequências de notas
- Hit detection
- Miss detection
- Hitpads
- Feedback visual
- Contador de acertos
- Contador de erros
- HUD
- Efeitos de gameplay
- Renderização otimizada através de Canvas

O sistema de input foi desenvolvido com foco em baixa latência e resposta rápida, característica essencial para jogos de ritmo.

---

# 🎵 Sustains

As notas de sustain possuem suporte próprio para controle de duração.

O jogador não precisa necessariamente manter uma nota até o último instante para que ela seja considerada corretamente executada.

Existe uma tolerância de finalização para tornar a gameplay mais natural em situações nas quais uma nova nota aparece imediatamente após um sustain.

Isso é especialmente importante em charts com grande densidade de notas.

---

# 🤖 Geração automática de charts

Quando uma chart da comunidade não está disponível, o Guitar Livre possui um sistema próprio de geração.

O sistema utiliza análise de áudio para identificar eventos musicais e produzir uma chart jogável.

O objetivo é permitir que músicas sem charts pré-existentes também possam ser utilizadas no jogo.

---

# 🎼 Parser de charts da comunidade

O Guitar Livre possui um parser responsável por interpretar charts utilizadas pela comunidade.

O processamento pode envolver:

```text
Arquivo MIDI / CHART
        │
        ▼
Leitura das notas
        │
        ▼
Identificação das lanes
        │
        ▼
Identificação das dificuldades
        │
        ▼
Conversão dos tempos
        │
        ▼
Conversão para JSON
        │
        ▼
Chart utilizada pelo jogo
```

A estrutura final é otimizada para ser consumida pelo frontend durante a gameplay.

---

# 🎚️ Masterização de áudio

Charts da comunidade podem possuir diversos arquivos de áudio separados.

Exemplos:

```text
guitar
rhythm
drums
vocals
song
```

O pipeline do Guitar Livre pode combinar esses stems em uma faixa principal.

Resultado:

```text
master.ogg
```

A faixa masterizada é utilizada como áudio principal durante a gameplay.

---

# 🎥 Vídeo de fundo

O Guitar Livre possui suporte para vídeo de fundo.

Por padrão, o jogo pode utilizar o vídeo associado à música processada.

Porém, o sistema também possui suporte para personalização do background pelo usuário.

O usuário pode escolher:

- Imagem de fundo
- Vídeo de fundo
- Background padrão
- Background personalizado para a highway

Quando uma personalização é definida pelo usuário, ela pode substituir o vídeo padrão da música.

---

# 🖼️ Background da Highway

Além do background geral da gameplay, o projeto possui suporte para personalização visual da highway.

O jogador pode utilizar uma imagem personalizada como fundo da área de jogo.

Quando nenhuma imagem personalizada está configurada, a highway utiliza o fundo padrão do jogo.

A personalização permite que cada jogador possa criar sua própria experiência visual.

---

# ⚙️ Configurações

O Guitar Livre possui uma tela de configurações onde o jogador pode personalizar sua experiência.

Entre as configurações disponíveis:

- Volume do áudio
- Ativar/desativar vídeo de fundo
- Remapeamento das teclas
- Personalização visual

As configurações são gerenciadas através de um contexto próprio de configurações.

---

# ⚡ Performance

A gameplay foi desenvolvida com foco em desempenho, especialmente considerando que o Guitar Livre roda diretamente no navegador.

A renderização utiliza **Canvas** para reduzir a quantidade de elementos DOM utilizados durante a gameplay.

O projeto também busca minimizar:

- Re-renderizações desnecessárias
- Criação excessiva de elementos
- Operações pesadas durante cada frame
- Manipulação excessiva do DOM
- Cálculos repetitivos

O objetivo é manter a gameplay fluida mesmo em charts com grande quantidade de notas.

---

# 🧠 Tecnologias utilizadas

## Frontend

- React
- Vite
- JavaScript
- CSS
- Canvas API

## Backend

- Python
- FastAPI
- Pydantic

## Processamento

- FFmpeg
- yt-dlp
- librosa
- Selenium
- Chrome / Chromium
- WebDriver Manager

## Charts

- MIDI
- CHART
- JSON

---

# 📁 Estrutura do projeto

```text
guitar-livre/
│
├── backend/
│   │
│   ├── app/
│   │   ├── api/
│   │   ├── services/
│   │   ├── models/
│   │   └── ...
│   │
│   ├── storage/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── ...
│
├── frontend/
│   │
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── screens/
│   │   ├── assets/
│   │   └── ...
│   │
│   ├── package.json
│   ├── vite.config.js
│   └── ...
│
├── .gitignore
├── .env.example
├── render.yaml
├── DEPLOY.md
├── LICENSE
└── README.md
```

---

# 💻 Rodando localmente

## 📋 Requisitos

Antes de executar o projeto localmente, tenha instalado:

- Node.js 20+
- Python 3.11+
- FFmpeg
- Google Chrome ou Chromium
- Git

---

## 🔎 Verificando Node.js

```bash
node --version
```

```bash
npm --version
```

---

## 🔎 Verificando Python

```bash
python --version
```

ou:

```bash
py --version
```

---

## 🔎 Verificando FFmpeg

```bash
ffmpeg -version
```

Se o comando não for reconhecido, instale o FFmpeg e configure o PATH do sistema.

---

# 📥 1. Clonar o projeto

```bash
git clone https://github.com/SEU_USUARIO/guitar-livre.git
```

Entre na pasta:

```bash
cd guitar-livre
```

---

# 🐍 2. Configurar o Backend

Entre na pasta:

```bash
cd backend
```

Crie um ambiente virtual:

### Windows

```bash
python -m venv venv
```

Ative:

```bash
venv\Scripts\activate
```

### Linux / macOS

```bash
python3 -m venv venv
```

Ative:

```bash
source venv/bin/activate
```

---

# 📦 3. Instalar dependências do Backend

Com o ambiente virtual ativado:

```bash
pip install -r requirements.txt
```

Opcionalmente:

```bash
python -m pip install --upgrade pip
```

---

# 🔐 4. Configurar variáveis de ambiente

Utilize:

```text
.env.example
```

como referência.

Crie:

```text
backend/.env
```

e configure as variáveis necessárias.

> **IMPORTANTE:** Nunca envie o `.env` real para o GitHub.

---

# ▶️ 5. Executar o Backend

Dentro da pasta `backend`:

```bash
uvicorn app.main:app --reload
```

O backend ficará disponível em:

```text
http://localhost:8000
```

A documentação automática da API:

```text
http://localhost:8000/docs
```

---

# ⚛️ 6. Configurar o Frontend

Abra outro terminal.

Volte para a raiz:

```bash
cd ..
```

Entre no frontend:

```bash
cd frontend
```

Instale as dependências:

```bash
npm install
```

---

# 🔧 7. Configurar a API do Frontend

Crie:

```text
frontend/.env
```

com:

```env
VITE_API_URL=http://localhost:8000
```

Essa variável informa ao frontend onde encontrar o backend.

---

# ▶️ 8. Executar o Frontend

Execute:

```bash
npm run dev
```

O Vite disponibilizará o frontend normalmente em:

```text
http://localhost:5173
```

Abra esse endereço no navegador.

---

# 🎮 Executando o projeto completo

É necessário manter o Backend e o Frontend executando simultaneamente.

### Terminal 1 — Backend

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Depois acesse:

```text
http://localhost:5173
```

---

# 🎵 Adicionando uma música

Para adicionar uma música:

1. Abra o Guitar Livre.
2. Acesse a área de adicionar música.
3. Cole a URL do YouTube.
4. Confirme os dados apresentados.
5. Inicie o processamento.
6. Aguarde o processamento.
7. A música aparecerá na biblioteca quando estiver pronta.
8. Escolha a dificuldade.
9. Inicie a gameplay.

---

# 🔄 Pipeline de processamento

```text
URL do YouTube
       │
       ▼
Obtenção dos metadados
       │
       ▼
Criação do storage
       │
       ▼
Busca de chart
       │
       ├───────────────┐
       │               │
       ▼               ▼
Chart encontrada   Não encontrada
       │               │
       ▼               ▼
    Parser       Gerador próprio
       │               │
       └───────┬───────┘
               ▼
          chart_*.json
               │
               ▼
       Processamento áudio
               │
               ▼
          Masterização
               │
               ▼
           master.ogg
               │
               ▼
         Música pronta
```

---

# 📂 Storage

As músicas processadas ficam armazenadas em uma estrutura semelhante a:

```text
storage/songs/
└── SONG_ID/
    ├── metadata.json
    ├── master.ogg
    ├── chart_easy.json
    ├── chart_medium.json
    ├── chart_hard.json
    └── chart_expert.json
```

Arquivos adicionais podem existir dependendo do processamento.

---

# 🚫 Arquivos que NÃO devem ser enviados ao GitHub

Não faça commit de arquivos gerados ou dependências locais como:

```text
venv/
node_modules/
__pycache__/
.env
storage/songs/
downloads/
*.mp4
*.mp3
*.ogg
*.opus
*.wav
logs/
arquivos temporários
```

Esses arquivos podem aumentar drasticamente o tamanho do repositório.

---

# 🏗️ Build de produção

Para criar o build otimizado do frontend:

```bash
cd frontend
npm run build
```

O resultado será gerado em:

```text
frontend/dist/
```

Para testar o build localmente:

```bash
npm run preview
```

---

# 🚀 Deploy

O projeto pode ser dividido em duas partes:

```text
Frontend
   │
   ▼
Vercel

Backend
   │
   ▼
Render
```

Arquitetura:

```text
                 INTERNET
                    │
                    ▼
             ┌─────────────┐
             │   VERCEL    │
             │             │
             │ React/Vite  │
             └──────┬──────┘
                    │
                    │ HTTPS
                    ▼
             ┌─────────────┐
             │   RENDER    │
             │             │
             │   FastAPI   │
             │   Python    │
             └──────┬──────┘
                    │
                    ▼
              Processamento
```

As instruções específicas de deploy podem ser encontradas em:

```text
DEPLOY.md
```

---

# 🌐 Frontend em produção

No ambiente de produção, configure:

```env
VITE_API_URL=https://SEU-BACKEND.onrender.com
```

Essa variável deve apontar para a URL pública do backend.

---

# 🖥️ Backend em produção

O backend possui configuração para execução utilizando Docker.

O serviço pode ser hospedado em plataformas compatíveis com aplicações Python/Docker, como Render.

---

# ⚠️ Armazenamento em produção

O Guitar Livre trabalha com arquivos potencialmente grandes:

```text
Vídeos
Áudios
Masters
Charts
Thumbnails
```

Esses arquivos não devem ser versionados no GitHub.

Para uma instalação de produção com vários usuários, é recomendado utilizar armazenamento persistente ou object storage apropriado.

---

# 🔒 Segurança

Nunca publique no GitHub:

```text
API Keys
Tokens
Senhas
Cookies
Credenciais
.env
```

Utilize variáveis de ambiente.

O arquivo `.env.example` deve conter somente os nomes das variáveis necessárias, sem credenciais reais.

---

# 🧪 Desenvolvimento

Durante o desenvolvimento, execute:

### Backend

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

### Frontend

Em outro terminal:

```bash
cd frontend
npm run dev
```

---

# 🐛 Solução de problemas

## Backend não inicia

Verifique a versão do Python:

```bash
python --version
```

Depois reinstale as dependências:

```bash
pip install -r requirements.txt
```

Tente iniciar novamente:

```bash
uvicorn app.main:app --reload
```

---

## FFmpeg não encontrado

Execute:

```bash
ffmpeg -version
```

Se o comando não funcionar, instale o FFmpeg e configure o PATH.

---

## Frontend não consegue acessar o Backend

Confira:

```env
VITE_API_URL=http://localhost:8000
```

Confirme se o backend está executando.

Em produção, confirme se a variável aponta para a URL correta do backend.

---

## Música não aparece na biblioteca

Verifique os logs do backend.

O processamento envolve várias etapas:

```text
Download
   ↓
Chart
   ↓
Parser
   ↓
Áudio
   ↓
Masterização
   ↓
Storage
   ↓
Música pronta
```

Uma falha em qualquer etapa pode impedir que a música seja disponibilizada.

---

# 🤝 Contribuindo

Contribuições são bem-vindas.

Fluxo recomendado:

```text
Fork
  ↓
Branch
  ↓
Alteração
  ↓
Teste local
  ↓
Commit
  ↓
Pull Request
```

Exemplo:

```bash
git checkout -b minha-feature
```

Depois:

```bash
git add .
git commit -m "Adiciona nova funcionalidade"
git push origin minha-feature
```

---

# 📜 Licença

Este projeto é distribuído sob a licença **MIT**.

Consulte o arquivo:

```text
LICENSE
```

para obter o texto completo da licença.

---

# 👨‍💻 Créditos

## Guitar Livre

Desenvolvido por:

### 🎸 Igor Santos

Idealização, desenvolvimento e evolução do projeto.

O Guitar Livre foi desenvolvido com o objetivo de criar uma experiência de jogo de ritmo acessível diretamente pelo navegador, combinando desenvolvimento web, processamento de áudio, charts e gameplay em tempo real.

---

# 🎯 Objetivo

O objetivo do Guitar Livre é proporcionar uma experiência de jogo de ritmo simples, acessível e divertida diretamente no navegador.

O projeto busca combinar:

- 🎸 Gameplay de ritmo
- 🎵 Música
- 🤖 Processamento automático
- 🎼 Charts da comunidade
- 🧠 Análise de áudio
- ⚡ Performance
- 🌐 Tecnologias web

---

# 🎸 Guitar Livre

```text
        A   S   D   F   G

        🟢  🔴  🟡  🔵  🟠

              ↓
          🎸 HITPAD
```

**Música. Precisão. Diversão.**

---

## 👨‍💻 Desenvolvido por Igor Santos

🎸 **Guitar Livre — um jogo de ritmo feito para a web.**

---

# 📜 LICENSE

Este projeto utiliza a licença MIT.

Consulte o arquivo `LICENSE` na raiz do projeto para os termos completos.

> **Observação:** a licença MIT se aplica ao código do Guitar Livre. Músicas, vídeos, charts e outros conteúdos de terceiros podem possuir direitos autorais e licenças próprios e não são automaticamente cobertos pela licença MIT.
