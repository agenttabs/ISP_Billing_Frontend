import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const getCoordinates = (client) => {
  const latitude = client?.Latitude || client?.latitude || "";
  const longitude = client?.Longitude || client?.longitude || "";

  return latitude && longitude ? `${latitude}, ${longitude}` : "-";
};

const getMapCoordinates = (client) => {
  const latitude = String(client?.Latitude || client?.latitude || "").trim();
  const longitude = String(client?.Longitude || client?.longitude || "").trim();
  const latNumber = Number(latitude);
  const lngNumber = Number(longitude);

  if (!Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) {
    return null;
  }

  return { latitude, longitude };
};

const getRows = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.clients)) return data.clients;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const FieldBox = ({ label, value, wide = false }) => (
  <Box
    sx={{
      border: "1px solid #d9e4f2",
      borderRadius: 2,
      p: 1.5,
      minHeight: 72,
      gridColumn: wide ? { xs: "1", md: "1 / -1" } : "auto",
      bgcolor: "#fbfdff"
    }}
  >
    <Typography
      sx={{
        color: "#60708a",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.2,
        textTransform: "uppercase",
        mb: 0.75
      }}
    >
      {label}
    </Typography>
    <Typography sx={{ fontWeight: 700, wordBreak: "break-word" }}>
      {value || "-"}
    </Typography>
  </Box>
);

export default function TechnicianClientView() {
  const [accountName, setAccountName] = useState("");
  const [clients, setClients] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (event) => {
    event.preventDefault();
    const query = accountName.trim();

    setError("");
    setClients([]);

    if (!query) {
      setHasSearched(false);
      return;
    }

    try {
      setLoading(true);
      setHasSearched(true);

      const { data } = await API.get("/clients", {
        params: {
          search: query,
          page: 1,
          limit: 50
        }
      });

      const normalizedQuery = query.toLowerCase();
      const accountMatches = getRows(data).filter((client) =>
        String(client?.AccountName || "").toLowerCase().includes(normalizedQuery)
      );

      setClients(accountMatches);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Unable to search clients.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Technician Client View"
        subtitle="Search by account name to view client details. No records are loaded until you search."
      />

      <Card sx={{ borderRadius: 4, mb: 3 }}>
        <CardContent>
          <Box component="form" onSubmit={handleSearch}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                fullWidth
                label="Search Account Name"
                placeholder="Example: annex-juan-dela-cruz"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                size="small"
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? <CircularProgress color="inherit" size={16} /> : <SearchOutlinedIcon />}
                disabled={loading}
                sx={{ minWidth: 130 }}
              >
                Search
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {!hasSearched ? (
        <Alert severity="info">Type an account name and click Search to display client records.</Alert>
      ) : null}

      {hasSearched && !loading && clients.length === 0 ? (
        <Alert severity="warning">No client found for that account name.</Alert>
      ) : null}

      {clients.length > 0 ? (
        <Card sx={{ borderRadius: 4 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>
                Client Results
              </Typography>
              <Chip label={`${clients.length} found`} color="primary" variant="outlined" />
            </Stack>

            <Stack spacing={2}>
              {clients.map((client) => (
                <Card
                  key={client._id || client.AccountNumber || client.AccountName}
                  variant="outlined"
                  sx={{ borderRadius: 3, overflow: "hidden" }}
                >
                  {(() => {
                    const mapCoordinates = getMapCoordinates(client);
                    const mapQuery = mapCoordinates
                      ? `${mapCoordinates.latitude},${mapCoordinates.longitude}`
                      : "";
                    const mapEmbedUrl = mapCoordinates
                      ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=17&output=embed`
                      : "";
                    const mapOpenUrl = mapCoordinates
                      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
                      : "";

                    return (
                      <>
                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      bgcolor: "#eff6ff",
                      borderBottom: "1px solid #d9e4f2",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 1,
                      flexWrap: "wrap"
                    }}
                  >
                    <Box>
                      <Typography fontWeight={800}>{client.AccountName || "-"}</Typography>
                      <Typography color="text.secondary" fontSize={13}>
                        Account No. {client.AccountNumber || "-"}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={client.Status || client.StatusModem || "-"}
                      color={String(client.Status || "").toUpperCase() === "ACTIVE" ? "success" : "default"}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                      gap: 1.25,
                      p: 2
                    }}
                  >
                    <FieldBox label="Client Name" value={client.ClientName} />
                    <FieldBox label="Contact Number" value={client.ContactNumber} />
                    <FieldBox label="Authentication" value={client.AuthenticationMode} />
                    <FieldBox label="MAC Address" value={client.MacAddress} />
                    <FieldBox label="Profile" value={client.Profile || client.MikrotikProfile} />
                    <FieldBox label="Net Plan" value={client.NetPlan} />
                    <FieldBox label="Due Date" value={formatDate(client.DueDate)} />
                    <FieldBox label="Amount Due" value={client.AmountDue ? `PHP ${client.AmountDue}` : "-"} />
                    <FieldBox label="Payment Status" value={client.PaymentStatus} />
                    <FieldBox label="Coordinates" value={getCoordinates(client)} />
                    <FieldBox label="Address" value={client.Address} wide />
                    <FieldBox label="Notes" value={client.Note || client.Notes} wide />
                  </Box>
                  {mapCoordinates ? (
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Box
                        sx={{
                          border: "1px solid #d9e4f2",
                          borderRadius: 3,
                          overflow: "hidden",
                          bgcolor: "#f8fbff"
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          spacing={1}
                          sx={{ p: 1.5, borderBottom: "1px solid #d9e4f2" }}
                        >
                          <Box>
                            <Typography fontWeight={800}>Map Location</Typography>
                            <Typography color="text.secondary" fontSize={12}>
                              {getCoordinates(client)}
                            </Typography>
                          </Box>
                          <Button
                            component="a"
                            href={mapOpenUrl}
                            target="_blank"
                            rel="noreferrer"
                            size="small"
                            variant="outlined"
                          >
                            Open Map
                          </Button>
                        </Stack>
                        <Box
                          component="iframe"
                          title={`Map for ${client.AccountName || client.ClientName || "client"}`}
                          src={mapEmbedUrl}
                          loading="lazy"
                          sx={{
                            display: "block",
                            width: "100%",
                            height: { xs: 240, md: 320 },
                            border: 0
                          }}
                        />
                      </Box>
                    </Box>
                  ) : null}
                      </>
                    );
                  })()}
                </Card>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
