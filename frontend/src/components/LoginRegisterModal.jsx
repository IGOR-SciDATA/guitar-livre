import { useState } from "react";
import "./LoginRegisterModal.css";
import { useAuth } from "../contexts/AuthContext";
import logoImg from "../assets/logo.png"; // ajuste o caminho conforme necessário

function LoginRegisterModal({ onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    const result =
      mode === "login"
        ? await login(username, password, remember)
        : await register(username, password);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    if (result.success) {
      setSuccess(result.message);
      setSubmitting(false);
      // Fecha após 2 segundos para que o usuário veja a mensagem
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <img src={logoImg} alt="Guitar Livre" className="auth-logo" />
          <h2 className="auth-title">
            {mode === "login" ? "ENTRAR" : "REGISTRAR"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>USUÁRIO</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label>SENHA</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === "login" && (
            <label className="auth-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              MANTER CONECTADO
            </label>
          )}

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? "AGUARDE..." : mode === "login" ? "ENTRAR" : "CRIAR CONTA"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <button onClick={() => setMode("register")}>
              NÃO TEM CONTA? REGISTRE-SE
            </button>
          ) : (
            <button onClick={() => setMode("login")}>
              JÁ TEM CONTA? ENTRAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginRegisterModal;