import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import AutorenewIcon from "@mui/icons-material/Autorenew";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultConfig = {
  Name: "Mikrotik DC Batch",
  SendTime: "09:00",
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

  if (normalized === "UPDATED_TO_DISCONNECTED") {
    return { label: "Updated", backgroundColor: "#dcfce7", color: "#166534" };
  }

  if (normalized === "READY_TO_UPDATE") {
    return { label: "Ready", backgroundColor: "#eff6ff", color: "#1d4ed8" };
  }

  if (normalized === "ALREADY_DISCONNECTED") {
    return { label: "Already Disconnected", backgroundColor: "#fff7ed", color: "#c2410c" };
  }

  return { label: value || "-", backgroundColor: "#f8fafc", color: "#475569" };
};

export default function MikrotikDcBatch() {
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [config, setConfig] = useState(defaultConfig);
  const [report, setReport] = useState(null);
  const [confirmRunOpen, setConfirmRunOpen] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await API.get("/mikrotik-dc-batch/config");
        setConfig({
          ...defaultConfig,
          ...(response.data || {})
        });
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load MikroTik DC batch config.");
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  const previewBatch = async () => {
    try {
      setPreviewing(true);
      const response = await API.get("/mikrotik-dc-batch/report", {
        params: {
          GraceDays: config.GraceDays,
          SendTime: config.SendTime,
          DisconnectedPlanName: config.DisconnectedPlanName
        }
      });
      setReport(response.data);
      setError("");
      setSuccess("MikroTik DC batch preview loaded.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to preview MikroTik DC batch clients.");
    } finally {
      setPreviewing(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await API.put("/mikrotik-dc-batch/config", config);
      setConfig({
        ...defaultConfig,
        ...(response.data || {})
      });
      setError("");
      setSuccess("MikroTik DC batch scheduler saved.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save MikroTik DC batch config.");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    try {
      setRunningNow(true);
      const response = await API.post("/mikrotik-dc-batch/run-now", {
        GraceDays: config.GraceDays,
        SendTime: config.SendTime,
        DisconnectedPlanName: config.DisconnectedPlanName
      });
      if (response.data?.report) {
        setReport(response.data.report);
      }
      if (response.data?.config) {
        setConfig({
          ...defaultConfig,
          ...(response.data.config || {})
        });
      }
      setError("");
      setSuccess(response.data?.reason || "MikroTik DC batch completed.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to run MikroTik DC batch.");
    } finally {
      setRunningNow(false);
    }
  };

  const openRunConfirm = () => {
    setConfirmRunOpen(true);
  };

  const closeRunConfirm = () => {
    if (runningNow) return;
    setConfirmRunOpen(false);
  };

  const confirmRunNow = async () => {
    await runNow();
    setConfirmRunOpen(false);
  };

  const visibleRows = (report?.rows || []).filter(
    (row) => String(row?.result || "").toUpperCase() !== "ALREADY_DISCONNECTED"
  );
  const hasRunnableRows = visibleRows.length > 0;

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Mikrotik DC Batch"
          subtitle="Disconnect overdue unpaid PPPOE and IPOE clients after the grace period, while skipping bypass accounts."
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
                    label="Days Before Disconnection"
                    type="number"
                    value={config.GraceDays ?? 15}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        GraceDays: event.target.value
                      }))
                    }
                    inputProps={{ min: 0 }}
                    fullWidth
                  />

                  <TextField
                    label="Send Time"
                    type="time"
                    value={config.SendTime || "09:00"}
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
                    startIcon={runningNow ? <CircularProgress size={16} color="inherit" /> : <SyncAltIcon />}
                    onClick={openRunConfirm}
                    disabled={runningNow || !hasRunnableRows}
                  >
                    {runningNow ? "Running..." : "Run Now"}
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
                  <Typography color="text.secondary">Record Count</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "#c2410c" }}>
                    {visibleRows.length}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>

            <Card sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontWeight: 700, color: "#0f172a", mb: 2 }}>
                  Batch Result
                </Typography>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Auth</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Client Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Old Profile</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Old NetPlan</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Next Plan</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Detail</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          No overdue non-bypass client needs a disconnect right now.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleRows.map((row, index) => {
                        const chip = getResultChip(row.result);

                        return (
                          <TableRow key={`${row.accountName}-${index}`}>
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
                            <TableCell>{row.oldProfile || "-"}</TableCell>
                            <TableCell>{row.oldNetPlan || "-"}</TableCell>
                            <TableCell>{row.nextPlan || "-"}</TableCell>
                            <TableCell>{row.detail || "-"}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </Stack>

      <Dialog open={confirmRunOpen} onClose={closeRunConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Run DC Batch</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#334155" }}>
            Are you sure you want to run the MikroTik DC Batch now?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRunConfirm} disabled={runningNow}>
            Cancel
          </Button>
          <Button onClick={confirmRunNow} variant="contained" disabled={runningNow}>
            {runningNow ? "Running..." : "Yes, Run Now"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
