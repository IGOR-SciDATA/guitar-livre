FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CHROME_BIN=/usr/bin/chromium \
    DENO_DIR=/root/.cache/deno

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        chromium \
        chromium-driver \
        curl \
        unzip \
        git \
        ca-certificates \
        fonts-liberation \
        libnss3 \
        libatk-bridge2.0-0 \
        libgbm1 \
        libasound2 \
    && rm -rf /var/lib/apt/lists/*

# ============================================================
# DENO
# ============================================================
# Necessário para:
# - componentes EJS do yt-dlp
# - geração de PO Tokens pelo bgutil
RUN curl -fsSL https://deno.land/install.sh | sh \
    && ln -s /root/.deno/bin/deno /usr/local/bin/deno

# ============================================================
# BGUTIL PO TOKEN PROVIDER
# ============================================================
# Versão fixa para manter o plugin e o provider compatíveis.
ENV BGUTIL_VERSION=1.3.1
ENV BGUTIL_HOME=/opt/bgutil-ytdlp-pot-provider

RUN git clone --depth 1 \
        --branch ${BGUTIL_VERSION} \
        https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git \
        ${BGUTIL_HOME} \
    && cd ${BGUTIL_HOME}/server \
    && deno install --allow-scripts=npm:canvas --frozen

WORKDIR /app

# ============================================================
# PYTHON DEPENDENCIES
# ============================================================
COPY requirements.txt .

RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# ============================================================
# APPLICATION
# ============================================================
COPY app ./app
COPY storage ./storage

RUN mkdir -p /app/storage/songs

ENV STORAGE_ROOT=/app/storage

EXPOSE 10000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]