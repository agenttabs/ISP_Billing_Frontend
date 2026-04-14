// import React, { useEffect, useState } from "react";
// import { Box, AppBar, Toolbar, Typography, TextField, InputAdornment, Paper, CircularProgress } from "@mui/material";
// import SearchIcon from "@mui/icons-material/Search";
// import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
// import "leaflet/dist/leaflet.css";

// // Fix leaflet marker icon issue
// import L from "leaflet";
// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
//   iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
//   shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
// });

// // SAMPLE CLIENTS (NO LAT/LNG)
// const mockClients = [
//   { id: 1, name: "ClientdA", address: "447 ramos compound 2 talon uno las pinas city, Philippines" },
//   { id: 2, name: "Client B", address: "447 ramos compound 2 talon uno las pinas city, Philippines" },
//   { id: 3, name: "Client C", address: "447 ramos compound 2 talon uno las pinas city, Philippines" },
// ];

// // GEOCODING FUNCTION
// const getCoordinates = async (address) => {
//   try {
//     const res = await fetch(
//       `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
//     );
//     const data = await res.json();

//     if (!data.length) return null;

//     return {
//       lat: parseFloat(data[0].lat),
//       lng: parseFloat(data[0].lon),
//     };
//   } catch (err) {
//     console.error("Geocoding error:", err);
//     return null;
//   }
// };

// export default function ClientMapPage() {
//   const [clients] = useState(mockClients);
//   const [search, setSearch] = useState("");
//   const [clientsWithCoords, setClientsWithCoords] = useState([]);
//   const [loading, setLoading] = useState(true);

//   // GEOCODE + CACHE
//   useEffect(() => {
//     const loadClients = async () => {
//       const cached = localStorage.getItem("clientsWithCoords");

//       if (cached) {
//         setClientsWithCoords(JSON.parse(cached));
//         setLoading(false);
//         return;
//       }

//       const results = [];

//       for (const client of clients) {
//         const coords = await getCoordinates(client.address);

//         if (coords) {
//           results.push({
//             ...client,
//             ...coords,
//           });
//         }
//       }

//       localStorage.setItem("clientsWithCoords", JSON.stringify(results));
//       setClientsWithCoords(results);
//       setLoading(false);
//     };

//     loadClients();
//   }, [clients]);

//   const filteredClients = clientsWithCoords.filter((c) =>
//     c.name.toLowerCase().includes(search.toLowerCase()) ||
//     c.address.toLowerCase().includes(search.toLowerCase())
//   );

//   return (
//     <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
//       {/* Header */}
//       <AppBar position="static" elevation={1}>
//         <Toolbar>
//           <Typography variant="h6" sx={{ flexGrow: 1 }}>
//             Client Map Dashboard
//           </Typography>

//           <TextField
//             size="small"
//             placeholder="Search clients..."
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             sx={{ background: "white", borderRadius: 1, minWidth: 250 }}
//             InputProps={{
//               startAdornment: (
//                 <InputAdornment position="start">
//                   <SearchIcon />
//                 </InputAdornment>
//               ),
//             }}
//           />
//         </Toolbar>
//       </AppBar>

//       {/* Content */}
//       <Box sx={{ flex: 1, display: "flex" }}>
//         {/* Sidebar */}
//         <Paper sx={{ width: 300, overflow: "auto", p: 2 }}>
//           <Typography variant="h6" gutterBottom>
//             Clients
//           </Typography>

//           {loading ? (
//             <CircularProgress />
//           ) : (
//             filteredClients.map((client) => (
//               <Box key={client.id} sx={{ mb: 2, p: 1, borderBottom: "1px solid #eee" }}>
//                 <Typography variant="subtitle1">{client.name}</Typography>
//                 <Typography variant="body2" color="text.secondary">
//                   {client.address}
//                 </Typography>
//               </Box>
//             ))
//           )}
//         </Paper>

//         {/* Map */}
//         <Box sx={{ flex: 1 }}>
//           <MapContainer
//             center={[14.5995, 120.9842]}
//             zoom={12}
//             style={{ height: "100%", width: "100%" }}
//           >
//             <TileLayer
//               attribution="&copy; OpenStreetMap contributors"
//               url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//             />

//             {!loading &&
//               filteredClients.map((client) => (
//                 <Marker key={client.id} position={[client.lat, client.lng]}>
//                   <Popup>
//                     <strong>{client.name}</strong>
//                     <br />
//                     {client.address}
//                   </Popup>
//                 </Marker>
//               ))}
//           </MapContainer>
//         </Box>
//       </Box>
//     </Box>
//   );
// }


