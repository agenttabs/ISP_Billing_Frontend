import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import API from "../api/api";

const AuthContext = createContext();
const initialToken = localStorage.getItem("token");

if (initialToken) {
  axios.defaults.headers.common.Authorization = `Bearer ${initialToken}`;
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(initialToken || null);
  const [user, setUser] = useState(() => {
    const rawUser = localStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    try {
      setLoading(true);
      const { data } = await API.post("/auth/login", {
        username,
        password
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      const message = err.response?.data?.error || "Login failed.";
      console.error("Login error:", err);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token),
      login,
      logout,
      hasRole: (...roles) =>
        roles
          .map((role) => String(role).toUpperCase())
          .includes(String(user?.type || "").toUpperCase())
    }),
    [token, user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
