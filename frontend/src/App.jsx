import { useState, useEffect } from "react";
import "./App.css";
import Play from "./pages/Play";
import Upload from "./pages/Upload";
import ConfigScreen from "./pages/ConfigScreen";
import LoginRegisterModal from "./components/LoginRegisterModal";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";

// Importa o vídeo de fundo
import menuVideoSrc from "./assets/menu-background.mp4";

function Home({ onPlay, onUpload, onConfig, user, onLogout }) {
  return (
    <div className="home-container">
      <video
        className="home-video"
        src={menuVideoSrc}
        autoPlay
        loop
        muted
        playsInline
      />

      <nav className="home-menu">
        <button className="menu-button" onClick={onPlay}>
          JOGAR
        </button>
        <button className="menu-button" onClick={onUpload}>
          SUBIR MÚSICA
        </button>
        <button className="menu-button" onClick={onConfig}>
          CONFIGURAÇÕES
        </button>

        {user && (
          <button className="menu-button" onClick={onLogout}>
            SAIR
          </button>
        )}
      </nav>
    </div>
  );
}

function AppContent() {
  const [page, setPage] = useState("home");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const { user, logout } = useAuth();

  // Limpa o toast automaticamente após 3 segundos
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handlePlayClick = () => {
    if (user) {
      setPage("play");
    } else {
      setShowAuthModal(true);
    }
  };

  const handleLogout = () => {
    logout();
    setPage("home");
    setToastMessage("Logout com sucesso!");
  };

  // Após login, navega automaticamente para a tela de Jogar e exibe toast
  useEffect(() => {
    if (user && showAuthModal) {
      setShowAuthModal(false);
      setPage("play");
      setToastMessage("Login realizado com sucesso!");
    }
  }, [user, showAuthModal]);

  return (
    <>
      {page === "home" && (
        <Home
          onPlay={handlePlayClick}
          onUpload={() => setPage("upload")}
          onConfig={() => setPage("config")}
          user={user}
          onLogout={handleLogout}
        />
      )}

      {page === "play" && <Play onBack={() => setPage("home")} />}

      {page === "upload" && <Upload onBack={() => setPage("home")} />}

      {page === "config" && <ConfigScreen onBack={() => setPage("home")} />}

      {showAuthModal && (
        <LoginRegisterModal onClose={() => setShowAuthModal(false)} />
      )}

      {toastMessage && (
        <div className="toast-message">
          {toastMessage}
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;