import { useState, useEffect } from "react";
import "./ConfigScreen.css";
import { useSettings } from "../contexts/SettingsContext";
import {
  getBackgroundSettings,
  saveBackgroundSettings,
  replaceBackgroundAsset,
  clearBackgroundAsset,
  getBackgroundAsset,
} from "../services/backgroundStorage";

const NOTE_COLORS = [
  { name: "VERDE", color: "#20d83b" },
  { name: "VERMELHO", color: "#ff2020" },
  { name: "AMARELO", color: "#ffd21f" },
  { name: "AZUL", color: "#159cff" },
  { name: "LARANJA", color: "#ff9418" },
];

const BACKGROUND_MODES = [
  { id: "song-video", label: "VÍDEO DA MÚSICA" },
  { id: "image", label: "IMAGEM PERSONALIZADA" },
  { id: "video", label: "VÍDEO PERSONALIZADO" },
  { id: "none", label: "NENHUM" },
];

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE = 250 * 1024 * 1024;

function ConfigScreen({ onBack }) {
  const { settings, updateSettings } = useSettings();

  const [volume, setVolume] = useState(settings.volume);
  const [disableVideo, setDisableVideo] = useState(settings.disableVideo);
  const [keyBindings, setKeyBindings] = useState(settings.keyBindings);
  const [awaitingKey, setAwaitingKey] = useState(null);
  const [duplicateKey, setDuplicateKey] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [backgroundSettings, setBackgroundSettingsState] = useState(() => getBackgroundSettings());
  const [backgroundPreview, setBackgroundPreview] = useState(null);
  const [highwayPreview, setHighwayPreview] = useState(null);
  const [assetError, setAssetError] = useState("");
  const [savingBackground, setSavingBackground] = useState(false);

  useEffect(() => {
    const loadPreviews = async () => {
      try {
        if (backgroundSettings.backgroundMode === "image" && backgroundSettings.backgroundImageId) {
          const blob = await getBackgroundAsset(backgroundSettings.backgroundImageId);
          if (blob) setBackgroundPreview(URL.createObjectURL(blob));
        }

        if (backgroundSettings.highwayImageId) {
          const blob = await getBackgroundAsset(backgroundSettings.highwayImageId);
          if (blob) setHighwayPreview(URL.createObjectURL(blob));
        }
      } catch (error) {
        console.error("Falha ao carregar previews:", error);
      }
    };

    loadPreviews();

    return () => {
      if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
      if (highwayPreview) URL.revokeObjectURL(highwayPreview);
    };
    // Os previews são tratados também pelos handlers abaixo. Aqui carregamos o valor inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (awaitingKey === null) return;

    const handleKeyDown = (event) => {
      event.preventDefault();

      if (event.key === "Escape") {
        setAwaitingKey(null);
        return;
      }

      const newKey = event.key.toUpperCase();

      const duplicateIndex = keyBindings.findIndex(
        (k, idx) => idx !== awaitingKey && k === newKey
      );

      if (duplicateIndex !== -1) {
        setDuplicateKey({
          key: newKey,
          noteName: NOTE_COLORS[duplicateIndex].name,
        });
        setAwaitingKey(null);
        return;
      }

      setKeyBindings((prev) => {
        const updated = [...prev];
        updated[awaitingKey] = newKey;
        return updated;
      });
      setAwaitingKey(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [awaitingKey, keyBindings]);

  useEffect(() => {
    if (!duplicateKey) return;
    const timer = setTimeout(() => setDuplicateKey(null), 3000);
    return () => clearTimeout(timer);
  }, [duplicateKey]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 2000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  const updateBackgroundState = (patch) => {
    const next = saveBackgroundSettings(patch);
    setBackgroundSettingsState(next);
    return next;
  };

  const validateFile = (file, type) => {
    if (!file) return false;

    if (type === "image") {
      if (!IMAGE_TYPES.includes(file.type)) {
        setAssetError("Escolha uma imagem PNG, JPG, WEBP ou GIF.");
        return false;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        setAssetError("A imagem deve ter no máximo 15 MB.");
        return false;
      }
    }

    if (type === "video") {
      if (!file.type.startsWith("video/")) {
        setAssetError("Escolha um arquivo de vídeo válido.");
        return false;
      }

      if (file.size > MAX_VIDEO_SIZE) {
        setAssetError("O vídeo deve ter no máximo 250 MB.");
        return false;
      }
    }

    setAssetError("");
    return true;
  };

  const handleBackgroundImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!validateFile(file, "image")) return;

    setSavingBackground(true);

    try {
      const oldId = backgroundSettings.backgroundImageId;
      const id = await replaceBackgroundAsset(
        "background-image",
        oldId,
        file
      );

      const previewUrl = URL.createObjectURL(file);

      if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
      setBackgroundPreview(previewUrl);

      updateBackgroundState({
        backgroundMode: "image",
        backgroundImageId: id,
      });
    } catch (error) {
      console.error(error);
      setAssetError("Não foi possível salvar a imagem no navegador.");
    } finally {
      setSavingBackground(false);
    }
  };

  const handleBackgroundVideo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!validateFile(file, "video")) return;

    setSavingBackground(true);

    try {
      const oldId = backgroundSettings.backgroundVideoId;
      const id = await replaceBackgroundAsset(
        "background-video",
        oldId,
        file
      );

      updateBackgroundState({
        backgroundMode: "video",
        backgroundVideoId: id,
      });
    } catch (error) {
      console.error(error);
      setAssetError("Não foi possível salvar o vídeo no navegador.");
    } finally {
      setSavingBackground(false);
    }
  };

  const handleHighwayImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!validateFile(file, "image")) return;

    setSavingBackground(true);

    try {
      const oldId = backgroundSettings.highwayImageId;
      const id = await replaceBackgroundAsset(
        "highway-image",
        oldId,
        file
      );

      const previewUrl = URL.createObjectURL(file);

      if (highwayPreview) URL.revokeObjectURL(highwayPreview);
      setHighwayPreview(previewUrl);

      updateBackgroundState({
        highwayImageId: id,
      });
    } catch (error) {
      console.error(error);
      setAssetError("Não foi possível salvar a imagem da highway.");
    } finally {
      setSavingBackground(false);
    }
  };

  const handleClearBackgroundImage = async () => {
    const id = backgroundSettings.backgroundImageId;
    const next = await clearBackgroundAsset(
      "background-image",
      id
    );

    if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
    setBackgroundPreview(null);
    setBackgroundSettingsState(next);
  };

  const handleClearBackgroundVideo = async () => {
    const id = backgroundSettings.backgroundVideoId;
    const next = await clearBackgroundAsset(
      "background-video",
      id
    );

    setBackgroundSettingsState(next);
  };

  const handleClearHighway = async () => {
    const id = backgroundSettings.highwayImageId;
    const next = await clearBackgroundAsset(
      "highway-image",
      id
    );

    if (highwayPreview) URL.revokeObjectURL(highwayPreview);
    setHighwayPreview(null);
    setBackgroundSettingsState(next);
  };

  const handleSave = async () => {
    await updateSettings({
      volume,
      disableVideo,
      keyBindings,
    });

    saveBackgroundSettings(backgroundSettings);
    setSaveSuccess(true);
  };

  const handleModeChange = (mode) => {
    updateBackgroundState({
      backgroundMode: mode,
    });
  };

  return (
    <div className="config-screen">
      <div className="config-background" />

      <header className="config-header">
        <button className="hud-back-button" onClick={onBack}>
          ←
        </button>

        <div className="header-text">
          <span className="header-label">GUITAR LIVRE</span>
          <h1 className="header-title">CONFIGURAÇÕES</h1>
        </div>
      </header>

      <div className="config-wrapper">
        <div className="config-panel">
          <div className="config-panel-title">OPÇÕES DO SISTEMA</div>

          <div className="config-section">
            <label className="config-label">VOLUME DO ÁUDIO</label>
            <div className="volume-control">
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="volume-slider"
              />
              <span className="volume-value">{volume}%</span>
            </div>
          </div>

          <div className="config-section">
            <div className="config-toggle-row">
              <div>
                <span className="config-label">DESATIVAR VÍDEO DE FUNDO</span>
                <p className="config-hint">
                  Funciona como atalho para não usar vídeo durante o gameplay.
                </p>
              </div>

              <button
                type="button"
                className={`toggle-switch ${disableVideo ? "on" : "off"}`}
                onClick={() => setDisableVideo(!disableVideo)}
              >
                <span className="toggle-knob" />
              </button>
            </div>
          </div>

          <div className="config-section background-section">
            <label className="config-label">FUNDO DO GAMEPLAY</label>
            <p className="config-hint">
              Escolha o que será exibido atrás da highway. A música continua usando o master.ogg.
            </p>

            <div className="background-mode-grid">
              {BACKGROUND_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`background-mode-card ${
                    backgroundSettings.backgroundMode === mode.id ? "selected" : ""
                  }`}
                  onClick={() => handleModeChange(mode.id)}
                >
                  <span className="background-mode-radio" />
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>

            <div className="background-file-row">
              <label className="file-picker-button">
                ESCOLHER IMAGEM
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleBackgroundImage}
                  hidden
                />
              </label>

              <label className="file-picker-button secondary-file-picker">
                ESCOLHER VÍDEO
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleBackgroundVideo}
                  hidden
                />
              </label>
            </div>

            {backgroundPreview && (
              <div className="asset-preview-card">
                <img src={backgroundPreview} alt="Preview do fundo" />
                <div>
                  <strong>IMAGEM DE FUNDO ATIVA</strong>
                  <button
                    type="button"
                    className="asset-remove-button"
                    onClick={handleClearBackgroundImage}
                  >
                    REMOVER IMAGEM
                  </button>
                </div>
              </div>
            )}

            {backgroundSettings.backgroundVideoId && (
              <div className="asset-status-card">
                <strong>VÍDEO PERSONALIZADO SALVO</strong>
                <button
                  type="button"
                  className="asset-remove-button"
                  onClick={handleClearBackgroundVideo}
                >
                  REMOVER VÍDEO
                </button>
              </div>
            )}
          </div>

          <div className="config-section highway-section">
            <label className="config-label">FUNDO DA HIGHWAY</label>
            <p className="config-hint">
              A imagem aparece apenas dentro da highway e não interfere na música nem no vídeo de fundo.
            </p>

            <div className="background-file-row">
              <label className="file-picker-button">
                ESCOLHER IMAGEM DA HIGHWAY
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleHighwayImage}
                  hidden
                />
              </label>
            </div>

            {highwayPreview && (
              <div className="asset-preview-card highway-preview-card">
                <img src={highwayPreview} alt="Preview da highway" />
                <div>
                  <strong>HIGHWAY PERSONALIZADA</strong>
                  <button
                    type="button"
                    className="asset-remove-button"
                    onClick={handleClearHighway}
                  >
                    REMOVER IMAGEM
                  </button>
                </div>
              </div>
            )}

            <div className="tuning-control">
              <div className="tuning-header">
                <span>OPACIDADE</span>
                <strong>{Math.round(backgroundSettings.highwayOpacity * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(backgroundSettings.highwayOpacity * 100)}
                onChange={(e) =>
                  updateBackgroundState({
                    highwayOpacity: Number(e.target.value) / 100,
                  })
                }
              />
            </div>

            <div className="tuning-control">
              <div className="tuning-header">
                <span>ESCURECIMENTO</span>
                <strong>{Math.round(backgroundSettings.highwayDarkness * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(backgroundSettings.highwayDarkness * 100)}
                onChange={(e) =>
                  updateBackgroundState({
                    highwayDarkness: Number(e.target.value) / 100,
                  })
                }
              />
            </div>
          </div>

          {assetError && (
            <div className="asset-error">
              {assetError}
            </div>
          )}

          {savingBackground && (
            <div className="asset-saving">
              SALVANDO ARQUIVO LOCAL...
            </div>
          )}

          <div className="config-section">
            <label className="config-label">TECLADO – HITPADS</label>
            <p className="config-hint">CLIQUE EM UMA TECLA PARA REMAPEAR</p>

            <div className="key-bindings-list">
              {NOTE_COLORS.map((note, index) => (
                <div className="key-binding-row" key={note.name}>
                  <span
                    className="note-color-dot"
                    style={{ backgroundColor: note.color }}
                  />

                  <span className="note-name">{note.name}</span>

                  <button
                    className={`key-binding-button ${
                      awaitingKey === index ? "awaiting" : ""
                    }`}
                    onClick={() => setAwaitingKey(index)}
                  >
                    {awaitingKey === index
                      ? "AGUARDANDO..."
                      : keyBindings[index]}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="config-save-row">
            <button
              className="hud-primary-button"
              onClick={handleSave}
            >
              SALVAR
            </button>
          </div>
        </div>
      </div>

      {duplicateKey && (
        <div
          className="duplicate-popup-overlay"
          onClick={() => setDuplicateKey(null)}
        >
          <div
            className="duplicate-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-title">TECLA EM USO</div>
            <p className="popup-message">
              A tecla <strong>{duplicateKey.key}</strong> já está atribuída a{" "}
              <strong>{duplicateKey.noteName}</strong>.
            </p>
            <button
              className="hud-secondary-button"
              onClick={() => setDuplicateKey(null)}
            >
              ENTENDI
            </button>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div
          className="duplicate-popup-overlay"
          onClick={() => setSaveSuccess(false)}
        >
          <div
            className="duplicate-popup success-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-title success-popup-title">
              CONFIGURAÇÕES SALVAS
            </div>
            <p className="popup-message success-popup-message">
              Suas preferências foram atualizadas.
            </p>
            <button
              className="hud-primary-button"
              onClick={() => setSaveSuccess(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigScreen;
