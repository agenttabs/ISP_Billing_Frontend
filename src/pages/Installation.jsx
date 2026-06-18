import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
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
import EventRepeatOutlined from "@mui/icons-material/EventRepeatOutlined";
import PendingActionsOutlined from "@mui/icons-material/PendingActionsOutlined";
import PlayCircleOutline from "@mui/icons-material/PlayCircleOutline";
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
  const [rescheduleRow, setRescheduleRow] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [detailsRow, setDetailsRow] = useState(null);

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
      ongoing: rows.filter((row) => String(row.Status || "").toUpperCase() === "ONGOING").length,
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

  const openReschedule = (row) => {
    setRescheduleRow(row);
    setRescheduleDate(toDateInput(row.InstallationDate));
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

  const saveReschedule = async () => {
    if (!rescheduleRow || !rescheduleDate) return;

    try {
      setSaving(true);
      await API.put(`/installations/${rescheduleRow._id}`, {
        ...rescheduleRow,
        InstallationDate: new Date(rescheduleDate).toISOString()
      });
      setSuccess("Installation date rescheduled.");
      setError("");
      setRescheduleRow(null);
      setRescheduleDate("");
      await loadRows();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to reschedule installation date.");
    } finally {
      setSaving(false);
    }
  };

  const canSetPending = (row) => {
    const currentStatus = String(row.Status || "").toUpperCase();
    if (currentStatus === "ONGOING") return false;
    return userType === "ADMIN" || !["DONE", "CANCEL"].includes(currentStatus);
  };

  const canChangeFromOngoing = (row, nextStatus) => {
    const currentStatus = String(row.Status || "").toUpperCase();
    return currentStatus !== "ONGOING" || ["DONE", "CANCEL"].includes(nextStatus);
  };

  const getStatusLabel = (status) => {
    const value = String(status || "PENDING").toUpperCase();
    if (value === "DONE") return "Done";
    if (value === "CANCEL") return "Cancel";
    if (value === "ONGOING") return "Ongoing";
    return "Pending";
  };

  const getStatusColor = (status) => {
    const value = String(status || "PENDING").toUpperCase();
    if (value === "DONE") return "success";
    if (value === "CANCEL") return "error";
    if (value === "ONGOING") return "info";
    return "warning";
  };

  const formatStatusChangedBy = (row) => {
    const statusUser = row.StatusChangedBy || {};
    const name = statusUser.Name || statusUser.name || "";
    const username = statusUser.Username || statusUser.username || "";
    const displayName = name || username;
    return displayName || "-";
  };

  const renderDetail = (label, value) => (
    <Box
      sx={{
        border: "1px solid #dbe4f0",
        borderRadius: 2,
        p: 1.25,
        backgroundColor: "#f8fafc"
      }}
    >
      <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>
        {label}
      </Typography>
      <Typography sx={{ color: "#0f172a", fontWeight: 700, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
        {value || "-"}
      </Typography>
    </Box>
  );

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Installation"
          subtitle="Create independent installation records, set installation and transfer dates, and track Pending, Ongoing, Done, or Cancel status."
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
                    (String(form.OriginalStatus || "").toUpperCase() === "ONGOING" ||
                      (userType !== "ADMIN" &&
                        ["DONE", "CANCEL"].includes(String(form.OriginalStatus || "").toUpperCase())))
                  }
                >
                  Pending
                </MenuItem>
                <MenuItem
                  value="ONGOING"
                  disabled={form._id && String(form.OriginalStatus || "").toUpperCase() === "ONGOING"}
                >
                  Ongoing
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
              <Tab value="ONGOING" label={`Ongoing (${counts.ongoing})`} />
              <Tab value="CANCEL" label={`Cancel (${counts.cancel})`} />
              <Tab value="DONE" label={`Done (${counts.done})`} />
            </Tabs>

            <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
              {displayedRows.length === 0 ? (
                <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                  No installation records found.
                </Typography>
              ) : (
                displayedRows.map((row) => (
                  <Paper
                    key={row._id}
                    onClick={() => {
                      if (userType === "TECHNICIAN") setDetailsRow(row);
                    }}
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      border: "1px solid #dbe4f0",
                      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
                      cursor: userType === "TECHNICIAN" ? "pointer" : "default"
                    }}
                  >
                    <Stack spacing={1.1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800, color: "#0f172a", fontSize: "0.9rem", wordBreak: "break-word" }}>
                            {row.CustomerName || "-"}
                          </Typography>
                          <Typography sx={{ color: "#64748b", fontSize: "0.72rem", wordBreak: "break-word" }}>
                            {row.ContactNumber || "-"}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={getStatusLabel(row.Status)}
                          color={getStatusColor(row.Status)}
                          variant="outlined"
                          sx={{ flexShrink: 0, fontWeight: 800 }}
                        />
                      </Stack>

                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                        <Box>
                          <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>PLAN</Typography>
                          <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "0.74rem" }}>
                            {row.Plan || "-"}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>INSTALL DATE</Typography>
                          <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "0.74rem" }}>
                            {formatDate(row.InstallationDate)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>TRANSFER</Typography>
                          <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "0.74rem" }}>
                            {formatDate(row.TransferDate)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>CHANGED BY</Typography>
                          <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "0.74rem" }}>
                            {formatStatusChangedBy(row)}
                          </Typography>
                        </Box>
                      </Box>

                      {row.Note ? (
                        <Typography sx={{ color: "#475569", fontSize: "0.72rem", whiteSpace: "pre-wrap" }}>
                          {row.Note}
                        </Typography>
                      ) : null}

                      <Stack direction="row" spacing={0.25} flexWrap="wrap" useFlexGap onClick={(event) => event.stopPropagation()}>
                        {userType === "TECHNICIAN" ? (
                          <Tooltip title="Resched">
                            <IconButton size="small" color="primary" onClick={() => openReschedule(row)}>
                              <EventRepeatOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Edit">
                            <IconButton size="small" color="primary" onClick={() => editRow(row)}>
                              <EditOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
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
                        <Tooltip title="Set Ongoing">
                          <IconButton
                            size="small"
                            color="info"
                            disabled={
                              saving ||
                              String(row.Status || "").toUpperCase() === "ONGOING" ||
                              !canChangeFromOngoing(row, "ONGOING")
                            }
                            onClick={() => changeStatus(row, "ONGOING")}
                          >
                            <PlayCircleOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Set Done">
                          <IconButton
                            size="small"
                            color="success"
                            disabled={saving || String(row.Status || "").toUpperCase() === "DONE" || !canChangeFromOngoing(row, "DONE")}
                            onClick={() => changeStatus(row, "DONE")}
                          >
                            <CheckCircleOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Set Cancel">
                          <IconButton
                            size="small"
                            color="error"
                            disabled={saving || String(row.Status || "").toUpperCase() === "CANCEL" || !canChangeFromOngoing(row, "CANCEL")}
                            onClick={() => changeStatus(row, "CANCEL")}
                          >
                            <CancelOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Paper>
                ))
              )}
            </Box>

            <TableContainer sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 920 }}>
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
                      <TableRow
                        key={row._id}
                        hover={userType === "TECHNICIAN"}
                        onClick={() => {
                          if (userType === "TECHNICIAN") setDetailsRow(row);
                        }}
                        sx={{ cursor: userType === "TECHNICIAN" ? "pointer" : "default" }}
                      >
                      <TableCell>
                        <Chip
                          size="small"
                          label={getStatusLabel(row.Status)}
                          color={getStatusColor(row.Status)}
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
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Stack direction="row" spacing={0.5}>
                          {userType === "TECHNICIAN" ? (
                            <Tooltip title="Resched">
                              <IconButton size="small" color="primary" onClick={() => openReschedule(row)}>
                                <EventRepeatOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Edit">
                              <IconButton size="small" color="primary" onClick={() => editRow(row)}>
                                <EditOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
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
                          <Tooltip title="Set Ongoing">
                            <IconButton
                              size="small"
                              color="info"
                              disabled={
                                saving ||
                                String(row.Status || "").toUpperCase() === "ONGOING" ||
                                !canChangeFromOngoing(row, "ONGOING")
                              }
                              onClick={() => changeStatus(row, "ONGOING")}
                            >
                              <PlayCircleOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Set Done">
                            <IconButton
                              size="small"
                              color="success"
                              disabled={saving || String(row.Status || "").toUpperCase() === "DONE" || !canChangeFromOngoing(row, "DONE")}
                              onClick={() => changeStatus(row, "DONE")}
                            >
                              <CheckCircleOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Set Cancel">
                            <IconButton
                              size="small"
                              color="error"
                              disabled={saving || String(row.Status || "").toUpperCase() === "CANCEL" || !canChangeFromOngoing(row, "CANCEL")}
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
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={Boolean(rescheduleRow)} onClose={() => setRescheduleRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Resched Installation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>
              {rescheduleRow?.CustomerName || "-"}
            </Typography>
            <TextField
              label="Installation Date"
              type="date"
              value={rescheduleDate}
              onChange={(event) => setRescheduleDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRescheduleRow(null)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveReschedule} disabled={saving || !rescheduleDate}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detailsRow)} onClose={() => setDetailsRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Installation Details</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 1.25,
              pt: 1
            }}
          >
            {renderDetail("Status", getStatusLabel(detailsRow?.Status))}
            {renderDetail("Customer", detailsRow?.CustomerName)}
            {renderDetail("Contact", detailsRow?.ContactNumber)}
            {renderDetail("Plan", detailsRow?.Plan)}
            {renderDetail("Installation Date", formatDate(detailsRow?.InstallationDate))}
            {renderDetail("Transfer Date", formatDate(detailsRow?.TransferDate))}
            {renderDetail("Status Changed By", detailsRow ? formatStatusChangedBy(detailsRow) : "-")}
            {renderDetail("Note", detailsRow?.Note)}
            {renderDetail("Address", detailsRow?.Address)}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
