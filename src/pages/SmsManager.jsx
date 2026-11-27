import { useEffect, useState } from "react";
import {
  Alert, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography
} from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const gatewayApi = "/android-sms-gateway";
const emptyRange = { from: "", to: "" };
const statusInfo = {
  QUEUED: { label: "Queued", color: "default" },
  CLAIMED: { label: "Claimed", color: "info" },
  SENDING: { label: "Sending", color: "info" },
  SENT: { label: "Sent", color: "success" },
  FAILED: { label: "Failed", color: "error" },
  UNKNOWN: { label: "Unknown", color: "warning" }
};

const manilaDateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "medium"
});

const formatDateTime = (value) => value ? manilaDateTime.format(new Date(value)) : "—";

// Use a fresh, time-ordered ObjectId per dialog. Retrying the same request keeps its ID.
const makeResendId = () => {
  const seconds = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  const random = crypto.getRandomValues(new Uint8Array(8));
  return seconds + Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export default function SmsManager() {
  const [cursors, setCursors] = useState([null]);
  const [draft, setDraft] = useState(emptyRange);
  const [range, setRange] = useState(emptyRange);
  const [rows, setRows] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retention, setRetention] = useState("");
  const [savedRetention, setSavedRetention] = useState(null);
  const [retentionError, setRetentionError] = useState("");
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState("");
  const cursor = cursors[cursors.length - 1];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    API.get(gatewayApi + "/jobs", {
      params: {
        ...(cursor ? { before: cursor } : {}),
        ...(range.from ? { from: range.from } : {}),
        ...(range.to ? { to: range.to } : {})
      },
      signal: controller.signal
    }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setRows(data.rows);
      setNextCursor(data.nextCursor);
    }).catch((err) => {
      if (controller.signal.aborted) return;
      setRows([]);
      setNextCursor(null);
      setError(err.response?.data?.error || "Could not load SMS history.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [cursor, range, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    API.get(gatewayApi + "/retention", { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setSavedRetention(data.retentionDays);
      setRetention(String(data.retentionDays));
    }).catch(() => {
      if (!controller.signal.aborted) setRetentionError("Could not load auto-delete settings.");
    });
    return () => controller.abort();
  }, []);

  const refresh = () => {
    setCursors([null]);
    setRefreshKey((key) => key + 1);
  };

  const applyRange = (event) => {
    event.preventDefault();
    setCursors([null]);
    setRange({ ...draft });
  };

  const clearRange = () => {
    setDraft(emptyRange);
    setCursors([null]);
    setRange(emptyRange);
  };

  const saveRetention = async (event) => {
    event.preventDefault();
    const retentionDays = Number(retention);
    if (!retention.trim() || !Number.isInteger(retentionDays) || retentionDays < 0 || retentionDays > 3650) {
      setRetentionError("Enter a whole number from 0 to 3650.");
      return;
    }
    setRetentionSaving(true);
    setRetentionError("");
    setNotice("");
    try {
      const { data } = await API.put(gatewayApi + "/retention", { retentionDays });
      setSavedRetention(data.retentionDays);
      setRetention(String(data.retentionDays));
      setNotice(retentionDays === 0
        ? "Auto-delete is off."
        : "Auto-delete saved. Finished jobs removed: " + data.deleted + ".");
      refresh();
    } catch (err) {
      setRetentionError(err.response?.data?.error || "Could not save auto-delete settings.");
    } finally {
      setRetentionSaving(false);
    }
  };

  const queueResend = async () => {
    if (resending || dialog?.type !== "resend") return;

    setResending(true);
    setResendError("");
    setNotice("");
    try {
      await API.post(gatewayApi + "/jobs/" + dialog.job.id + "/resend", { requestId: dialog.requestId });
      setNotice("Resend queued for the Android gateway.");
      setDialog(null);
      refresh();
    } catch (err) {
      setResendError(err.response?.data?.error || "Could not confirm the resend. You can retry this request.");
    } finally {
      setResending(false);
    }
  };

  return (
    <Stack spacing={2}>
      <PageHeader
        title="SMS Manager"
        subtitle="Android gateway messages. Times are shown in Philippine time."
        action={
          <Stack component="form" spacing={0.5} onSubmit={saveRetention}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Auto-delete after (days)"
                value={retention}
                onChange={(event) => setRetention(event.target.value)}
                type="number"
                size="small"
                inputProps={{ min: 0, max: 3650, step: 1 }}
                disabled={savedRetention === null || retentionSaving}
                sx={{ minWidth: 180 }}
              />
              <Button type="submit" variant="outlined"
                disabled={savedRetention === null || retentionSaving || retention === "" || Number(retention) === savedRetention}>
                Save
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">Finished jobs only. 0 turns auto-delete off.</Typography>
          </Stack>
        }
      />
      {retentionError && <Alert severity="error">{retentionError}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Card variant="outlined" sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack component="form" onSubmit={applyRange} spacing={1.5}
            direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField
              type="date"
              label="Queued from"
              size="small"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: draft.to || undefined }}
            />
            <TextField
              type="date"
              label="Queued through"
              size="small"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: draft.from || undefined }}
            />
            <Button type="submit" variant="contained" disabled={loading}>Search</Button>
            <Button onClick={clearRange} disabled={loading || (!draft.from && !draft.to && !range.from && !range.to)}>
              Clear
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlinedIcon />}
              onClick={refresh}
              disabled={loading}
              sx={{ ml: { sm: "auto !important" } }}
            >
              Refresh
            </Button>
          </Stack>
        </CardContent>

        <TableContainer>
          <Table size="small" aria-label="Android SMS history" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>Recipient</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Queued</TableCell>
                <TableCell>Send confirmed</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center"><span role="status">Loading SMS history…</span></TableCell>
                </TableRow>
              ) : rows.length ? rows.map((row) => {
                const status = statusInfo[row.status];
                return (
                  <TableRow key={row.id}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{row.recipient}</TableCell>
                    <TableCell sx={{ minWidth: 200, maxWidth: 360 }}>
                      <Typography variant="body2" noWrap>{row.message}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={status?.label || row.status} color={status?.color || "default"} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.createdAt)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.sentAt)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button size="small" onClick={() => setDialog({ type: "view", job: row })}>View</Button>
                        <Button size="small" disabled={!row.canResend} onClick={() => {
                          setResendError("");
                          setDialog({ type: "resend", job: row, requestId: makeResendId() });
                        }}>Resend</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    {error ? "History unavailable." : "No Android SMS jobs found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {(cursors.length > 1 || nextCursor) && (
          <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" sx={{ p: 2 }}>
            <Button disabled={loading || cursors.length === 1} onClick={() => {
              setLoading(true);
              setCursors((previous) => previous.slice(0, -1));
            }}>Previous</Button>
            <Typography variant="body2">Page {cursors.length}</Typography>
            <Button disabled={loading || !nextCursor} onClick={() => {
              setLoading(true);
              setCursors((previous) => [...previous, nextCursor]);
            }}>Next</Button>
          </Stack>
        )}
      </Card>

      <Dialog open={Boolean(dialog)} onClose={() => { if (!resending) setDialog(null); }}
        maxWidth="sm" fullWidth aria-labelledby="sms-manager-dialog-title">
        {dialog && (
          <>
            <DialogTitle id="sms-manager-dialog-title">{dialog.type === "resend" ? "Resend SMS?" : "SMS message"}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <DialogContentText>Recipient {dialog.job.recipient}</DialogContentText>
                {dialog.type === "resend" && (
                  <DialogContentText>
                    This queues a new SMS. The recipient may receive it twice if the original arrived.
                  </DialogContentText>
                )}
                <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{dialog.job.message}</Typography>
                {dialog.type === "resend" && resendError && <Alert severity="error">{resendError}</Alert>}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button disabled={resending} onClick={() => setDialog(null)}>
                {dialog.type === "resend" ? "Cancel" : "Close"}
              </Button>
              {dialog.type === "resend" && (
                <Button variant="contained" disabled={resending} onClick={queueResend}>
                  {resending ? "Queueing…" : "Queue resend"}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  );
}
