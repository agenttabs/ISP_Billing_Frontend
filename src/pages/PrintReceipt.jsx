import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";
import { DEFAULT_COMPANY_NAME, fetchSystemCompanyName, normalizeCompanyName } from "../utils/companyName";

const QZ_TRAY_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js";
const RECEIPT_PRINTER_STORAGE_KEY = "isp_billing_receipt_printer_name";
const RECEIPT_LOGO_SRC = "/dns_logo.png";
let qzSecurityConfigured = false;

const defaultForm = {
  Name: "Default Thermal Receipt",
  CompanyName: DEFAULT_COMPANY_NAME,
  ReceiptTitle: "Official Payment Receipt",
  ReceiptSubtitle: "",
  FooterNote: "Thank you for your payment.",
  PreferredPrinterName: "----------",
  EnablePrinting: true,
  UseDirectPrint: true,
  ShowSubscriptionCover: true,
  ShowContactNumber: true,
  ShowReference: true,
  ShowCreatedBy: true
};

const fitReceiptText = (value, maxLength = 32) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? normalized.slice(0, Math.max(maxLength - 3, 1)) + "..."
    : normalized;
};

const formatReceiptAmount = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const loadReceiptLogoImage = () =>
  new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(null);
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = RECEIPT_LOGO_SRC;
  });

const createReceiptLogoBase64 = async () => {
  if (typeof document === "undefined") {
    return "";
  }

  const image = await loadReceiptLogoImage();

  if (!image) {
    return "";
  }

  const width = 384;
  const height = Math.max(
    1,
    Math.round(width / (image.naturalWidth / image.naturalHeight))
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    return "";
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/png").split(",")[1] || "";
};

const THERMAL_RECEIPT_CHAR_WIDTH = 48;

const createReceiptLine = (label, value, width = THERMAL_RECEIPT_CHAR_WIDTH) => {
  const safeLabel = fitReceiptText(label, width - 8);
  const safeValue = fitReceiptText(value, width - safeLabel.length - 1);
  const gap = Math.max(width - safeLabel.length - safeValue.length, 1);
  return `${safeLabel}${" ".repeat(gap)}${safeValue}`;
};

const wrapReceiptText = (value, maxLength = THERMAL_RECEIPT_CHAR_WIDTH) => {
  const words = String(value || "-").replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLength) {
      current = next;
      return;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : ["-"];
};

const createWrappedReceiptField = (
  label,
  value,
  width = THERMAL_RECEIPT_CHAR_WIDTH,
  maxLines = null
) => {
  const wrappedLines = wrapReceiptText(value || "-", width);
  const visibleLines = maxLines ? wrappedLines.slice(0, maxLines) : wrappedLines;
  return [
    `${label}\n`,
    ...visibleLines.map((line) => `  ${line}\n`)
  ];
};

const loadQzTrayScript = () =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window is not available."));
      return;
    }

    if (window.qz) {
      resolve(window.qz);
      return;
    }

    const existingScript = document.querySelector('script[data-qz-tray="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.qz));
      existingScript.addEventListener("error", () => reject(new Error("Failed to load QZ Tray script.")));
      return;
    }

    const script = document.createElement("script");
    script.src = QZ_TRAY_SCRIPT_URL;
    script.async = true;
    script.dataset.qzTray = "true";
    script.onload = () => resolve(window.qz);
    script.onerror = () => reject(new Error("Failed to load QZ Tray script."));
    document.body.appendChild(script);
  });

const configureQzSecurity = (qz) => {
  if (!qz?.security || qzSecurityConfigured) {
    return;
  }

  qz.security.setCertificatePromise((resolve, reject) => {
    API.get("/qz/certificate", { responseType: "text" })
      .then(({ data }) => resolve(data))
      .catch((error) =>
        reject(
          new Error(
            error.response?.data?.error ||
              error.response?.data?.message ||
              error.message ||
              "Failed to load QZ certificate."
          )
        )
      );
  });

  if (typeof qz.security.setSignatureAlgorithm === "function") {
    qz.security.setSignatureAlgorithm("SHA512");
  }

  qz.security.setSignaturePromise((request) => (resolve, reject) => {
    API.post("/qz/sign", { request })
      .then(({ data }) => resolve(data?.signature || data))
      .catch((error) =>
        reject(
          new Error(
            error.response?.data?.error ||
              error.response?.data?.message ||
              error.message ||
              "Failed to sign QZ request."
          )
        )
      );
  });

  qzSecurityConfigured = true;
};

