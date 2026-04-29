import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultForm = {
  Name: "Billing SOA Notification",
  DaysOffset: 0,
  SendTime: "08:00",
  Subject: "DNS Internet Billing Statement - @BillingMonth@",
  Body: [
    "Hi @ClientName@,",
    "",
    "Attached is your DNS Internet billing statement.",
    "",
    "Account Number: @AccountNumber@",
    "Monthly Due: @MonthlyDue@",
    "Total Amount Due: @TotalAmountDue@",
    "Due Date: @DueDate@",
    "Subscription Covered: @SubscriptionCover@",
    "",
    "Thank you."
  ].join("\n"),
  SmtpHost: "",
  SmtpPort: 587,
  SmtpSecure: false,
  SmtpUser: "",
  SmtpPassword: "",
  FromName: "DNS INTERNET",
  IsActive: false,
  LastRunAt: null,
  LastRunSummary: "",
  LastError: "",
  EligibleCount: 0,
  EligibleClients: [],
  AvailableClients: [],
  ManualClientIds: []
};

const availableTokens = [
  "@ClientName@",
  "@AccountName@",
  "@AccountNumber@",
  "@ContactNumber@",
  "@MonthlyDue@",
  "@TotalAmountDue@",
  "@DueDate@",
  "@SubscriptionCover@",
  "@BillingMonth@"
];

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

