import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const getTodayIsoDate = () => new Date().toISOString().split("T")[0];

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
};

const formatDateOnly = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const formatInfoPreview = (value) => {
  if (!value) return "-";

  try {
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  } catch (_err) {
    return "-";
  }
};

export default function TechReport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    startDate: getTodayIsoDate(),
    endDate: getTodayIsoDate(),
    search: "",
    reportType: "INSTALLED"
  });
  const [reportData, setReportData] = useState({
    summary: {
      installCount: 0,
      repairDoneCount: 0
    },
    installs: [],
    repairsDone: []
  });

  const loadReport = async () => {
    try {
      setLoading(true);
      const params = {
        startDate: filters.startDate,
        endDate: filters.endDate
      };

      if (String(filters.search || "").trim()) {
        params.search = String(filters.search || "").trim();
      }

      const response = await API.get("/reports/tech-report", { params });
      setReportData({
        summary: response.data?.summary || {
          installCount: 0,
          repairDoneCount: 0
        },
        installs: Array.isArray(response.data?.installs) ? response.data.installs : [],
        repairsDone: Array.isArray(response.data?.repairsDone)
          ? response.data.repairsDone
          : []
      });
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load tech report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const activeRows = useMemo(
    () =>
      filters.reportType === "REPAIR"
        ? reportData.repairsDone
        : reportData.installs,
    [filters.reportType, reportData.installs, reportData.repairsDone]
  );

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Tech Report"
          subtitle="Review client installations by date and repair-done activity in one module."
          action={
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<ReplayOutlinedIcon />}
                onClick={loadReport}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintOutlinedIcon />}
                onClick={() => window.print()}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Print Tech Report
              </Button>
            </Stack>
          }
        />

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, startDate: event.target.value }))
                }
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, endDate: event.target.value }))
                }
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Search"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, search: event.target.value }))
                }
                placeholder="Client, account, action, tech"
                sx={{ minWidth: { xs: "100%", md: 260 } }}
              />
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel id="tech-report-type-label">Report Type</InputLabel>
                <Select
                  labelId="tech-report-type-label"
                  label="Report Type"
                  value={filters.reportType}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, reportType: event.target.value }))
                  }
                >
                  <MenuItem value="INSTALLED">Installed</MenuItem>
                  <MenuItem value="REPAIR">Repair</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={loadReport}
                sx={{ textTransform: "none", fontWeight: 700, minWidth: 120 }}
              >
                Apply
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography variant="overline" sx={{ color: "#64748b", fontWeight: 700 }}>
                  {filters.reportType === "REPAIR" ? "Repair Done" : "Client Installed"}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: "#0f172a" }}>
                  {activeRows.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 3, pt: 3, pb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {filters.reportType === "REPAIR" ? "Repair Done" : "Client Installed"}
              </Typography>
              <Typography sx={{ color: "#64748b" }}>
                {filters.reportType === "REPAIR"
                  ? "Completed repair activity captured in the audit logs."
                  : "Client records filtered by installation date."}
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <CircularProgress />
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  {filters.reportType === "REPAIR" ? (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Date Done</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Done By</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Summary</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Information</TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Date Installed</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Client Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Account No.</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Authentication</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Net Plan</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  )}
                </TableHead>
                <TableBody>
                  {!activeRows.length ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        {filters.reportType === "REPAIR"
                          ? "No repair-done records found yet."
                          : "No installed client records found for the selected range."}
                      </TableCell>
                    </TableRow>
                  ) : filters.reportType === "REPAIR" ? (
                    activeRows.map((row) => (
                      <TableRow key={String(row._id)}>
                        <TableCell>{formatDateTime(row.DateDone)}</TableCell>
                        <TableCell>{row.AccountName || "-"}</TableCell>
                        <TableCell>{row.Action || "-"}</TableCell>
                        <TableCell>{row.DoneBy || "-"}</TableCell>
                        <TableCell>{row.Status || "-"}</TableCell>
                        <TableCell>{row.Summary || "-"}</TableCell>
                        <TableCell>{formatInfoPreview(row.Information)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    activeRows.map((row) => (
                      <TableRow key={String(row._id)}>
                        <TableCell>{formatDateOnly(row.DateInstalled)}</TableCell>
                        <TableCell>{row.AccountName || "-"}</TableCell>
                        <TableCell>{row.ClientName || "-"}</TableCell>
                        <TableCell>{row.AccountNumber || "-"}</TableCell>
                        <TableCell>{row.AuthenticationMode || "-"}</TableCell>
                        <TableCell>{row.NetPlan || "-"}</TableCell>
                        <TableCell>{row.Status || "-"}</TableCell>
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