const getAvailablePrinterNames = async (qz) => {
  try {
    const details = await qz.printers.details();
    if (Array.isArray(details) && details.length) {
      return details
        .map((printer) =>
          String(printer?.name || printer?.printerName || printer || "").trim()
        )
        .filter(Boolean);
    }
  } catch (error) {
    // Older QZ versions may not support details(), so try find() below.
  }

  try {
    const printers = await qz.printers.find();
    if (Array.isArray(printers)) {
      return printers.map((printer) => String(printer || "").trim()).filter(Boolean);
    }
    return printers ? [String(printers).trim()].filter(Boolean) : [];
  } catch (error) {
    return [];
  }
};

const resolveReceiptPrinterName = async (qz, preferredPrinterName = "") => {
  const savedPrinterName =
    typeof window !== "undefined"
      ? window.localStorage.getItem(RECEIPT_PRINTER_STORAGE_KEY) || ""
      : "";

  const candidateNames = [
    preferredPrinterName,
    savedPrinterName,
    "Xprinter",
    "Xprinter XP-80",
    "XP-58",
    "XP-80"
  ]
    .map((value) => String(value || "").trim())
    .filter((value) => value && value !== "----------");

  for (const candidate of candidateNames) {
    try {
      const printer = await qz.printers.find(candidate);
      if (printer) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(RECEIPT_PRINTER_STORAGE_KEY, printer);
        }
        return printer;
      }
    } catch (error) {
      // Keep trying the next configured printer name.
    }
  }

  const availablePrinters = await getAvailablePrinterNames(qz);
  const normalizedCandidates = candidateNames.map((candidate) => candidate.toLowerCase());
  const fuzzyMatch = availablePrinters.find((printer) => {
    const normalizedPrinter = printer.toLowerCase();
    return normalizedCandidates.some(
      (candidate) =>
        normalizedPrinter === candidate ||
        normalizedPrinter.includes(candidate) ||
        candidate.includes(normalizedPrinter)
    );
  });

  if (fuzzyMatch) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RECEIPT_PRINTER_STORAGE_KEY, fuzzyMatch);
    }
    return fuzzyMatch;
  }

  const availableMessage = availablePrinters.length
    ? ` Available printers: ${availablePrinters.join(", ")}.`
    : " No printers were returned by QZ Tray.";

  const directPrinterName = String(preferredPrinterName || "").trim();
  if (directPrinterName && directPrinterName !== "----------") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RECEIPT_PRINTER_STORAGE_KEY, directPrinterName);
    }
    return directPrinterName;
  }

  throw new Error(`Xprinter printer was not found.${availableMessage}`);
};

