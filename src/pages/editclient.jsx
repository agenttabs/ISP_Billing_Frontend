import { useEffect, useState } from "react";
import {
  Box, TextField, Button, Typography, Paper, Grid, MenuItem
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import API from "../api/api";

function EditClient() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [form, setForm] = useState({
    clientName: "",
    accountName: "",
    contactNumber: "",
    email: "",
    address: "",
    plan: "",
    amountDue: "",
    dueDate: null
  });

  useEffect(() => {
    API.get(`/clients/${id}`)
      .then(res => {
        const d = res.data;

        setForm({
          clientName: d.clientName || "",
          accountName: d.accountName || "",
          contactNumber: d.contactNumber || "",
          email: d.email || "",
          address: d.address || "",
          plan: d.plan || "",
          amountDue: d.amountDue || "",
          dueDate: d.dueDate ? dayjs(d.dueDate) : null
        });
      });
  }, [id]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    await API.put(`/clients/${id}`, {
      ...form,
      dueDate: form.dueDate?.toISOString(),
      amountDue: Number(form.amountDue)
    });

    alert("✅ Updated!");
    navigate("/");
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Edit Client</Typography>

      <Paper sx={{ p: 3, mt: 2 }}>
        <form onSubmit={handleSubmit}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2}>

              <Grid item xs={6}>
                <TextField label="Client Name" name="clientName" fullWidth value={form.clientName} onChange={handleChange} />
              </Grid>

              <Grid item xs={6}>
                <TextField label="Account Name" name="accountName" fullWidth value={form.accountName} onChange={handleChange} />
              </Grid>

              <Grid item xs={6}>
                <TextField label="Contact" name="contactNumber" fullWidth value={form.contactNumber} onChange={handleChange} />
              </Grid>

              <Grid item xs={6}>
                <TextField label="Email" name="email" fullWidth value={form.email} onChange={handleChange} />
              </Grid>

              <Grid item xs={12}>
                <TextField label="Address" name="address" fullWidth value={form.address} onChange={handleChange} />
              </Grid>

              <Grid item xs={6}>
                <TextField select label="Plan" name="plan" fullWidth value={form.plan} onChange={handleChange}>
                  <MenuItem value="Basic">Basic</MenuItem>
                  <MenuItem value="Standard">Standard</MenuItem>
                  <MenuItem value="Premium">Premium</MenuItem>
                </TextField>
              </Grid>
asads
              <Grid item xs={6}>
                <TextField label="Amount" name="amountDue" type="number" fullWidth value={form.amountDue} onChange={handleChange} />
              </Grid>

              <Grid item xs={6}>
                <DatePicker
                  label="Due Date"
                  value={form.dueDate}
                  onChange={(v) => setForm({ ...form, dueDate: v })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button type="submit" fullWidth variant="contained">
                  Save Changes
                </Button>
              </Grid>

            </Grid>
          </LocalizationProvider>
        </form>
      </Paper>
    </Box>
  );
}

export default EditClient;
