import { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Grid,
  MenuItem
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import API from "../api/api";

function AddClient() {
  const navigate = useNavigate();

  const [netplans, setNetplans] = useState([]);

  const [form, setForm] = useState({
    AccountName: "",
    AccountNumber: "",
    ClientName: "",
    ContactNumber: "",
    NetPlan: "",
    Profile: "",
    AmountDue: "",
    DueDate: null
  });

  // ✅ LOAD NETPLAN
  useEffect(() => {
    API.get("/netplans")
      .then(res => setNetplans(res.data))
      .catch(err => console.error(err));
  }, []);

  // normal input
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // 🔥 PLAN SELECT (IMPORTANT)
  const handlePlanChange = (e) => {
    const selectedSpeed = e.target.value;

    const selectedPlan = netplans.find(p => p.Speed === selectedSpeed);

    setForm({
      ...form,
      NetPlan: selectedPlan.Speed,   // PLAN NAME
      Profile: selectedPlan.Name     // PROFILE NAME
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    await API.post("/clients", {
      ...form,
      DueDate: form.DueDate?.toISOString()
    });

    alert("✅ Client added");
    navigate("/");
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Add Client</Typography>

      <Paper sx={{ p: 3, mt: 2 }}>
        <form onSubmit={handleSubmit}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2}>

              <Grid item xs={6}>
                <TextField label="AccountName" name="AccountName" fullWidth onChange={handleChange}/>
              </Grid>

              <Grid item xs={6}>
                <TextField label="ClientName" name="ClientName" fullWidth onChange={handleChange}/>
              </Grid>

              <Grid item xs={6}>
                <TextField label="ContactNumber" name="ContactNumber" fullWidth onChange={handleChange}/>
              </Grid>

              {/* 🔥 NETPLAN DROPDOWN */}
              <Grid item xs={6}>
                <TextField
                  select
                  label="NetPlan"
                  value={form.NetPlan}
                  fullWidth
                  onChange={handlePlanChange}
                >
                  {netplans.map((plan) => (
                    <MenuItem key={plan.Name} value={plan.Speed}>
                      {plan.Speed} (₱{plan.Price})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={6}>
                <TextField label="Profile" value={form.Profile} fullWidth disabled />
              </Grid>

              <Grid item xs={6}>
                <TextField label="AmountDue" name="AmountDue" fullWidth onChange={handleChange}/>
              </Grid>

              <Grid item xs={6}>
                <DatePicker
                  label="DueDate"
                  value={form.DueDate}
                  onChange={(val) => setForm({ ...form, DueDate: val })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button type="submit" variant="contained" fullWidth>
                  Save Client
                </Button>
              </Grid>

            </Grid>
          </LocalizationProvider>
        </form>
      </Paper>
    </Box>
  );
}

export default AddClient;