//with api
// import React, { useEffect, useState } from "react";
// import { Box, AppBar, Toolbar, Typography, TextField, InputAdornment, Paper, CircularProgress } from "@mui/material";
// import SearchIcon from "@mui/icons-material/Search";
// import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
// import "leaflet/dist/leaflet.css";
// import L from "leaflet";

// // 🔥 CUSTOM ICONS
// const greenIcon = new L.Icon({
//   iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
//   iconSize: [32, 32]
// });

// const redIcon = new L.Icon({
//   iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
//   iconSize: [32, 32]
// });

// // 🔥 BLINK STYLE
// const blinkStyle = document.createElement("style");
// blinkStyle.innerHTML = `
// @keyframes blink {
//   0% { opacity: 1; }
//   50% { opacity: 0.3; }
//   100% { opacity: 1; }
// }
// .leaflet-marker-icon.blink {
//   animation: blink 1s infinite;
// }
// `;
// document.head.appendChild(blinkStyle);

// // GEOCODE
// const getCoordinates = async (address) => {
//   try {
//     const res = await fetch(
//       `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
//     );
//     const data = await res.json();
//     if (!data.length) return null;

//     return {
//       lat: parseFloat(data[0].lat),
//       lng: parseFloat(data[0].lon),
//     };
//   } catch {
//     return null;
//   }
// };

// export default function ClientMapPage({ clients }) {
//   const [search, setSearch] = useState("");
//   const [clientsWithCoords, setClientsWithCoords] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const load = async () => {
//       const cached = localStorage.getItem("clientsWithCoords");

//       if (cached) {
//         setClientsWithCoords(JSON.parse(cached));
//         setLoading(false);
//         return;
//       }

//       const results = [];

//       for (const c of clients) {
//         const coords = await getCoordinates(c.Address);

//         if (coords) {
//           results.push({
//             ...c,
//             ...coords,
//           });
//         }
//       }

//       localStorage.setItem("clientsWithCoords", JSON.stringify(results));
//       setClientsWithCoords(results);
//       setLoading(false);
//     };

//     if (clients?.length) load();
//   }, [clients]);

//   const filtered = clientsWithCoords.filter((c) =>
//     (c.ClientName || "").toLowerCase().includes(search.toLowerCase())
//   );

//   return (
//     <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
//       <AppBar position="static">
//         <Toolbar>
//           <Typography sx={{ flexGrow: 1 }}>Client Map</Typography>
//           <TextField
//             size="small"
//             placeholder="Search"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             sx={{ background: "white", borderRadius: 1 }}
//             InputProps={{
//               startAdornment: (
//                 <InputAdornment position="start">
//                   <SearchIcon />
//                 </InputAdornment>
//               ),
//             }}
//           />
//         </Toolbar>
//       </AppBar>

//       <Box sx={{ flex: 1, display: "flex" }}>
//         {/* LIST */}
//         <Paper sx={{ width: 300, p: 2, overflow: "auto" }}>
//           {loading ? (
//             <CircularProgress />
//           ) : (
//             filtered.map((c) => (
//               <Box key={c._id} sx={{ mb: 2 }}>
//                 <Typography fontWeight="bold">{c.ClientName}</Typography>
//                 <Typography variant="body2">{c.Address}</Typography>
//                 <Typography
//                   color={c.PaymentStatus === "PAID" ? "green" : "red"}
//                 >
//                   {c.PaymentStatus || "UNPAID"}
//                 </Typography>
//               </Box>
//             ))
//           )}
//         </Paper>

//         {/* MAP */}
//         <Box sx={{ flex: 1 }}>
//           <MapContainer
//             center={[14.5995, 120.9842]}
//             zoom={12}
//             style={{ height: "100%" }}
//           >
//             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

//             {!loading &&
//               filtered.map((c) => {
//                 const isPaid = (c.PaymentStatus || "").toUpperCase() === "PAID";

//                 return (
//                   <Marker
//                     key={c._id}
//                     position={[c.lat, c.lng]}
//                     icon={isPaid ? greenIcon : redIcon}
//                     eventHandlers={{
//                       add: (e) => {
//                         if (!isPaid) {
//                           e.target._icon.classList.add("blink");
//                         }
//                       },
//                     }}
//                   >
//                     <Popup>
//                       <strong>{c.ClientName}</strong>
//                       <br />
//                       {c.Address}
//                       <br />
//                       Status: {c.PaymentStatus || "UNPAID"}
//                     </Popup>
//                   </Marker>
//                 );
//               })}
//           </MapContainer>
//         </Box>
//       </Box>
//     </Box>
//   );
// }


