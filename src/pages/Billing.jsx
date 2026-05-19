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

  const handleGeneratePdf = () => {
    if (!client) {
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const rightEdge = pageWidth - 18;
    const statementTitle = `Billing Statement - ${statementMonth}`;
    const statementCovered =
      statementRange.start && statementRange.end
        ? `${formatDate(statementRange.start)} to ${formatDate(statementRange.end)}`
        : "-";

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 34, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(companyName, 18, 14);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(statementTitle, 18, 22);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Billed To", 18, 46);
    doc.text("Account Details", 112, 46);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(client.ClientName || "-", 18, 53);
    doc.text(client.Address || "No address provided", 18, 59);
    doc.text(`Contact: ${client.ContactNumber || "N/A"}`, 18, 65);

    doc.text(`Account Number: ${client.AccountNumber || "-"}`, 112, 53);
    doc.text(`Plan: ${formatCurrency(client.AmountDue || 0)}`, 112, 59);
    doc.text(`Due Date: ${formatDate(client.DueDate)}`, 112, 65);

    autoTable(doc, {
      startY: 80,
      head: [["Summary", "Value"]],
      body: [
        ["Monthly Due", formatCurrency(monthlyDue)],
        ["Previous Balance", formatCurrency(previousBalance)],
        ["Total Amount Due", formatCurrency(totalDue)],
        ["Subscription Covered", statementCovered]
      ],
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 4,
        textColor: [15, 23, 42]
      },
      headStyles: {
        fillColor: [239, 246, 255],
        textColor: [15, 23, 42],
        fontStyle: "bold"
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 102 }
      }
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
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
              background:
                "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #60a5fa 100%)",
              color: "#fff"
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "flex-start" }}
            >
              <Box>
                <Typography sx={{ fontSize: "0.9rem", letterSpacing: 1.5, opacity: 0.9 }}>
                  {companyName}
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.1, mt: 0.75 }}>
                  {statementMonth}
                </Typography>
                <Typography sx={{ mt: 1, opacity: 0.9 }}>Billing Statement</Typography>
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

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              sx={{ mb: 4 }}
            >
              {[
                { label: "Monthly Due", value: formatCurrency(monthlyDue) },
                { label: "Previous Balance", value: formatCurrency(previousBalance) },
                { label: "Total Amount Due", value: formatCurrency(totalDue) },
                { label: "Subscription Covered", value: statementRange.start && statementRange.end ? `${formatDate(statementRange.start)} to ${formatDate(statementRange.end)}` : "-" }
              ].map((item) => (
                <Paper
                  key={item.label}
                  elevation={0}
                  sx={{
                    flex: 1,
                    p: 2.5,
                    borderRadius: 3,
                    border: "1px solid #dbe4ee",
                    bgcolor: "#fcfdff"
                  }}
                >
                  <Typography sx={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 800, letterSpacing: 0.7 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ mt: 1, fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                    {item.value}
                  </Typography>
                </Paper>
              ))}
            </Stack>

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
