import { useState } from "react";
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await login(form.username, form.password);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setError("");
    navigate("/", { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 3,
        background:
          "radial-gradient(circle at top left, rgba(29,78,216,0.18), transparent 35%), linear-gradient(135deg, #eff6ff, #f8fafc)"
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 460, borderRadius: 5, boxShadow: 8 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} component="form" onSubmit={handleSubmit}>
            <Stack spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "#dbeafe",
                  color: "#1d4ed8"
                }}
              >
                <LockOutlinedIcon />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Sign In
              </Typography>
              <Typography color="text.secondary" align="center">
                Use your credential account to open the ISP billing dashboard.
              </Typography>
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label="Username"
              value={form.username}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, username: event.target.value }))
              }
              fullWidth
              required
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
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ py: 1.4, borderRadius: 3, fontWeight: 700 }}
            >
              {loading ? "Signing In..." : "Login"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