import React, { useEffect, useState } from "react";
import { Box, AppBar, Toolbar, Typography, TextField, InputAdornment, Paper, CircularProgress, Alert } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Custom icons
const greenIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  iconSize: [32, 32]
});

const redIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  iconSize: [32, 32]
});

// Blink animation style
const blinkStyle = document.createElement("style");
blinkStyle.innerHTML = `
@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0.3; }
  100% { opacity: 1; }
}
.leaflet-marker-icon.blink {
  animation: blink 1s infinite;
}
`;
document.head.appendChild(blinkStyle);

// Geocoding function
const getCoordinates = async (address) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await res.json();
    if (!data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
};

// FREE API EXAMPLES (choose one):

// OPTION 1: JSONPlaceholder + Random Address Generator
const fetchFromJSONPlaceholder = async () => {
  const response = await fetch('https://jsonplaceholder.typicode.com/users');
  const users = await response.json();
  
  // Transform to your client format
  return users.map(user => ({
    _id: user.id,
    ClientName: user.name,
    Address: `${user.address.street}, ${user.address.city}, ${user.address.zipcode}`,
    PaymentStatus: Math.random() > 0.5 ? "PAID" : "UNPAID", // Random status for demo
    Email: user.email,
    Phone: user.phone
  }));
};

// OPTION 2: Random User API
const fetchFromRandomUserAPI = async () => {
  const response = await fetch('https://randomuser.me/api/?results=20');
  const data = await response.json();
  
  return data.results.map((user, index) => ({
    _id: index + 1,
    ClientName: `${user.name.first} ${user.name.last}`,
    Address: `${user.location.street.number} ${user.location.street.name}, ${user.location.city}, ${user.location.country}`,
    PaymentStatus: Math.random() > 0.5 ? "PAID" : "UNPAID",
    Email: user.email,
    Phone: user.phone
  }));
};

// OPTION 3: Custom Free API Service (example with sample data)
const fetchFromSampleAPI = async () => {
  // You can replace this with any free API endpoint
  // Example: MockAPI.io, Mocky.io, or any free REST API
  
  // For demonstration, returning sample data
  return [
    {
      _id: 1,
      ClientName: "John Smith",
      Address: "123 Main St, Los Angeles, CA 90001",
      PaymentStatus: "PAID"
    },
    {
      _id: 2,
      ClientName: "Emma Johnson",
      Address: "456 Broadway, New York, NY 10001",
      PaymentStatus: "UNPAID"
    },
    {
      _id: 3,
      ClientName: "Michael Brown",
      Address: "789 Michigan Ave, Chicago, IL 60601",
      PaymentStatus: "PAID"
    },
    {
      _id: 4,
      ClientName: "Sarah Wilson",
      Address: "321 Texas St, Houston, TX 77001",
      PaymentStatus: "UNPAID"
    },
    {
      _id: 5,
      ClientName: "David Lee",
      Address: "654 Market St, San Francisco, CA 94101",
      PaymentStatus: "PAID"
    }
  ];
};

