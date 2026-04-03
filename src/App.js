import { useEffect, useState } from "react";
import axios from "axios";
import ClientList from "./pages/client";

function App() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:5000/api/clients")
      .then(res => setClients(res.data));
  }, []);

  return (
    <div>
      <ClientList clients={clients} />
    </div>
  );
}

export default App;