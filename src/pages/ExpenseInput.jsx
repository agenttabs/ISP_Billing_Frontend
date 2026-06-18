import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import API from "../api/api";
import { useAuth } from "../context/auth.context";
import PageHeader from "../layout/PageHeader";

const padDatePart = (value) => String(value).padStart(2, "0");

const getTodayInputDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(now.getDate())}`;
};

const normalizeLogDateKey = (value) => {
  if (!value) return "";

  const text = String(value).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${Number(year)}/${Number(month)}/${Number(day)}`;
  }

  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)) {
    const [year, month, day] = text.split("/");
    return `${Number(year)}/${Number(month)}/${Number(day)}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}/${parsed.getMonth() + 1}/${parsed.getDate()}`;
  }

  return text;
};

const getTodayLogDateKey = () => normalizeLogDateKey(getTodayInputDate());

const normalizeOwnerToken = (value) => String(value || "").trim().toLowerCase();

const getUserOwnerTokens = (user) =>
  [
    user?.id,
    user?._id,
    user?.ID,
    user?.username,
    user?.Username,
    user?.name,
    user?.Name
  ]
    .map(normalizeOwnerToken)
    .filter(Boolean);

const isRowOwnedByUser = (row, user) => {
  const userTokens = getUserOwnerTokens(user);
  const rowTokens = [
    row?.InChargeId,
    row?.InCharge,
    row?.CreatedById,
    row?.CreatedBy
  ]
    .map(normalizeOwnerToken)
    .filter(Boolean);

  return rowTokens.some((token) => userTokens.includes(token));
};

const defaultForm = {
  Name: "",
  Type: "Financial Expenses",
  Amount: "",
  Invoice: "",
  LogDate: getTodayInputDate(),
  Docs: "",
  TechnicianId: "",
  TechnicianName: ""
};

const expenseTypes = [
  "Financial expenses",
  "Cash Advance",
  "Materials",
  "Family Expense"
];

const formatDisplayAmount = (value) => {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  if (!Number.isFinite(parsed)) {
    return value || "-";
  }

  return `PHP ${parsed.toLocaleString()}`;
};

const normalizeDateForInput = (value) => {
  if (!value) return getTodayInputDate();

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return String(value);
  }

  const parts = String(value).split("/");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return getTodayInputDate();
};

