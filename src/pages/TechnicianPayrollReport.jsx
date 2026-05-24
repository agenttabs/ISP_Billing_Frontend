import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const toIsoDate = (date) => date.toISOString().split("T")[0];

const getDefaultPayrollCutoffDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const cutoffDay = [7, 15, 22, lastDay]
    .filter((candidate) => candidate <= day)
    .sort((a, b) => b - a)[0];

  if (cutoffDay) {
    return toIsoDate(new Date(year, month, cutoffDay));
  }

  const previousMonthLastDay = new Date(year, month, 0);
  return toIsoDate(previousMonthLastDay);
};

const formatMoney = (value) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderPayrollPrintHtml = ({ rows, cutoffDate }) => {
  const generatedAt = new Date().toLocaleString("en-PH");
  const technicianSections = rows
    .map((row) => {
      const advances = Array.isArray(row.cashAdvances) ? row.cashAdvances : [];
      const advanceRows = advances.length
        ? advances
            .map(
              (advance) => `
                <tr>
                  <td>${escapeHtml(formatDate(advance.date))}</td>
                  <td>${escapeHtml(advance.name || "-")}</td>
                  <td>${escapeHtml(advance.invoice || "-")}</td>
                  <td>${escapeHtml(advance.docs || "-")}</td>
                  <td class="amount">${escapeHtml(formatMoney(advance.amount))}</td>
                </tr>
              `
            )
            .join("")
        : `<tr><td colspan="5" class="empty">No new cash advance in this cutoff.</td></tr>`;

      return `
        <section class="technician-page">
          <div class="print-header">
            <div>
              <h1>Technician Payroll</h1>
              <p>Cutoff: ${escapeHtml(formatDate(row.cutoffDate))}</p>
            </div>
            <div class="meta">
              <div>Generated: ${escapeHtml(generatedAt)}</div>
              <div>Schedule: ${escapeHtml(row.payrollScheduleLabel || "-")}</div>
            </div>
          </div>

          <div class="technician-name">${escapeHtml(row.name || "-")}</div>
          <div class="period">
            Period: ${escapeHtml(formatDate(row.cutoffStartDate))} to ${escapeHtml(formatDate(row.cutoffDate))}
          </div>

          <div class="summary-grid">
            <div><span>Monthly Salary</span><strong>${escapeHtml(formatMoney(row.monthlySalary))}</strong></div>
            <div><span>Cutoff Salary</span><strong>${escapeHtml(formatMoney(row.grossSalary))}</strong></div>
            <div><span>Cash Advance Deducted</span><strong>${escapeHtml(formatMoney(row.cashAdvanceTotal))}</strong></div>
            <div><span>Carry Over to Next Cutoff</span><strong>${escapeHtml(formatMoney(row.cashAdvanceCarryOver))}</strong></div>
            <div class="net"><span>Net Salary</span><strong>${escapeHtml(formatMoney(row.netSalary))}</strong></div>
          </div>

          <h2>Cash Advance Details</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Invoice</th>
                <th>Docs</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>${advanceRows}</tbody>
          </table>

          <div class="signatures">
            <div>Prepared By</div>
            <div>Received By</div>
          </div>
        </section>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <title>Technician Payroll - ${escapeHtml(formatDate(cutoffDate))}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #fff; }
          .summary-grid div { border: 1px solid #d1d5db; padding: 10px; border-radius: 4px; }
          span { display: block; color: #4b5563; font-size: 10px; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
          strong { font-size: 15px; }
          .technician-page { padding: 24px 28px; page-break-after: always; }
          .technician-page:last-child { page-break-after: auto; }
          .print-header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 10px; }
          .print-header h1 { margin: 0; font-size: 20px; }
          .print-header p, .meta, .period { margin: 4px 0 0; font-size: 12px; color: #4b5563; }
          .meta { text-align: right; line-height: 1.5; }
          .technician-name { margin-top: 18px; font-size: 18px; font-weight: 800; }
          .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 16px 0 18px; }
          .summary-grid .net { border-color: #15803d; }
          h2 { font-size: 14px; margin: 0 0 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; }
          th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; }
          .amount { text-align: right; white-space: nowrap; }
          .empty { text-align: center; color: #6b7280; padding: 14px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 44px; }
          .signatures div { border-top: 1px solid #111827; text-align: center; padding-top: 7px; font-size: 12px; }
          @page { size: A4 portrait; margin: 10mm; }
          @media print {
            .technician-page { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${technicianSections || '<section class="technician-page"><p>No technician payroll records to print.</p></section>'}
      </body>
    </html>
  `;
};

function PayrollRow({ row }) {
  const [open, setOpen] = useState(false);
  const hasAdvances = Array.isArray(row.cashAdvances) && row.cashAdvances.length > 0;

  return (
    <>
      <TableRow hover>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen((prev) => !prev)} disabled={!hasAdvances}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 700 }}>{row.name || "-"}</TableCell>
        <TableCell>{row.payrollScheduleLabel || "-"}</TableCell>
        <TableCell>{formatDate(row.cutoffStartDate)}</TableCell>
        <TableCell>{formatDate(row.cutoffDate)}</TableCell>
        <TableCell sx={{ fontWeight: 700 }}>{formatMoney(row.monthlySalary)}</TableCell>
        <TableCell sx={{ color: "#2563eb", fontWeight: 800 }}>
          {formatMoney(row.grossSalary)}
        </TableCell>
        <TableCell sx={{ color: "#dc2626", fontWeight: 800 }}>
          {formatMoney(row.cashAdvanceTotal)}
        </TableCell>
        <TableCell sx={{ color: "#b45309", fontWeight: 800 }}>
          {formatMoney(row.cashAdvanceCarryOver)}
        </TableCell>
        <TableCell sx={{ color: "#15803d", fontWeight: 900 }}>
          {formatMoney(row.netSalary)}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={10} sx={{ p: 0, borderBottom: open ? undefined : 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, background: "#f8fafc" }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>
                Cash Advance Expenses
              </Typography>
              {Number(row.cashAdvanceCarryOver || 0) > 0 ? (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                  {formatMoney(row.periodCashAdvanceTotal)} new cash advance this cutoff.{" "}
                  {formatMoney(row.cashAdvanceTotal)} deducted this cutoff and{" "}
                  {formatMoney(row.cashAdvanceCarryOver)} will carry over to the next cutoff.
                </Alert>
              ) : null}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Invoice</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Docs</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {row.cashAdvances.map((advance) => (
                    <TableRow key={advance._id}>
                      <TableCell>{formatDate(advance.date)}</TableCell>
                      <TableCell>{advance.name || "-"}</TableCell>
                      <TableCell>{advance.invoice || "-"}</TableCell>
                      <TableCell>{advance.type || "-"}</TableCell>
                      <TableCell>{advance.docs || "-"}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatMoney(advance.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function TechnicianPayrollReport() {
  const [cutoffDate, setCutoffDate] = useState(getDefaultPayrollCutoffDate());
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const includedRows = useMemo(
    () => rows.filter((row) => row.isIncluded),
    [rows]
  );

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await API.get("/reports/technician-payroll", {
        params: { cutoffDate }
      });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setSummary(data?.summary || null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load technician payroll report.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPayroll = () => {
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const frameWindow = printFrame.contentWindow;
    const frameDocument = printFrame.contentDocument || frameWindow?.document;

    if (!frameWindow || !frameDocument) {
      document.body.removeChild(printFrame);
      setError("Unable to prepare payroll print document.");
      return;
    }

    frameDocument.open();
    frameDocument.write(
      renderPayrollPrintHtml({
        rows: includedRows,
        cutoffDate
      })
    );
    frameDocument.close();

    const cleanup = () => {
      window.setTimeout(() => {
        if (printFrame.parentNode) {
          printFrame.parentNode.removeChild(printFrame);
        }
      }, 500);
    };

    frameWindow.onafterprint = cleanup;
    window.setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      cleanup();
    }, 250);
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <PageHeader
        title="Technician Payroll"
        subtitle="Review technician cutoff salary and subtract cash advances from Expense records."
        action={
          <Button
            variant="outlined"
            startIcon={<PrintOutlinedIcon />}
            onClick={handlePrintPayroll}
          >
            Print Payroll
          </Button>
        }
      />

      <Card sx={{ borderRadius: 4, mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
              label="Cutoff Date"
              type="date"
              value={cutoffDate}
              onChange={(event) => setCutoffDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Use 7, 15, 22, or end of month depending on technician schedule."
            />
            <Button variant="contained" onClick={loadReport} disabled={loading}>
              Apply Cutoff
            </Button>
            <Box sx={{ flex: 1 }} />
            <Chip
              color="primary"
              label={`Technicians: ${summary?.technicianCount || 0}`}
              sx={{ fontWeight: 800 }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="overline" sx={{ color: "#64748b", fontWeight: 800 }}>
                Gross Salary
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#2563eb" }}>
                {formatMoney(summary?.grossSalaryTotal)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="overline" sx={{ color: "#64748b", fontWeight: 800 }}>
                Cash Advances
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#dc2626" }}>
                {formatMoney(summary?.cashAdvanceTotal)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="overline" sx={{ color: "#64748b", fontWeight: 800 }}>
                Carry Over
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#b45309" }}>
                {formatMoney(summary?.cashAdvanceCarryOverTotal)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="overline" sx={{ color: "#64748b", fontWeight: 800 }}>
                Net Payroll
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#15803d" }}>
                {formatMoney(summary?.netSalaryTotal)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>Technician</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Period Start</TableCell>
                  <TableCell>Cutoff</TableCell>
                  <TableCell>Monthly Salary</TableCell>
                  <TableCell>Cutoff Salary</TableCell>
                  <TableCell>Cash Advance</TableCell>
                  <TableCell>Carry Over</TableCell>
                  <TableCell>Net Salary</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {includedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      No technician payroll schedule matches this cutoff date.
                    </TableCell>
                  </TableRow>
                ) : (
                  includedRows.map((row) => (
                    <PayrollRow key={row.technicianId || row.username} row={row} />
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
