import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import API from "../api/api";
import PageHeader from "../layout/PageHeader";
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

const formatCurrency = (value) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

const getPdfTextLines = (doc, value, maxWidth, maxLines = 2) => {
  const lines = doc.splitTextToSize(String(value || "").trim() || "-", maxWidth);

  if (lines.length <= maxLines) {
    return lines;
  }

  const visibleLines = lines.slice(0, maxLines);
  const lastLineIndex = visibleLines.length - 1;
  const lastLine = visibleLines[lastLineIndex] || "";
  visibleLines[lastLineIndex] =
    lastLine.length > 3 ? `${lastLine.slice(0, -3).trimEnd()}...` : "...";

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

const addOneMonthAnchored = (value, preferredDay) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const originalDay = Number(preferredDay) || date.getDate();
  const originalMonth = date.getMonth();
  const originalYear = date.getFullYear();
  const lastDayOfNextMonth = new Date(
    originalYear,
    originalMonth + 2,
    0
  ).getDate();
  const safeDay = Math.min(originalDay, lastDayOfNextMonth);

  return new Date(originalYear, originalMonth + 1, safeDay, 12, 0, 0, 0);
};

const getStatementRange = (client) => {
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

export default function Billing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [history, setHistory] = useState([]);
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY_NAME);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [clientsResponse, nextCompanyName] = await Promise.all([
          API.get("/clients"),
          fetchSystemCompanyName().catch(() => DEFAULT_COMPANY_NAME)
        ]);
        const matchedClient = (clientsResponse.data || []).find(
          (item) => String(item._id) === String(id)
        );

        if (!matchedClient) {
          throw new Error("Client record not found.");
        }

        const historyResponse = await API.get("/transactions", {
          params: {
            accountNumber: matchedClient.AccountNumber || ""
          }
        });

        if (!mounted) return;

        setClient(matchedClient);
        setHistory(historyResponse.data || []);
        setCompanyName(nextCompanyName);
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.error || err.message || "Failed to load billing data.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [id]);

  const statementRange = useMemo(() => getStatementRange(client), [client]);
  const statementMonth = statementRange.start
    ? statementRange.start.toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric"
      })
    : "Billing Statement";

  const latestPayment = history[0] || null;
  const previousBalance = Math.max(Number(client?.Balance || 0), 0);
  const monthlyDue = Number(client?.AmountDue || 0);
  const totalDue = monthlyDue + previousBalance;

  const handleGeneratePdf = async () => {
    if (!client) {
      return;
    }

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
    doc.text(`Billing Due Date: ${formatDate(client.DueDate)}`, 114, infoPanelY + 29);

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

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Description", "Amount"]],
      body: [
        ["Monthly internet service fee", formatCurrency(monthlyDue)],
        ["Previous balance carried forward", formatCurrency(previousBalance)],
        ["Total Amount Due", formatCurrency(totalDue)]
      ],
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 4,
        textColor: [15, 23, 42]
      },
      headStyles: {
        fillColor: [219, 234, 254],
        textColor: [15, 23, 42],
        fontStyle: "bold"
      },
      bodyStyles: {
        lineColor: [219, 228, 238]
      },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 52, halign: "right" }
      }
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

    const paymentNotesY =
      latestPaymentY + 7 + latestPaymentLines.length * 6 + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Payment Notes", 18, paymentNotesY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      [
        `Please settle your account on or before ${formatDate(client.DueDate)}.`,
        "Payments posted after the due date may affect service continuity depending on account status.",
        "Keep this billing statement for your records."
      ],
      18,
      paymentNotesY + 7
    );

    const fileName = `${String(client.AccountName || client.ClientName || "billing")
      .replace(/[^\w-]+/g, "_")
      .replace(/^_+|_+$/g, "")}_${statementMonth.replace(/\s+/g, "_")}.pdf`;

    doc.save(fileName);
  };

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ "@media print": { display: "none" } }}>
        <PageHeader
          title="Billing Statement"
          subtitle="Review and generate a billing PDF file for this client."
          action={
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate("/clients")}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Back to Clients
              </Button>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={handleGeneratePdf}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Generate PDF
              </Button>
            </Stack>
          }
        />
      </Box>

      {loading ? (
        <Paper
          sx={{
            p: 5,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 260
          }}
        >
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography sx={{ color: "#64748b" }}>
              Loading billing statement...
            </Typography>
          </Stack>
        </Paper>
      ) : error ? (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      ) : (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            border: "1px solid #dbe4ee",
            overflow: "hidden",
            background: "#fff",
            "@media print": {
              boxShadow: "none",
              border: "none",
              borderRadius: 0
            }
          }}
        >
          <Box
            sx={{
              px: { xs: 3, md: 5 },
              py: { xs: 3, md: 4 },
              background: "#fff",
              color: "#0f172a",
              borderBottom: "1px solid #dbe4ee"
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "flex-start" }}
            >
              <Box
                component="img"
                src={BILLING_LOGO_SRC}
                alt={companyName}
                sx={{
                  width: { xs: "100%", sm: 320, md: 380 },
                  maxWidth: "100%",
                  maxHeight: 72,
                  objectFit: "contain",
                  objectPosition: "left center"
                }}
              />
              <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {statementMonth}
                </Typography>
                <Typography sx={{ mt: 1, color: "#64748b" }}>Billing Statement</Typography>
              </Box>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 3, md: 5 } }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={3}
              sx={{ mb: 4 }}
            >
              <Paper
                elevation={0}
                sx={{
                  flex: 1.2,
                  p: 3,
                  borderRadius: 3,
                  bgcolor: "#f8fbff",
                  border: "1px solid #dbe4ee"
                }}
              >
                <Typography sx={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 800, letterSpacing: 1 }}>
                  BILLED TO
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", mt: 1 }}>
                  {client?.ClientName || "-"}
                </Typography>
                <Typography sx={{ color: "#475569", mt: 0.75 }}>
                  {client?.Address || "No address provided"}
                </Typography>
                <Typography sx={{ color: "#475569", mt: 0.5 }}>
                  Contact: {client?.ContactNumber || "N/A"}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  p: 3,
                  borderRadius: 3,
                  bgcolor: "#fff",
                  border: "1px solid #dbe4ee"
                }}
              >
                <Typography sx={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 800, letterSpacing: 1 }}>
                  ACCOUNT DETAILS
                </Typography>
                <Stack spacing={1.15} sx={{ mt: 1.5 }}>
                  <Typography><strong>Account Number:</strong> {client?.AccountNumber || "-"}</Typography>
                  <Typography><strong>Plan:</strong> {Number(client?.AmountDue || 0).toLocaleString("en-PH")}</Typography>
                  <Typography><strong>Current Due Date:</strong> {formatDate(client?.DueDate)}</Typography>
                </Stack>
              </Paper>
            </Stack>

            <TableContainer
              component={Paper}
              elevation={0}
              sx={{ borderRadius: 3, border: "1px solid #dbe4ee", mb: 4 }}
            >
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

            <TableContainer
              component={Paper}
              elevation={0}
              sx={{ borderRadius: 3, border: "1px solid #dbe4ee", mb: 4 }}
            >
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
                    <TableCell sx={{ fontWeight: 800, color: "#0f172a" }}>
                      Total Amount Due
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, color: "#0f172a" }}>
                      {formatCurrency(totalDue)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                border: "1px solid #dbe4ee",
                bgcolor: "#f8fafc",
                mb: 3
              }}
            >
              <Typography sx={{ fontWeight: 800, color: "#0f172a", mb: 1.5 }}>
                Latest Payment
              </Typography>
              {latestPayment ? (
                <Stack spacing={1.1}>
                  <Typography><strong>Date:</strong> {formatDate(latestPayment.TransactionDate || latestPayment.PaymentDate)}</Typography>
                  <Typography><strong>Amount:</strong> {formatCurrency(latestPayment.TotalAmount || latestPayment.Cash || 0)}</Typography>
                </Stack>
              ) : (
                <Typography sx={{ color: "#64748b" }}>
                  No payment history found for this account yet.
                </Typography>
              )}
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                border: "1px solid #dbe4ee"
              }}
            >
              <Typography sx={{ fontWeight: 800, color: "#0f172a", mb: 1.5 }}>
                Payment Notes
              </Typography>
              <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                Please settle your account on or before <strong>{formatDate(client?.DueDate)}</strong>.
                Payments posted after the due date may affect service continuity depending on account status.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                Keep this billing statement for your records. Use the Generate PDF button above to
                download the billing file directly.
              </Typography>
            </Paper>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
