import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";
import { DEFAULT_COMPANY_NAME } from "../utils/companyName";

const defaultForm = {
  CompanyName: DEFAULT_COMPANY_NAME,
  CompanyAddress: "",
  CompanyContactNumber: "",
  CompanyEmailAddress: "",
  CompanyWebsite: "",
  CompanyTin: "",
  DisconnectAfterDueDays: 15
};

export default function SystemSettings() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = async () => {
    try {
      setError("");
      const { data } = await API.get("/system-settings");
      setForm((prev) => ({
        ...prev,
        ...data,
        DisconnectAfterDueDays:
          data.DisconnectAfterDueDays ?? prev.DisconnectAfterDueDays
      }));
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to load system settings.");
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const payload = {
        ...form,
        DisconnectAfterDueDays: Number(form.DisconnectAfterDueDays || 0)
      };
      const { data } = await API.put("/system-settings", payload);
      setForm((prev) => ({
        ...prev,
        ...data
      }));
      setSuccess("System settings saved successfully.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save system settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="System Settings"
          subtitle="Central settings for company information and billing system rules."
          action={
            <Button
              variant="outlined"
              startIcon={<RefreshOutlinedIcon />}
              onClick={loadSettings}
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
            <Stack component="form" spacing={3} onSubmit={handleSubmit}>
              <Box>
                <Typography sx={{ fontWeight: 800, color: "#0f172a", mb: 0.5 }}>
                  Company
                </Typography>
                <Typography sx={{ color: "#64748b", mb: 2 }}>
                  This is the default company identity used by the system.
                </Typography>

                <Stack spacing={2}>
                  <TextField
                    label="Company Name"
                    value={form.CompanyName}
                    onChange={(event) => updateField("CompanyName", event.target.value)}
                    fullWidth
                    required
                  />

                  <TextField
                    label="Company Address"
                    value={form.CompanyAddress}
                    onChange={(event) => updateField("CompanyAddress", event.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      label="Contact Number"
                      value={form.CompanyContactNumber}
                      onChange={(event) =>
                        updateField("CompanyContactNumber", event.target.value)
                      }
                      fullWidth
                    />
                    <TextField
                      label="Email Address"
                      value={form.CompanyEmailAddress}
                      onChange={(event) =>
                        updateField("CompanyEmailAddress", event.target.value)
                      }
                      fullWidth
                    />
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      label="Website"
                      value={form.CompanyWebsite}
                      onChange={(event) => updateField("CompanyWebsite", event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="TIN / Tax ID"
                      value={form.CompanyTin}
                      onChange={(event) => updateField("CompanyTin", event.target.value)}
                      fullWidth
                    />
                  </Stack>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography sx={{ fontWeight: 800, color: "#0f172a", mb: 0.5 }}>
                  Billing Rules
                </Typography>
                <Typography sx={{ color: "#64748b", mb: 2 }}>
                  Control when unpaid clients become eligible for disconnection after their due date.
                </Typography>

                <TextField
                  label="Days After Due Date Before Disconnection"
                  type="number"
                  value={form.DisconnectAfterDueDays}
                  onChange={(event) =>
                    updateField("DisconnectAfterDueDays", event.target.value)
                  }
                  inputProps={{ min: 0, step: 1 }}
                  helperText="Example: 15 means the disconnect date is 15 days after the due date."
                  sx={{ maxWidth: 420 }}
                  fullWidth
                />
              </Box>

              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {loading ? "Saving..." : "Save System Settings"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
