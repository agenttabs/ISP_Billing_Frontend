import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { DEFAULT_COMPANY_NAME, fetchSystemCompanyName } from "../utils/companyName";

const BILLING_LOGO_SRC = "/dns_logo.png";

const loadImageDataUrl = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = reject;
    image.src = src;
  });

const getPdfTextLines = (doc, value, maxWidth, maxLines = 2) => {
  const lines = doc.splitTextToSize(String(value || "").trim() || "-", maxWidth);
  if (lines.length <= maxLines) return lines;
  const visibleLines = lines.slice(0, maxLines);
  visibleLines[maxLines - 1] = `${String(visibleLines[maxLines - 1] || "").replace(/\s+$/g, "")}...`;
  return visibleLines;
};

const drawPdfPanel = (doc, x, y, width, height, fill = [255, 255, 255]) => {
  doc.setFillColor(...fill);
  doc.setDrawColor(219, 228, 238);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, "FD");
};

const drawPdfSectionTitle = (doc, label, x, y) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(String(label || "").toUpperCase(), x, y);
};

export const formatCurrency = (value) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

const addOneMonthAnchored = (value, preferredDay) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const originalDay = Number(preferredDay) || date.getDate();
  const originalMonth = date.getMonth();
  const originalYear = date.getFullYear();
  const lastDayOfNextMonth = new Date(originalYear, originalMonth + 2, 0).getDate();
  const safeDay = Math.min(originalDay, lastDayOfNextMonth);

  return new Date(originalYear, originalMonth + 1, safeDay, 12, 0, 0, 0);
};

export const getStatementRange = (client) => {
  if (!client?.DueDate) return { start: null, end: null };

  const start = new Date(client.DueDate);
  if (Number.isNaN(start.getTime())) return { start: null, end: null };

  const anchorDay = Number(client.SubscriptionCover) || start.getDate();
  const nextDue = addOneMonthAnchored(start, anchorDay);

  if (!nextDue) return { start, end: null };

  const end = new Date(nextDue);
  end.setDate(end.getDate() - 1);

  return { start, end };
};

