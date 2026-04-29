import { useEffect, useState } from "react";
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
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultForm = {
  name: "",
  username: "",
  password: "",
  type: "CASHIER",
  status: "ACTIVE",
  email: "",
  contact: "",
  salary: "",
  restriction: "Default"
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
      if (editingId) {
        const payload = { ...form };
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
        const { data } = await API.post("/auth/users", form);
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
      restriction: user.Restriction || "Default"
    });
    setError("");
    setSuccess("");
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
