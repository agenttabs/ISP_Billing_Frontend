import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  IconButton,
  Tooltip,
  Typography
} from "@mui/material";
import CancelOutlined from "@mui/icons-material/CancelOutlined";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PendingActionsOutlined from "@mui/icons-material/PendingActionsOutlined";
import API from "../api/api";
import { useAuth } from "../context/auth.context";
import PageHeader from "../layout/PageHeader";

const emptyForm = {
  _id: "",
  CustomerName: "",
  ContactNumber: "",
  Address: "",
  Plan: "",
  InstallationDate: "",
  TransferDate: "",
  Status: "PENDING",
  OriginalStatus: "",
  Note: ""
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH");
};

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function Installation() {
  const { user } = useAuth();
  const userType = String(user?.type || "").toUpperCase();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRows = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/installations", {
        params: {
          search,
          status: "ALL"
        }
      });
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load installation records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () => ({
      pending: rows.filter((row) => String(row.Status || "").toUpperCase() === "PENDING").length,
      done: rows.filter((row) => String(row.Status || "").toUpperCase() === "DONE").length,
      cancel: rows.filter((row) => String(row.Status || "").toUpperCase() === "CANCEL").length
    }),
    [rows]
  );

  const displayedRows = useMemo(
    () => rows.filter((row) => String(row.Status || "PENDING").toUpperCase() === statusFilter),
    [rows, statusFilter]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const editRow = (row) => {
    setForm({
      _id: row._id || "",
      CustomerName: row.CustomerName || "",
      ContactNumber: row.ContactNumber || "",
      Address: row.Address || "",
      Plan: row.Plan || "",
      InstallationDate: toDateInput(row.InstallationDate),
      TransferDate: toDateInput(row.TransferDate),
      Status: row.Status || "PENDING",
      OriginalStatus: row.Status || "PENDING",
      Note: row.Note || ""
    });
  };

  const saveInstallation = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        InstallationDate: form.InstallationDate ? new Date(form.InstallationDate).toISOString() : "",
        TransferDate: form.TransferDate ? new Date(form.TransferDate).toISOString() : ""
      };
      const request = form._id
        ? API.put(`/installations/${form._id}`, payload)
        : API.post("/installations", payload);
      await request;
      setSuccess(form._id ? "Installation record updated." : "Installation record created.");
      setError("");
      resetForm();
      await loadRows();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save installation record.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (row, status) => {
    try {
      setSaving(true);
      await API.put(`/installations/${row._id}`, {
        ...row,
        Status: status
      });
      setSuccess(`Installation status changed to ${status === "CANCEL" ? "Cancel" : status.toLowerCase()}.`);
      setError("");
      await loadRows();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to update installation status.");
    } finally {
      setSaving(false);
    }
  };

  const canSetPending = (row) => {
    const currentStatus = String(row.Status || "").toUpperCase();
    return userType === "ADMIN" || !["DONE", "CANCEL"].includes(currentStatus);
  };

  const formatStatusChangedBy = (row) => {
    const statusUser = row.StatusChangedBy || {};
    const name = statusUser.Name || statusUser.name || "";
    const username = statusUser.Username || statusUser.username || "";
    const displayName = name || username;
    return displayName || "-";
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Installation"
          subtitle="Create independent installation records, set installation and transfer dates, and track Pending, Done, or Cancel status."
        />

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 800, color: "#0f172a", mb: 2 }}>
              {form._id ? "Update Installation" : "New Installation"}
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                gap: 1.5
              }}
            >
              <TextField label="Customer Name" name="CustomerName" value={form.CustomerName} onChange={handleChange} />
              <TextField label="Contact Number" name="ContactNumber" value={form.ContactNumber} onChange={handleChange} />
              <TextField label="Address" name="Address" value={form.Address} onChange={handleChange} />
              <TextField select label="Plan" name="Plan" value={form.Plan} onChange={handleChange}>
                <MenuItem value="Plan 1000">Plan 1000</MenuItem>
                <MenuItem value="Plan 1500">Plan 1500</MenuItem>
                <MenuItem value="Plan 2500">Plan 2500</MenuItem>
              </TextField>
              <TextField select label="Status" name="Status" value={form.Status} onChange={handleChange}>
                <MenuItem
                  value="PENDING"
                  disabled={
                    form._id &&
                    userType !== "ADMIN" &&
                    ["DONE", "CANCEL"].includes(String(form.OriginalStatus || "").toUpperCase())
                  }
                >
                  Pending
                </MenuItem>
                <MenuItem value="DONE">Done</MenuItem>
                <MenuItem value="CANCEL">Cancel</MenuItem>
              </TextField>
              <TextField
                label="Installation Date"
                name="InstallationDate"
                type="date"
                value={form.InstallationDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Transfer Date"
                name="TransferDate"
                type="date"
                value={form.TransferDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
              <TextField label="Note" name="Note" value={form.Note} onChange={handleChange} />
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
              <Button variant="contained" onClick={saveInstallation} disabled={saving}>
                {saving ? "Saving..." : form._id ? "Update" : "Save"}
              </Button>
              <Button variant="outlined" onClick={resetForm} disabled={saving}>
                Clear
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadRows();
                }}
                fullWidth
              />
              <Button variant="outlined" onClick={loadRows} disabled={loading} sx={{ minWidth: 120 }}>
                {loading ? "Loading..." : "Search"}
              </Button>
            </Stack>

            <Tabs
              value={statusFilter}
              onChange={(event, value) => setStatusFilter(value)}
              sx={{ mb: 2, borderBottom: "1px solid #dbe4f0" }}
            >
              <Tab value="PENDING" label={`Pending (${counts.pending})`} />
              <Tab value="CANCEL" label={`Cancel (${counts.cancel})`} />
              <Tab value="DONE" label={`Done (${counts.done})`} />
            </Tabs>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Contact</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Plan</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Installation Date</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Transfer Date</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status Changed By</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Note</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No installation records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedRows.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            String(row.Status || "PENDING").toUpperCase() === "DONE"
                              ? "Done"
                              : String(row.Status || "PENDING").toUpperCase() === "CANCEL"
                                ? "Cancel"
                                : "Pending"
                          }
                          color={
                            String(row.Status || "").toUpperCase() === "DONE"
                              ? "success"
                              : String(row.Status || "").toUpperCase() === "CANCEL"
                                ? "error"
                                : "warning"
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{row.CustomerName || "-"}</TableCell>
                      <TableCell>{row.ContactNumber || "-"}</TableCell>
                      <TableCell>{row.Plan || "-"}</TableCell>
                      <TableCell>{formatDate(row.InstallationDate)}</TableCell>
                      <TableCell>{formatDate(row.TransferDate)}</TableCell>
                      <TableCell>{formatStatusChangedBy(row)}</TableCell>
                      <TableCell>{row.Note || "-"}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Edit">
                            <IconButton size="small" color="primary" onClick={() => editRow(row)}>
                              <EditOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Set Pending">
                            <IconButton
                              size="small"
                              color="warning"
                              disabled={saving || String(row.Status || "").toUpperCase() === "PENDING" || !canSetPending(row)}
                              onClick={() => changeStatus(row, "PENDING")}
                            >
                              <PendingActionsOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Set Done">
                            <IconButton
                              size="small"
                              color="success"
                              disabled={saving || String(row.Status || "").toUpperCase() === "DONE"}
                              onClick={() => changeStatus(row, "DONE")}
                            >
                              <CheckCircleOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Set Cancel">
                            <IconButton
                              size="small"
                              color="error"
                              disabled={saving || String(row.Status || "").toUpperCase() === "CANCEL"}
                              onClick={() => changeStatus(row, "CANCEL")}
                            >
                              <CancelOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
