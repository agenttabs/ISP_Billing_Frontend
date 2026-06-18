import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import WifiTetheringOutlinedIcon from "@mui/icons-material/WifiTetheringOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultForm = {
  Name: "",
  ServerType: "AC",
  Address: "",
  User: "",
  Password: "",
  Port: "8728",
  Notes: "",
  IsDefault: true
};

export default function MikrotikConnection() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) =>
      [row.Name, row.Address, row.User, row.ServerType, row.Port, row.Notes]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [rows, search]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/mikrotik-connections");
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load MikroTik connections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
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
        Port: Number(form.Port || 8728)
      };

      if (editingId) {
        await API.put(`/mikrotik-connections/${editingId}`, payload);
        setSuccess("MikroTik connection updated successfully.");
      } else {
        await API.post("/mikrotik-connections", payload);
        setSuccess("MikroTik connection saved successfully.");
      }

      resetForm();
      await loadConnections();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save MikroTik connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (row) => {
    setEditingId(String(row._id || ""));
    setForm({
      Name: row.Name || "",
      ServerType: row.ServerType || "AC",
      Address: row.Address || "",
      User: row.User || "",
      Password: "",
      Port: String(row.Port || 8728),
      Notes: row.Notes || "",
      IsDefault: Boolean(row.IsDefault)
    });
    setError("");
    setSuccess("");
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await API.delete(`/mikrotik-connections/${id}`);
      if (editingId === String(id)) {
        resetForm();
      }
      setSuccess("MikroTik connection deleted successfully.");
      await loadConnections();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to delete MikroTik connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (id = "") => {
    try {
      setTesting(true);
      setError("");
      setSuccess("");

      const payload = {
        ...form,
        Port: Number(form.Port || 8728)
      };

      const { data } = id
        ? await API.post(`/mikrotik-connections/${id}/test`)
        : await API.post("/mikrotik-connections/test", payload);

      setSuccess(
        `Connected successfully${data?.identityName ? ` to ${data.identityName}` : ""} at ${data?.host || form.Address}:${data?.port || form.Port}.`
      );
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to connect to MikroTik.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Mikrotik Connection"
          subtitle="Maintain the shared MikroTik AC connection from the existing Servers collection. All MikroTik calls use this saved source."
          action={
            <Button
              variant="outlined"
              startIcon={<RouterOutlinedIcon />}
              onClick={loadConnections}
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
                  label="Connection Name"
                  value={form.Name}
                  onChange={(event) => setForm((prev) => ({ ...prev, Name: event.target.value }))}
                  fullWidth
                  required
                />
                <TextField
                  select
                  label="Server Type"
                  value={form.ServerType}
                  onChange={(event) => setForm((prev) => ({ ...prev, ServerType: event.target.value }))}
                  fullWidth
                >
                  <MenuItem value="AC">AC</MenuItem>
                </TextField>
                <TextField
                  label="Port"
                  value={form.Port}
                  onChange={(event) => setForm((prev) => ({ ...prev, Port: event.target.value }))}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Address / IP"
                  value={form.Address}
                  onChange={(event) => setForm((prev) => ({ ...prev, Address: event.target.value }))}
                  fullWidth
                  required
                />
                <TextField
                  label="Username"
                  value={form.User}
                  onChange={(event) => setForm((prev) => ({ ...prev, User: event.target.value }))}
                  fullWidth
                  required
                />
                <TextField
                  label={editingId ? "Password (leave blank to keep current)" : "Password"}
                  type="password"
                  value={form.Password}
                  onChange={(event) => setForm((prev) => ({ ...prev, Password: event.target.value }))}
                  fullWidth
                  required={!editingId}
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Notes"
                  value={form.Notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, Notes: event.target.value }))}
                  fullWidth
                />
                <TextField
                  select
                  label="Default Connection"
                  value={form.IsDefault ? "YES" : "NO"}
                  onChange={(event) => setForm((prev) => ({ ...prev, IsDefault: event.target.value === "YES" }))}
                  fullWidth
                >
                  <MenuItem value="YES">YES</MenuItem>
                  <MenuItem value="NO">NO</MenuItem>
                </TextField>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {editingId ? "Update Connection" : "Save Connection"}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  startIcon={<WifiTetheringOutlinedIcon />}
                  onClick={() => handleTest("")}
                  disabled={testing}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {testing ? "Testing..." : "Test Connection"}
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
                Existing MikroTik Connections
              </Typography>
              <TextField
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, address, username"
                sx={{ minWidth: { xs: "100%", md: 260 } }}
              />
            </Stack>

            <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
              {!filteredRows.length ? (
                <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                  No MikroTik connection records found.
                </Typography>
              ) : (
                filteredRows.map((row) => (
                  <Card key={String(row._id)} sx={{ borderRadius: 3, border: "1px solid #dbe4ee" }}>
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>{row.Name || "-"}</Typography>
                            <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                              {row.Address || "-"}:{row.Port || 8728}
                            </Typography>
                          </Box>
                          {row.IsDefault ? <Chip label="DEFAULT" size="small" color="success" sx={{ fontWeight: 700 }} /> : null}
                        </Stack>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>TYPE</Typography>
                            <Typography sx={{ fontWeight: 800 }}>{row.ServerType || "-"}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>USER</Typography>
                            <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>{row.User || "-"}</Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                          Notes: {row.Notes || "-"}
                        </Typography>
                        <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                          <IconButton color="primary" onClick={() => handleEdit(row)}>
                            <EditOutlinedIcon />
                          </IconButton>
                          <IconButton color="info" onClick={() => handleTest(row._id)}>
                            <WifiTetheringOutlinedIcon />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDelete(row._id)}>
                            <DeleteOutlineIcon />
                          </IconButton>
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
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Port</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Default</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!filteredRows.length ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No MikroTik connection records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={String(row._id)}>
                      <TableCell>{row.Name || "-"}</TableCell>
                      <TableCell>{row.ServerType || "-"}</TableCell>
                      <TableCell>{row.Address || "-"}</TableCell>
                      <TableCell>{row.User || "-"}</TableCell>
                      <TableCell>{row.Port || 8728}</TableCell>
                      <TableCell>
                        {row.IsDefault ? (
                          <Chip label="DEFAULT" size="small" color="success" sx={{ fontWeight: 700 }} />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{row.Notes || "-"}</TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" onClick={() => handleEdit(row)}>
                          <EditOutlinedIcon />
                        </IconButton>
                        <IconButton color="info" onClick={() => handleTest(row._id)}>
                          <WifiTetheringOutlinedIcon />
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
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
