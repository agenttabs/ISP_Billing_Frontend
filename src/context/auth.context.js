import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import API from "../api/api";

const AuthContext = createContext();
const IDLE_LOGOUT_MS = 30 * 60 * 1000;
const SESSION_CHECK_MS = 30 * 1000;
const initialToken = sessionStorage.getItem("token");
const initialUserRaw = sessionStorage.getItem("user");
const initialUser = initialUserRaw ? JSON.parse(initialUserRaw) : null;

const getTokenPayload = (value) => {
  try {
    const payload = String(value || "").split(".")[1];
    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );

    return JSON.parse(window.atob(paddedPayload));
  } catch (error) {
    return null;
  }
};

const getTokenExpiryTime = (value) => {
  const payload = getTokenPayload(value);
  const expirySeconds = Number(payload?.exp || 0);

  return expirySeconds > 0 ? expirySeconds * 1000 : 0;
};

const isTokenInvalidOrExpired = (value) => {
  if (!getTokenPayload(value)) {
    return true;
  }

  const expiryTime = getTokenExpiryTime(value);

  return Boolean(expiryTime && Date.now() >= expiryTime);
};

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

  const logoutWithMessage = (message = "") => {
    if (message) {
      sessionStorage.setItem("logoutMessage", message);
    }

    logout(true);
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
    if (!token) {
      return undefined;
    }

    if (isTokenInvalidOrExpired(token)) {
      logout(true);
      return undefined;
    }

    const expiryTime = getTokenExpiryTime(token);
    const timeoutMs = expiryTime ? Math.max(expiryTime - Date.now(), 0) : 0;

    if (!timeoutMs) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      logout(true);
    }, timeoutMs);

    const handleSessionCheck = () => {
      const currentToken = sessionStorage.getItem("token");

      if (!currentToken || isTokenInvalidOrExpired(currentToken)) {
        logout(true);
      }
    };

    window.addEventListener("focus", handleSessionCheck);
    document.addEventListener("visibilitychange", handleSessionCheck);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", handleSessionCheck);
      document.removeEventListener("visibilitychange", handleSessionCheck);
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const checkActiveSession = () => {
      API.get("/auth/me").catch(() => {
        // 401 responses are handled by the shared API interceptor below.
      });
    };

    checkActiveSession();
    const intervalId = window.setInterval(checkActiveSession, SESSION_CHECK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let timeoutId = null;

    const resetIdleTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        logout(true);
      }, IDLE_LOGOUT_MS);
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "click",
      "scroll",
      "touchstart",
      "wheel"
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
    };
  }, [token]);

  useEffect(() => {
    const interceptorId = API.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const requestUrl = String(error?.config?.url || "");
        const isLoginRequest = requestUrl.includes("/auth/login");

        if (status === 401 && !isLoginRequest) {
          const message =
            error?.response?.data?.code === "SESSION_REPLACED"
              ? "Your account was logged in from another device."
              : "";
          logoutWithMessage(message);
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
      logoutWithMessage,
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

