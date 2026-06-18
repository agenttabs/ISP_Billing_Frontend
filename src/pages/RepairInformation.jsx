import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import API from "../api/api";
import { useAuth } from "../context/auth.context";
import PageHeader from "../layout/PageHeader";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PH");
};

const getMongoId = (row) => {
  if (!row?._id) return "";
  if (typeof row._id === "string") return row._id;
  if (row._id.$oid) return row._id.$oid;
  return String(row._id);
};

export default function RepairInformation() {
  const { user } = useAuth();
  const userType = String(user?.type || "").toUpperCase();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const showActionColumn = userType !== "ADMIN" || statusFilter !== "DONE";
  const groupedRows = useMemo(() => {
    const groups = new Map();

    rows.forEach((row) => {
      const dateKey = row.repairGroupId
        ? row.repairGroupId
        : [
            row.clientId || "",
            row.accountName || "",
            row.repairDetails || row.repairText || "",
            row.createdBy?.username || "",
            row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 16) : ""
          ].join("|");

      const existing = groups.get(dateKey);
      if (!existing) {
        groups.set(dateKey, {
          ...row,
          repairIds: [getMongoId(row)],
          technicianNames: [row.technicianName].filter(Boolean),
          smsSentCount: row.smsSent ? 1 : 0,
          smsTotalCount: 1,
          hasPending: String(row.status || "").toUpperCase() !== "DONE"
        });
        return;
      }

      existing.repairIds.push(getMongoId(row));
      if (row.technicianName && !existing.technicianNames.includes(row.technicianName)) {
        existing.technicianNames.push(row.technicianName);
      }
      existing.smsSentCount += row.smsSent ? 1 : 0;
      existing.smsTotalCount += 1;
      existing.hasPending = existing.hasPending || String(row.status || "").toUpperCase() !== "DONE";
      existing.status = existing.hasPending ? "PENDING" : "DONE";
    });

    return Array.from(groups.values());
  }, [rows]);

  const loadRepairs = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/repairs", {
        params: {
          search,
          status: userType === "ADMIN" ? statusFilter : "PENDING"
        }
      });
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load repair records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepairs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, userType]);

  const markDone = async (row) => {
    const repairId = getMongoId(row);
    if (!repairId || repairId === "[object Object]") {
      setError("Cannot update repair status because the repair id is invalid.");
      return;
    }

    try {
      setSaving(true);
      await API.put(`/repairs/${repairId}/status`, { status: "DONE" });
      setSuccess("Repair status changed to Done.");
      setError("");
      await loadRepairs();
    } catch (err) {
      setSuccess("");
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to update repair status."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Repair Information"
          subtitle="View repair requests sent from the client repair SMS action."
        />

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadRepairs();
                }}
                fullWidth
              />
              <Button variant="outlined" onClick={loadRepairs} disabled={loading} sx={{ minWidth: 120 }}>
                {loading ? "Loading..." : "Search"}
              </Button>
            </Stack>

            {userType === "ADMIN" ? (
              <Tabs
                value={statusFilter}
                onChange={(event, value) => setStatusFilter(value)}
                sx={{ mb: 2, borderBottom: "1px solid #dbe4f0" }}
              >
                <Tab value="PENDING" label="Pending" />
                <Tab value="DONE" label="Done" />
              </Tabs>
            ) : null}

            <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
              {groupedRows.length === 0 ? (
                <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                  No repair records found.
                </Typography>
              ) : (
                groupedRows.map((row) => (
                  <Paper
                    key={row.repairGroupId || row.repairIds?.join("-") || getMongoId(row)}
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      border: "1px solid #dbe4f0",
                      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)"
                    }}
                  >
                    <Stack spacing={1.1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800, color: "#0f172a", fontSize: "0.9rem", wordBreak: "break-word" }}>
                            {row.clientName || "-"}
                          </Typography>
                          <Typography sx={{ color: "#64748b", fontSize: "0.72rem", wordBreak: "break-word" }}>
                            {row.accountName || "-"}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={row.hasPending ? "PENDING" : "DONE"}
                          color={row.hasPending ? "warning" : "success"}
                          variant="outlined"
                          sx={{ flexShrink: 0, fontWeight: 800 }}
                        />
                      </Stack>

                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                        <Box>
                          <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>DATE</Typography>
                          <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "0.74rem" }}>
                            {formatDate(row.createdAt)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>CONTACT</Typography>
                          <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "0.74rem" }}>
                            {row.contactNumber || "-"}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>TECHNICIAN</Typography>
                          <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "0.74rem", wordBreak: "break-word" }}>
                            {row.technicianNames?.join(", ") || row.technicianName || "-"}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>SMS</Typography>
                          <Chip
                            size="small"
                            label={`${row.smsSentCount || 0}/${row.smsTotalCount || 1} Sent`}
                            color={(row.smsSentCount || 0) > 0 ? "success" : "error"}
                            variant="outlined"
                          />
                        </Box>
                      </Box>

                      <Typography sx={{ color: "#475569", fontSize: "0.72rem", whiteSpace: "pre-wrap" }}>
                        {row.repairDetails || row.repairText || "-"}
                      </Typography>

                      {showActionColumn && row.hasPending ? (
                        <Stack direction="row" justifyContent="flex-end">
                          <IconButton
                            size="small"
                            color="success"
                            disabled={saving}
                            onClick={() => markDone(row)}
                          >
                            <CheckCircleOutline fontSize="small" />
                          </IconButton>
                        </Stack>
                      ) : null}
                    </Stack>
                  </Paper>
                ))
              )}
            </Box>

            <TableContainer sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 920 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Account</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Contact</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Technician</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Details</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>SMS</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                    {showActionColumn ? <TableCell sx={{ fontWeight: 800 }}>Action</TableCell> : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showActionColumn ? 9 : 8} align="center">
                        No repair records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedRows.map((row) => (
                      <TableRow key={row.repairGroupId || row.repairIds?.join("-") || getMongoId(row)}>
                      <TableCell>{formatDate(row.createdAt)}</TableCell>
                      <TableCell>{row.clientName || "-"}</TableCell>
                      <TableCell>{row.accountName || "-"}</TableCell>
                      <TableCell>{row.contactNumber || "-"}</TableCell>
                      <TableCell>{row.technicianNames?.join(", ") || row.technicianName || "-"}</TableCell>
                      <TableCell sx={{ maxWidth: 420 }}>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                          {row.repairDetails || row.repairText || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={`${row.smsSentCount || 0}/${row.smsTotalCount || 1} Sent`}
                          color={(row.smsSentCount || 0) > 0 ? "success" : "error"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.hasPending ? "PENDING" : "DONE"}
                          color={row.hasPending ? "warning" : "success"}
                          variant="outlined"
                        />
                      </TableCell>
                      {showActionColumn ? (
                        <TableCell>
                          {!row.hasPending ? (
                            "-"
                          ) : (
                            <IconButton
                              size="small"
                              color="success"
                              disabled={saving}
                              onClick={() => markDone(row)}
                            >
                              <CheckCircleOutline fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      ) : null}
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
