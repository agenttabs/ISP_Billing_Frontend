import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

export default function SystemDiagnostics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDiagnostics = async () => {
      try {
        const response = await API.get("/system/diagnostics");
        setData(response.data);
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load system diagnostics.");
      } finally {
        setLoading(false);
      }
    };

    loadDiagnostics();
  }, []);

  return (
    <Box sx={{ minWidth: 0, width: "100%", overflowX: "hidden" }}>
      <Stack spacing={3}>
        <PageHeader
          title="System Diagnostics"
          subtitle="Check the active database connection and the collection names currently used by the backend."
        />

        {error ? <Alert severity="error">{error}</Alert> : null}

        {loading ? (
          <Card sx={{ borderRadius: 4, minWidth: 0, width: "100%" }}>
            <CardContent sx={{ p: 4, textAlign: "center" }}>
              <CircularProgress />
            </CardContent>
          </Card>
        ) : null}

        {data ? (
          <>
            <Card sx={{ borderRadius: 4, minWidth: 0, width: "100%" }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={1.5}>
                  <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                    Runtime
                  </Typography>
                  <Typography>
                    Connected:{" "}
                    <Chip
                      size="small"
                      color={data.runtime?.connected ? "success" : "error"}
                      label={data.runtime?.connected ? "Yes" : "No"}
                    />
                  </Typography>
                  <Typography>Database: {data.runtime?.databaseName || "-"}</Typography>
                  <Typography sx={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
                    Mongo URI: {data.runtime?.mongoUri || "-"}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 4, minWidth: 0, width: "100%" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontWeight: 700, color: "#0f172a", mb: 2 }}>
                  Configured Collections
                </Typography>

                <Box sx={{ width: "100%", minWidth: 0, overflowX: "auto" }}>
                  <Table size="small" sx={{ tableLayout: "fixed", minWidth: 0, width: "100%" }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: 220 }}>Key</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(data.collections || {}).map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell sx={{ wordBreak: "break-word" }}>{key}</TableCell>
                          <TableCell sx={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                            {Array.isArray(value) ? value.join(", ") : String(value || "-")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 4, minWidth: 0, width: "100%" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontWeight: 700, color: "#0f172a", mb: 1.5 }}>
                  Available Collections In DB
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
                  {(data.availableCollections || []).map((name) => (
                    <Chip
                      key={name}
                      label={name}
                      variant="outlined"
                      sx={{ fontWeight: 600, maxWidth: "100%", "& .MuiChip-label": { overflowWrap: "anywhere" } }}
                    />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}
