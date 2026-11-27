import { useEffect, useState } from "react";
import {
  Alert, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField, Typography
} from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import API from "../api/api";

const base = "/android-sms-gateway";
const pairingQrPrefix = "isp-sms-gateway:v1:";

export default function SmsProviderSettings() {
  const [settings, setSettings] = useState(null);
  const [provider, setProvider] = useState("ZITASMS");
  const [token, setToken] = useState("");
  const [pairingOpen, setPairingOpen] = useState(false);
  const [existingToken, setExistingToken] = useState("");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("Test SMS from ISP Billing.");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    API.get(base + "/provider", { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setSettings(data);
      setProvider(data.provider);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setFeedback({ section: "provider", severity: "error", message: "Could not load SMS provider settings." });
      }
    });
    return () => controller.abort();
  }, []);

  const run = async (section, action) => {
    setBusy(true);
    setFeedback(null);
    try {
      const message = await action();
      if (message) setFeedback({ section, severity: "success", message });
    } catch (err) {
      setFeedback({
        section,
        severity: "error",
        message: err.response?.data?.error || err.response?.data?.message || "Could not update the SMS gateway."
      });
    } finally {
      setBusy(false);
    }
  };

  const closePairing = () => {
    if (busy) return;
    setPairingOpen(false);
    setToken("");
    setExistingToken("");
    setFeedback(null);
  };

  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Active SMS provider</Typography>
            {feedback?.section === "provider" && (
              <Alert severity={feedback.severity}>{feedback.message}</Alert>
            )}
            {settings && (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField select size="small" label="Provider" value={provider} disabled={busy}
                    onChange={(event) => setProvider(event.target.value)} sx={{ minWidth: 220 }}>
                    <MenuItem value="ZITASMS">ZitaSMS</MenuItem>
                    <MenuItem value="ANDROID" disabled={!settings.androidConfigured}>Our Android Gateway</MenuItem>
                  </TextField>
                  <Button variant="contained" disabled={busy || provider === settings.provider}
                    onClick={() => run("provider", async () => {
                      const { data } = await API.put(base + "/provider", { provider });
                      setSettings(data);
                      return "SMS provider updated.";
                    })}>
                    Save provider
                  </Button>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  New billing messages use the saved provider. Android jobs already queued stay in the Android queue.
                </Typography>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {settings && (
        <Card variant="outlined" sx={{ borderRadius: 4 }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Android gateway</Typography>
              {!pairingOpen && feedback?.section === "android" && (
                <Alert severity={feedback.severity}>{feedback.message}</Alert>
              )}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                {settings.androidConfigured && (
                  <Button variant="outlined" disabled={busy} onClick={() => run("android", async () => {
                    const { data } = await API.get(base + "/token");
                    setSettings((previous) => ({ ...previous, androidConfigured: data.configured }));
                    if (!data.configured) return;
                    setToken(data.token || "");
                    setPairingOpen(true);
                  })}>
                    View device token &amp; QR code
                  </Button>
                )}
                <Button size="small" disabled={busy} onClick={() => {
                  if (settings.androidConfigured && !window.confirm("Replace the device token? The paired phone will need the new token.")) return;
                  run("android", async () => {
                    const { data } = await API.post(base + "/token");
                    setToken(data.token);
                    setPairingOpen(true);
                    setSettings((previous) => ({ ...previous, androidConfigured: true }));
                  });
                }}>
                  {settings.androidConfigured ? "Replace device token" : "Generate device token"}
                </Button>
              </Stack>
              <Stack component="form" spacing={1} onSubmit={(event) => {
                event.preventDefault();
                run("android", async () => {
                  await API.post(base + "/test", { number, message });
                  return "Test SMS queued. Tap Fetch and Send on the Android phone.";
                });
              }}>
                <TextField label="Test phone number" type="tel" size="small" value={number} required
                  onChange={(event) => setNumber(event.target.value)} disabled={busy} />
                <TextField label="Test message" size="small" value={message} required
                  onChange={(event) => setMessage(event.target.value)} disabled={busy} inputProps={{ maxLength: 1600 }} />
                <Button type="submit" variant="outlined" sx={{ alignSelf: "flex-start" }}
                  disabled={busy || !settings.androidConfigured || !number.trim() || !message.trim()}>
                  Queue Android test SMS
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}
      <Dialog open={pairingOpen} onClose={closePairing} fullWidth maxWidth="sm" aria-labelledby="pairing-dialog-title">
        <DialogTitle id="pairing-dialog-title">Android gateway pairing</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {feedback?.section === "android" && (
              <Alert severity={feedback.severity}>{feedback.message}</Alert>
            )}
            {token ? (
              <>
                <Typography variant="body2">
                  In the Android gateway app, open Settings and tap Scan token QR.
                </Typography>
                <QRCodeSVG
                  value={pairingQrPrefix + token}
                  title="Gateway device pairing QR code"
                  size={220}
                  marginSize={4}
                  style={{ alignSelf: "center", maxWidth: "100%", height: "auto" }}
                />
                <TextField label="Device token" value={token} InputProps={{ readOnly: true }}
                  helperText="Keep the token and QR code private." />
              </>
            ) : (
              <Stack component="form" spacing={2} onSubmit={(event) => {
                event.preventDefault();
                run("android", async () => {
                  const currentToken = existingToken.trim();
                  await API.put(base + "/token", { token: currentToken });
                  setToken(currentToken);
                  setExistingToken("");
                });
              }}>
                <Alert severity="info">
                  Let your paired phone connect to Billing, then close and reopen this window. If you have a copy of the current token, you can also paste it below.
                </Alert>
                <TextField label="Existing device token" type="password" value={existingToken} required
                  autoComplete="off" onChange={(event) => setExistingToken(event.target.value)} disabled={busy} />
                <Button type="submit" variant="contained" disabled={busy || !/^[0-9a-f]{64}$/.test(existingToken.trim())}
                  sx={{ alignSelf: "flex-start" }}>
                  Save existing token
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closePairing} disabled={busy}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
