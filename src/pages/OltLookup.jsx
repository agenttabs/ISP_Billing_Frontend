import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import SettingsInputAntennaOutlined from "@mui/icons-material/SettingsInputAntennaOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "-";
  return `PHP ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const Field = ({ label, value, highlight }) => (
  <Box
    sx={{
      minWidth: 0,
      p: 1.25,
      borderRadius: 1,
      border: "1px solid #e2e8f0",
      background: highlight ? "#eff6ff" : "#f8fafc"
    }}
  >
    <Typography sx={{ color: "#64748b", fontSize: "0.72rem", fontWeight: 800, mb: 0.45 }}>
      {label}
    </Typography>
    <Typography
      sx={{
        color: highlight ? "#1d4ed8" : "#0f172a",
        fontWeight: 800,
        fontSize: "0.94rem",
        overflowWrap: "anywhere"
      }}
    >
      {value || "-"}
    </Typography>
  </Box>
);

const ResultCard = ({ title, children, action }) => (
  <Card sx={{ borderRadius: 2, border: "1px solid #dbe4ee", boxShadow: "0 8px 24px rgba(15,23,42,0.04)" }}>
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 900, color: "#0f172a" }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </CardContent>
  </Card>
);

export default function OltLookup() {
  const [technology, setTechnology] = useState("gpon");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError("Please enter OLT SN or MAC address.");
      setResult(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const { data } = await API.get("/olt-lookup", {
        params: {
          query: trimmedQuery,
          technology
        }
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err.response?.data?.error || "Failed to lookup OLT client information.");
    } finally {
      setLoading(false);
    }
  };

  const appClient = result?.appClient || {};
  const mikrotik = result?.mikrotik || {};
  const olt = result?.olt || {};

  return (
    <Box>
      <PageHeader
        title="OLT Lookup"
        subtitle="Choose GPON or EPON, then compare live OLT telnet data, PPP active, and the app client record."
      />

      <Card sx={{ borderRadius: 2, border: "1px solid #dbe4ee", mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="stretch">
            <TextField
              select
              label="Type"
              value={technology}
              onChange={(event) => {
                setTechnology(event.target.value);
                setQuery("");
                setResult(null);
                setError("");
              }}
              size="small"
              sx={{ width: { xs: "100%", md: 150 } }}
            >
              <MenuItem value="gpon">GPON</MenuItem>
              <MenuItem value="epon">EPON</MenuItem>
            </TextField>
            <TextField
              label={technology === "gpon" ? "ONU SN / AuthInfo" : "OLT MAC Address"}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSearch();
                }
              }}
              fullWidth
              size="small"
              placeholder={
                technology === "gpon"
                  ? "Example: ZTEGCE46E690"
                  : "Example: B4:E4:6B:72:BF:70"
              }
              helperText={
                technology === "gpon"
                  ? "GPON search uses the ONU SN/AuthInfo from the OLT."
                  : "EPON search uses the MAC address shown by the OLT."
              }
            />
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchOutlined />}
              onClick={handleSearch}
              disabled={loading}
              sx={{ minWidth: 132, fontWeight: 800 }}
            >
              Search
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {result && !result.matched ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No matching OLT, PPP active, or app client record was found for this input.
        </Alert>
      ) : null}

      {result ? (
        <Grid container spacing={2}>
          <Grid item xs={12} lg={4}>
            <ResultCard
              title="OLT Information"
              action={
                <Chip
                  size="small"
                  label={olt?.matchStatus || "Not Found"}
                  color={olt?.matchStatus ? "primary" : "default"}
                  variant={olt?.matchStatus ? "filled" : "outlined"}
                />
              }
            >
              <Stack spacing={1}>
                <Field label="MAC Address" value={olt.macAddress} highlight />
                <Field label="AuthInfo / SN" value={olt.authInfo} highlight />
                <Field label="VLAN" value={olt.vlan} />
                <Field label="OLT Port" value={olt.oltPort} />
                <Field label="ONU Type" value={olt.onuType} />
                <Field label="ONU State" value={olt.onuState} />
              </Stack>
            </ResultCard>
          </Grid>

          <Grid item xs={12} lg={4}>
            <ResultCard
              title="PPP Active"
              action={
                <Chip
                  size="small"
                  label={mikrotik.pppActiveFound ? "Active" : "Not Active"}
                  color={mikrotik.pppActiveFound ? "success" : "default"}
                  variant={mikrotik.pppActiveFound ? "filled" : "outlined"}
                />
              }
            >
              {mikrotik.error ? (
                <Alert severity="warning" sx={{ mb: 1.25 }}>
                  MikroTik check failed: {mikrotik.error}
                </Alert>
              ) : null}
              <Stack spacing={1}>
                <Field label="Account Name" value={mikrotik.name} highlight />
                <Field label="IP Address" value={mikrotik.ipAddress} />
                <Field label="Active MAC" value={mikrotik.macAddress} />
                <Field label="Service" value={mikrotik.service} />
                <Field label="Uptime" value={mikrotik.uptime} />
              </Stack>
            </ResultCard>
          </Grid>

          <Grid item xs={12} lg={4}>
            <ResultCard
              title="App Client"
              action={
                <Chip
                  size="small"
                  label={!appClient.found ? "Not Found" : appClient.isActive ? "Active" : "Disconnected"}
                  color={!appClient.found ? "default" : appClient.isActive ? "success" : "error"}
                  variant={!appClient.found ? "outlined" : "filled"}
                />
              }
            >
              <Stack spacing={1}>
                <Field label="Client Name" value={appClient.clientName} highlight />
                <Field label="Account Name" value={appClient.accountName} highlight />
                <Field label="Account Number" value={appClient.accountNumber} />
                <Field label="Contact Number" value={appClient.contactNumber} />
                <Field label="Plan" value={appClient.netPlan} />
                <Field label="Due Date" value={formatDate(appClient.dueDate)} />
                <Field label="Amount Due" value={appClient.found ? formatCurrency(appClient.amountDue) : "-"} />
                <Field label="Payment Status" value={appClient.paymentStatus} />
              </Stack>
            </ResultCard>
          </Grid>

          <Grid item xs={12}>
            <Alert severity="info" icon={<SettingsInputAntennaOutlined />}>
              OLT data is checked live through telnet. Commands run: {(result.liveTelnet?.commandsRun || []).join(", ") || "-"}.
            </Alert>
          </Grid>
        </Grid>
      ) : null}
    </Box>
  );
}
