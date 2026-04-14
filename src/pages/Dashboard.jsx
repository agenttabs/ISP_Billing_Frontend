import { Grid, Card, CardContent, Typography, Box, Paper, Avatar, LinearProgress, alpha, useTheme, CircularProgress } from "@mui/material";
import { People, CheckCircle, Cancel, TrendingUp, AttachMoney, LocationOn, Warning } from "@mui/icons-material";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { useClient } from "../context/client.context"; // Adjust path as needed

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Custom icons for map
const paidIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  shadowSize: [41, 41]
});

const partialIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  shadowSize: [41, 41]
});

const unpaidIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  shadowSize: [41, 41]
});

// Function to determine payment status based on Balance and PaymentStatus
const getPaymentStatus = (client) => {
  // If PaymentStatus is explicitly set
  if (client.PaymentStatus) {
    if (client.PaymentStatus === "PAID") return "PAID";
    if (client.PaymentStatus === "PARTIAL") return "PARTIAL";
  }
  
  // Check balance to determine status
  const balance = parseFloat(client.Balance) || 0;
  const totalAmount = parseFloat(client.Amount) || 0;
  
  if (balance === 0) return "PAID";
  if (balance > 0 && balance < totalAmount) return "PARTIAL";
  if (balance === totalAmount) return "UNPAID";
  
  return "UNPAID";
};

