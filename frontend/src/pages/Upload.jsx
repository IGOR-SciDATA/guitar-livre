import API_URL from "../config";
import { useEffect, useRef, useState } from "react";
import "./Upload.css";

const PROCESSING_STEPS = [
  "BAIXANDO ÁUDIO",
  "GERANDO CHART",
  "PREPARANDO GAMEPLAY",
];

function Upload({ onBack }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [song, setSong] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [songId, setSongId] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  const pollIntervalRef = useRef(null);
  const stepIntervalRef = useRef(null);

  // Limpa intervalos ao desmontar
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    };
  }, []);

  // Efeito de progresso das etapas
  useEffect(() => {
    if (!processing) return;

    setCurrentStep(0);
    stepIntervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= PROCESSING_STEPS.length - 1) {
          clearInterval(stepIntervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 4000); // avança etapa a cada 4 segundos

    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    };
  }, [processing]);

  // Polling para verificar quando a música estiver pronta
  useEffect(() => {
    if (!processing || !songId) return;

    const MAX_POLLING_ATTEMPTS = 120;
    let attempts = 0;

    const checkStatus = async () => {
      attempts++;

      if (attempts > MAX_POLLING_ATTEMPTS) {
        clearInterval(pollIntervalRef.current);
        setProcessing(false);
        setError("O processamento demorou demais. Tente novamente.");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/songs");
        if (!response.ok) throw new Error("Erro ao verificar status");

        const songs = await response.json();
        const foundSong = songs.find((s) => s.id === songId);

        if (foundSong && foundSong.ready) {
          clearInterval(pollIntervalRef.current);
          setProcessing(false);
          setConfirmed(true);
        }
      } catch (err) {
        console.error("Erro no polling:", err);
      }
    };

    pollIntervalRef.current = setInterval(checkStatus, 5000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [processing, songId]);

  async function handleSearch() {
    if (!url.trim()) {
      setError("Cole um link do YouTube.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const normalizedUrl = normalizeYouTubeUrl(url);

      // Mostra no campo a URL realmente utilizada pelo Guitar Livre.
      setUrl(normalizedUrl);

      console.log(
        "[Guitar Livre] URL original:",
        url
      );

      console.log(
        "[Guitar Livre] URL normalizada:",
        normalizedUrl
      );

      const response = await fetch(
        `${API_URL}/api/songs/metadata`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: normalizedUrl,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Não foi possível encontrar a música."
        );
      }

      setSong(data);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!song) return;

    setConfirming(true);
    setError("");

    try {
      const normalizedUrl = normalizeYouTubeUrl(
        song.source_url
      );

      const response = await fetch(
        `${API_URL}/api/songs/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: normalizedUrl,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Não foi possível adicionar a música."
        );
      }

      setSongId(data.id);
      setProcessing(true);

    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  }

  function handleReset() {
    setSong(null);
    setConfirmed(false);
    setProcessing(false);
    setSongId(null);
    setError("");
    setCurrentStep(0);
  }

  function formatDuration(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function normalizeYouTubeUrl(rawUrl) {
    const value = rawUrl.trim();

    if (!value) {
      throw new Error("Cole um link do YouTube.");
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(value);
    } catch {
      throw new Error("Cole um link válido do YouTube.");
    }

    const hostname = parsedUrl.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    let videoId = "";

    // youtube.com/watch?v=VIDEO_ID
    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com"
    ) {
      if (
        parsedUrl.pathname === "/watch" ||
        parsedUrl.pathname === "/watch/"
      ) {
        videoId = parsedUrl.searchParams.get("v") || "";
      }

      // youtube.com/shorts/VIDEO_ID
      if (
        !videoId &&
        parsedUrl.pathname.startsWith("/shorts/")
      ) {
        videoId =
          parsedUrl.pathname
            .split("/")[2]
            ?.split("?")[0] || "";
      }

      // youtube.com/live/VIDEO_ID
      if (
        !videoId &&
        parsedUrl.pathname.startsWith("/live/")
      ) {
        videoId =
          parsedUrl.pathname
            .split("/")[2]
            ?.split("?")[0] || "";
      }
    }

    // youtu.be/VIDEO_ID
    if (hostname === "youtu.be") {
      videoId =
        parsedUrl.pathname
          .split("/")
          .filter(Boolean)[0] || "";
    }

    if (!videoId) {
      throw new Error(
        "Não foi possível identificar o vídeo nesse link do YouTube."
      );
    }

    // Remove qualquer parâmetro/caractere residual.
    videoId = videoId.split("&")[0].trim();

    if (videoId.length < 6) {
      throw new Error(
        "O link não parece conter um ID de vídeo válido."
      );
    }

    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  /*
   * ==================================================
   * TELA DE SUCESSO
   * ==================================================
   */
  if (confirmed && song) {
    return (
      <div className="upload-page">
        <div className="upload-background" />
        <div className="upload-overlay" />

        <header className="upload-header">
          <button className="hud-back-button" onClick={onBack}>
            ←
          </button>
          <div className="header-text">
            <span className="header-label">GUITAR LIVRE</span>
            <h1 className="header-title">ADICIONAR MÚSICA</h1>
          </div>
        </header>

        <main className="upload-content">
          <section className="game-panel success-panel">
            <div className="panel-title">MÚSICA PRONTA!</div>

            <div className="success-song-info">
              <span className="success-song-artist">{song.artist}</span>
              <span className="success-song-title">{song.title}</span>
            </div>

            <p className="success-message">
              SUA MÚSICA FOI ADICIONADA AO GUITAR LIVRE
            </p>

            <button className="hud-primary-button" onClick={onBack}>
              VOLTAR PARA O MENU
            </button>
          </section>
        </main>
      </div>
    );
  }

  /*
   * ==================================================
   * TELA DE PROCESSAMENTO
   * ==================================================
   */
  if (processing) {
    return (
      <div className="upload-page">
        <div className="upload-background" />
        <div className="upload-overlay" />

        <header className="upload-header">
          <button className="hud-back-button" onClick={onBack}>
            ←
          </button>
          <div className="header-text">
            <span className="header-label">GUITAR LIVRE</span>
            <h1 className="header-title">ADICIONAR MÚSICA</h1>
          </div>
        </header>

        <main className="upload-content">
          <section className="game-panel processing-panel">
            <div className="panel-title">PROCESSANDO MÚSICA</div>
            <p className="processing-subtitle">
              O GUITAR LIVRE ESTÁ PREPARANDO SUA MÚSICA
            </p>

            <div className="processing-steps">
              {PROCESSING_STEPS.map((step, index) => (
                <div
                  key={step}
                  className={`processing-step ${
                    index === currentStep
                      ? "active"
                      : index < currentStep
                      ? "done"
                      : ""
                  }`}
                >
                  <span
                    className={`step-indicator ${
                      index === currentStep
                        ? "active"
                        : index < currentStep
                        ? "done"
                        : ""
                    }`}
                  ></span>
                  {step}
                </div>
              ))}
            </div>

            <div className="equalizer">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>

            <p className="processing-hint">
              {currentStep === 0 && "Baixando e extraindo áudio..."}
              {currentStep === 1 && "Analisando ritmo e gerando chart..."}
              {currentStep === 2 && "Preparando gameplay..."}
              {currentStep >= PROCESSING_STEPS.length - 1 &&
                "Finalizando. Isso pode levar alguns minutos."}
            </p>
          </section>
        </main>
      </div>
    );
  }

  /*
   * ==================================================
   * TELA DE CONFIRMAÇÃO DA MÚSICA ENCONTRADA
   * ==================================================
   */
  if (song) {
    return (
      <div className="upload-page">
        <div className="upload-background" />
        <div className="upload-overlay" />

        <header className="upload-header">
          <button className="hud-back-button" onClick={handleReset}>
            ←
          </button>
          <div className="header-text">
            <span className="header-label">GUITAR LIVRE</span>
            <h1 className="header-title">ADICIONAR MÚSICA</h1>
          </div>
        </header>

        <main className="upload-content">
          <section className="game-panel confirm-panel">
            <div className="panel-title">MÚSICA ENCONTRADA</div>

            <div className="confirm-thumbnail-container">
              <img
                className="confirm-thumbnail"
                src={song.thumbnail}
                alt={song.title}
              />
            </div>

            <div className="confirm-info">
              <span className="confirm-artist">{song.artist}</span>
              <h2 className="confirm-title">{song.title}</h2>
              <span className="confirm-duration">
                DURAÇÃO {formatDuration(song.duration)}
              </span>
            </div>

            <p className="confirm-question">
              ESSA É A MÚSICA QUE VOCÊ DESEJA?
            </p>

            {error && (
              <div className="error-box">
                <span className="error-icon">!</span>
                {error}
              </div>
            )}

            <div className="confirm-actions">
              <button
                className="hud-secondary-button"
                onClick={handleReset}
                disabled={confirming}
              >
                VOLTAR
              </button>
              <button
                className="hud-primary-button"
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming ? "CONFIRMANDO..." : "CONFIRMAR"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  /*
   * ==================================================
   * TELA INICIAL (FORMULÁRIO)
   * ==================================================
   */
  return (
    <div className="upload-page">
      <div className="upload-background" />
      <div className="upload-overlay" />

      <header className="upload-header">
        <button className="hud-back-button" onClick={onBack}>
          ←
        </button>
        <div className="header-text">
          <span className="header-label">GUITAR LIVRE</span>
          <h1 className="header-title">ADICIONAR MÚSICA</h1>
        </div>
      </header>

      <main className="upload-content">
        <section className="game-panel form-panel">
          <div className="panel-title">ADICIONAR MÚSICA</div>
          <p className="panel-subtitle">COLOQUE O ROCK PARA TOCAR</p>

          <div className="url-form">
            <label className="url-label" htmlFor="youtube-url">
              LINK DO YOUTUBE
            </label>
            <input
              id="youtube-url"
              className="url-input"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={loading}
            />

            {error && (
              <div className="error-box">
                <span className="error-icon">!</span>
                {error}
              </div>
            )}

            <button
              className="hud-primary-button full-width"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? "BUSCANDO..." : "CONTINUAR"}
            </button>
          </div>

          <p className="upload-hint">
            O GUITAR LIVRE IRÁ PREPARAR E SALVAR A MÚSICA AUTOMATICAMENTE
          </p>
        </section>
      </main>
    </div>
  );
}

export default Upload;