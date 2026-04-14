  import { useEffect, useState } from "react";
  import axios from "axios";

  import {
    BrowserRouter as Router,
    Routes,
    Route
  } from "react-router-dom";


  import AddClient from "./pages/addclient";
  import EditClient from "./pages/editclient";
  import Dashboard from "./pages/Dashboard";

  import Billing from "./pages/Billing";
  import Receipts from "./pages/Receipts";
  import Layout from "./layout/Layout";
  import ClientList from "./pages/client";
import ClientMapPage from "./pages/map/client.address.map";

  function App() {
    
    // ✅ define clients state
    const [clients, setClients] = useState([]);

    // ✅ load clients from backend
    useEffect(() => {
      axios
        .get("http://localhost:5000/api/clients")
        .then((res) => setClients(res.data))
        .catch((err) => console.error(err));
    }, []);

    return (
      <Router>
        <Layout>
          <Routes>
            <Route path="/clients" element={<ClientList />} />
            <Route path="/addclient" element={<AddClient />} />
            <Route path="/editclient/:id" element={<EditClient />} />
            <Route path="/billing/:id" element={<div>Billing Page</div>} />
            <Route path="/receipt/:id" element={<div>Receipt Page</div>} />
            <Route path="/map" element={<ClientMapPage />} />
            <Route path="/dashboard" element={<Dashboard />} />

          </Routes>
        </Layout>
      </Router>
    );
  }

  export default App;