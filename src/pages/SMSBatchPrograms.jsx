import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ScheduleSendOutlinedIcon from "@mui/icons-material/ScheduleSendOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultForm = {
  Name: "",
  TemplateType: "",
  RecipientRule: "DUE_DATE",
  DaysOffset: 0,
  SendTime: "09:00",
  Body: "",
  IsActive: true
};

const availableTokens = [
  "@ClientName@",
  "@AccountName@",
  "@AccountNumber@",
  "@ContactNumber@",
  "@TotalAmountDue@",
  "@MonthlyDue@",
  "@DueDate@",
  "@SubscriptionCover@"
];

const ruleOptions = [
  {
    value: "DUE_DATE",
    label: "Due Date Based"
  }
];

export default function SMSBatchPrograms() {
  const [programs, setPrograms] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingProgram, setEditingProgram] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPrograms = async () => {
    try {
      const { data } = await API.get("/sms-batch-programs");
      setPrograms(data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load SMS batch programs.");
    }
  };

  const loadTemplates = async () => {
    try {
      const { data } = await API.get("/sms-recepients");
      setTemplates(data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load SMS templates.");
    }
  };

  useEffect(() => {
    loadPrograms();
    loadTemplates();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      if (editingProgram?._id) {
        const { data } = await API.put(
          `/sms-batch-programs/${editingProgram._id}`,
          form
        );

        setPrograms((prev) =>
          prev.map((item) => (item._id === editingProgram._id ? data : item))
        );
        setSuccess("SMS batch program updated successfully.");
      } else {
        const { data } = await API.post("/sms-batch-programs", form);
        setPrograms((prev) => [data, ...prev]);
        setSuccess("SMS batch program added successfully.");
      }

      setForm(defaultForm);
      setEditingProgram(null);
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save SMS batch program.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (program) => {
    setEditingProgram(program);
      setForm({
        Name: program.Name || "",
        TemplateType: program.TemplateType || "",
        RecipientRule: program.RecipientRule || "DUE_DATE",
        DaysOffset: Number(program.DaysOffset || 0),
        SendTime: program.SendTime || "09:00",
      Body: program.Body || "",
      IsActive: Boolean(program.IsActive)
    });
    setError("");
    setSuccess("");
  };

  const handleCancelEdit = () => {
    setEditingProgram(null);
    setForm(defaultForm);
    setError("");
    setSuccess("");
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="SMS Batch Program"
          subtitle="Create reminder batch programs, choose the due-date recipient rule, set the send time, and customize the message with parameters."
        />

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Program Name"
                  value={form.Name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Name: event.target.value }))
                  }
                  fullWidth
                  required
                />

                <TextField
                  select
                  label="SMS Template"
                  value={form.TemplateType}
                  onChange={(event) => {
                    const nextTemplate = templates.find(
                      (item) =>
                        String(item.TYPE || "").trim() ===
                        String(event.target.value || "").trim()
                    );

                    setForm((prev) => ({
                      ...prev,
                      TemplateType: event.target.value,
                      Body: nextTemplate?.Body || ""
                    }));
                  }}
                  fullWidth
                  required
                  helperText="Choose an existing SMS template."
                >
                  {templates.map((template) => (
                    <MenuItem key={template._id} value={template.TYPE}>
                      {template.TYPE}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Recipient Rule"
                  value={form.RecipientRule}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      RecipientRule: event.target.value
                    }))
                  }
                  fullWidth
                >
                  {ruleOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Day Offset"
                  type="number"
                  value={form.DaysOffset}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      DaysOffset: Number(event.target.value || 0)
                    }))
                  }
                  fullWidth
                  helperText="0 = due today, -1 = one day before due, 1 = one day after due."
                />

                <TextField
                  label="Send Time"
                  type="time"
                  value={form.SendTime}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      SendTime: event.target.value
                    }))
                  }
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />

                <Box
                  sx={{
                    minWidth: { xs: "100%", md: 220 },
                    px: 1,
                    py: 1,
                    border: "1px solid #dbe4ee",
                    borderRadius: 2,
                    backgroundColor: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      Active
                    </Typography>
                    <Typography sx={{ fontSize: "0.85rem", color: "#64748b" }}>
                      Enable this batch program
                    </Typography>
                  </Box>
                  <Switch
                    checked={form.IsActive}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        IsActive: event.target.checked
                      }))
                    }
                  />
                </Box>
              </Stack>

              <TextField
                label="Message Body Preview"
                value={form.Body}
                fullWidth
                required
                multiline
                minRows={10}
                InputProps={{ readOnly: true }}
                helperText="This body comes from the selected SMS template."
              />

              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Available Tokens
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {availableTokens.map((token) => (
                    <Chip
                      key={token}
                      label={token}
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                  ))}
                </Stack>
              </Box>

              <Stack direction="row" spacing={1.5}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={
                    editingProgram ? <SaveOutlinedIcon /> : <ScheduleSendOutlinedIcon />
                  }
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {loading
                    ? "Saving..."
                    : editingProgram
                      ? "Update Batch Program"
                      : "Add Batch Program"}
                </Button>

                {editingProgram ? (
                  <Button
                    variant="outlined"
                    onClick={handleCancelEdit}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Existing Batch Programs
            </Typography>

            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Program Name</TableCell>
                  <TableCell>Template</TableCell>
                  <TableCell>Rule</TableCell>
                  <TableCell>Offset</TableCell>
                  <TableCell>Send Time</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Message Preview</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {programs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No SMS batch programs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  programs.map((program) => (
                    <TableRow key={program._id}>
                      <TableCell sx={{ fontWeight: 700 }}>{program.Name}</TableCell>
                      <TableCell>{program.TemplateType || "-"}</TableCell>
                      <TableCell>{program.RecipientRule}</TableCell>
                      <TableCell>{program.DaysOffset}</TableCell>
                      <TableCell>{program.SendTime}</TableCell>
                      <TableCell>
                        <Chip
                          label={program.IsActive ? "Active" : "Inactive"}
                          color={program.IsActive ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          sx={{
                            maxWidth: 560,
                            whiteSpace: "pre-wrap",
                            color: "#475569"
                          }}
                        >
                          {program.Body}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          startIcon={<EditOutlinedIcon />}
                          onClick={() => handleEdit(program)}
                          sx={{ textTransform: "none", fontWeight: 700 }}
                        >
                          Edit
                        </Button>
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