const buildTestEscPosReceiptData = async (config) => {
  const paymentLines = [
    { method: "CASH", amount: 500, reference: "" },
    { method: "GCASH", amount: 1000, reference: "8039947123436" }
  ];
  const paymentMode = [...new Set(paymentLines.map((line) => line.method).filter(Boolean))].join("/");
  const logoBase64 = await createReceiptLogoBase64();
  const lines = [
    "\x1B\x61\x01",
    `${fitReceiptText(config.ReceiptTitle || "Official Payment Receipt", THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    config.ReceiptSubtitle ? `${fitReceiptText(config.ReceiptSubtitle, THERMAL_RECEIPT_CHAR_WIDTH)}\n` : "",
    `${"=".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    "\x1B\x61\x00",
    `${createReceiptLine("Receipt No.", "PR-TEST-0001")}\n`,
    `${createReceiptLine("Invoice No.", "SI-TEST-0001")}\n`,
    `${createReceiptLine("Date", new Date().toLocaleString("en-PH"))}\n`,
    `${createReceiptLine("Name", "JUAN DELA CRUZ")}\n`,
    `${createReceiptLine("Plan", "PHP 1,000.00")}\n`,
    config.ShowContactNumber ? `${createReceiptLine("Contact", "09167700957")}\n` : "",
    ...(config.ShowSubscriptionCover
      ? createWrappedReceiptField(
          "Subscription Cover",
          "Subscription covered from May 15, 2026 to June 14, 2026",
          THERMAL_RECEIPT_CHAR_WIDTH,
          2
        )
      : []),
    `${"-".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    `${createReceiptLine("Payment Mode", paymentMode || "-")}\n`,
    `${"-".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n`
  ];

  paymentLines.forEach((line) => {
    lines.push(`${createReceiptLine(line.method, formatReceiptAmount(line.amount))}\n`);

    if (config.ShowReference && line.reference) {
      lines.push(`${createReceiptLine("Ref", line.reference)}\n`);
    }
  });

  lines.push(
    `${"-".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    `${createReceiptLine("Total Paid", formatReceiptAmount(1500))}\n`,
    `${"-".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    config.ShowCreatedBy ? `${createReceiptLine("Received by", "admin")}\n` : "",
    "\n",
    "\x1B\x61\x01",
    `${fitReceiptText(config.FooterNote || "Thank you for your payment.", THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    "\x1B\x64\x04",
    "\x1D\x56\x00"
  );

  const printData = [
    {
      type: "raw",
      format: "command",
      flavor: "plain",
      data: "\x1B\x40\x1B\x61\x01"
    }
  ];

  if (logoBase64) {
    printData.push(
      {
        type: "raw",
        format: "image",
        flavor: "base64",
        data: logoBase64,
        options: { language: "ESCPOS", dotDensity: "double" }
      },
      {
        type: "raw",
        format: "command",
        flavor: "plain",
        data: "\n"
      }
    );
  } else {
    printData.push({
      type: "raw",
      format: "command",
      flavor: "plain",
      data: `${fitReceiptText(normalizeCompanyName(config.CompanyName), THERMAL_RECEIPT_CHAR_WIDTH)}\n`
    });
  }

  printData.push({
    type: "raw",
    format: "command",
    flavor: "plain",
    data: lines.join("")
  });

  return printData;
};

const tryDirectTestPrint = async (config) => {
  const qz = await loadQzTrayScript();

  if (!qz) {
    throw new Error("QZ Tray is not available.");
  }

  configureQzSecurity(qz);

  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }

  const printerName = await resolveReceiptPrinterName(qz, config.PreferredPrinterName);
  const printerConfig = qz.configs.create(printerName);

  await qz.print(printerConfig, await buildTestEscPosReceiptData(config));
};

const openTestReceiptPrint = (config) => {
  if (typeof window === "undefined") {
    return;
  }

  const receiptWindow = window.open("", "_blank", "width=420,height=900");

  if (!receiptWindow) {
    return;
  }

  const paymentLines = [
    { method: "CASH", amount: 500, reference: "" },
    { method: "GCASH", amount: 1000, reference: "8039947123436" }
  ];

  const paymentBreakdownHtml = paymentLines
    .map(
      (line) => `
        <tr>
          <td>${line.method}</td>
          <td style="text-align:right">PHP ${Number(line.amount || 0).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}</td>
        </tr>
        ${
          config.ShowReference && line.reference
            ? `<tr><td colspan="2" style="font-size:11px;color:#475569">Ref: ${line.reference}</td></tr>`
            : ""
        }
      `
    )
    .join("");
  const receiptLogoUrl = `${window.location.origin}${RECEIPT_LOGO_SRC}`;

  receiptWindow.document.write(`
    <html>
      <head>
        <title>Test Receipt</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #0f172a;
            background: #ffffff;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
          .receipt {
            box-sizing: border-box;
            width: 80mm;
            margin: 0;
            border: 1px dashed #cbd5e1;
            padding: 3mm;
          }
          .center { text-align: center; }
          .logo {
            display: block;
            width: 58mm;
            max-width: 100%;
            height: auto;
            margin: 0 auto 3mm;
          }
          .title { font-weight: 700; font-size: 18px; margin-bottom: 4px; }
          .subtitle { font-size: 12px; color: #475569; margin-bottom: 12px; }
          .meta, .section-note { font-size: 12px; color: #334155; line-height: 1.55; }
          .line {
            border-top: 1px dashed #cbd5e1;
            margin: 10px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          td {
            padding: 3px 0;
            vertical-align: top;
          }
          .total {
            font-weight: 700;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <img class="logo" src="${receiptLogoUrl}" alt="${config.CompanyName || "-"}" />
          <div class="center title" style="font-size:15px;">${config.ReceiptTitle || "-"}</div>
          <div class="center subtitle">${config.ReceiptSubtitle || "-"}</div>

          <div class="meta">Receipt No.: PR-TEST-0001</div>
          <div class="meta">Invoice No.: SI-TEST-0001</div>
          <div class="meta">Date: ${new Date().toLocaleString("en-PH")}</div>
          <div class="meta">Name: JUAN DELA CRUZ</div>
          <div class="meta">Plan: PHP 1,000.00</div>
          ${config.ShowContactNumber ? '<div class="meta">Contact: 09167700957</div>' : ""}
          ${config.ShowSubscriptionCover ? '<div class="meta">Subscription: May 15, 2026 to June 14, 2026</div>' : ""}

          <div class="line"></div>
          <table>
            <tbody>
              ${paymentBreakdownHtml}
              <tr>
                <td class="total">Total Paid</td>
                <td class="total" style="text-align:right">PHP 1,500.00</td>
              </tr>
            </tbody>
          </table>
          <div class="line"></div>

          ${config.ShowCreatedBy ? '<div class="section-note">Received By: admin</div>' : ""}
          <div class="section-note">${config.FooterNote || "-"}</div>
        </div>
        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  receiptWindow.document.close();
};

export default function PrintReceipt() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadConfig = async () => {
    try {
      const [{ data }, companyName] = await Promise.all([
        API.get("/print-receipt"),
        fetchSystemCompanyName().catch(() => DEFAULT_COMPANY_NAME)
      ]);
      setForm((prev) => ({
        ...prev,
        ...data,
        CompanyName: normalizeCompanyName(companyName)
      }));
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load print receipt settings.");
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const { data } = await API.put("/print-receipt", form);
      setForm((prev) => ({
        ...prev,
        ...data
      }));
      setSuccess("Print receipt settings saved successfully.");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.error || "Failed to save print receipt settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = async () => {
    setError("");
    setSuccess("");

    if (!form.EnablePrinting) {
      setError("Printing is disabled. Turn on Enable Printing first.");
      return;
    }

    if (form.UseDirectPrint) {
      try {
        await tryDirectTestPrint(form);
        setSuccess("Test receipt sent to the configured Xprinter.");
        return;
      } catch (err) {
        setError(
          err.response?.data?.error ||
            err.message ||
            "Direct print failed. Please check QZ Tray, certificate, and printer name."
        );
        return;
      }
    }

    openTestReceiptPrint(form);
  };

  return (
    <Box>
      <Stack spacing={3}>
        <PageHeader
          title="Print Receipt"
          subtitle="Maintain the thermal receipt header, footer, printer name, and printed fields for Xprinter receipts."
          action={
            <Button
              variant="outlined"
              startIcon={<PrintOutlinedIcon />}
              onClick={loadConfig}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Refresh
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
                  label="Template Name"
                  value={form.Name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Name: event.target.value }))
                  }
                  fullWidth
                />

                <TextField
                  label="Preferred Printer Name"
                  value={form.PreferredPrinterName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      PreferredPrinterName: event.target.value
                    }))
                  }
                  fullWidth
                  helperText="Example: Xprinter, XP-58, XP-80"
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Company Name"
                  value={form.CompanyName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      CompanyName: event.target.value
                    }))
                  }
                  fullWidth
                />

                <TextField
                  label="Receipt Title"
                  value={form.ReceiptTitle}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      ReceiptTitle: event.target.value
                    }))
                  }
                  fullWidth
                />
              </Stack>

              <TextField
                label="Receipt Subtitle"
                value={form.ReceiptSubtitle}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    ReceiptSubtitle: event.target.value
                  }))
                }
                fullWidth
              />

              <TextField
                label="Footer Note"
                value={form.FooterNote}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    FooterNote: event.target.value
                  }))
                }
                fullWidth
                multiline
                rows={3}
              />

              <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap">
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.EnablePrinting}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          EnablePrinting: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Enable Printing"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.UseDirectPrint}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          UseDirectPrint: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Use Direct Print (QZ Tray)"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.ShowSubscriptionCover}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          ShowSubscriptionCover: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Show Subscription Cover"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.ShowContactNumber}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          ShowContactNumber: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Show Contact Number"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.ShowReference}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          ShowReference: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Show Reference"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.ShowCreatedBy}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          ShowCreatedBy: event.target.checked
                        }))
                      }
                    />
                  }
                  label="Show Received By"
                />
              </Stack>

              <Box
                sx={{
                  border: "1px dashed #cbd5e1",
                  borderRadius: 3,
                  p: 2.5,
                  backgroundColor: "#f8fafc"
                }}
              >
                <Typography sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Receipt Preview
                </Typography>
                <Box
                  sx={{
                    width: "100%",
                    maxWidth: 360,
                    mb: 2,
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <Box
                    component="img"
                    src={RECEIPT_LOGO_SRC}
                    alt={form.CompanyName || DEFAULT_COMPANY_NAME}
                    sx={{
                      display: "block",
                      width: "100%",
                      maxWidth: 280,
                      height: "auto",
                      mx: "auto",
                      mb: 1.5
                    }}
                  />
                  <Typography sx={{ textAlign: "center", fontWeight: 700, color: "#0f172a" }}>
                    {form.ReceiptTitle || "-"}
                  </Typography>
                  {form.ReceiptSubtitle ? (
                    <Typography sx={{ textAlign: "center", color: "#64748b", fontSize: 13 }}>
                      {form.ReceiptSubtitle}
                    </Typography>
                  ) : null}
                </Box>
                <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                  Company: {form.CompanyName || "-"}
                </Typography>
                <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                  Title: {form.ReceiptTitle || "-"}
                </Typography>
                <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                  Subtitle: {form.ReceiptSubtitle || "-"}
                </Typography>
                <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                  Footer: {form.FooterNote || "-"}
                </Typography>
                <Typography sx={{ color: "#475569", lineHeight: 1.7 }}>
                  Printing: {form.EnablePrinting ? "Enabled" : "Disabled"}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
                <Button
                  type="button"
                  variant="outlined"
                  startIcon={<PrintOutlinedIcon />}
                  onClick={handleTestPrint}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Test Print
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={loading}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {loading ? "Saving..." : "Save Receipt Design"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
