import API_URL from "../config";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("guitarLivreUser");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("guitarLivreUser");
      }
    }
  }, []);

  const login = async (username, password, remember = false) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.detail || "Falha ao entrar." };
      }

      const user = { username: data.username };
      setUser(user);

      if (remember) {
        localStorage.setItem("guitarLivreUser", JSON.stringify(user));
      } else {
        localStorage.removeItem("guitarLivreUser");
      }

      return { success: true, message: "Login realizado com sucesso!" };
    } catch {
      return { error: "Não foi possível conectar ao servidor." };
    }
  };

  const register = async (username, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.detail || "Falha ao registrar." };
      }

      const user = { username: data.username };
      setUser(user);
      localStorage.removeItem("guitarLivreUser");

      return { success: true, message: "Conta criada com sucesso!" };
    } catch {
      return { error: "Não foi possível conectar ao servidor." };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("guitarLivreUser");
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}