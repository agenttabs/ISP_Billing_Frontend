import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
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
import PageHeader from "../layout/PageHeader";

const getTodayInputDate = () => new Date().toISOString().split("T")[0];

const defaultForm = {
  Name: "",
  Type: "Financial Expenses",
  Amount: "",
  Invoice: "",
  LogDate: getTodayInputDate(),
  Docs: ""
};

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
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    loadExpenses();
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();

    if (!keyword) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.Name,
        row.Type,
        row.Invoice,
        row.LogDate,
        row.InCharge,
        row.Amount
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [rows, search]);

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

      if (editingId) {
        await API.put(`/expenses/${editingId}`, form);
        setSuccess("Expense updated successfully.");
      } else {
        await API.post("/expenses", form);
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
      Docs: row.Docs || ""
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
          title="Expenses Input"
          subtitle="Save operational and financial expense records into the Expenses collection."
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
                  required
                />
                <TextField
                  label="Type"
                  value={form.Type}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Type: event.target.value }))
                  }
                  fullWidth
                  required
                />
              </Stack>

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
                  required
                />
                <TextField
                  label="Log Date"
                  type="date"
                  value={form.LogDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, LogDate: event.target.value }))
                  }
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
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
                  {editingId ? "Update Expenses" : "Save Expenses"}
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
                Expenses Records
              </Typography>
              <TextField
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, invoice, in-charge"
                sx={{ minWidth: { xs: "100%", md: 260 } }}
              />
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Log Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Invoice</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Docs</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>In Charge</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!filteredRows.length ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
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
                      <TableCell>{row.InCharge || "-"}</TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" onClick={() => handleEdit(row)}>
                          <EditOutlinedIcon />
                        </IconButton>
                        <IconButton color="error" onClick={() => handleDelete(row._id)}>
                          <DeleteOutlineIcon />
                        </IconButton>
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
