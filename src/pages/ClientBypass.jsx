import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
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
  Typography,
  Tooltip
} from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultForm = {
  clientId: "",
  notes: ""
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.clients)) return value.clients;
  return [];
};

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

export default function ClientBypass() {
  const [bypassRows, setBypassRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const bypassedAccountKeys = useMemo(
    () =>
      new Set(
        (bypassRows || []).map((row) =>
          String(row.AccountNameKey || row.AccountName || "")
            .trim()
            .toUpperCase()
        )
      ),
    [bypassRows]
  );

  const bypassEligibleClients = useMemo(
    () =>
      (clients || [])
        .filter(
          (client) =>
            ["IPOE", "PPPOE"].includes(
              String(client.AuthenticationMode || "").trim().toUpperCase()
            ) &&
            !bypassedAccountKeys.has(
              String(client.AccountName || "")
                .trim()
                .toUpperCase()
            )
        )
        .sort((a, b) =>
          String(a.AccountName || "").localeCompare(String(b.AccountName || ""))
        ),
    [clients, bypassedAccountKeys]
  );

  const loadPageData = async () => {
    try {
      const [{ data: bypassData }, { data: clientData }] = await Promise.all([
        API.get("/client-bypass"),
        API.get("/client-bypass/clients")
      ]);

      setBypassRows(toArray(bypassData));
      setClients(toArray(clientData));
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load client bypass module.");
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      const { data } = await API.post("/client-bypass", form);
      setBypassRows((prev) => [data, ...prev]);
      setForm(defaultForm);
      setError("");
      setSuccess("Client bypass added successfully.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save client bypass.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row) => {
    try {
      await API.delete(`/client-bypass/${row._id}`);
      setBypassRows((prev) => prev.filter((item) => item._id !== row._id));
      setError("");
      setSuccess("Client bypass removed successfully.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to remove client bypass.");
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Client Bypass"
          subtitle="Add VIP client accounts here as bypass records."
        />

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Autocomplete
                  options={bypassEligibleClients}
                  value={
                    bypassEligibleClients.find(
                      (client) => String(client._id) === String(form.clientId)
                    ) || null
                  }
                  onChange={(_event, value) =>
                    setForm((prev) => ({
                      ...prev,
                      clientId: value?._id || ""
                    }))
                  }
                  fullWidth
                  autoHighlight
                  getOptionLabel={(option) =>
                    `${option.AccountName || ""} - ${option.ClientName || "No Client Name"}`
                  }
                  isOptionEqualToValue={(option, value) =>
                    String(option._id) === String(value._id)
                  }
                  filterOptions={(options, state) => {
                    const keyword = String(state.inputValue || "")
                      .trim()
                      .toLowerCase();

                    if (!keyword) {
                      return options;
                    }

                    return options.filter((option) =>
                      [
                        option.AccountName,
                        option.ClientName,
                        option.AccountNumber
                      ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase()
                        .includes(keyword)
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Client Account"
                      required
                      helperText="Type account name or client name to search."
                    />
                  )}
                />

                <TextField
                  label="Notes"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<ShieldOutlinedIcon />}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Add Client Bypass"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              VIP Client Bypass List
            </Typography>

            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Account Name</TableCell>
                  <TableCell>Client Name</TableCell>
                  <TableCell>MAC Address</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Added By</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell width={80}>Delete</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bypassRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No client bypass records yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  bypassRows.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell>{row.AccountName || "-"}</TableCell>
                      <TableCell>{row.ClientName || "-"}</TableCell>
                      <TableCell>{row.MacAddress || "-"}</TableCell>
                      <TableCell>{row.Notes || "-"}</TableCell>
                      <TableCell>{row.CreatedBy || row.CreatedById || "-"}</TableCell>
                      <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                      <TableCell>
                        <Tooltip title="Remove Bypass">
                          <IconButton color="error" onClick={() => handleDelete(row)}>
                            <DeleteOutlineOutlinedIcon />
                          </IconButton>
                        </Tooltip>
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
