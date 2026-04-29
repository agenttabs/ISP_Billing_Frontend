import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
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
  TextField,
  Typography
} from "@mui/material";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });
};

const formatJsonPreview = (value) => {
  if (!value) return "-";

  try {
    const text = JSON.stringify(value);
    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
  } catch (_err) {
    return "-";
  }
};

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    module: "",
    action: "",
    accountName: "",
    limit: "100"
  });

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = {};

      if (filters.module.trim()) params.module = filters.module.trim();
      if (filters.action.trim()) params.action = filters.action.trim();
      if (filters.accountName.trim()) params.accountName = filters.accountName.trim();
      if (filters.limit.trim()) params.limit = filters.limit.trim();

      const response = await API.get("/system/logs", { params });
      setLogs(Array.isArray(response.data?.logs) ? response.data.logs : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load system logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Audit Logs"
          subtitle="Review report-style audit activity such as login, payment save, report generation, email, SMS, verification, and maintenance changes."
          action={
            <Button
              variant="outlined"
              startIcon={<ReplayOutlinedIcon />}
              onClick={loadLogs}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Refresh
            </Button>
          }
        />

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Module"
                value={filters.module}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, module: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Action"
                value={filters.action}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, action: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Account Name"
                value={filters.accountName}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, accountName: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Limit"
                value={filters.limit}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, limit: event.target.value }))
                }
                sx={{ minWidth: 120 }}
              />
              <Button
                variant="contained"
                onClick={loadLogs}
                sx={{ textTransform: "none", fontWeight: 700, minWidth: 120 }}
              >
                Apply
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 0 }}>
            {loading ? (
              <Box sx={{ p: 5, textAlign: "center" }}>
                <CircularProgress />
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Module</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Login Account</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Summary</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Information</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!logs.length ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No system logs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((row) => (
                      <TableRow key={row._id}>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {formatDateTime(row.createdAt)}
                        </TableCell>
                        <TableCell>{row.Module || "-"}</TableCell>
                        <TableCell>{row.Action || "-"}</TableCell>
                        <TableCell>
                          {row.Actor?.loginAccount ||
                            row.Actor?.username ||
                            row.Actor?.name ||
                            "-"}
                        </TableCell>
                        <TableCell>{row.AccountName || "-"}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={
                              row.Status === "SUCCESS"
                                ? "success"
                                : row.Status === "FAILED"
                                  ? "error"
                                  : "default"
                            }
                            label={row.Status || "-"}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 220 }}>{row.Summary || "-"}</TableCell>
                        <TableCell sx={{ minWidth: 320, color: "#475569" }}>
                          {formatJsonPreview(row.Values || row.Details)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
