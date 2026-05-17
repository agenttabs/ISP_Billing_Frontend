import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
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
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const WEEK_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
];

const dayLabels = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun"
};

const normalizeScheduleDays = (value) => {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim());

  return [...new Set(source.map((item) => String(item || "").trim().toUpperCase()))]
    .filter((day) => WEEK_DAYS.includes(day));
};

const formatScheduleDays = (value) => {
  const days = normalizeScheduleDays(value);
  if (!days.length) {
    return "No days assigned";
  }
  if (days.length === WEEK_DAYS.length) {
    return "Every day";
  }
  return days.map((day) => dayLabels[day] || day).join(", ");
};

const getUserScheduleDays = (user) => {
  const days = normalizeScheduleDays(user?.ScheduleDays ?? user?.scheduleDays);
  if (!days.length && String(user?.Type || "").toUpperCase() === "CASHIER") {
    return [...WEEK_DAYS];
  }
  return days;
};

const defaultForm = {
  name: "",
  username: "",
  password: "",
  type: "CASHIER",
  status: "ACTIVE",
  email: "",
  contact: "",
  salary: "",
  restriction: "Default",
  scheduleDays: [...WEEK_DAYS]
};

export default function UserAccounts() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    try {
      const { data } = await API.get("/auth/users");
      setUsers(data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load account users.");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      const payloadForm = {
        ...form,
        scheduleDays: normalizeScheduleDays(form.scheduleDays)
      };
      if (editingId) {
        const payload = { ...payloadForm };
        if (!String(payload.password || "").trim()) {
          delete payload.password;
        }

        const { data } = await API.put(`/auth/users/${editingId}`, payload);
        setUsers((prev) =>
          prev.map((user) =>
            String(user.ID) === String(editingId) ? data.user : user
          )
        );
        setSuccess("Account user updated successfully.");
      } else {
        const { data } = await API.post("/auth/users", payloadForm);
        setUsers((prev) => [...prev, data.user]);
        setSuccess("Account user added successfully.");
      }
      setForm(defaultForm);
      setEditingId("");
      setError("");
    } catch (err) {
      setSuccess("");
      setError(
        err.response?.data?.error ||
          (editingId ? "Failed to update account user." : "Failed to create account user.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingId(String(user.ID || ""));
    setForm({
      name: user.Name || "",
      username: user.Username || "",
      password: "",
      type: user.Type || "CASHIER",
      email: user.Email || "",
      contact: user.Contact || "",
      salary: user.Salary || "",
      status: user.Status || "ACTIVE",
      restriction: user.Restriction || "Default",
      scheduleDays: getUserScheduleDays(user)
    });
    setError("");
    setSuccess("");
  };

  const handleScheduleDayToggle = (day) => {
    setForm((prev) => {
      const days = normalizeScheduleDays(prev.scheduleDays);
      const nextDays = days.includes(day)
        ? days.filter((item) => item !== day)
        : [...days, day];
      return { ...prev, scheduleDays: nextDays };
    });
  };

  const handleCancelEdit = () => {
    setEditingId("");
    setForm(defaultForm);
    setError("");
    setSuccess("");
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Account Users"
          subtitle="Admin can add and edit login accounts for cashier and technician access here."
        />

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack
              component="form"
              spacing={2}
              onSubmit={handleSubmit}
            >
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Full Name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  fullWidth
                  required
                />
                <TextField
                  label="Username"
                  value={form.username}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, username: event.target.value }))
                  }
                  fullWidth
                  required
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  fullWidth
                  required={!editingId}
                  placeholder={editingId ? "Leave blank to keep current password" : ""}
                />
                <TextField
                  select
                  label="Type"
                  value={form.type}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, type: event.target.value }))
                  }
                  fullWidth
                >
                  <MenuItem value="ADMIN">ADMIN</MenuItem>
                  <MenuItem value="CASHIER">CASHIER</MenuItem>
                  <MenuItem value="TECHNICIAN">TECHNICIAN</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Status"
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                  fullWidth
                  disabled={String(form.type || "").toUpperCase() === "ADMIN"}
                  helperText={
                    String(form.type || "").toUpperCase() === "ADMIN"
                      ? "Admin accounts stay ACTIVE."
                      : ""
                  }
                >
                  <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                  <MenuItem value="DEACTIVE">DEACTIVE</MenuItem>
                </TextField>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Contact"
                  value={form.contact}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, contact: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Salary"
                  value={form.salary}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, salary: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Restriction"
                  value={form.restriction}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, restriction: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              {String(form.type || "").toUpperCase() === "CASHIER" ? (
                <Box
                  sx={{
                    border: "1px solid #d7e3f2",
                    borderRadius: 3,
                    p: 2
                  }}
                >
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ mb: 1 }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        Cashier Weekly Schedule
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Cashier can login only on the selected weekday(s).
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, scheduleDays: [...WEEK_DAYS] }))
                        }
                      >
                        Select All
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        onClick={() => setForm((prev) => ({ ...prev, scheduleDays: [] }))}
                      >
                        Clear
                      </Button>
                    </Stack>
                  </Stack>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {WEEK_DAYS.map((day) => (
                      <FormControlLabel
                        key={day}
                        control={
                          <Checkbox
                            checked={normalizeScheduleDays(form.scheduleDays).includes(day)}
                            onChange={() => handleScheduleDayToggle(day)}
                          />
                        }
                        label={dayLabels[day]}
                      />
                    ))}
                  </Stack>
                </Box>
              ) : null}

              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<PersonAddAltOutlinedIcon />}
                  disabled={loading}
                  sx={{ mr: 1 }}
                >
                  {loading
                    ? "Saving..."
                    : editingId
                      ? "Update Account User"
                      : "Add Account User"}
                </Button>
                {editingId ? (
                  <Button variant="outlined" onClick={handleCancelEdit}>
                    Cancel Edit
                  </Button>
                ) : null}
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Existing Login Accounts
            </Typography>

            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell align="center">Edit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.ID}>
                    <TableCell>{user.ID}</TableCell>
                    <TableCell>{user.Name}</TableCell>
                    <TableCell>{user.Username}</TableCell>
                    <TableCell>{user.Type}</TableCell>
                    <TableCell>{user.Status || "ACTIVE"}</TableCell>
                    <TableCell>
                      {String(user.Type || "").toUpperCase() === "CASHIER" ? (
                        <Chip
                          label={formatScheduleDays(getUserScheduleDays(user))}
                          size="small"
                          color={getUserScheduleDays(user).length ? "success" : "warning"}
                          variant="outlined"
                        />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{user.Email || "-"}</TableCell>
                    <TableCell>{user.Contact || "-"}</TableCell>
                    <TableCell align="center">
                      <IconButton color="primary" onClick={() => handleEdit(user)}>
                        <EditOutlinedIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
