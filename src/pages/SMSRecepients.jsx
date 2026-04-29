import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import MessageOutlinedIcon from "@mui/icons-material/MessageOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const defaultTemplates = [
  {
    TYPE: "paymentreceived",
    Body:
      "Hi @ClientName@, we have received the payment for your DNS Internet bill. Thank you.\r\n\r\nAccount no. @AccountNumber@\r\nMonthly due: @MonthlyDue@\r\nSubscription cover: @SubscriptionCover@\r\nTotal amount paid: @AmountPaid@\r\nNext due date: @NextDueDate@\r\n\r\n**This is a system generated sms. Kindly message us for any concerns."
  },
  {
    TYPE: "paymentreminder",
    Body:
      "Hi @ClientName@, we would like to remind that your DNS Internet bill is due. Kindly settle thru any of our Gcash accounts: 09260218957 Ma**a Cr*****e N. or 09167700957 Mi****l N. or Maya: 09260218957 Ma**a Cr*****e N. to avoid disconnection.\r\n\r\nAccount no.: @AccountNumber@\r\nAmount due: @TotalAmountDue@\r\nDue date: @DueDate@\r\n**This is a system generated sms. Kindly message us for any concerns."
  },
  {
    TYPE: "smsRepairTech",
    Body:
      "DNS Repair Request\r\nTechnician: @TechnicianName@\r\nClient: @ClientName@\r\nAccount: @AccountName@\r\nAccount no.: @AccountNumber@\r\nContact: @ContactNumber@\r\nAddress: @Address@\r\nIssue: @RepairText@"
  }
];

const defaultForm = {
  TYPE: "",
  Body: ""
};

const availableTokens = [
  "@ClientName@",
  "@TechnicianName@",
  "@AccountName@",
  "@AccountNumber@",
  "@ContactNumber@",
  "@Address@",
  "@RepairText@",
  "@Issue@",
  "@MonthlyDue@",
  "@SubscriptionCover@",
  "@AmountPaid@",
  "@NextDueDate@",
  "@TotalAmountDue@",
  "@DueDate@"
];

export default function SMSRecepients() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);

  const loadTemplates = async () => {
    try {
      const { data } = await API.get("/sms-recepients");
      setTemplates(data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load SMS templates.");
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const templateTypes = useMemo(
    () => new Set(templates.map((item) => String(item.TYPE || "").toLowerCase())),
    [templates]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      if (editingTemplate?._id) {
        const { data } = await API.put(`/sms-recepients/${editingTemplate._id}`, form);
        setTemplates((prev) =>
          prev.map((item) => (item._id === editingTemplate._id ? data : item))
        );
        setSuccess("SMS recipient template updated successfully.");
      } else {
        const { data } = await API.post("/sms-recepients", form);
        setTemplates((prev) => [...prev, data].sort((a, b) => a.TYPE.localeCompare(b.TYPE)));
        setSuccess("SMS recipient template added successfully.");
      }

      setForm(defaultForm);
      setEditingTemplate(null);
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save SMS template.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setForm({
      TYPE: template.TYPE || "",
      Body: template.Body || ""
    });
    setError("");
    setSuccess("");
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setForm(defaultForm);
  };

  const handleSeedTemplate = (template) => {
    setForm(template);
    setEditingTemplate(null);
    setSeedDialogOpen(false);
    setError("");
    setSuccess("");
  };

  const handleInsertToken = (token) => {
    setForm((prev) => ({
      ...prev,
      Body: `${prev.Body || ""}${token}`
    }));
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="SMS Template"
          subtitle="Admin can add and edit SMS message templates used by the billing workflow."
          action={
            <Button
              variant="contained"
              startIcon={<MessageOutlinedIcon />}
              onClick={() => setSeedDialogOpen(true)}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Use Default Pattern
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
                  label="TYPE"
                  value={form.TYPE}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, TYPE: event.target.value }))
                  }
                  fullWidth
                  required
                  helperText="Example: paymentreceived, paymentreminder, or smsRepairTech"
                />
              </Stack>

              <TextField
                label="Body"
                value={form.Body}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, Body: event.target.value }))
                }
                fullWidth
                required
                multiline
                minRows={10}
                helperText="You can use placeholders from the tokens below."
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
                      clickable
                      onClick={() => handleInsertToken(token)}
                      sx={{ fontWeight: 600 }}
                    />
                  ))}
                </Stack>
              </Box>

              <Stack direction="row" spacing={1.5}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={editingTemplate ? <SaveOutlinedIcon /> : <MessageOutlinedIcon />}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {loading
                    ? "Saving..."
                    : editingTemplate
                      ? "Update SMS Template"
                      : "Add SMS Template"}
                </Button>

                {editingTemplate ? (
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
              Existing SMS Templates
            </Typography>

            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>TYPE</TableCell>
                  <TableCell>Body Preview</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No SMS templates found.
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((template) => (
                    <TableRow key={template._id}>
                      <TableCell sx={{ fontWeight: 700 }}>{template.TYPE}</TableCell>
                      <TableCell>
                        <Typography
                          sx={{
                            maxWidth: 720,
                            whiteSpace: "pre-wrap",
                            color: "#475569"
                          }}
                        >
                          {template.Body}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          startIcon={<EditOutlinedIcon />}
                          onClick={() => handleEdit(template)}
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

        <Dialog
          open={seedDialogOpen}
          onClose={() => setSeedDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Choose Default SMS Pattern</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {defaultTemplates.map((template) => {
                const exists = templateTypes.has(template.TYPE.toLowerCase());

                return (
                  <Card key={template.TYPE} sx={{ borderRadius: 3, border: "1px solid #dbe4ee" }}>
                    <CardContent>
                      <Stack spacing={1.25}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography sx={{ fontWeight: 700 }}>{template.TYPE}</Typography>
                          {exists ? <Chip label="Already Exists" color="success" size="small" /> : null}
                        </Stack>
                        <Typography sx={{ whiteSpace: "pre-wrap", color: "#475569" }}>
                          {template.Body}
                        </Typography>
                        <Box>
                          <Button
                            variant="outlined"
                            onClick={() => handleSeedTemplate(template)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Use This Pattern
                          </Button>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSeedDialogOpen(false)} sx={{ textTransform: "none", fontWeight: 700 }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Box>
  );
}
