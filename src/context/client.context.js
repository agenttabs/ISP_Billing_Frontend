import { createContext, useState, useContext, useCallback } from "react";
import API from "../api/api";

const ClientContext = createContext();

const defaultClientMeta = {
  total: 0,
  activeCount: 0,
  disconnectedCount: 0,
  page: 1,
  limit: 10,
};

export const ClientProvider = ({ children }) => {
  const [clients, setClients] = useState([]);
  const [clientMeta, setClientMeta] = useState(defaultClientMeta);
  const [loading, setLoading] = useState(false);

  const fetchClients = useCallback(async (params = {}) => {
    try {
      setLoading(true);

      const res = await API.get("/clients", { params });
      const rows = Array.isArray(res.data) ? res.data : res.data?.rows || [];
      const meta = res.data?.meta || {};

      console.log("FETCHED CLIENTS:", rows);

      setClients(rows);
      setClientMeta({
        total: Number(meta.total || rows.length || 0),
        activeCount: Number(meta.activeCount || 0),
        disconnectedCount: Number(meta.disconnectedCount || 0),
        page: Number(meta.page || params.page || 1),
        limit: Number(meta.limit || params.limit || defaultClientMeta.limit),
      });
    } catch (err) {
      console.error("FETCH ERROR:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addClient = async (clientData) => {
    try {
      const res = await API.post("/clients", clientData);

      console.log("ADDED CLIENT:", res.data);

      setClients((prev) => [...prev, res.data]);
      setClientMeta((prev) => ({
        ...prev,
        total: prev.total + 1,
        activeCount: prev.activeCount + 1,
      }));
    } catch (err) {
      console.error("ADD ERROR:", err);
      throw err;
    }
  };

  return (
    <ClientContext.Provider
      value={{
        clients,
        clientMeta,
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