export default function ExpenseInput() {
  const { user } = useAuth();
  const userType = String(user?.type || "").toUpperCase();
  const isCashier = userType === "CASHIER";
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/expenses");
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data } = await API.get("/auth/technicians");
      setTechnicians(Array.isArray(data) ? data : []);
    } catch (_err) {
      setTechnicians([]);
    }
  };

  useEffect(() => {
    loadExpenses();
    loadTechnicians();
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();
    const scopedRows = isCashier
      ? rows.filter(
          (row) =>
            normalizeLogDateKey(row.LogDate) === getTodayLogDateKey() &&
            isRowOwnedByUser(row, user)
        )
      : rows;

    if (!keyword) {
      return scopedRows;
    }

    return scopedRows.filter((row) =>
      [
        row.Name,
        row.Type,
        row.Invoice,
        row.LogDate,
        row.CreatedBy,
        row.InCharge,
        row.Amount,
        row.TechnicianName
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [isCashier, rows, search, user]);

  const canEditRow = (row) =>
    !isCashier ||
    (normalizeLogDateKey(row.LogDate) === getTodayLogDateKey() &&
      isRowOwnedByUser(row, user));

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const payload = {
        ...form,
        LogDate: isCashier ? getTodayInputDate() : form.LogDate
      };

      if (String(payload.Type || "").trim().toUpperCase() !== "CASH ADVANCE") {
        payload.TechnicianId = "";
        payload.TechnicianName = "";
      }

      if (editingId) {
        await API.put(`/expenses/${editingId}`, payload);
        setSuccess("Expense updated successfully.");
      } else {
        await API.post("/expenses", payload);
        setSuccess("Expense saved successfully.");
      }

      resetForm();
      await loadExpenses();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save expense.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (row) => {
    setEditingId(String(row._id || ""));
    setForm({
      Name: row.Name || "",
      Type: row.Type || "Financial Expenses",
      Amount: row.Amount || "",
      Invoice: row.Invoice || "",
      LogDate: normalizeDateForInput(row.LogDate),
      Docs: row.Docs || "",
      TechnicianId: row.TechnicianId || "",
      TechnicianName: row.TechnicianName || ""
    });
    setError("");
    setSuccess("");
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await API.delete(`/expenses/${id}`);
      if (editingId === String(id)) {
        resetForm();
      }
      setSuccess("Expense deleted successfully.");
      await loadExpenses();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to delete expense.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Expense"
          subtitle={
            isCashier
              ? "Cashier can only view and save today's own expense records."
              : "Save operational and financial expense records."
          }
          action={
            <Button
              variant="outlined"
              startIcon={<ReceiptLongOutlinedIcon />}
              onClick={loadExpenses}
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
                  label="Name"
                  value={form.Name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Name: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  select
                  label="Type"
                  value={form.Type}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      Type: event.target.value,
                      ...(String(event.target.value || "").trim().toUpperCase() === "CASH ADVANCE"
                        ? {}
                        : { TechnicianId: "", TechnicianName: "" })
                    }))
                  }
                  fullWidth
                  required
                >
                  {expenseTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              {String(form.Type || "").trim().toUpperCase() === "CASH ADVANCE" ? (
                <TextField
                  select
                  label="Technician"
                  value={form.TechnicianId}
                  onChange={(event) => {
                    const selected = technicians.find(
                      (technician) =>
                        String(technician.ID || "") === String(event.target.value)
                    );
                    setForm((prev) => ({
                      ...prev,
                      TechnicianId: String(selected?.ID || ""),
                      TechnicianName: selected?.Name || ""
                    }));
                  }}
                  fullWidth
                  required
                  helperText="This amount will be deducted from the technician payroll cutoff."
                >
                  {technicians.map((technician) => (
                    <MenuItem key={technician.ID} value={technician.ID}>
                      {technician.Name || technician.Username}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Amount"
                  value={form.Amount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Amount: event.target.value }))
                  }
                  fullWidth
                  required
                />
                <TextField
                  label="Invoice"
                  value={form.Invoice}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Invoice: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Log Date"
                  type="date"
                  value={isCashier ? getTodayInputDate() : form.LogDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, LogDate: event.target.value }))
                  }
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                  disabled={isCashier}
                  helperText={isCashier ? "Cashier date is locked to today." : " "}
                />
              </Stack>

              <TextField
                label="Docs"
                value={form.Docs}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, Docs: event.target.value }))
                }
                fullWidth
                multiline
                rows={2}
                helperText="You can store file names, remarks, or placeholders like in the sample record."
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {editingId ? "Update Expense" : "Save Expense"}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={resetForm}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Clear
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
                Expense Records
              </Typography>
              <TextField
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, invoice, in-charge"
                sx={{ minWidth: { xs: "100%", md: 260 } }}
              />
            </Stack>

            <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
              {!filteredRows.length ? (
                <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                  No expense records found.
                </Typography>
              ) : (
                filteredRows.map((row) => (
                  <Card
                    key={String(row._id)}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid #dbe4ee",
                      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)"
                    }}
                  >
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800, color: "#0f172a", wordBreak: "break-word" }}>
                              {row.Name || "-"}
                            </Typography>
                            <Typography sx={{ color: "#64748b", fontSize: "0.72rem", wordBreak: "break-word" }}>
                              {row.Type || "-"}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontWeight: 900, color: "#0f172a", flexShrink: 0 }}>
                            {formatDisplayAmount(row.Amount)}
                          </Typography>
                        </Stack>

                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>
                              LOG DATE
                            </Typography>
                            <Typography sx={{ fontWeight: 800 }}>{row.LogDate || "-"}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>
                              INVOICE
                            </Typography>
                            <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>{row.Invoice || "-"}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>
                              DOCS
                            </Typography>
                            <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>{row.Docs || "-"}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>
                              TECHNICIAN
                            </Typography>
                            <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>{row.TechnicianName || "-"}</Typography>
                          </Box>
                        </Box>

                        <Typography sx={{ color: "#64748b", fontSize: "0.72rem", wordBreak: "break-word" }}>
                          Created by: {row.CreatedBy || row.InCharge || "-"}
                        </Typography>

                        <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                          {canEditRow(row) ? (
                            <IconButton color="primary" onClick={() => handleEdit(row)}>
                              <EditOutlinedIcon />
                            </IconButton>
                          ) : null}
                          {!isCashier ? (
                            <IconButton color="error" onClick={() => handleDelete(row._id)}>
                              <DeleteOutlineIcon />
                            </IconButton>
                          ) : null}
                          {!canEditRow(row) && isCashier ? (
                            <Typography sx={{ color: "#64748b", fontWeight: 700, alignSelf: "center" }}>
                              No action
                            </Typography>
                          ) : null}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>

            <TableContainer sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Log Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Invoice</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Docs</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Technician</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created By</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!filteredRows.length ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No expense records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={String(row._id)}>
                      <TableCell>{row.LogDate || "-"}</TableCell>
                      <TableCell>{row.Invoice || "-"}</TableCell>
                      <TableCell>{row.Name || "-"}</TableCell>
                      <TableCell>{row.Type || "-"}</TableCell>
                      <TableCell>{formatDisplayAmount(row.Amount)}</TableCell>
                      <TableCell>{row.Docs || "-"}</TableCell>
                      <TableCell>{row.TechnicianName || "-"}</TableCell>
                      <TableCell>{row.CreatedBy || row.InCharge || "-"}</TableCell>
                      <TableCell align="center">
                        {canEditRow(row) ? (
                          <IconButton color="primary" onClick={() => handleEdit(row)}>
                            <EditOutlinedIcon />
                          </IconButton>
                        ) : null}
                        {!isCashier ? (
                          <IconButton color="error" onClick={() => handleDelete(row._id)}>
                            <DeleteOutlineIcon />
                          </IconButton>
                        ) : null}
                        {!canEditRow(row) && isCashier ? "-" : null}
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
    </Box>
  );
}
