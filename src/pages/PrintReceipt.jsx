import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultForm = {
  Name: "Default Thermal Receipt",
  CompanyName: "DNS NETWORKS",
  ReceiptTitle: "Official Payment Receipt",
  ReceiptSubtitle: "DNS INTERNET",
  FooterNote: "Thank you for your payment.",
  PreferredPrinterName: "DNS PRINTER",
  UseDirectPrint: true,
  ShowSubscriptionCover: true,
  ShowContactNumber: true,
  ShowReference: true,
  ShowCreatedBy: true
};

export default function PrintReceipt() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadConfig = async () => {
    try {
      const { data } = await API.get("/print-receipt");
      setForm((prev) => ({
        ...prev,
        ...data
      }));
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load print receipt settings.");
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

      const { data } = await API.put("/print-receipt", form);
      setForm((prev) => ({
        ...prev,
        ...data
      }));
      setSuccess("Print receipt settings saved successfully.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save print receipt settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Print Receipt"
          subtitle="Maintain the thermal receipt header, footer, printer name, and printed fields for Xprinter receipts."
          action={
            <Button
              variant="outlined"
              startIcon={<PrintOutlinedIcon />}
              onClick={loadConfig}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Refresh
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
                  label="Template Name"
                  value={form.Name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Name: event.target.value }))
                  }
                  fullWidth
                />

                <TextField
                  label="Preferred Printer Name"
                  value={form.PreferredPrinterName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      PreferredPrinterName: event.target.value
                    }))
                  }
                  fullWidth
                  helperText="Example: Xprinter, XP-58, XP-80"
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Company Name"
                  value={form.CompanyName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      CompanyName: event.target.value
                    }))
                  }
                  fullWidth
                />

                <TextField
                  label="Receipt Title"
                  value={form.ReceiptTitle}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      ReceiptTitle: event.target.value
                    }))
                  }
                  fullWidth
                />
              </Stack>

              <TextField
                label="Receipt Subtitle"
                value={form.ReceiptSubtitle}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    ReceiptSubtitle: event.target.value
                  }))
                }
                fullWidth
              />

              <TextField
                label="Footer Note"
                value={form.FooterNote}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    FooterNote: event.target.value
                  }))
                }
                fullWidth
                multiline
                rows={3}
              />

              <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap">
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.UseDirectPrint}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          UseDirectPrint: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Use Direct Print (QZ Tray)"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.ShowSubscriptionCover}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          ShowSubscriptionCover: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Show Subscription Cover"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.ShowContactNumber}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          ShowContactNumber: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Show Contact Number"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.ShowReference}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          ShowReference: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Show Reference"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.ShowCreatedBy}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          ShowCreatedBy: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Show Received By"
                />
              </Stack>

              <Box
                sx={{
                  border: "1px dashed #cbd5e1",
                  borderRadius: 3,
                  p: 2.5,
                  backgroundColor: "#f8fafc"
                }}
              >
                <Typography sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Preview Notes
                </Typography>
                <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                  Company: {form.CompanyName || "-"}
                </Typography>
                <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                  Title: {form.ReceiptTitle || "-"}
                </Typography>
                <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                  Subtitle: {form.ReceiptSubtitle || "-"}
                </Typography>
                <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                  Footer: {form.FooterNote || "-"}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {loading ? "Saving..." : "Save Receipt Design"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
