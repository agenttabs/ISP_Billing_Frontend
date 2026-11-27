import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import API from "../api/api";
import { useAuth } from "../context/auth.context";
import PageHeader from "../layout/PageHeader";

const formatDate = (date) => new Date(date + "T00:00:00Z").toLocaleDateString("en-PH", {
  timeZone: "UTC",
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric"
});

const statusLabel = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };

export default function EmployeeAbsence() {
  const { user } = useAuth();
  const isAdmin = String(user?.type || "").toUpperCase() === "ADMIN";
  const [date, setDate] = useState("");
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeListError, setEmployeeListError] = useState("");
  const [reason, setReason] = useState("");
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);
  const [absenceToDelete, setAbsenceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    API.get("/absences", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setAbsences(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setListError(error.response?.data?.error || "Could not load your absences. Refresh to try again.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const controller = new AbortController();
    API.get("/absences/employees", { signal: controller.signal })
      .then(({ data }) => setEmployees(data))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setEmployeeListError(error.response?.data?.error || "Could not load employees. Refresh to try again.");
        }
      });

    return () => controller.abort();
  }, [isAdmin]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSuccess(false);
    setSubmitError("");

    try {
      const endpoint = isAdmin ? "/absences/mark" : "/absences";
      const { data } = await API.post(endpoint, isAdmin ? { employeeId, date, reason } : { date, reason });
      setAbsences((previous) => [...previous.filter((item) => item._id !== data._id), data]
        .sort((a, b) => b.date.localeCompare(a.date)));
      setDate("");
      setReason("");
      setSuccess(true);
    } catch (error) {
      setSubmitError(error.response?.data?.error || "Could not save the absence.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!absenceToDelete || deleting) return;
    const { _id: id } = absenceToDelete;
    setDeleting(true);
    setDeleteError("");

    try {
      await API.delete("/absences/" + encodeURIComponent(id));
      setAbsences((previous) => previous.filter((absence) => absence._id !== id));
      setAbsenceToDelete(null);
      setDeleteMessage("Absence deleted.");
    } catch (error) {
      if (error.response?.status === 404) {
        setAbsences((previous) => previous.filter((absence) => absence._id !== id));
        setAbsenceToDelete(null);
        setDeleteMessage("This absence was already removed.");
      } else {
        setDeleteError(error.response?.data?.error || "Could not delete the absence.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader title="Attendance" />
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            <Typography variant="h6">{isAdmin ? "Mark employee absent" : "Report an absence"}</Typography>
            {employeeListError && <Alert severity="error">{employeeListError}</Alert>}
            {submitError && <Alert severity="error">{submitError}</Alert>}
            {success && (
              <Alert severity="success">{isAdmin ? "Employee marked absent." : "Absence submitted for review."}</Alert>
            )}
            {isAdmin ? (
              <>
                <TextField
                  select
                  label="Employee"
                  value={employeeId}
                  onChange={(event) => {
                    setEmployeeId(event.target.value);
                    setDate("");
                    setReason("");
                    setSuccess(false);
                    setSubmitError("");
                  }}
                  required
                  disabled={saving || !employees.length}
                  sx={{ maxWidth: { sm: 400 } }}
                >
                  {employees.map((employee) => (
                    <MenuItem key={employee.id} value={employee.id}>
                      {employee.name} · {employee.role} · {employee.id}
                    </MenuItem>
                  ))}
                </TextField>
                {employeeId && (
                  <Stack spacing={0.5} sx={{ alignSelf: "flex-start", maxWidth: "100%" }}>
                    <Typography fontWeight={700}>Absence date</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {date ? formatDate(date) : "Choose a Monday through Saturday workday."}
                    </Typography>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <DateCalendar
                        views={["day"]}
                        value={date ? dayjs(date) : null}
                        onChange={(value) => setDate(value ? value.format("YYYY-MM-DD") : "")}
                        shouldDisableDate={(value) => value.day() === 0}
                        disabled={saving}
                        sx={{ maxWidth: "100%", m: 0 }}
                      />
                    </LocalizationProvider>
                  </Stack>
                )}
              </>
            ) : (
              <TextField
                label="Absence date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Choose a Monday through Saturday workday."
                required
                disabled={saving}
                sx={{ maxWidth: { sm: 300 } }}
              />
            )}
            <TextField
              label={isAdmin ? "Reason (optional)" : "Reason"}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              inputProps={{ maxLength: 500 }}
              multiline
              minRows={2}
              required={!isAdmin}
              disabled={saving}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading || saving || !date || (isAdmin ? !employeeId : !reason.trim())}
              sx={{ alignSelf: "flex-start" }}
            >
              {saving ? "Saving…" : isAdmin ? "Mark Absent" : "Submit absence"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">{isAdmin ? "Submitted absences" : "My absences"}</Typography>
            {loading && <Typography role="status">Loading absences…</Typography>}
            {listError && <Alert severity="error">{listError}</Alert>}
            {deleteMessage && <Alert severity="info">{deleteMessage}</Alert>}
            {!loading && !listError && !absences.length && (
              <Typography color="text.secondary">No absences submitted yet.</Typography>
            )}
            <Stack divider={<Divider flexItem />} spacing={1.5}>
              {absences.map((absence) => (
                <Stack key={absence._id} spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography fontWeight={700}>{formatDate(absence.date)}</Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip size="small" label={statusLabel[absence.status] || absence.status} />
                      {isAdmin && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeleteMessage("");
                            setDeleteError("");
                            setAbsenceToDelete(absence);
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                  {isAdmin && (
                    <Typography variant="body2" color="text.secondary">
                      {absence.employeeName || absence.employeeId}
                    </Typography>
                  )}
                  <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {absence.reason}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {isAdmin && (
        <Dialog
          open={Boolean(absenceToDelete)}
          onClose={() => { if (!deleting) setAbsenceToDelete(null); }}
          aria-labelledby="delete-absence-title"
        >
          <DialogTitle id="delete-absence-title">Delete absence?</DialogTitle>
          <DialogContent>
            {absenceToDelete && (
              <DialogContentText>
                Delete the attendance record for {absenceToDelete.employeeName || absenceToDelete.employeeId}
                {" on "}{formatDate(absenceToDelete.date)}?
              </DialogContentText>
            )}
            {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAbsenceToDelete(null)} disabled={deleting}>Cancel</Button>
            <Button onClick={handleDelete} color="error" disabled={deleting} variant="contained">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Stack>
  );
}
