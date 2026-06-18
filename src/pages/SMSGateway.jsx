import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultForm = {
  ServiceName: "ZITASMS",
  Status: "NO",
  ApiUrl: "https://www.zitasms.com/api/send/sms",
  Secret: "",
  Mode: "devices",
  Device: "",
  Sim: "1"
};

const defaultTestForm = {
  Phone: "",
  Message: "Test SMS from ISP Billing."
};

export default function SMSGateway() {
  const [rows, setRows] = useState([]);
  const [collectionName, setCollectionName] = useState("SmsGateway");
  const [form, setForm] = useState(defaultForm);
  const [editingRow, setEditingRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testForm, setTestForm] = useState(defaultTestForm);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testGateway, setTestGateway] = useState(null);
  const [testResult, setTestResult] = useState("");

  const loadRows = async () => {
    try {
      const { data } = await API.get("/sms-gateways");
      setRows(data?.rows || []);
      setCollectionName(data?.collectionName || "SmsGateway");
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load SMS collection.");
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingRow(null);
  };

  const openTestDialog = (row) => {
    setTestGateway(row);
    setTestForm(defaultTestForm);
    setTestResult("");
    setError("");
    setSuccess("");
    setTestDialogOpen(true);
  };

  const closeTestDialog = () => {
    if (testLoading) return;
    setTestDialogOpen(false);
    setTestGateway(null);
    setTestForm(defaultTestForm);
    setTestResult("");
  };

  const handleSendTest = async () => {
    try {
      setTestLoading(true);
      setError("");
      setSuccess("");

      const { data } = await API.post("/sms-gateways/test", {
        ...(testGateway || form),
        ...testForm
      });

      setSuccess(data?.message || "Test SMS sent successfully.");
      setTestResult(data?.response || "");
      setTestDialogOpen(false);
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to send test SMS.");
      setTestResult(err.response?.data?.response || "");
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      if (editingRow?._id) {
        const { data } = await API.put(`/sms-gateways/${editingRow._id}`, form);
        setRows((prev) =>
          prev.map((row) => (row._id === editingRow._id ? data.row : row))
        );
        setCollectionName(data?.collectionName || collectionName);
        setSuccess("SMS collection updated successfully.");
      } else {
        const { data } = await API.post("/sms-gateways", form);
        setRows((prev) =>
          [...prev, data.row].sort((a, b) =>
            String(a.ServiceName || "").localeCompare(String(b.ServiceName || ""))
          )
        );
        setCollectionName(data?.collectionName || collectionName);
        setSuccess("SMS collection added successfully.");
      }

      resetForm();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save SMS collection.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setForm({
      ServiceName: row.ServiceName || "",
      Status: String(row.Status || "NO").toUpperCase(),
      ApiUrl: row.ApiUrl || "",
      Secret: row.Secret || "",
      Mode: row.Mode || "devices",
      Device: row.Device || "",
      Sim: row.Sim || "1"
    });
    setError("");
    setSuccess("");
  };

  const handleDelete = async (row) => {
    try {
      await API.delete(`/sms-gateways/${row._id}`);
      setRows((prev) => prev.filter((item) => item._id !== row._id));
      setSuccess("SMS collection deleted successfully.");
      setError("");
      if (editingRow?._id === row._id) {
        resetForm();
      }
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to delete SMS collection.");
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="SMS Collection"
          subtitle={`Maintain the SMS gateway collection used by the messaging service. Current collection: ${collectionName}`}
          action={
            <Button
              variant="contained"
              startIcon={<SmsOutlinedIcon />}
              onClick={resetForm}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              New SMS Collection
            </Button>
          }
        />

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}
        {testResult ? <Alert severity="info">API Return: {testResult}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack component="form" spacing={2.25} onSubmit={handleSubmit}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Service Name"
                  value={form.ServiceName}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, ServiceName: event.target.value }))
                  }
                  fullWidth
                  required
                />
                <TextField
                  select
                  label="Status"
                  value={form.Status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Status: event.target.value }))
                  }
                  fullWidth
                >
                  <MenuItem value="YES">YES</MenuItem>
                  <MenuItem value="NO">NO</MenuItem>
                </TextField>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="API URL"
                  value={form.ApiUrl}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, ApiUrl: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Secret"
                  value={form.Secret}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Secret: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Mode"
                  value={form.Mode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Mode: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Device"
                  value={form.Device}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Device: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="SIM"
                  value={form.Sim}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Sim: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {loading
                    ? "Saving..."
                    : editingRow
                      ? "Update SMS Collection"
                      : "Add SMS Collection"}
                </Button>
                {editingRow ? (
                  <Button
                    variant="outlined"
                    onClick={resetForm}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Existing SMS Collection
            </Typography>

            <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
              {rows.length === 0 ? (
                <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                  No SMS collection rows found.
                </Typography>
              ) : (
                rows.map((row) => (
                  <Card key={row._id} sx={{ borderRadius: 3, border: "1px solid #dbe4ee" }}>
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>
                              {row.ServiceName || "-"}
                            </Typography>
                            <Typography sx={{ color: "#64748b", fontSize: "0.75rem" }}>
                              Status: {row.Status || "-"} | Mode: {row.Mode || "-"}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-all" }}>
                          {row.ApiUrl || "-"}
                        </Typography>
                        <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                          Device: {row.Device || "-"}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SmsOutlinedIcon />}
                            onClick={() => openTestDialog(row)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Test
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditOutlinedIcon />}
                            onClick={() => handleEdit(row)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<DeleteOutlineOutlinedIcon />}
                            onClick={() => handleDelete(row)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>

            <TableContainer sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Service Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>API URL</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Device</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No SMS collection rows found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell sx={{ fontWeight: 700 }}>{row.ServiceName || "-"}</TableCell>
                      <TableCell>{row.Status || "-"}</TableCell>
                      <TableCell sx={{ maxWidth: 420, wordBreak: "break-all" }}>
                        {row.ApiUrl || "-"}
                      </TableCell>
                      <TableCell>{row.Mode || "-"}</TableCell>
                      <TableCell>{row.Device || "-"}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            variant="outlined"
                            startIcon={<SmsOutlinedIcon />}
                            onClick={() => openTestDialog(row)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Test
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<EditOutlinedIcon />}
                            onClick={() => handleEdit(row)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Edit
                          </Button>
                          <Button
                            color="error"
                            variant="outlined"
                            startIcon={<DeleteOutlineOutlinedIcon />}
                            onClick={() => handleDelete(row)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      <Dialog
        open={testDialogOpen}
        onClose={closeTestDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Test SMS
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Service Name"
              value={testGateway?.ServiceName || ""}
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Device"
                value={testGateway?.Device || ""}
                fullWidth
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="Mode"
                value={testGateway?.Mode || ""}
                fullWidth
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="SIM"
                value={testGateway?.Sim || "1"}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            </Stack>
            <TextField
              label="Test Phone Number"
              value={testForm.Phone}
              onChange={(event) =>
                setTestForm((prev) => ({ ...prev, Phone: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Test Message"
              value={testForm.Message}
              onChange={(event) =>
                setTestForm((prev) => ({ ...prev, Message: event.target.value }))
              }
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTestDialog} sx={{ textTransform: "none", fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SmsOutlinedIcon />}
            onClick={handleSendTest}
            disabled={testLoading}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {testLoading ? "Sending..." : "Send Test SMS"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
