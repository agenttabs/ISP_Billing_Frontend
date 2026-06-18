import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultConfig = {
  Name: "Mikrotik Due Disconnect Batch",
  SendTime: "09:30",
  GraceDays: 15,
  IsActive: false,
  DisconnectedPlanName: "disconnection",
  LastRunAt: null,
  LastRunSummary: "",
  LastError: ""
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-PH");
};

const getResultChip = (value) => {
  const normalized = String(value || "").toUpperCase();

  if (normalized === "DISCONNECTED_IN_MIKROTIK") {
    return { label: "Disconnected", backgroundColor: "#dcfce7", color: "#166534" };
  }

  if (normalized === "READY_TO_DISCONNECT") {
    return { label: "Ready", backgroundColor: "#eff6ff", color: "#1d4ed8" };
  }

  if (normalized === "ALREADY_DISCONNECTED") {
    return { label: "Already Disconnected", backgroundColor: "#fff7ed", color: "#c2410c" };
  }

  return { label: value || "-", backgroundColor: "#f8fafc", color: "#475569" };
};

export default function MikrotikDueDisconnectBatch() {
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [config, setConfig] = useState(defaultConfig);
  const [report, setReport] = useState(null);
  const [selectedClientIds, setSelectedClientIds] = useState([]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await API.get("/mikrotik-due-disconnect-batch/config");
        setConfig({
          ...defaultConfig,
          ...(response.data || {})
        });
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load due disconnect batch config.");
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  const previewBatch = async () => {
    try {
      setPreviewing(true);
      const response = await API.get("/mikrotik-due-disconnect-batch/report");
      setReport(response.data);
      setSelectedClientIds([]);
      setError("");
      setSuccess("Overdue disconnect preview loaded.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to preview overdue disconnect batch.");
    } finally {
      setPreviewing(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await API.put("/mikrotik-due-disconnect-batch/config", config);
      setConfig({
        ...defaultConfig,
        ...(response.data || {})
      });
      setError("");
      setSuccess("Overdue disconnect scheduler saved.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save overdue disconnect config.");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    try {
      setRunningNow(true);
      const payload = selectedClientIds.length > 0 ? { selectedClientIds } : {};
      const response = await API.post("/mikrotik-due-disconnect-batch/run-now", payload);
      if (response.data?.report) {
        setReport(response.data.report);
      }
      setSelectedClientIds([]);
      if (response.data?.config) {
        setConfig({
          ...defaultConfig,
          ...(response.data.config || {})
        });
      }
      setError("");
      setSuccess(response.data?.reason || "Overdue disconnect batch completed.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to run overdue disconnect batch.");
    } finally {
      setRunningNow(false);
    }
  };

  const summary = report?.summary || {};
  const rows = report?.rows || [];
  const selectableRows = rows.filter((row) => row.result === "READY_TO_DISCONNECT");
  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selectedClientIds.includes(String(row.clientId || "").trim()));

  const toggleClient = (clientId) => {
    const normalizedId = String(clientId || "").trim();

    setSelectedClientIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((value) => value !== normalizedId)
        : [...prev, normalizedId]
    );
  };

  const toggleAllClients = () => {
    if (allSelectableSelected) {
      setSelectedClientIds([]);
      return;
    }

    setSelectedClientIds(
      selectableRows
        .map((row) => String(row.clientId || "").trim())
        .filter(Boolean)
    );
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Mikrotik Due Disconnect Batch"
          subtitle="Disconnect clients in MikroTik when the due date is overdue and they still have not paid after the grace period."
        />

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            {configLoading ? (
              <Box sx={{ textAlign: "center", py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack spacing={2}>
                <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                  Scheduler Config
                </Typography>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Grace Days"
                    type="number"
                    value={config.GraceDays ?? 15}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        GraceDays: Number(event.target.value || 0)
                      }))
                    }
                    fullWidth
                  />

                  <TextField
                    label="Disconnected Plan Name"
                    value={config.DisconnectedPlanName || ""}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        DisconnectedPlanName: event.target.value
                      }))
                    }
                    fullWidth
                  />

                  <TextField
                    label="Send Time"
                    type="time"
                    value={config.SendTime || "09:30"}
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
                    variant="outlined"
                    startIcon={previewing ? <CircularProgress size={16} color="inherit" /> : <AutorenewIcon />}
                    onClick={previewBatch}
                    disabled={previewing}
                  >
                    {previewing ? "Checking..." : "Preview Batch"}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={runningNow ? <CircularProgress size={16} color="inherit" /> : <PowerSettingsNewIcon />}
                    onClick={runNow}
                    disabled={runningNow}
                  >
                    {runningNow
                      ? "Disconnecting..."
                      : selectedClientIds.length > 0
                        ? `Run Selected (${selectedClientIds.length})`
                        : "Run Now"}
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
                  <Typography color="text.secondary">Checked Clients</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {summary.checkedCount || 0}
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="text.secondary">Eligible for Disconnection</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "#c2410c" }}>
                    {summary.eligibleForDisconnectionCount || 0}
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="text.secondary">Disconnected in MikroTik</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "#166534" }}>
                    {summary.updatedCount || 0}
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="text.secondary">Overdue Unpaid</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "#b45309" }}>
                    {summary.overdueCount || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>

            <Card sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontWeight: 700, color: "#0f172a", mb: 2 }}>
                  Batch Result
                </Typography>
                <Typography sx={{ mb: 2, color: "#64748b", fontSize: "0.95rem" }}>
                  Check the clients you want to disconnect manually. If no row is checked, `Run Now` will process all eligible rows.
                </Typography>

                <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
                  {(report.rows || []).length === 0 ? (
                    <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                      No unpaid client is currently queued for disconnection.
                    </Typography>
                  ) : (
                    (report.rows || []).map((row, index) => {
                      const chip = getResultChip(row.result);
                      const normalizedId = String(row.clientId || "").trim();
                      const selectable = row.result === "READY_TO_DISCONNECT";
                      const checked = selectable && selectedClientIds.includes(normalizedId);

                      return (
                        <Card key={`${row.accountName}-${index}`} sx={{ borderRadius: 3, border: "1px solid #dbe4ee" }}>
                          <CardContent>
                            <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                  <Checkbox
                                    checked={checked}
                                    disabled={!selectable}
                                    onChange={() => toggleClient(normalizedId)}
                                    sx={{ p: 0.25 }}
                                  />
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>{row.accountName || "-"}</Typography>
                                    <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                                      {row.clientName || "-"} | {row.authMode || "-"}
                                    </Typography>
                                  </Box>
                                </Stack>
                                <Chip
                                  label={chip.label}
                                  size="small"
                                  sx={{
                                    backgroundColor: chip.backgroundColor,
                                    color: chip.color,
                                    fontWeight: 700
                                  }}
                                />
                              </Stack>
                              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                                <Box>
                                  <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>DUE DATE</Typography>
                                  <Typography sx={{ fontWeight: 800 }}>{row.dueDate || "-"}</Typography>
                                </Box>
                                <Box>
                                  <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>DISCONNECT</Typography>
                                  <Typography sx={{ fontWeight: 800 }}>{row.disconnectDate || "-"}</Typography>
                                </Box>
                                <Box>
                                  <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>DAYS OVER</Typography>
                                  <Typography sx={{ fontWeight: 800 }}>{row.daysOverdue ?? "-"}</Typography>
                                </Box>
                                <Box>
                                  <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>AMOUNT</Typography>
                                  <Typography sx={{ fontWeight: 800 }}>
                                    {Number(row.amountDue || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </Typography>
                                </Box>
                              </Box>
                              <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                                {row.detail || "-"}
                              </Typography>
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </Box>

                <TableContainer sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <Checkbox
                          checked={allSelectableSelected}
                          indeterminate={selectedClientIds.length > 0 && !allSelectableSelected}
                          onChange={toggleAllClients}
                          disabled={selectableRows.length === 0}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Auth</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Client Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Disconnect Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Days Over</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Amount Due</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Detail</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(report.rows || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} align="center">
                          No unpaid client is currently queued for disconnection.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (report.rows || []).map((row, index) => {
                        const chip = getResultChip(row.result);
                        const normalizedId = String(row.clientId || "").trim();
                        const selectable = row.result === "READY_TO_DISCONNECT";
                        const checked = selectable && selectedClientIds.includes(normalizedId);

                        return (
                          <TableRow key={`${row.accountName}-${index}`}>
                            <TableCell>
                              <Checkbox
                                checked={checked}
                                disabled={!selectable}
                                onChange={() => toggleClient(normalizedId)}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={chip.label}
                                size="small"
                                sx={{
                                  backgroundColor: chip.backgroundColor,
                                  color: chip.color,
                                  fontWeight: 700
                                }}
                              />
                            </TableCell>
                            <TableCell>{row.authMode || "-"}</TableCell>
                            <TableCell>{row.accountName || "-"}</TableCell>
                            <TableCell>{row.clientName || "-"}</TableCell>
                            <TableCell>{row.dueDate || "-"}</TableCell>
                            <TableCell>{row.disconnectDate || "-"}</TableCell>
                            <TableCell>{row.daysOverdue ?? "-"}</TableCell>
                            <TableCell>{Number(row.amountDue || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell>{row.detail || "-"}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}
