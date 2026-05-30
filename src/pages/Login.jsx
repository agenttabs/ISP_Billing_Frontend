import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth.context";

export default function Login() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const message = sessionStorage.getItem("logoutMessage") || "";

    if (message) {
      setNotice(message);
      sessionStorage.removeItem("logoutMessage");
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await login(form.username, form.password);

    if (!result.success) {
      setError(result.error);
      setNotice("");
      return;
    }

    setError("");
    setNotice("");
    navigate("/", { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        background:
          "radial-gradient(circle at top left, rgba(29,78,216,0.18), transparent 35%), linear-gradient(135deg, #eff6ff, #f8fafc)"
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 380,
          borderRadius: 4,
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.16)"
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack spacing={2.25} component="form" onSubmit={handleSubmit}>
            <Stack spacing={0.75} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "#dbeafe",
                  color: "#1d4ed8"
                }}
              >
                <LockOutlinedIcon sx={{ fontSize: 24 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                Sign In
              </Typography>
              <Typography color="text.secondary" align="center" sx={{ fontSize: "0.9rem", maxWidth: 300 }}>
                Use your credential account to open the ISP billing dashboard.
              </Typography>
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {notice ? <Alert severity="warning">{notice}</Alert> : null}

            <TextField
              label="Username"
              value={form.username}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, username: event.target.value }))
              }
              fullWidth
              required
              size="small"
            />

            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              fullWidth
              required
              size="small"
            />

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ py: 1.05, borderRadius: 2.5, fontWeight: 700 }}
            >
              {loading ? "Signing In..." : "Login"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