// IMPROVED GEOCODING FUNCTION with better search parameters
const getCoordinates = async (address) => {
  if (!address) return null;
  
  try {
    // Add Philippines to ensure local results
    const searchQuery = `${address}, Philippines`;
    
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?` + 
      new URLSearchParams({
        format: 'json',
        q: searchQuery,
        limit: 1,
        addressdetails: 1,
        countrycodes: 'ph',
        dedupe: 1,
      })
    );
    
    const data = await res.json();
    
    if (data && data.length > 0) {
      return { 
        lat: parseFloat(data[0].lat), 
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    }
    
    // If no results, try without "Philippines"
    if (!address.toLowerCase().includes('philippines')) {
      const res2 = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          format: 'json',
          q: address,
          limit: 1,
          addressdetails: 1,
          countrycodes: 'ph',
        })
      );
      const data2 = await res2.json();
      
      if (data2 && data2.length > 0) {
        return { 
          lat: parseFloat(data2[0].lat), 
          lng: parseFloat(data2[0].lon),
          displayName: data2[0].display_name
        };
      }
    }
    
    console.warn(`No coordinates found for address: ${address}`);
    return null;
  } catch (error) {
    console.error("Geocoding error for address:", address, error);
    return null;
  }
};

// Helper function to get fallback coordinates for Metro Manila areas
const getFallbackCoordinates = (address) => {
  const fallbacks = {
    'las pinas': { lat: 14.4500, lng: 120.9833 },
    'makati': { lat: 14.5547, lng: 121.0244 },
    'taguig': { lat: 14.5243, lng: 121.0792 },
    'manila': { lat: 14.5995, lng: 120.9842 },
    'quezon city': { lat: 14.6760, lng: 121.0437 },
    'pasay': { lat: 14.5378, lng: 121.0014 },
    'paranaque': { lat: 14.4793, lng: 121.0197 },
    'mandaluyong': { lat: 14.5794, lng: 121.0359 },
    'pasig': { lat: 14.5764, lng: 121.0851 },
    'marikina': { lat: 14.6500, lng: 121.1000 },
    'caloocan': { lat: 14.6500, lng: 120.9833 },
    'malabon': { lat: 14.6625, lng: 120.9603 },
    'navotas': { lat: 14.6667, lng: 120.9417 },
    'valenzuela': { lat: 14.7000, lng: 120.9833 },
    'muntinlupa': { lat: 14.3833, lng: 121.0500 },
    'san juan': { lat: 14.6000, lng: 121.0333 },
    'cavite': { lat: 14.4791, lng: 120.8969 },
    'bulacan': { lat: 14.7944, lng: 120.8792 },
    'rizal': { lat: 14.5863, lng: 121.1759 },
    'laguna': { lat: 14.2752, lng: 121.1545 },
  };
  
  const lowerAddress = address.toLowerCase();
  for (const [area, coords] of Object.entries(fallbacks)) {
    if (lowerAddress.includes(area)) {
      return coords;
    }
  }
  
  return { lat: 14.5995, lng: 120.9842 };
};

export default function Dashboard() {
  const theme = useTheme();
  const { clients, loading: clientsLoading, fetchClients } = useClient();
  const [clientsWithCoords, setClientsWithCoords] = useState([]);
  const [geocodingLoading, setGeocodingLoading] = useState(true);
  const [geocodingProgress, setGeocodingProgress] = useState(0);
  const [mapCenter, setMapCenter] = useState([14.5995, 120.9842]);

  // Fetch clients on component mount
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Geocode addresses when clients are loaded
  useEffect(() => {
    const loadClientCoordinates = async () => {
      if (!clients || clients.length === 0) {
        setGeocodingLoading(false);
        setClientsWithCoords([]);
        return;
      }

      // Check cache first
      const cacheKey = "dashboardClientCoords_v2";
      const cached = localStorage.getItem(cacheKey);
      const cachedData = cached ? JSON.parse(cached) : null;
      
      if (cachedData && 
          cachedData.length === clients.length && 
          cachedData.every((c, i) => c._id === clients[i]?._id && c.Address === clients[i]?.Address)) {
        setClientsWithCoords(cachedData);
        setGeocodingLoading(false);
        return;
      }

      setGeocodingProgress(0);
      const results = [];
      
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        
        if (!client.Address) {
          results.push({
            ...client,
            lat: 14.5995 + (Math.random() - 0.5) * 0.1,
            lng: 120.9842 + (Math.random() - 0.5) * 0.1,
            paymentStatus: getPaymentStatus(client)
          });
          setGeocodingProgress(((i + 1) / clients.length) * 100);
          continue;
        }

        const coords = await getCoordinates(client.Address);
        
        if (coords) {
          results.push({ 
            ...client, 
            lat: coords.lat, 
            lng: coords.lng,
            displayName: coords.displayName,
            paymentStatus: getPaymentStatus(client)
          });
        } else {
          const fallbackCoords = getFallbackCoordinates(client.Address);
          results.push({
            ...client,
            lat: fallbackCoords.lat,
            lng: fallbackCoords.lng,
            paymentStatus: getPaymentStatus(client)
          });
          console.log(`Using fallback coordinates for: ${client.Name} (${client.Address})`);
        }
        
        setGeocodingProgress(((i + 1) / clients.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      localStorage.setItem(cacheKey, JSON.stringify(results));
      setClientsWithCoords(results);
      setGeocodingLoading(false);
    };

    loadClientCoordinates();
  }, [clients]);

  const isLoading = clientsLoading || geocodingLoading;

  // Calculate statistics based on actual data structure
  const totalClients = clients.length;
  
  // Calculate paid clients (Balance === 0 or PaymentStatus === "PAID")
  const paidClients = clients.filter(c => {
    const balance = parseFloat(c.Balance) || 0;
    const paymentStatus = c.PaymentStatus;
    return balance === 0 || paymentStatus === "PAID";
  }).length;
  
  // Calculate partial clients
  const partialClients = clients.filter(c => {
    const balance = parseFloat(c.Balance) || 0;
    const totalAmount = parseFloat(c.Amount) || 0;
    const paymentStatus = c.PaymentStatus;
    return (balance > 0 && balance < totalAmount) || paymentStatus === "PARTIAL";
  }).length;
  
  // Calculate unpaid clients (Balance === Amount or no payments)
  const unpaidClients = clients.filter(c => {
    const balance = parseFloat(c.Balance) || 0;
    const totalAmount = parseFloat(c.Amount) || 0;
    const paymentStatus = c.PaymentStatus;
    return (balance === totalAmount && balance > 0) || (!paymentStatus && balance === totalAmount);
  }).length;
  
  // Calculate revenue
  const totalRevenue = clients.reduce((sum, c) => sum + (parseFloat(c.Amount) || 0), 0);
  const paidRevenue = clients.filter(c => {
    const balance = parseFloat(c.Balance) || 0;
    return balance === 0 || c.PaymentStatus === "PAID";
  }).reduce((sum, c) => sum + (parseFloat(c.Amount) || 0), 0);
  
  const partialRevenue = clients.filter(c => {
    const balance = parseFloat(c.Balance) || 0;
    const totalAmount = parseFloat(c.Amount) || 0;
    return (balance > 0 && balance < totalAmount) || c.PaymentStatus === "PARTIAL";
  }).reduce((sum, c) => sum + (parseFloat(c.Amount) || 0), 0);
  
  const unpaidRevenue = totalRevenue - paidRevenue;
  const paymentRate = totalClients > 0 ? ((paidClients + partialClients) / totalClients) * 100 : 0;
  const collectionRate = totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 0;

  // Get icon based on payment status for map
  const getMarkerIcon = (client) => {
    const status = getPaymentStatus(client);
    if (status === "PAID") return paidIcon;
    if (status === "PARTIAL") return partialIcon;
    return unpaidIcon;
  };

  // Get color based on payment status
  const getStatusColor = (client) => {
    const status = getPaymentStatus(client);
    if (status === "PAID") return "success.main";
    if (status === "PARTIAL") return "warning.main";
    return "error.main";
  };

  // Get status text
  const getStatusText = (client) => {
    const status = getPaymentStatus(client);
    return status;
  };

  const stats = [
    {
      title: "Total Clients",
      value: totalClients,
      icon: <People sx={{ fontSize: 40 }} />,
      color: theme.palette.primary.main,
      bgColor: alpha(theme.palette.primary.main, 0.1),
      trend: `+${Math.floor(Math.random() * 20)}%`,
    },
    {
      title: "Paid Clients",
      value: paidClients,
      icon: <CheckCircle sx={{ fontSize: 40 }} />,
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.1),
      trend: `+${Math.floor(Math.random() * 15)}%`,
    },
    {
      title: "Partial Clients",
      value: partialClients,
      icon: <Warning sx={{ fontSize: 40 }} />,
      color: theme.palette.warning.main,
      bgColor: alpha(theme.palette.warning.main, 0.1),
      trend: `+${Math.floor(Math.random() * 10)}%`,
    },
    {
      title: "Unpaid Clients",
      value: unpaidClients,
      icon: <Cancel sx={{ fontSize: 40 }} />,
      color: theme.palette.error.main,
      bgColor: alpha(theme.palette.error.main, 0.1),
      trend: `-${Math.floor(Math.random() * 5)}%`,
    },
  ];

  if (isLoading && clients.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", bgcolor: "#f5f7fa" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, bgcolor: "#f5f7fa", minHeight: "100vh" }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Dashboard Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome back! Here's what's happening with your clients today.
        </Typography>
      </Box>

      {/* Summary Banner */}
      <Card sx={{ 
        borderRadius: 4, 
        mb: 4, 
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: 'white'
      }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                  Total Clients
                </Typography>
                <Typography variant="h2" fontWeight="bold">
                  {totalClients}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Paid: {paidClients}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Partial: {partialClients}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Unpaid: {unpaidClients}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                  Total Revenue
                </Typography>
                <Typography variant="h2" fontWeight="bold">
                  ₱{totalRevenue.toLocaleString()}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Paid: ₱{paidRevenue.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Unpaid: ₱{unpaidRevenue.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                  Collection Rate
                </Typography>
                <Typography variant="h2" fontWeight="bold">
                  {collectionRate.toFixed(1)}%
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={collectionRate} 
                  sx={{ 
                    mt: 2, 
                    height: 8, 
                    borderRadius: 4,
                    bgcolor: 'rgba(255,255,255,0.3)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: 'white'
                    }
                  }} 
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                borderRadius: 4,
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: theme.shadows[8],
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {stat.value}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                      <TrendingUp sx={{ fontSize: 16, color: "success.main", mr: 0.5 }} />
                      <Typography variant="caption" color="success.main">
                        {stat.trend}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        vs last month
                      </Typography>
                    </Box>
                  </Box>
                  <Avatar
                    sx={{
                      bgcolor: stat.bgColor,
                      color: stat.color,
                      width: 56,
                      height: 56,
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Payment Progress Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 4, height: "100%" }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Payment Collection Progress
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Collection Rate
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {collectionRate.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={collectionRate}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 5,
                      bgcolor: theme.palette.success.main,
                    },
                  }}
                />
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Paid Revenue
                    </Typography>
                    <Typography variant="h6" color="success.main" fontWeight="bold">
                      ₱{paidRevenue.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="caption" color="text.secondary">
                      Unpaid Revenue
                    </Typography>
                    <Typography variant="h6" color="error.main" fontWeight="bold">
                      ₱{unpaidRevenue.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 4, height: "100%" }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Quick Stats
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: "center", p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Average Payment
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      ₱{(totalRevenue / totalClients || 0).toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: "center", p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Payment Rate
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="success.main">
                      {paymentRate.toFixed(1)}%
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Financial Summary Card */}
      <Card sx={{ borderRadius: 4, mb: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Financial Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Client Summary
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">Total Clients:</Typography>
                  <Typography variant="body1" fontWeight="bold">{totalClients}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="success.main">Paid Clients:</Typography>
                  <Typography variant="body1" fontWeight="bold" color="success.main">{paidClients}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="warning.main">Partial Clients:</Typography>
                  <Typography variant="body1" fontWeight="bold" color="warning.main">{partialClients}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="error.main">Unpaid Clients:</Typography>
                  <Typography variant="body1" fontWeight="bold" color="error.main">{unpaidClients}</Typography>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Revenue Summary
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">Total Revenue:</Typography>
                  <Typography variant="body1" fontWeight="bold">₱{totalRevenue.toLocaleString()}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="success.main">Paid Revenue:</Typography>
                  <Typography variant="body1" fontWeight="bold" color="success.main">₱{paidRevenue.toLocaleString()}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="error.main">Unpaid Revenue:</Typography>
                  <Typography variant="body1" fontWeight="bold" color="error.main">₱{unpaidRevenue.toLocaleString()}</Typography>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Performance Metrics
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">Collection Rate:</Typography>
                  <Typography variant="body1" fontWeight="bold" color="success.main">{collectionRate.toFixed(1)}%</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">Payment Rate:</Typography>
                  <Typography variant="body1" fontWeight="bold" color="warning.main">{paymentRate.toFixed(1)}%</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Avg Payment:</Typography>
                  <Typography variant="body1" fontWeight="bold">₱{(totalRevenue / totalClients || 0).toLocaleString()}</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Map Section */}
      <Card sx={{ borderRadius: 4, overflow: "hidden" }}>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <LocationOn sx={{ color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight="bold">
                Client Locations Map
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: "success.main", borderRadius: "50%" }} />
                <Typography variant="caption">Paid</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: "warning.main", borderRadius: "50%" }} />
                <Typography variant="caption">Partial</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: "error.main", borderRadius: "50%" }} />
                <Typography variant="caption">Unpaid</Typography>
              </Box>
            </Box>
          </Box>
          {geocodingLoading && clients.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Geocoding addresses... {geocodingProgress.toFixed(0)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={geocodingProgress} 
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            </Box>
          )}
        </CardContent>
        <Box sx={{ height: 500, width: "100%" }}>
          {!geocodingLoading && clientsWithCoords.length > 0 && (
            <MapContainer
              center={mapCenter}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {clientsWithCoords.map((client) => (
                <Marker
                  key={client._id}
                  position={[client.lat, client.lng]}
                  icon={getMarkerIcon(client)}
                >
                  <Popup>
                    <Box sx={{ p: 1, minWidth: 200 }}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {client.Name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {client.Address}
                      </Typography>
                      {client.displayName && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          📍 {client.displayName.substring(0, 100)}
                        </Typography>
                      )}
                      <Typography
                        variant="body2"
                        sx={{
                          color: getStatusColor(client),
                          fontWeight: "bold",
                          mt: 1,
                        }}
                      >
                        Status: {getStatusText(client)}
                      </Typography>
                      <Typography variant="body2">
                        Amount: ₱{(parseFloat(client.Amount) || 0).toLocaleString()}
                      </Typography>
                      <Typography variant="body2">
                        Balance: ₱{(parseFloat(client.Balance) || 0).toLocaleString()}
                      </Typography>
                      {client.AmountPaid > 0 && (
                        <Typography variant="body2">
                          Paid: ₱{(parseFloat(client.AmountPaid) || 0).toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
          {(geocodingLoading || clients.length === 0) && (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: 2 }}>
              {geocodingLoading ? (
                <>
                  <CircularProgress size={40} />
                  <Typography>Loading map data...</Typography>
                </>
              ) : (
                <Typography>No clients to display on map</Typography>
              )}
            </Box>
          )}
        </Box>
      </Card>

      {/* Recent Clients List */}
      <Card sx={{ borderRadius: 4, mt: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Recent Clients
          </Typography>
          <Grid container spacing={2}>
            {clients.slice(0, 4).map((client) => (
              <Grid item xs={12} sm={6} md={3} key={client._id}>
                <Paper
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    transition: "transform 0.2s",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: theme.shadows[4],
                    },
                  }}
                >
                  <Typography variant="subtitle2" fontWeight="bold">
                    {client.Name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    {client.Address || "No address provided"}
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: getStatusColor(client),
                        fontWeight: "bold",
                      }}
                    >
                      {getStatusText(client)}
                    </Typography>
                    <Typography variant="caption" fontWeight="bold">
                      ₱{(parseFloat(client.Amount) || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  {client.Balance > 0 && getStatusText(client) !== "PAID" && (
                    <Typography variant="caption" color="text.secondary">
                      Balance: ₱{(parseFloat(client.Balance) || 0).toLocaleString()}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
          {clients.length === 0 && (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography color="text.secondary">No clients found. Add your first client to get started.</Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}