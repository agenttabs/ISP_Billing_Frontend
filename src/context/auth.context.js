import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import API from "../api/api";

const AuthContext = createContext();
const initialToken = sessionStorage.getItem("token");
const initialUserRaw = sessionStorage.getItem("user");
const initialUser = initialUserRaw ? JSON.parse(initialUserRaw) : null;

if (initialToken) {
  axios.defaults.headers.common.Authorization = `Bearer ${initialToken}`;
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(initialToken || null);
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    try {
      setLoading(true);
      const { data } = await API.post("/auth/login", {
        username,
        password
      });

      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
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

  const logout = (redirectToLogin = false) => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    delete axios.defaults.headers.common.Authorization;
    setToken(null);
    setUser(null);

    if (redirectToLogin && window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      setLoading(true);
      const { data } = await API.post("/auth/change-password", {
        currentPassword,
        newPassword
      });

      return { success: true, message: data?.message || "Password changed successfully." };
    } catch (err) {
      const message = err.response?.data?.error || "Failed to change password.";
      console.error("Change password error:", err);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, [token]);

  useEffect(() => {
    if ((token && !user) || (!token && user)) {
      logout(true);
    }
  }, [token, user]);

  useEffect(() => {
    const interceptorId = API.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const requestUrl = String(error?.config?.url || "");
        const isLoginRequest = requestUrl.includes("/auth/login");

        if (status === 401 && !isLoginRequest) {
          logout(true);
        }

        return Promise.reject(error);
      }
    );

    return () => {
      API.interceptors.response.eject(interceptorId);
    };
  }, [token, user]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token),
      login,
      logout,
      changePassword,
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

