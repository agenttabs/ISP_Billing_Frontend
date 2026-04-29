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
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultForm = {
  Name: "",
  Speed: "",
  Price: "",
  TYPE: "PPPOE",
  Rx: "",
  Tx: ""
};

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

export default function NetplanMaintenance() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();

    if (!keyword) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.Name,
        row.Speed,
        row.TYPE,
        row.Rx,
        row.Tx,
        row.Price
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [rows, search]);

  const loadNetplans = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/netplans");
      const sortedRows = (Array.isArray(data) ? data : []).sort((a, b) =>
        String(a.Name || "").localeCompare(String(b.Name || ""))
      );
      setRows(sortedRows);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load netplans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNetplans();
  }, []);

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
        Price: Number(String(form.Price || 0).replace(/,/g, ""))
      };

      if (editingId) {
        await API.put(`/netplans/${editingId}`, payload);
        setSuccess("Netplan updated successfully.");
      } else {
        await API.post("/netplans", payload);
        setSuccess("Netplan saved successfully.");
      }

      resetForm();
      await loadNetplans();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save netplan.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (row) => {
    setEditingId(String(row._id || ""));
    setForm({
      Name: row.Name || row.name || "",
      Speed: row.Speed || row.speed || "",
      Price: String(row.Price ?? row.price ?? ""),
      TYPE: row.TYPE || row.Type || row.type || "PPPOE",
      Rx: row.Rx || row.rx || "",
      Tx: row.Tx || row.tx || ""
    });
    setError("");
    setSuccess("");
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await API.delete(`/netplans/${id}`);
      if (editingId === String(id)) {
        resetForm();
      }
      setSuccess("Netplan deleted successfully.");
      await loadNetplans();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to delete netplan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Netplan"
          subtitle="Maintain the NetPlan collection used by client accounts, reconnect plans, and checker modules."
          action={
            <Button
              variant="outlined"
              startIcon={<RouterOutlinedIcon />}
              onClick={loadNetplans}
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
                  label="Speed"
                  value={form.Speed}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Speed: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Price"
                  value={form.Price}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Price: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  select
                  label="Type"
                  value={form.TYPE}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, TYPE: event.target.value }))
                  }
                  fullWidth
                >
                  <MenuItem value="PPPOE">PPPOE</MenuItem>
                  <MenuItem value="IPOE">IPOE</MenuItem>
                </TextField>
                <TextField
                  label="Rx"
                  value={form.Rx}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Rx: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Tx"
                  value={form.Tx}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Tx: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {editingId ? "Update Netplan" : "Save Netplan"}
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
                Netplan Records
              </Typography>
              <TextField
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Plan name, speed, type"
                sx={{ minWidth: { xs: "100%", md: 260 } }}
              />
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Speed</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Price</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Rx</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tx</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!filteredRows.length ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No netplan records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={String(row._id)}>
                      <TableCell>{row.Name || row.name || "-"}</TableCell>
                      <TableCell>{row.Speed || row.speed || "-"}</TableCell>
                      <TableCell>{formatMoney(row.Price || row.price || 0)}</TableCell>
                      <TableCell>{row.TYPE || row.Type || row.type || "-"}</TableCell>
                      <TableCell>{row.Rx || row.rx || "-"}</TableCell>
                      <TableCell>{row.Tx || row.tx || "-"}</TableCell>
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
