import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultConfig = {
  Name: "OLT Dump Scheduler",
  SendTime: "06:00",
  ScheduleTimes: ["06:00"],
  IsActive: false,
  RunGpon: true,
  RunEpon: true,
  LastRunAt: null,
  LastRunSummary: "",
  LastError: "",
  LastOutput: ""
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH");
};

const normalizeScheduleTimes = (config = {}) => {
  const source = Array.isArray(config.ScheduleTimes) && config.ScheduleTimes.length
    ? config.ScheduleTimes
    : [config.SendTime || "06:00"];

  return source.map((value) => String(value || "").trim()).filter(Boolean);
};

export default function OltDumpScheduler() {
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [confirmRunOpen, setConfirmRunOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [config, setConfig] = useState(defaultConfig);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await API.get("/olt-dump-scheduler/config");
        setConfig({
          ...defaultConfig,
          ...(response.data || {})
        });
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load OLT dump scheduler config.");
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  const saveConfig = async () => {
    try {
      setSaving(true);
      const scheduleTimes = normalizeScheduleTimes(config);
      const response = await API.put("/olt-dump-scheduler/config", {
        ...config,
        SendTime: scheduleTimes[0] || config.SendTime || "06:00",
        ScheduleTimes: scheduleTimes
      });
      setConfig({
        ...defaultConfig,
        ...(response.data || {})
      });
      setError("");
      setSuccess("OLT dump scheduler saved.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save OLT dump scheduler.");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    try {
      setRunningNow(true);
      const response = await API.post("/olt-dump-scheduler/run-now", {
        SendTime: config.SendTime,
        ScheduleTimes: normalizeScheduleTimes(config),
        IsActive: config.IsActive,
        RunGpon: config.RunGpon,
        RunEpon: config.RunEpon
      });
      if (response.data?.config) {
        setConfig({
          ...defaultConfig,
          ...(response.data.config || {})
        });
      }
      setError("");
      setSuccess(response.data?.reason || "OLT dump completed.");
    } catch (err) {
      const reportConfig = err.response?.data?.report?.config;
      if (reportConfig) {
        setConfig({
          ...defaultConfig,
          ...(reportConfig || {})
        });
      }
      setSuccess("");
      setError(err.response?.data?.error || "Failed to run OLT dump.");
    } finally {
      setRunningNow(false);
    }
  };

  const closeRunConfirm = () => {
    if (runningNow) return;
    setConfirmRunOpen(false);
  };

  const confirmRunNow = async () => {
    await runNow();
    setConfirmRunOpen(false);
  };

  const scheduleTimes = normalizeScheduleTimes(config);

  const updateScheduleTime = (index, value) => {
    const nextTimes = [...scheduleTimes];
    nextTimes[index] = value;
    setConfig((prev) => ({
      ...prev,
      SendTime: nextTimes[0] || prev.SendTime || "06:00",
      ScheduleTimes: nextTimes
    }));
  };

  const addScheduleTime = () => {
    const nextTimes = [...scheduleTimes, "12:00"];
    setConfig((prev) => ({
      ...prev,
      SendTime: nextTimes[0] || prev.SendTime || "06:00",
      ScheduleTimes: nextTimes
    }));
  };

  const removeScheduleTime = (index) => {
    const nextTimes = scheduleTimes.filter((_, itemIndex) => itemIndex !== index);
    const fallbackTimes = nextTimes.length ? nextTimes : ["06:00"];
    setConfig((prev) => ({
      ...prev,
      SendTime: fallbackTimes[0],
      ScheduleTimes: fallbackTimes
    }));
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="OLT Dump Scheduler"
          subtitle="Generate GPON and EPON OLT dump files from the system using the backend .env OLT settings."
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
                    label="Output Folder"
                    value="migration\\olt-dumps"
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                </Stack>

                <Box>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ xs: "stretch", sm: "center" }}
                    justifyContent="space-between"
                    spacing={1.5}
                    sx={{ mb: 1 }}
                  >
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      Schedule Times
                    </Typography>
                    <Button variant="outlined" size="small" onClick={addScheduleTime}>
                      Add Time
                    </Button>
                  </Stack>

                  <Stack spacing={1.5}>
                    {scheduleTimes.map((timeValue, index) => (
                      <Stack
                        key={`schedule-time-${index}`}
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        alignItems={{ xs: "stretch", sm: "center" }}
                      >
                        <TextField
                          label={`Schedule Time ${index + 1}`}
                          type="time"
                          value={timeValue}
                          onChange={(event) => updateScheduleTime(index, event.target.value)}
                          InputLabelProps={{ shrink: true }}
                          sx={{ maxWidth: { sm: 260 } }}
                          fullWidth
                        />
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => removeScheduleTime(index)}
                          disabled={scheduleTimes.length <= 1}
                          sx={{ minWidth: 100 }}
                        >
                          Remove
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(config.RunGpon)}
                        onChange={(event) =>
                          setConfig((prev) => ({
                            ...prev,
                            RunGpon: event.target.checked
                          }))
                        }
                      />
                    }
                    label="Generate GPON dump"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(config.RunEpon)}
                        onChange={(event) =>
                          setConfig((prev) => ({
                            ...prev,
                            RunEpon: event.target.checked
                          }))
                        }
                      />
                    }
                    label="Generate EPON dump"
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

                {config.LastOutput ? (
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 2,
                      maxHeight: 280,
                      overflow: "auto",
                      borderRadius: 2,
                      backgroundColor: "#0f172a",
                      color: "#e2e8f0",
                      fontSize: "0.78rem",
                      whiteSpace: "pre-wrap"
                    }}
                  >
                    {config.LastOutput}
                  </Box>
                ) : null}

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Button variant="outlined" onClick={saveConfig} disabled={saving}>
                    {saving ? "Saving..." : "Save Scheduler"}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={runningNow ? <CircularProgress size={16} color="inherit" /> : <AutorenewIcon />}
                    onClick={() => setConfirmRunOpen(true)}
                    disabled={runningNow || (!config.RunGpon && !config.RunEpon)}
                  >
                    {runningNow ? "Running..." : "Run Now"}
                  </Button>
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={confirmRunOpen} onClose={closeRunConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Run OLT Dump</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#334155" }}>
            Are you sure you want to generate the selected OLT dump files now?
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
