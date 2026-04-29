import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography
} from "@mui/material";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import WifiTetheringOutlinedIcon from "@mui/icons-material/WifiTetheringOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import API from "../api/api";
import { useAuth } from "../context/auth.context";
import PageHeader from "../layout/PageHeader";

const statCards = [
  {
    key: "activeClients",
    title: "Active Clients",
    icon: <PeopleAltOutlinedIcon />,
    color: "#1d4ed8"
  },
  {
    key: "pppoeClients",
    title: "PPPOE Clients",
    icon: <RouterOutlinedIcon />,
    color: "#0f766e"
  },
  {
    key: "ipoeClients",
    title: "IPOE Clients",
    icon: <WifiTetheringOutlinedIcon />,
    color: "#b45309"
  },
  {
    key: "totalClients",
    title: "Total Clients",
    icon: <DashboardOutlinedIcon />,
    color: "#7c3aed"
  }
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        const { data } = await API.get("/dashboard/summary");
        setSummary(data);
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, []);

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome, ${user?.name || user?.username}.`}
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`Logged in as ${user?.type || "USER"}`} />
            <Chip label={`Username: ${user?.username || "-"}`} />
          </Stack>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {statCards.map((card) => (
            <Grid item xs={12} md={6} xl={3} key={card.key}>
              <Card sx={{ borderRadius: 4, height: "100%" }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography color="text.secondary" sx={{ mb: 1 }}>
                        {card.title}
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {summary?.[card.key] ?? 0}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 3,
                        display: "grid",
                        placeItems: "center",
                        color: "#fff",
                        bgcolor: card.color
                      }}
                    >
                      {card.icon}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
