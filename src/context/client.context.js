import { createContext, useState, useContext, useCallback } from "react";
import API from "../api/api";

const ClientContext = createContext();

export const ClientProvider = ({ children }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ FIXED: useCallback (prevents re-render issues)
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);

      const res = await API.get("/clients");

      console.log("✅ FETCHED CLIENTS:", res.data); // DEBUG

      setClients(res.data || []);
    } catch (err) {
      console.error("❌ FETCH ERROR:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ADD CLIENT
  const addClient = async (clientData) => {
    try {
      const res = await API.post("/clients", clientData);

      console.log("✅ ADDED CLIENT:", res.data);

      setClients((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("❌ ADD ERROR:", err);
    }
  };

  return (
    <ClientContext.Provider
      value={{
        clients,
        loading,
        fetchClients,
        addClient,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = () => useContext(ClientContext);
