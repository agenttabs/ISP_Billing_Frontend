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
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FmdGoodOutlinedIcon from "@mui/icons-material/FmdGoodOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultForm = {
  Name: "",
  NapCode: "",
  FiberLine: "",
  Address: "",
  Latitude: "",
  Longitude: "",
  Status: "ACTIVE",
  Notes: ""
};

const cleanCoordinate = (value) =>
  String(value ?? "")
    .replace(/[^0-9.\-]/g, "")
    .trim();

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
};

export default function NapLocation() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const hasCoordinates =
    form.Latitude !== "" &&
    form.Longitude !== "" &&
    Number.isFinite(Number(form.Latitude)) &&
    Number.isFinite(Number(form.Longitude));
  const encodedAddress = encodeURIComponent(String(form.Address || "").trim());
  const mapEmbedUrl = hasCoordinates
    ? `https://maps.google.com/maps?q=${encodeURIComponent(`${form.Latitude},${form.Longitude}`)}&z=17&output=embed`
    : form.Address
      ? `https://maps.google.com/maps?q=${encodedAddress}&z=15&output=embed`
      : "";
  const mapOpenUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.Latitude},${form.Longitude}`)}`
    : form.Address
      ? `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
      : "";

  const filteredRows = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();

    if (!keyword) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.Name,
        row.NapCode,
        row.FiberLine,
        row.Address,
        row.Status,
        row.Notes
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [rows, search]);

  const loadNapList = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/nap");
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load NAP locations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNapList();
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
        Latitude: cleanCoordinate(form.Latitude),
        Longitude: cleanCoordinate(form.Longitude)
      };

      if (editingId) {
        await API.put(`/nap/${editingId}`, payload);
        setSuccess("NAP location updated successfully.");
      } else {
        await API.post("/nap", payload);
        setSuccess("NAP location saved successfully.");
      }

      resetForm();
      await loadNapList();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save NAP location.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (row) => {
    setEditingId(String(row._id || ""));
    setForm({
      Name: row.Name || "",
      NapCode: row.NapCode || "",
      FiberLine: row.FiberLine || "",
      Address: row.Address || "",
      Latitude: row.Latitude || "",
      Longitude: row.Longitude || "",
      Status: row.Status || "ACTIVE",
      Notes: row.Notes || ""
    });
    setError("");
    setSuccess("");
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await API.delete(`/nap/${id}`);
      if (editingId === String(id)) {
        resetForm();
      }
      setSuccess("NAP location deleted successfully.");
      await loadNapList();
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to delete NAP location.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="NAP"
          subtitle="Maintain the NAP fiber line locations with address and saved map coordinates."
          action={
            <Button
              variant="outlined"
              startIcon={<FmdGoodOutlinedIcon />}
              onClick={loadNapList}
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
                  label="NAP Name"
                  value={form.Name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Name: event.target.value }))
                  }
                  fullWidth
                  required
                />
                <TextField
                  label="NAP Code"
                  value={form.NapCode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, NapCode: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Fiber Line"
                  value={form.FiberLine}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, FiberLine: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Address"
                  value={form.Address}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Address: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Status"
                  value={form.Status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Status: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Latitude"
                  value={form.Latitude}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      Latitude: cleanCoordinate(event.target.value)
                    }))
                  }
                  fullWidth
                  placeholder="Example: 7.0731"
                />
                <TextField
                  label="Longitude"
                  value={form.Longitude}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      Longitude: cleanCoordinate(event.target.value)
                    }))
                  }
                  fullWidth
                  placeholder="Example: 125.6128"
                />
              </Stack>

              {mapEmbedUrl ? (
                <Box
                  sx={{
                    border: "1px solid #dbe4ee",
                    borderRadius: 2.5,
                    overflow: "hidden",
                    backgroundColor: "#fff"
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1.25,
                      display: "flex",
                      alignItems: { xs: "flex-start", md: "center" },
                      justifyContent: "space-between",
                      gap: 1.5,
                      flexDirection: { xs: "column", md: "row" },
                      borderBottom: "1px solid #e2e8f0"
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                        NAP Map
                      </Typography>
                      <Typography sx={{ fontSize: "0.82rem", color: "#64748b" }}>
                        Preview based on saved coordinates or address.
                      </Typography>
                    </Box>
                    <Button
                      component="a"
                      href={mapOpenUrl}
                      target="_blank"
                      rel="noreferrer"
                      size="small"
                      variant="outlined"
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Open in Google Maps
                    </Button>
                  </Box>

                  <Box sx={{ height: 240, backgroundColor: "#f8fafc" }}>
                    <Box
                      component="iframe"
                      title="NAP location map"
                      src={mapEmbedUrl}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      sx={{
                        width: "100%",
                        height: "100%",
                        border: 0
                      }}
                    />
                  </Box>
                </Box>
              ) : null}

              <TextField
                label="Notes"
                value={form.Notes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, Notes: event.target.value }))
                }
                fullWidth
                multiline
                rows={2}
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {editingId ? "Update NAP" : "Save NAP"}
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
                NAP Fiber Line Locations
              </Typography>
              <TextField
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="NAP, code, fiber line"
                sx={{ minWidth: { xs: "100%", md: 260 } }}
              />
            </Stack>

            <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
              {!filteredRows.length ? (
                <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                  No NAP location records found.
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
                              {row.NapCode || "-"} | {row.FiberLine || "-"}
                            </Typography>
                          </Box>
                          <Typography sx={{ color: "#64748b", fontSize: "0.72rem", fontWeight: 800 }}>
                            {row.Status || "-"}
                          </Typography>
                        </Stack>
                        <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                          {row.Address || "-"}
                        </Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>COORDINATES</Typography>
                            <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>
                              {row.Latitude && row.Longitude ? `${row.Latitude}, ${row.Longitude}` : "-"}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>CREATED</Typography>
                            <Typography sx={{ fontWeight: 800 }}>{formatDateTime(row.createdAt)}</Typography>
                          </Box>
                        </Box>
                        <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                          <IconButton color="primary" onClick={() => handleEdit(row)}>
                            <EditOutlinedIcon />
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
                  <TableCell sx={{ fontWeight: 700 }}>NAP Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>NAP Code</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Fiber Line</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Coordinates</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created At</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!filteredRows.length ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No NAP location records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={String(row._id)}>
                      <TableCell>{row.Name || "-"}</TableCell>
                      <TableCell>{row.NapCode || "-"}</TableCell>
                      <TableCell>{row.FiberLine || "-"}</TableCell>
                      <TableCell>{row.Address || "-"}</TableCell>
                      <TableCell>
                        {row.Latitude && row.Longitude
                          ? `${row.Latitude}, ${row.Longitude}`
                          : "-"}
                      </TableCell>
                      <TableCell>{row.Status || "-"}</TableCell>
                      <TableCell>{formatDateTime(row.createdAt)}</TableCell>
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
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
