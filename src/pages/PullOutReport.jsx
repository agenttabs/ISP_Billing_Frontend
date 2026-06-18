import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import API from "../api/api";
import PageHeader from "../layout/PageHeader";
import { DEFAULT_COMPANY_NAME, fetchSystemCompanyName } from "../utils/companyName";

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

export default function PullOutReport() {
  const [days, setDays] = useState(30);
  const [appliedDays, setAppliedDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY_NAME);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totalAmount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amountDue || 0), 0),
    [rows]
  );

  const loadReport = async (targetDays = appliedDays) => {
    try {
      setLoading(true);
      setError("");

      const safeDays = Math.max(0, Math.floor(Number(targetDays) || 0));
      const { data } = await API.get("/reports/pull-out", {
        params: { days: safeDays }
      });

      setRows(data?.rows || []);
      setSummary(data?.summary || null);
      setAppliedDays(safeDays);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load pull out report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(30);
    fetchSystemCompanyName()
      .then(setCompanyName)
      .catch(() => setCompanyName(DEFAULT_COMPANY_NAME));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilter = () => {
    loadReport(days);
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(companyName, 14, 14);
    doc.setFontSize(13);
    doc.text("Pull Out Report", 14, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Due date day: ${appliedDays} day(s) overdue and up`, 14, 29);
    doc.text(`As of: ${formatDate(summary?.asOfDate || new Date())}`, 14, 35);
    doc.text(`Records: ${rows.length}`, 14, 41);
    doc.text(`Total Amount Due: ${formatMoney(totalAmount)}`, pageWidth - 70, 41);

    autoTable(doc, {
      startY: 48,
      head: [[
        "Pull Out",
        "Account",
        "Client",
        "Auth",
        "Due Date",
        "Overdue",
        "Amount",
        "Contact",
        "Address"
      ]],
      body: rows.map((row) => [
        "",
        row.accountName || "-",
        row.clientName || "-",
        row.authMode || "-",
        formatDate(row.dueDate),
        `${row.daysPastDue || 0} day(s)`,
        formatMoney(row.amountDue),
        row.contactNumber || "-",
        row.address || "-"
      ]),
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: [15, 23, 42],
        overflow: "linebreak"
      },
      headStyles: {
        fillColor: [239, 246, 255],
        textColor: [15, 23, 42],
        fontStyle: "bold"
      },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 36 },
        2: { cellWidth: 36 },
        8: { cellWidth: 62 }
      },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 0) {
          return;
        }

        const boxSize = 4.5;
        const x = data.cell.x + (data.cell.width - boxSize) / 2;
        const y = data.cell.y + (data.cell.height - boxSize) / 2;
        doc.rect(x, y, boxSize, boxSize);
      },
      margin: { left: 10, right: 10 }
    });

    doc.save(`pull-out-report-${appliedDays}-days.pdf`);
  };

  return (
    <Box>
      <PageHeader
        title="Pull Out Report"
        subtitle="Display clients whose due date is overdue by the selected number of days."
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlinedIcon />}
              onClick={() => loadReport(appliedDays)}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={handleDownloadPdf}
              disabled={loading || rows.length === 0}
            >
              Download PDF
            </Button>
          </Stack>
        }
      />

      <Card sx={{ borderRadius: 4, mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
              label="Due date day"
              type="number"
              value={days}
              onChange={(event) => setDays(event.target.value)}
              inputProps={{ min: 0 }}
              helperText="Example: 30 means show clients 30 days overdue and up."
              sx={{ width: { xs: "100%", md: 220 } }}
            />
            <Button variant="contained" onClick={handleApplyFilter} disabled={loading}>
              Apply Filter
            </Button>
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.secondary" }}>
              Records: {rows.length}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              Total: {formatMoney(totalAmount)}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
            <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
              {rows.length === 0 ? (
                <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                  No pull out candidates found for {appliedDays} day(s) overdue.
                </Typography>
              ) : (
                rows.map((row) => (
                  <Card key={row.clientId || row.accountName} sx={{ borderRadius: 3, border: "1px solid #dbe4ee" }}>
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>{row.accountName || "-"}</Typography>
                            <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                              {row.clientName || "-"} | {row.authMode || "-"}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontWeight: 900, color: "error.main", flexShrink: 0 }}>
                            {row.daysPastDue || 0}d
                          </Typography>
                        </Stack>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>DUE DATE</Typography>
                            <Typography sx={{ fontWeight: 800 }}>{formatDate(row.dueDate)}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>PULL OUT</Typography>
                            <Typography sx={{ fontWeight: 800 }}>{formatDate(row.eligibleDate)}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>PLAN</Typography>
                            <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>{row.netPlan || "-"}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>AMOUNT</Typography>
                            <Typography sx={{ fontWeight: 900 }}>{formatMoney(row.amountDue)}</Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                          Contact: {row.contactNumber || "-"}
                        </Typography>
                        <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                          {row.address || "-"}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>

            <TableContainer sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Account Name</TableCell>
                  <TableCell>Client Name</TableCell>
                  <TableCell>Auth</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Pull Out Date</TableCell>
                  <TableCell>Overdue</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Address</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      No pull out candidates found for {appliedDays} day(s) overdue.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.clientId || row.accountName}>
                      <TableCell>{row.accountName || "-"}</TableCell>
                      <TableCell>{row.clientName || "-"}</TableCell>
                      <TableCell>{row.authMode || "-"}</TableCell>
                      <TableCell>{row.netPlan || "-"}</TableCell>
                      <TableCell>{formatDate(row.dueDate)}</TableCell>
                      <TableCell>{formatDate(row.eligibleDate)}</TableCell>
                      <TableCell>
                        <Box component="span" sx={{ fontWeight: 800, color: "error.main" }}>
                          {row.daysPastDue || 0} day(s)
                        </Box>
                      </TableCell>
                      <TableCell>{formatMoney(row.amountDue)}</TableCell>
                      <TableCell>{row.contactNumber || "-"}</TableCell>
                      <TableCell>{row.address || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </TableContainer>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