export default function EmailNotification() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadConfig = async () => {
    try {
      const { data } = await API.get("/email-notification");
      setForm((prev) => ({
        ...prev,
        ...data
      }));
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load email notification settings.");
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const { data } = await API.put("/email-notification", form);
      setForm((prev) => ({
        ...prev,
        ...data
      }));
      setSuccess("Email notification settings saved successfully.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save email notification settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setRunningNow(true);
      setError("");
      setSuccess("");

      const { data } = await API.post("/email-notification/run-now", {
        ManualClientIds: form.ManualClientIds || []
      });
      if (data?.config) {
        setForm((prev) => ({
          ...prev,
          ...data.config
        }));
      }
      setSuccess(data?.reason || "Email notification run completed.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to run email notification now.");
    } finally {
      setRunningNow(false);
    }
  };

  const toggleManualClient = (clientId) => {
    setForm((prev) => {
      const nextIds = new Set(prev.ManualClientIds || []);

      if (nextIds.has(clientId)) {
        nextIds.delete(clientId);
      } else {
        nextIds.add(clientId);
      }

      return {
        ...prev,
        ManualClientIds: Array.from(nextIds)
      };
    });
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Email Notification"
          subtitle="Set the billing email time, SMTP settings, and message. Only clients with a valid email and Email Billing turned on will receive the SOA PDF attachment."
          action={
            <Button
              variant="outlined"
              startIcon={<PlayCircleOutlineOutlinedIcon />}
              onClick={handleRunNow}
              disabled={runningNow}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              {runningNow ? "Running..." : "Run Now"}
            </Button>
          }
        />

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Notification Name"
                  value={form.Name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Name: event.target.value }))
                  }
                  fullWidth
                />

                <TextField
                  label="Send Time"
                  type="time"
                  value={form.SendTime}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, SendTime: event.target.value }))
                  }
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />

                <TextField
                  label="Days Offset"
                  type="number"
                  value={form.DaysOffset}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      DaysOffset: Number(event.target.value || 0)
                    }))
                  }
                  fullWidth
                  helperText="-1 = day before due, 0 = due day, 1 = day after due"
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="SMTP Host"
                  value={form.SmtpHost}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, SmtpHost: event.target.value }))
                  }
                  fullWidth
                  required
                />

                <TextField
                  label="SMTP Port"
                  type="number"
                  value={form.SmtpPort}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      SmtpPort: Number(event.target.value || 0)
                    }))
                  }
                  fullWidth
                  required
                />

                <TextField
                  label="From Name"
                  value={form.FromName}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, FromName: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="SMTP User / Sender Email"
                  value={form.SmtpUser}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, SmtpUser: event.target.value }))
                  }
                  fullWidth
                  required
                />

                <TextField
                  label="SMTP Password / App Password"
                  type="password"
                  value={form.SmtpPassword}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, SmtpPassword: event.target.value }))
                  }
                  fullWidth
                  required
                />

                <Box
                  sx={{
                    minWidth: { xs: "100%", md: 260 },
                    px: 1.5,
                    py: 1,
                    border: "1px solid #dbe4ee",
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#fff"
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      Secure SMTP / Active
                    </Typography>
                    <Typography sx={{ fontSize: "0.85rem", color: "#64748b" }}>
                      For Gmail use port 587 for STARTTLS or 465 for SSL. Email sending must also be active.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Switch
                      checked={Boolean(form.SmtpSecure)}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          SmtpSecure: event.target.checked
                        }))
                      }
                    />
                    <Switch
                      checked={Boolean(form.IsActive)}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          IsActive: event.target.checked
                        }))
                      }
                    />
                  </Stack>
                </Box>
              </Stack>

              <TextField
                label="Email Subject"
                value={form.Subject}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, Subject: event.target.value }))
                }
                fullWidth
                required
              />

              <TextField
                label="Email Body"
                value={form.Body}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, Body: event.target.value }))
                }
                fullWidth
                required
                multiline
                minRows={10}
                helperText="The generated billing PDF will be attached automatically."
              />

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: "1px solid #dbe4ee",
                  backgroundColor: "#f8fbff"
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                    Eligible Clients Today
                  </Typography>
                  <Typography sx={{ color: "#475569", mt: 0.5 }}>
                    {form.EligibleCount || 0} client(s) currently match the schedule and have Email Billing enabled.
                  </Typography>
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                    Last Run
                  </Typography>
                  <Typography sx={{ color: "#475569", mt: 0.5 }}>
                    {formatDateTime(form.LastRunAt)}
                  </Typography>
                  <Typography sx={{ color: "#475569", mt: 0.75 }}>
                    {form.LastRunSummary || "No run history yet."}
                  </Typography>
                  {form.LastError ? (
                    <Typography sx={{ color: "#b91c1c", mt: 0.75 }}>
                      {form.LastError}
                    </Typography>
                  ) : null}
                </Box>
              </Stack>

              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Manual Client Picker
                </Typography>
                <Typography sx={{ color: "#64748b", mb: 1.5 }}>
                  Pick client accounts manually here. These selected clients will be included when you use <strong>Run Now</strong>, even if they are not part of today&apos;s schedule.
                </Typography>

                <Box
                  sx={{
                    border: "1px solid #dbe4ee",
                    borderRadius: 3,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                    maxHeight: 320,
                    overflowY: "auto"
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: 56 }}>Pick</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Client Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(form.AvailableClients || []).length > 0 ? (
                        form.AvailableClients.map((client) => {
                          const clientId = String(client._id || "");
                          const checked = (form.ManualClientIds || []).includes(clientId);

                          return (
                            <TableRow key={`manual-client-${clientId || client.AccountName || client.Email}`}>
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={checked}
                                  onChange={() => toggleManualClient(clientId)}
                                />
                              </TableCell>
                              <TableCell>{client.AccountName || "-"}</TableCell>
                              <TableCell>{client.ClientName || "-"}</TableCell>
                              <TableCell>{client.Email || "-"}</TableCell>
                              <TableCell>
                                {client.DueDate
                                  ? new Date(client.DueDate).toLocaleDateString("en-PH", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric"
                                    })
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} sx={{ color: "#64748b", py: 3 }}>
                            No clients with valid email and Email Billing enabled are available yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Box>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Multiple Client Names
                </Typography>
                <Typography sx={{ color: "#64748b", mb: 1.5 }}>
                  These are the client names currently included in today&apos;s email notification schedule.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {(form.EligibleClients || []).length > 0 ? (
                    form.EligibleClients.map((client) => (
                      <Chip
                        key={`client-name-${client._id || client.AccountName || client.Email}`}
                        label={client.ClientName || client.AccountName || "Unnamed Client"}
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    ))
                  ) : (
                    <Typography sx={{ color: "#64748b" }}>
                      No client names available for the current schedule yet.
                    </Typography>
                  )}
                </Stack>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Client Email Accounts
                </Typography>
                <Typography sx={{ color: "#64748b", mb: 1.5 }}>
                  Each client can use a special email address. This list shows the client accounts that currently match the schedule and will receive billing email from this module.
                </Typography>

                <Box
                  sx={{
                    border: "1px solid #dbe4ee",
                    borderRadius: 3,
                    overflow: "hidden",
                    backgroundColor: "#fff"
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Client Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(form.EligibleClients || []).length > 0 ? (
                        form.EligibleClients.map((client) => (
                          <TableRow key={client._id || `${client.AccountName}-${client.Email}`}>
                            <TableCell>{client.AccountName || "-"}</TableCell>
                            <TableCell>{client.ClientName || "-"}</TableCell>
                            <TableCell>{client.Email || "-"}</TableCell>
                            <TableCell>
                              {client.DueDate
                                ? new Date(client.DueDate).toLocaleDateString("en-PH", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric"
                                  })
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ color: "#64748b", py: 3 }}>
                            No eligible client email accounts for the current schedule yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Box>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Available Tokens
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {availableTokens.map((token) => (
                    <Chip key={token} label={token} variant="outlined" sx={{ fontWeight: 600 }} />
                  ))}
                </Stack>
              </Box>

              <Stack direction="row" spacing={1.5}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {loading ? "Saving..." : "Save Email Notification"}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<EmailOutlinedIcon />}
                  onClick={loadConfig}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Refresh
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