export default function ClientMapPage() {
  const [search, setSearch] = useState("");
  const [clientsWithCoords, setClientsWithCoords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiSource, setApiSource] = useState("jsonplaceholder"); // 'jsonplaceholder', 'randomuser', 'sample'

  // Fetch data from selected API
  const fetchClientsFromAPI = async () => {
    try {
      let clients = [];
      
      switch(apiSource) {
        case 'jsonplaceholder':
          clients = await fetchFromJSONPlaceholder();
          break;
        case 'randomuser':
          clients = await fetchFromRandomUserAPI();
          break;
        case 'sample':
          clients = await fetchFromSampleAPI();
          break;
        default:
          clients = await fetchFromJSONPlaceholder();
      }
      
      return clients;
    } catch (err) {
      console.error("API fetch error:", err);
      throw new Error("Failed to fetch client data");
    }
  };

  // Load and geocode clients
  useEffect(() => {
    const loadClients = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Check cache first
        const cacheKey = `clientsWithCoords_${apiSource}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.length > 0) {
            setClientsWithCoords(parsed);
            setLoading(false);
            return;
          }
        }
        
        // Fetch from API
        const clients = await fetchClientsFromAPI();
        
        if (!clients || clients.length === 0) {
          throw new Error("No client data received from API");
        }
        
        // Geocode addresses (limit to first 10 for demo to avoid rate limiting)
        const results = [];
        const batchSize = 5; // Process in smaller batches
        
        for (let i = 0; i < Math.min(clients.length, 15); i++) {
          const client = clients[i];
          console.log(`Geocoding: ${client.ClientName} - ${client.Address}`);
          const coords = await getCoordinates(client.Address);
          
          if (coords) {
            results.push({
              ...client,
              ...coords,
            });
          } else {
            // Add default coordinates for Manila if geocoding fails
            results.push({
              ...client,
              lat: 14.5995 + (Math.random() - 0.5) * 0.1,
              lng: 120.9842 + (Math.random() - 0.5) * 0.1,
            });
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        localStorage.setItem(cacheKey, JSON.stringify(results));
        setClientsWithCoords(results);
      } catch (err) {
        console.error("Error loading clients:", err);
        setError(err.message);
        
        // Fallback to sample data
        const fallbackClients = await fetchFromSampleAPI();
        const fallbackResults = [];
        for (const client of fallbackClients) {
          fallbackResults.push({
            ...client,
            lat: 14.5995 + (Math.random() - 0.5) * 0.2,
            lng: 120.9842 + (Math.random() - 0.5) * 0.2,
          });
        }
        setClientsWithCoords(fallbackResults);
      } finally {
        setLoading(false);
      }
    };
    
    loadClients();
  }, [apiSource]);

  const filtered = clientsWithCoords.filter((c) =>
    (c.ClientName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static">
        <Toolbar>
          <Typography sx={{ flexGrow: 1 }}>Client Map Dashboard</Typography>
          
          {/* API Selector */}
          <TextField
            select
            size="small"
            value={apiSource}
            onChange={(e) => setApiSource(e.target.value)}
            sx={{ background: "white", borderRadius: 1, mr: 2, minWidth: 150 }}
            SelectProps={{
              native: true,
            }}
          >
            <option value="jsonplaceholder">JSONPlaceholder</option>
            <option value="randomuser">Random User API</option>
            <option value="sample">Sample Data</option>
          </TextField>
          
          <TextField
            size="small"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ background: "white", borderRadius: 1, minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, display: "flex" }}>
        {/* Sidebar */}
        <Paper sx={{ width: 320, p: 2, overflow: "auto" }}>
          <Typography variant="h6" gutterBottom>
            Clients ({filtered.length})
          </Typography>
          
          {error && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error} - Using fallback data
            </Alert>
          )}
          
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            filtered.map((c) => (
              <Box 
                key={c._id} 
                sx={{ 
                  mb: 2, 
                  p: 1.5, 
                  border: "1px solid #e0e0e0",
                  borderRadius: 1,
                  '&:hover': { bgcolor: '#f5f5f5' }
                }}
              >
                <Typography fontWeight="bold">{c.ClientName}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {c.Address}
                </Typography>
                <Typography 
                  variant="body2"
                  sx={{ 
                    mt: 0.5,
                    color: (c.PaymentStatus || "").toUpperCase() === "PAID" ? "green" : "red",
                    fontWeight: "bold"
                  }}
                >
                  {c.PaymentStatus || "UNPAID"}
                </Typography>
                {c.Email && (
                  <Typography variant="caption" color="text.secondary">
                    {c.Email}
                  </Typography>
                )}
              </Box>
            ))
          )}
        </Paper>

        {/* Map */}
        <Box sx={{ flex: 1 }}>
          <MapContainer
            center={[14.5995, 120.9842]}
            zoom={12}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {!loading &&
              filtered.map((c) => {
                const isPaid = (c.PaymentStatus || "").toUpperCase() === "PAID";
                
                return c.lat && c.lng ? (
                  <Marker
                    key={c._id}
                    position={[c.lat, c.lng]}
                    icon={isPaid ? greenIcon : redIcon}
                    eventHandlers={{
                      add: (e) => {
                        if (!isPaid) {
                          e.target._icon.classList.add("blink");
                        }
                      },
                    }}
                  >
                    <Popup>
                      <div>
                        <strong>{c.ClientName}</strong>
                        <br />
                        {c.Address}
                        <br />
                        <span style={{ color: isPaid ? "green" : "red" }}>
                          Status: {c.PaymentStatus || "UNPAID"}
                        </span>
                        {c.Email && (
                          <>
                            <br />
                            Email: {c.Email}
                          </>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ) : null;
              })}
          </MapContainer>
        </Box>
      </Box>
    </Box>
  );
}