const getPaymentDate = (row) => {
  const date = new Date(row?.TransactionDate || row?.PaymentDate || row?.createdAt || "");
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateOnlyTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const getClientInstallDate = (client) => {
  const candidates = [
    client?.DateEntry,
    client?.DateInstalled,
    client?.InstallDate,
    client?.createdAt
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
};

const getFirstBillableMonthStart = (client) => {
  const installDate = getClientInstallDate(client);
  if (!installDate) {
    return null;
  }

  return new Date(
    installDate.getFullYear(),
    installDate.getMonth() + 1,
    1,
    0,
    0,
    0,
    0
  );
};

const getClientReconnectDate = (client) => {
  const candidates = [
    client?.LastReconnectedAt,
    client?.ReconnectedAt,
    client?.ReconnectDate
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
};

const shouldSkipPreviousDueAfterReconnect = (client, billingDueDate, previousDueDate) => {
  const reconnectDate = getClientReconnectDate(client);
  if (!reconnectDate || !billingDueDate || !previousDueDate) {
    return false;
  }

  const reconnectMonthStart = new Date(
    reconnectDate.getFullYear(),
    reconnectDate.getMonth(),
    1,
    0,
    0,
    0,
    0
  );
  const nextReconnectMonthStart = new Date(
    reconnectDate.getFullYear(),
    reconnectDate.getMonth() + 1,
    1,
    0,
    0,
    0,
    0
  );
  const billingTime = getDateOnlyTime(billingDueDate);
  const previousTime = getDateOnlyTime(previousDueDate);

  return (
    billingTime !== null &&
    previousTime !== null &&
    previousTime >= reconnectMonthStart.getTime() &&
    billingTime >= nextReconnectMonthStart.getTime()
  );
};

const getBillingDueDate = (client, billingPeriod, fallbackRange) => {
  const year = Number(billingPeriod?.year);
  const month = Number(billingPeriod?.month);

  if (Number.isInteger(year) && Number.isInteger(month) && month >= 0 && month <= 11) {
    const currentDueDate = new Date(client?.DueDate || "");
    const dueDay = !Number.isNaN(currentDueDate.getTime())
      ? currentDueDate.getDate()
      : Number(client?.SubscriptionCover) || 1;
    const lastDay = new Date(year, month + 1, 0).getDate();

    return new Date(year, month, Math.min(dueDay, lastDay), 12, 0, 0, 0);
  }

  return client?.DueDate || fallbackRange?.start || null;
};

const getSelectedStatementRange = (client, billingPeriod) => {
  const year = Number(billingPeriod?.year);
  const month = Number(billingPeriod?.month);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    return getStatementRange(client);
  }

  const billingDueDate = getBillingDueDate(client, billingPeriod);
  if (!billingDueDate) {
    return {
      start: new Date(year, month, 1, 12, 0, 0, 0),
      end: new Date(year, month + 1, 0, 12, 0, 0, 0)
    };
  }

  const anchorDay = billingDueDate.getDate();
  const start = new Date(billingDueDate);
  const nextMonthLastDay = new Date(year, month + 2, 0).getDate();
  const nextDueDate = new Date(
    year,
    month + 1,
    Math.min(anchorDay, nextMonthLastDay),
    12,
    0,
    0,
    0
  );
  const end = new Date(nextDueDate);
  end.setDate(end.getDate() - 1);

  return { start, end };
};

const getPreviousBillingDueDate = (billingDueDate) => {
  if (!billingDueDate) {
    return null;
  }

  const dueDate = new Date(billingDueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const dueDay = dueDate.getDate();
  const previousMonthLastDay = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    0
  ).getDate();

  return new Date(
    dueDate.getFullYear(),
    dueDate.getMonth() - 1,
    Math.min(dueDay, previousMonthLastDay),
    0,
    0,
    0,
    0
  );
};

const getNextBillingDueDate = (billingDueDate) => {
  if (!billingDueDate) {
    return null;
  }

  const dueDate = new Date(billingDueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const dueDay = dueDate.getDate();
  const nextMonthLastDay = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth() + 2,
    0
  ).getDate();

  return new Date(
    dueDate.getFullYear(),
    dueDate.getMonth() + 1,
    Math.min(dueDay, nextMonthLastDay),
    0,
    0,
    0,
    0
  );
};

const isDateInDueCycle = (date, billingDueDate) => {
  if (!date || !billingDueDate) {
    return false;
  }

  const dueDate = new Date(billingDueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  const targetTime = getDateOnlyTime(date);
  const cycleStartTime = getDateOnlyTime(dueDate);
  const nextDueDate = getNextBillingDueDate(dueDate);
  const nextDueTime = nextDueDate ? getDateOnlyTime(nextDueDate) : null;

  return (
    targetTime !== null &&
    cycleStartTime !== null &&
    targetTime >= cycleStartTime &&
    (nextDueTime === null || targetTime < nextDueTime)
  );
};

const getCoverDates = (row) => {
  const coverText = String(row?.Cover || row?.SubscriptionCover || "").trim();
  const dates = [];

  if (!coverText) {
    return dates;
  }

  const monthDatePattern =
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/gi;
  const isoDatePattern = /\b\d{4}-\d{2}-\d{2}\b/g;
  const slashDatePattern = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;
  const matches = [
    ...(coverText.match(monthDatePattern) || []),
    ...(coverText.match(isoDatePattern) || []),
    ...(coverText.match(slashDatePattern) || [])
  ];

  matches.forEach((match) => {
    const date = new Date(match);
    if (!Number.isNaN(date.getTime())) {
      dates.push(date);
    }
  });

  return dates;
};

const isPrintEntryForDueCycle = (row, billingDueDate) => {
  const dueDate = new Date(billingDueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  const rowDueDate = row?.DueDate ? new Date(row.DueDate) : null;
  if (rowDueDate && isDateInDueCycle(rowDueDate, dueDate)) {
    return true;
  }

  return getCoverDates(row).some((coverDate) => isDateInDueCycle(coverDate, dueDate));
};

const getPaymentAmount = (row) =>
  Number(row?.TotalAmount || row?.Cash || row?.Amount || row?.PaymentAmount || 0);

const getPaymentsForDueCycle = (history, billingDueDate) =>
  (history || [])
    .filter((row) => isPrintEntryForDueCycle(row, billingDueDate))
    .sort((a, b) => {
      const left = getPaymentDate(a)?.getTime() || 0;
      const right = getPaymentDate(b)?.getTime() || 0;

      return right - left;
    });

const getPreviousDueBalance = ({ client, history, billingDueDate, monthlyDue }) => {
  const previousDueDate = getPreviousBillingDueDate(billingDueDate);

  if (!previousDueDate) {
    return 0;
  }

  const firstBillableMonthStart = getFirstBillableMonthStart(client);
  if (firstBillableMonthStart && previousDueDate < firstBillableMonthStart) {
    return 0;
  }

  if (shouldSkipPreviousDueAfterReconnect(client, billingDueDate, previousDueDate)) {
    return 0;
  }

  const paidForPreviousDue = getPaymentsForDueCycle(history, previousDueDate).reduce(
    (total, row) => total + getPaymentAmount(row),
    0
  );

  return Math.max(Number(monthlyDue || 0) - paidForPreviousDue, 0);
};

export default function BillingStatementContent({
  client,
  history = [],
  loading = false,
  error = "",
  embedded = false,
  billingPeriod = null,
  onClose,
  onBack
}) {
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY_NAME);
  const statementRange = useMemo(() => {
    return getSelectedStatementRange(client, billingPeriod);
  }, [billingPeriod, client]);
  const statementMonthDate =
    Number.isInteger(Number(billingPeriod?.year)) &&
    Number.isInteger(Number(billingPeriod?.month))
      ? new Date(Number(billingPeriod.year), Number(billingPeriod.month), 1, 12, 0, 0, 0)
      : statementRange.start;
  const statementMonth = statementMonthDate
    ? statementMonthDate.toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric"
      })
    : "Billing Statement";

  const billingDueDate = useMemo(
    () => getBillingDueDate(client, billingPeriod, statementRange),
    [billingPeriod, client, statementRange]
  );
  const sortedPaymentHistory = useMemo(
    () =>
      (history || []).slice().sort((a, b) => {
        const left = getPaymentDate(a)?.getTime() || 0;
        const right = getPaymentDate(b)?.getTime() || 0;

        return right - left;
      }),
    [history]
  );
  const latestPayment = sortedPaymentHistory[0] || null;
  const monthlyDue = Number(client?.AmountDue || 0);
  const previousDueBalance = billingPeriod
    ? getPreviousDueBalance({ client, history, billingDueDate, monthlyDue })
    : 0;
  const previousBalance =
    Math.max(Number(client?.Balance || 0), 0) + previousDueBalance;
  const totalDue = monthlyDue + previousBalance;

  useEffect(() => {
    let mounted = true;

    fetchSystemCompanyName()
      .then((nextCompanyName) => {
        if (mounted) {
          setCompanyName(nextCompanyName);
        }
      })
      .catch(() => {
        if (mounted) {
          setCompanyName(DEFAULT_COMPANY_NAME);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleGeneratePdf = async () => {
    if (!client) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const statementCovered =
      statementRange.start && statementRange.end
        ? `${formatDate(statementRange.start)} to ${formatDate(statementRange.end)}`
        : "-";
    let logoDataUrl = "";

    try {
      logoDataUrl = await loadImageDataUrl(BILLING_LOGO_SRC);
    } catch {
      logoDataUrl = "";
    }

    drawPdfPanel(doc, 14, 8, pageWidth - 28, 28, [255, 255, 255]);
    doc.setTextColor(15, 23, 42);
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", 22, 12, 82, 13);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(companyName, 22, 20);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(statementMonth, pageWidth - 34, 17, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Billing Statement", pageWidth - 34, 24, { align: "right" });

    const addressLines = getPdfTextLines(
      doc,
      client.Address || "No address provided",
      82,
      2
    );
    const infoPanelY = 44;
    drawPdfPanel(doc, 14, infoPanelY, 88, 36, [248, 251, 255]);
    drawPdfPanel(doc, 108, infoPanelY, 88, 36, [255, 255, 255]);

    drawPdfSectionTitle(doc, "Billed To", 20, infoPanelY + 8);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(client.ClientName || "-", 20, infoPanelY + 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(addressLines, 20, infoPanelY + 21);
    doc.text(`Contact: ${client.ContactNumber || "N/A"}`, 20, infoPanelY + 21 + addressLines.length * 4.5 + 3);

    drawPdfSectionTitle(doc, "Account Details", 114, infoPanelY + 8);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.7);
    doc.text(`Account Number: ${client.AccountNumber || "-"}`, 114, infoPanelY + 15);
    doc.text(`Plan: ${Number(client.AmountDue || 0).toLocaleString("en-PH")}`, 114, infoPanelY + 22);
    doc.text(`Billing Due Date: ${formatDate(billingDueDate)}`, 114, infoPanelY + 29);

    autoTable(doc, {
      startY: 90,
      body: [
        ["Monthly Due", formatCurrency(monthlyDue)],
        ["Previous Balance", formatCurrency(previousBalance)],
        ["Total Amount Due", formatCurrency(totalDue)],
        ["Subscription Covered", statementCovered]
      ],
      theme: "grid",
      styles: { fontSize: 9.2, cellPadding: 4, textColor: [15, 23, 42], minCellHeight: 12 },
      columnStyles: {
        0: { cellWidth: 62, fontStyle: "bold", textColor: [100, 116, 139] },
        1: { cellWidth: 110, fontStyle: "bold" }
      },
      margin: { left: 14, right: 14 }
    });

    const detailTableStartY = doc.lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: detailTableStartY,
      head: [["Description", "Amount"]],
      body: [
        ["Monthly internet service fee", formatCurrency(monthlyDue)],
        ["Previous balance carried forward", formatCurrency(previousBalance)],
        ["Total Amount Due", formatCurrency(totalDue)]
      ],
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 4, textColor: [15, 23, 42] },
      headStyles: { fillColor: [219, 234, 254], textColor: [15, 23, 42], fontStyle: "bold" },
      bodyStyles: { lineColor: [219, 228, 238] },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 52, halign: "right" } }
    });

    const latestPaymentY = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Latest Payment", 18, latestPaymentY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const latestPaymentLines = latestPayment
      ? [
          `Date: ${formatDate(latestPayment.TransactionDate || latestPayment.PaymentDate)}`,
          `Amount: ${formatCurrency(latestPayment.TotalAmount || latestPayment.Cash || 0)}`
        ]
      : ["No payment history found for this account yet."];

    doc.text(latestPaymentLines, 18, latestPaymentY + 7);

    const paymentNotesY = latestPaymentY + 7 + latestPaymentLines.length * 6 + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Payment Notes", 18, paymentNotesY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      [
        `Please settle your account on or before ${formatDate(billingDueDate)}.`,
        "Payments posted after the due date may affect service continuity depending on account status.",
        "Keep this billing statement for your records."
      ],
      18,
      paymentNotesY + 7
    );

    const fileName = `${String(client.AccountName || client.ClientName || "billing").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "")}_${statementMonth.replace(/\s+/g, "_")}.pdf`;
    doc.save(fileName);
  };

  if (loading) {
    return (
      <Paper sx={{ p: 5, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 260 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography sx={{ color: "#64748b" }}>Loading billing statement...</Typography>
        </Stack>
      </Paper>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>;
  }

  return (
    <Paper elevation={0} sx={{ borderRadius: embedded ? 0 : 4, border: embedded ? "none" : "1px solid #dbe4ee", overflow: "hidden", background: "#fff" }}>
      {embedded ? (
        <Box sx={{ px: 3, py: 2.25, background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #60a5fa 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Billing Statement</Typography>
            <Typography sx={{ opacity: 0.9, fontSize: "0.92rem" }}>{client?.ClientName || client?.AccountNumber || "Client"}</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={handleGeneratePdf} sx={{ textTransform: "none", fontWeight: 700, bgcolor: "rgba(255,255,255,0.16)", "&:hover": { bgcolor: "rgba(255,255,255,0.24)" } }}>
              Generate PDF
            </Button>
            {onClose ? <IconButton onClick={onClose} sx={{ color: "#fff" }}><CloseIcon /></IconButton> : null}
          </Stack>
        </Box>
      ) : (
        <Box sx={{ p: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Billing Statement</Typography>
          <Stack direction="row" spacing={1.5}>
            {onBack ? <Button variant="outlined" onClick={onBack}>Back</Button> : null}
            <Button variant="contained" startIcon={<PrintIcon />} onClick={handleGeneratePdf}>
              Generate PDF
            </Button>
          </Stack>
        </Box>
      )}

      <Box sx={{ p: { xs: 3, md: 5 } }}>
        <Box sx={{ px: { xs: 3, md: 5 }, py: { xs: 3, md: 4 }, background: "#fff", color: "#0f172a", border: "1px solid #dbe4ee", borderRadius: 2, mb: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between">
            <Box component="img" src={BILLING_LOGO_SRC} alt={companyName} sx={{ width: { xs: "100%", sm: 320, md: 380 }, maxWidth: "100%", maxHeight: 72, objectFit: "contain", objectPosition: "left center" }} />
            <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
              <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.1 }}>{statementMonth}</Typography>
              <Typography sx={{ mt: 1, color: "#64748b" }}>Billing Statement</Typography>
            </Box>
          </Stack>
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mb: 4 }}>
          <Paper elevation={0} sx={{ flex: 1.2, p: 3, borderRadius: 3, bgcolor: "#f8fbff", border: "1px solid #dbe4ee" }}>
            <Typography sx={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 800, letterSpacing: 1 }}>BILLED TO</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", mt: 1 }}>{client?.ClientName || "-"}</Typography>
            <Typography sx={{ color: "#475569", mt: 0.75 }}>{client?.Address || "No address provided"}</Typography>
            <Typography sx={{ color: "#475569", mt: 0.5 }}>Contact: {client?.ContactNumber || "N/A"}</Typography>
          </Paper>

          <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 3, bgcolor: "#fff", border: "1px solid #dbe4ee" }}>
            <Typography sx={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 800, letterSpacing: 1 }}>ACCOUNT DETAILS</Typography>
            <Stack spacing={1.15} sx={{ mt: 1.5 }}>
              <Typography><strong>Account Number:</strong> {client?.AccountNumber || "-"}</Typography>
              <Typography><strong>Plan:</strong> {Number(client?.AmountDue || 0).toLocaleString("en-PH")}</Typography>
              <Typography><strong>Billing Due Date:</strong> {formatDate(billingDueDate)}</Typography>
            </Stack>
          </Paper>
        </Stack>

        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: "1px solid #dbe4ee", mb: 4 }}>
          <Table>
            <TableBody>
              {[
                ["Monthly Due", formatCurrency(monthlyDue)],
                ["Previous Balance", formatCurrency(previousBalance)],
                ["Total Amount Due", formatCurrency(totalDue)],
                ["Subscription Covered", statementRange.start && statementRange.end ? `${formatDate(statementRange.start)} to ${formatDate(statementRange.end)}` : "-"]
              ].map((row) => (
                <TableRow key={row[0]}>
                  <TableCell sx={{ fontWeight: 800, color: "#64748b", bgcolor: "#fcfdff" }}>{row[0]}</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#0f172a" }}>{row[1]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: "1px solid #dbe4ee", mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "#eff6ff" }}>
                <TableCell sx={{ fontWeight: 800 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 800, width: 180 }}>Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Monthly internet service fee</TableCell>
                <TableCell>{formatCurrency(monthlyDue)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Previous balance carried forward</TableCell>
                <TableCell>{formatCurrency(previousBalance)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, color: "#0f172a" }}>Total Amount Due</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#0f172a" }}>{formatCurrency(totalDue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #dbe4ee", bgcolor: "#f8fafc", mb: 3 }}>
          <Typography sx={{ fontWeight: 800, color: "#0f172a", mb: 1.5 }}>Latest Payment</Typography>
          {latestPayment ? (
            <Stack spacing={1.1}>
              <Typography><strong>Date:</strong> {formatDate(latestPayment.TransactionDate || latestPayment.PaymentDate)}</Typography>
              <Typography><strong>Amount:</strong> {formatCurrency(latestPayment.TotalAmount || latestPayment.Cash || 0)}</Typography>
            </Stack>
          ) : (
            <Typography sx={{ color: "#64748b" }}>No payment history found for this account yet.</Typography>
          )}
        </Paper>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #dbe4ee" }}>
          <Typography sx={{ fontWeight: 800, color: "#0f172a", mb: 1.5 }}>Payment Notes</Typography>
          <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
            Please settle your account on or before <strong>{formatDate(billingDueDate)}</strong>.
            Payments posted after the due date may affect service continuity depending on account status.
          </Typography>
          <Typography sx={{ color: "#475569", lineHeight: 1.7, mt: 2 }}>
            Keep this billing statement for your records. Use the Generate PDF button above to download the billing file directly.
          </Typography>
        </Paper>
      </Box>
    </Paper>
  );
}
