import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import RouterIcon from "@mui/icons-material/Router";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultConfig = {
  Name: "Mikrotik Checker",
  SendTime: "08:30",
  RecipientEmail: "",
  IsActive: false,
  LastRunAt: null,
  LastRunSummary: "",
  LastError: ""
};

const getIssueLabel = (value) => {
  switch (String(value || "").toUpperCase()) {
    case "PLAN_NOT_BALANCE":
      return "Not Balance";
    case "NOT_FOUND_IN_MIKROTIK":
      return "Not Found in MikroTik";
    case "NOT_FOUND_IN_SYSTEM":
      return "Not Found in System";
    default:
      return value || "-";
  }
};

const getIssueChipColors = (value) => {
  switch (String(value || "").toUpperCase()) {
    case "PLAN_NOT_BALANCE":
      return {
        backgroundColor: "#fff7ed",
        color: "#c2410c"
      };
    case "NOT_FOUND_IN_MIKROTIK":
      return {
        backgroundColor: "#fef2f2",
        color: "#b91c1c"
      };
    case "NOT_FOUND_IN_SYSTEM":
      return {
        backgroundColor: "#eff6ff",
        color: "#1d4ed8"
      };
    default:
      return {
        backgroundColor: "#f8fafc",
        color: "#475569"
      };
  }
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH");
};

export default function MikrotikChecker() {
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [config, setConfig] = useState(defaultConfig);
  const [report, setReport] = useState(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await API.get("/mikrotik-checker/config");
        setConfig({
          ...defaultConfig,
          ...(response.data || {})
        });
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load Mikrotik checker config.");
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  const runChecker = async () => {
    try {
      setLoading(true);
      const response = await API.get("/mikrotik-checker/report");
      setReport(response.data);
      setError("");
      setSuccess("Mikrotik checker report loaded.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to run MikroTik checker.");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await API.put("/mikrotik-checker/config", config);
      setConfig({
        ...defaultConfig,
        ...(response.data || {})
      });
      setError("");
      setSuccess("Mikrotik checker scheduler saved.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save Mikrotik checker config.");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    try {
      setRunningNow(true);
      const response = await API.post("/mikrotik-checker/run-now");
      if (response.data?.report) {
        setReport(response.data.report);
      }
      if (response.data?.config) {
        setConfig({
          ...defaultConfig,
          ...response.data.config
        });
      }
      setError("");
      setSuccess(response.data?.reason || "Mikrotik checker email sent.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to run Mikrotik checker email now.");
    } finally {
      setRunningNow(false);
    }
  };

  const summary = report?.summary || {};

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Mikrotik Checker"
          subtitle="Check PPPOE and IPOE plans against MikroTik, then schedule and email the result to the DNS address."
        />

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
              spacing={2}
            >
              <Box>
                <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                  Run MikroTik Plan Checker
                </Typography>
                <Typography color="text.secondary">
                  This compares system clients against MikroTik PPPOE secrets and IPOE lease comments.
                </Typography>
                {report?.generatedAt ? (
                  <Typography sx={{ mt: 1, fontSize: "0.85rem", color: "#64748b" }}>
                    Last report: {formatDateTime(report.generatedAt)}
                  </Typography>
                ) : null}
              </Box>

              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RouterIcon />}
                disabled={loading}
                onClick={runChecker}
              >
                {loading ? "Running..." : "Run Checker"}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            {configLoading ? (
              <Box sx={{ textAlign: "center", py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack spacing={2}>
                <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                  Scheduler Email Config
                </Typography>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Recipient Email"
                    value={config.RecipientEmail || ""}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        RecipientEmail: event.target.value
                      }))
                    }
                    fullWidth
                  />

                  <TextField
                    label="Send Time"
                    type="time"
                    value={config.SendTime || "08:30"}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        SendTime: event.target.value
                      }))
                    }
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Stack>

                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(config.IsActive)}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          IsActive: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Active Scheduler"
                />

                <Typography sx={{ fontSize: "0.9rem", color: "#475569" }}>
                  Last Run: {formatDateTime(config.LastRunAt)}
                </Typography>
                <Typography sx={{ fontSize: "0.9rem", color: "#475569" }}>
                  Last Summary: {config.LastRunSummary || "-"}
                </Typography>
                <Typography sx={{ fontSize: "0.9rem", color: "#b91c1c" }}>
                  Last Error: {config.LastError || "-"}
                </Typography>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Button variant="outlined" onClick={saveConfig} disabled={saving}>
                    {saving ? "Saving..." : "Save Scheduler"}
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={runNow}
                    disabled={runningNow}
                  >
                    {runningNow ? "Sending..." : "Run Now and Email"}
                  </Button>
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>

        {report ? (
          <>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Card sx={{ flex: 1, borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="text.secondary">System Clients Checked</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {summary.totalSystemClientsChecked || 0}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ flex: 1, borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="text.secondary">Matched</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "#15803d" }}>
                    {summary.matchedCount || 0}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ flex: 1, borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="text.secondary">Not Balance</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "#c2410c" }}>
                    {summary.notBalanceCount || 0}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ flex: 1, borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="text.secondary">Not Found in MikroTik</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "#b91c1c" }}>
                    {summary.notFoundInMikrotikCount || 0}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ flex: 1, borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="text.secondary">Not Found in System</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "#1d4ed8" }}>
                    {summary.notFoundInSystemCount || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>

            <Card sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontWeight: 700, color: "#0f172a", mb: 2 }}>
                  Checker Report
                </Typography>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Issue</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Auth</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Client Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>System Plan</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>MikroTik Plan</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>System MAC</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>MikroTik MAC</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Detail</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(report.rows || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          No issues found. MikroTik and system plans are balanced.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (report.rows || []).map((row, index) => (
                        <TableRow key={`${row.issueType}-${row.accountName}-${index}`}>
                          <TableCell>
                            <Chip
                              label={getIssueLabel(row.issueType)}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                ...getIssueChipColors(row.issueType)
                              }}
                            />
                          </TableCell>
                          <TableCell>{row.authMode || "-"}</TableCell>
                          <TableCell>{row.accountName || "-"}</TableCell>
                          <TableCell>{row.clientName || "-"}</TableCell>
                          <TableCell>{row.systemPlan || "-"}</TableCell>
                          <TableCell>{row.mikrotikPlan || "-"}</TableCell>
                          <TableCell>{row.systemMacAddress || "-"}</TableCell>
                          <TableCell>{row.mikrotikMacAddress || "-"}</TableCell>
                          <TableCell>{row.detail || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}
