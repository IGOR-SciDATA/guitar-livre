import API_URL from "../config";
import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    volume: 70,
    disableVideo: false,
    keyBindings: ["A", "S", "D", "F", "G"],
  });
  const [loading, setLoading] = useState(false);

  // Carrega as configurações do usuário quando loga
  useEffect(() => {
    if (!user) {
      setSettings({
        volume: 70,
        disableVideo: false,
        keyBindings: ["A", "S", "D", "F", "G"],
      });
      return;
    }

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/settings/${user.username}`);
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        } else {
          // Usa padrão se algo falhar
          setSettings({
            volume: 70,
            disableVideo: false,
            keyBindings: ["A", "S", "D", "F", "G"],
          });
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  const updateSettings = async (newSettings) => {
    if (!user) {
      // Sem usuário logado, apenas mantém local
      setSettings((prev) => ({ ...prev, ...newSettings }));
      return;
    }

    // Atualiza localmente para resposta imediata
    setSettings((prev) => ({ ...prev, ...newSettings }));

    try {
      const response = await fetch(`${API_URL}/api/settings/${user.username}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro ao salvar configurações:", errorData.detail);
      }
    } catch (err) {
      console.error("Falha na conexão ao salvar:", err);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}