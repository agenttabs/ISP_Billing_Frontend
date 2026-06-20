import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TablePagination,
  TextField,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Card,
  CardContent,
  Switch,
  Tabs,
  Tab,
  CircularProgress,
  Stack
  } from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import ReceiptIcon from "@mui/icons-material/Receipt";
import PaymentIcon from "@mui/icons-material/Payment";
import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
import RouterIcon from "@mui/icons-material/Router";
import HistoryEduOutlinedIcon from "@mui/icons-material/HistoryEduOutlined";
import BuildCircleOutlinedIcon from "@mui/icons-material/BuildCircleOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { io } from "socket.io-client";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CloseIcon from "@mui/icons-material/Close";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import Tesseract from "tesseract.js";

import API, { SOCKET_BASE_URL } from "../api/api";
import BillingStatementContent from "../components/BillingStatementContent";
import PageHeader from "../layout/PageHeader";
import { useAuth } from "../context/auth.context";
import { useClient } from "../context/client.context";
import { DEFAULT_COMPANY_NAME, normalizeCompanyName } from "../utils/companyName";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPAIR_SMS_TEMPLATE_TYPE = "smsRepairTech";
const getTodayLocalDate = () => dayjs().format("YYYY-MM-DD");

const formatDateToMMDDYYYY = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();

  return `${mm}/${dd}/${yyyy}`;
};

const formatOltFiberReadDisplay = (value) => {
  const readings = String(value || "")
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);

  if (readings.length <= 1) {
    return readings[0] || "-";
  }

  return readings.reverse().join(" / ");
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const replaceTemplateTokens = (body, values) =>
  Object.entries(values).reduce((message, [key, value]) => {
    return String(message || "").split(`@${key}@`).join(String(value ?? ""));
  }, String(body || ""));

const createPaymentEntry = (overrides = {}) => ({
  method: "CASH",
  amount: "",
  reference: "",
  receiptAmount: "",
  transferDate: "",
  receiverLast4: "",
  receiptImageUrl: "",
  receiptImageDataUrl: "",
  ...overrides
});

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file as data URL."));
    reader.readAsDataURL(file);
  });

const MAX_RECEIPT_IMAGE_SIDE = 900;
const MAX_RECEIPT_IMAGE_DATA_URL_LENGTH = 260000;

const compressReceiptImageToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const scale = Math.min(
          1,
          MAX_RECEIPT_IMAGE_SIDE / Math.max(image.width || 1, image.height || 1)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((image.width || 1) * scale));
        canvas.height = Math.max(1, Math.round((image.height || 1) * scale));

        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const qualities = [0.72, 0.62, 0.52, 0.42, 0.34];
        let compressed = "";

        for (const quality of qualities) {
          compressed = canvas.toDataURL("image/jpeg", quality);
          if (compressed.length <= MAX_RECEIPT_IMAGE_DATA_URL_LENGTH) {
            break;
          }
        }

        URL.revokeObjectURL(objectUrl);
        resolve(compressed);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to prepare receipt image."));
    };

    image.src = objectUrl;
  });

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const getReceiptImageSource = (value) => {
  const raw = String(value || "").trim().replace(/\\/g, "/");
  if (!raw) {
    return "";
  }

  if (raw.startsWith("data:") || raw.startsWith("blob:") || /^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/api/uploads/")) {
    return `${SOCKET_BASE_URL}${raw.replace(/^\/api/, "")}`;
  }

  if (raw.startsWith("/uploads/") || raw.startsWith("uploads/")) {
    const uploadPath = raw.startsWith("/") ? raw : `/${raw}`;
    return `${SOCKET_BASE_URL}${uploadPath}`;
  }

  return `data:image/jpeg;base64,${raw}`;
};

const resolveReceiptImagePreviewSource = async (value) => {
  const source = getReceiptImageSource(value);

  if (!source || !/^https?:\/\//i.test(source) || !source.includes("/uploads/")) {
    return source;
  }

  const response = await fetch(source, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Receipt image request failed with ${response.status}.`);
  }

  return URL.createObjectURL(await response.blob());
};

const toSalesInvoiceNumber = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (raw.startsWith("PR-")) {
    return `SI-${raw.slice(3)}`;
  }

  if (raw.startsWith("SI-")) {
    return raw;
  }

  return raw.startsWith("SI") ? raw : `SI-${raw}`;
};

const DEFAULT_FOOTER_NOTE = "Please keep this receipt as proof of payment.\nThank you for your payment.";

const defaultReceiptPrintConfig = {
  Name: "Default Thermal Receipt",
  CompanyName: DEFAULT_COMPANY_NAME,
  ReceiptTitle: "Acknowledgement Receipt",
  ReceiptSubtitle: "",
  FooterNote: DEFAULT_FOOTER_NOTE,
  PreferredPrinterName: "",
  PrinterConnectionType: "USB",
  NetworkPrinterHost: "",
  NetworkPrinterPort: "9100",
  EnablePrinting: true,
  UseDirectPrint: true,
  ShowSubscriptionCover: true,
  ShowContactNumber: true,
  ShowReference: true,
  ShowCreatedBy: true
};

const isNetworkReceiptPrinter = (config = {}) =>
  String(config.PrinterConnectionType || "").trim().toUpperCase() === "NETWORK";

const normalizeReceiptPrinterPort = (value) => {
  const port = Number(String(value || "").trim());
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 9100;
};

const RECEIPT_LOGO_SRC = "/dns_logo.png";

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

const normalizeBooleanSetting = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const normalized = String(value ?? "").trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;

  return fallback;
};

const QZ_TRAY_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js";
const RECEIPT_PRINTER_STORAGE_KEY = "isp_billing_receipt_printer_name";
let qzSecurityConfigured = false;

const formatReceiptAmount = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const formatReceiptPlanAmount = (value) => {
  const amount = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? `PHP ${formatReceiptAmount(amount)}` : "";
};

const formatReceiptDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || "").trim();
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const getReceiptFooterLines = (value, fallback = DEFAULT_FOOTER_NOTE) =>
  String(value || fallback || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const fitReceiptText = (value, maxLength = 32) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? normalized.slice(0, Math.max(maxLength - 3, 1)) + "..."
    : normalized;
};

const THERMAL_RECEIPT_CHAR_WIDTH = 48;

const createReceiptLine = (label, value, width = THERMAL_RECEIPT_CHAR_WIDTH) => {
  const safeLabel = fitReceiptText(label, width - 8);
  const safeValue = fitReceiptText(value, width - safeLabel.length - 1);
  const gap = Math.max(width - safeLabel.length - safeValue.length, 1);
  return `${safeLabel}${" ".repeat(gap)}${safeValue}`;
};

const wrapReceiptText = (value, maxLength = 48) => {
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

const getReceiptPaymentRows = (paymentBreakdown) =>
  Array.isArray(paymentBreakdown)
    ? paymentBreakdown
        .filter((entry) => String(entry?.Method || "").trim())
        .map((entry) => ({
          ...entry,
          Reference: String(
            entry?.Reference || entry?.MOPRef || entry?.ReferenceNumber || ""
          ).trim()
        }))
    : [];

const getReceiptPaymentMode = (paymentBreakdown, fallback = "-") => {
  const methods = getReceiptPaymentRows(paymentBreakdown)
    .map((entry) => String(entry.Method || "").trim().toUpperCase())
    .filter(Boolean);
  const uniqueMethods = [...new Set(methods)];

  return uniqueMethods.length ? uniqueMethods.join("/") : fallback || "-";
};

const getReceiptHeaderReference = (paymentBreakdown, fallback = "") => {
  const rowsWithReference = getReceiptPaymentRows(paymentBreakdown)
    .map((entry) => String(entry.Reference || "").trim())
    .filter(Boolean);

  if (rowsWithReference.length === 1) {
    return rowsWithReference[0];
  }

  return rowsWithReference.length ? "" : fallback || "";
};

const resolveReceiptHistoryNextDueDate = (row, client = null) => {
  if (row?.NextDueDate) {
    return row.NextDueDate;
  }

  const sourceDueDate = row?.DueDate || client?.DueDate || "";
  const anchorDay =
    Number(row?.SubscriptionCover) ||
    Number(client?.SubscriptionCover) ||
    Number(row?.Cover);
  const computedNextDueDate = addOneMonthToDate(sourceDueDate, anchorDay);

  return computedNextDueDate?.toISOString?.() || client?.DueDate || "";
};

const createPaymentReceiptImage = async (receiptData) => {
  if (typeof document === "undefined") {
    return "";
  }

  const config = {
    ...defaultReceiptPrintConfig,
    ...(receiptData?.receiptConfig || {})
  };
  const companyName = normalizeCompanyName(config.CompanyName);
  const paymentRows = Array.isArray(receiptData?.paymentBreakdown)
    ? receiptData.paymentBreakdown
    : [];
  const rows = paymentRows.length
    ? paymentRows
    : [{ Method: receiptData?.paymentMethod || "-", Amount: receiptData?.amountPaid || 0 }];
  const customerName = String(receiptData?.clientName || "-").toUpperCase();
  const receiptPaymentMode = getReceiptPaymentMode(paymentRows, receiptData?.paymentMethod || "-");
  const receiptHeaderReference =
    String(receiptData?.salesInvoice || "").trim() ||
    getReceiptHeaderReference(paymentRows, receiptData?.reference || "");
  const receiptPlanAmount = formatReceiptPlanAmount(receiptData?.planAmount);
  const receiptNextDueDate = formatReceiptDate(
    receiptData?.nextDueDate || receiptData?.NextDueDate
  );
  const footerLines = getReceiptFooterLines(config.FooterNote, defaultReceiptPrintConfig.FooterNote);
  const receiptLogo = await loadReceiptLogoImage();
  const width = 640;
  const paddingX = 56;
  const lineHeight = 30;
  const dividerHeight = 34;
  const lines = [
    { type: "center", text: config.ReceiptTitle || defaultReceiptPrintConfig.ReceiptTitle, size: 22, weight: 700 }
  ];

  if (config.ReceiptSubtitle) {
    lines.push({ type: "center", text: config.ReceiptSubtitle, size: 18, weight: 600 });
  }

  lines.push(
    { type: "divider" },
    { type: "row", label: "Receipt No.", value: receiptData?.paymentReceipt || "-" },
    { type: "row", label: "Date", value: receiptData?.paymentDate || "-" },
    { type: "row", label: "Name", value: fitReceiptText(customerName, 28) }
  );

  if (receiptPlanAmount) {
    lines.push({ type: "row", label: "Plan", value: receiptPlanAmount });
  }

  if (config.ShowContactNumber) {
    lines.push({ type: "row", label: "Contact", value: receiptData?.contactNumber || "-" });
  }

  if (config.ShowSubscriptionCover) {
    lines.push(
      { type: "label", text: "Subscription Cover", weight: 700 },
      ...wrapReceiptText(receiptData?.subscriptionCover || "-", 48).map((text) => ({
        type: "text",
        text
      }))
    );
  }

  if (receiptNextDueDate) {
    lines.push({ type: "miniDivider" });
    lines.push({
      type: "row",
      label: "Next Due Date",
      value: receiptNextDueDate,
      size: 25,
      valueSize: 25,
      color: "#d32f2f",
      weight: 900,
      valueWeight: 900
    });
  }

  lines.push(
    { type: "divider" },
    { type: "row", label: "Payment Mode", value: receiptPaymentMode }
  );

  if (config.ShowReference && receiptHeaderReference) {
    lines.push({
      type: "row",
      label: "Sales Invoice",
      value: fitReceiptText(receiptHeaderReference, 28)
    });
  }

  lines.push({ type: "divider" });

  rows.forEach((entry) => {
    lines.push({
      type: "row",
      label: entry.Method || "-",
      value: `PHP ${formatReceiptAmount(entry.Amount || 0)}`,
      weight: 800,
      valueWeight: 800
    });

    if (entry.Reference) {
      lines.push({
        type: "row",
        label: "Ref",
        value: fitReceiptText(entry.Reference, 30),
        size: 17,
        weight: 500,
        valueWeight: 500
      });
    }
  });

  lines.push(
    { type: "divider" },
    {
      type: "row",
      label: "Additional",
      value: `PHP ${formatReceiptAmount(receiptData?.additionalCharge || 0)}`
    },
    {
      type: "row",
      label: "Discount",
      value: `PHP ${formatReceiptAmount(receiptData?.discount || 0)}`
    },
    {
      type: "row",
      label: "Total Paid",
      value: `PHP ${formatReceiptAmount(receiptData?.totalAmountToPay || receiptData?.amountPaid || 0)}`,
      size: 22,
      weight: 800,
      valueWeight: 800
    },
    { type: "divider" }
  );

  if (config.ShowCreatedBy) {
    lines.push({ type: "text", text: `Received by: ${receiptData?.createdBy || "-"}` });
  }

  lines.push(
    { type: "text", text: `Notes: ${fitReceiptText(receiptData?.notes || "-", 44)}` },
    { type: "divider" },
    ...footerLines.map((line) => ({
      type: "center",
      text: line,
      size: 20,
      weight: 800
    }))
  );

  const height =
    130 +
    lines.reduce(
      (total, line) => total + (line.type === "divider" ? dividerHeight : lineHeight),
      0
    ) +
    44;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return "";
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 7);
  ctx.fillStyle = "rgba(15, 23, 42, 0.055)";
  ctx.font = "900 58px Arial";
  ctx.textAlign = "center";
  ctx.fillText(companyName, 0, 0);
  ctx.restore();

  const drawText = (text, x, y, options = {}) => {
    ctx.fillStyle = options.color || "#000000";
    ctx.font = `${options.weight || 500} ${options.size || 20}px "Courier New", Consolas, monospace`;
    ctx.textAlign = options.align || "left";
    ctx.fillText(String(text || ""), x, y);
  };

  const drawDivider = (y) => {
    ctx.save();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(paddingX, y);
    ctx.lineTo(width - paddingX, y);
    ctx.stroke();
    ctx.restore();
  };

  const drawRow = (label, value, y, options = {}) => {
    drawText(label, paddingX, y, {
      size: options.size || 18,
      weight: options.weight || 500,
      color: options.color || "#000000"
    });
    drawText(value || "-", width - paddingX, y, {
      size: options.valueSize || options.size || 18,
      weight: options.valueWeight || options.weight || 600,
      color: options.color || "#000000",
      align: "right"
    });
  };

  let y = 46;

  if (receiptLogo) {
    const logoWidth = Math.min(460, width - paddingX * 2);
    const logoHeight = Math.min(
      78,
      logoWidth / (receiptLogo.naturalWidth / receiptLogo.naturalHeight)
    );
    ctx.drawImage(receiptLogo, (width - logoWidth) / 2, y, logoWidth, logoHeight);
    y += logoHeight + 34;
  } else {
    drawText(companyName, width / 2, y, {
      size: 30,
      weight: 800,
      align: "center"
    });
    y += lineHeight + 22;
  }

  lines.forEach((line) => {
    if (line.type === "divider") {
      drawDivider(y);
      y += dividerHeight;
      return;
    }

    if (line.type === "miniDivider") {
      drawDivider(y);
      y += 32;
      return;
    }

    if (line.type === "center") {
      drawText(line.text, width / 2, y, {
        size: line.size || 20,
        weight: line.weight || 600,
        align: "center"
      });
      y += lineHeight;
      return;
    }

    if (line.type === "row") {
      drawRow(line.label, line.value, y, line);
      y += lineHeight;
      return;
    }

    drawText(line.text, paddingX, y, {
      size: line.size || 18,
      weight: line.weight || 500
    });
    y += lineHeight;
  });

  return canvas.toDataURL("image/png");
};

const buildEscPosReceiptData = async (receiptData) => {
  const {
    clientName,
    planAmount,
    contactNumber,
    paymentReceipt,
    salesInvoice,
    paymentDate,
    paymentMethod,
    reference,
    amountPaid,
    paymentBreakdown = [],
    subscriptionCover,
    additionalCharge,
    discount,
    totalAmountToPay,
    nextDueDate,
    NextDueDate,
    createdBy,
    notes,
    receiptConfig
  } = receiptData;
  const config = {
    ...defaultReceiptPrintConfig,
    ...(receiptConfig || {})
  };
  const paymentRows = getReceiptPaymentRows(paymentBreakdown);
  const customerName = String(clientName || "-").toUpperCase();
  const receiptPaymentMode = getReceiptPaymentMode(paymentRows, paymentMethod || "-");
  const receiptHeaderReference =
    String(salesInvoice || "").trim() ||
    getReceiptHeaderReference(paymentRows, reference || "");
  const receiptPlanAmount = formatReceiptPlanAmount(planAmount);
  const receiptNextDueDate = formatReceiptDate(nextDueDate || NextDueDate);
  const footerLines = getReceiptFooterLines(config.FooterNote, defaultReceiptPrintConfig.FooterNote);
  const logoBase64 = await createReceiptLogoBase64();

  const lines = [
    "\x1B\x61\x01",
    `${fitReceiptText(config.ReceiptTitle || defaultReceiptPrintConfig.ReceiptTitle, THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    config.ReceiptSubtitle
      ? `${fitReceiptText(config.ReceiptSubtitle, THERMAL_RECEIPT_CHAR_WIDTH)}\n`
      : "",
    `${"=".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    "\x1B\x61\x00",
    `${createReceiptLine("Receipt No.", paymentReceipt)}\n`,
    `${createReceiptLine("Date", paymentDate)}\n`,
    `${createReceiptLine("Name", customerName)}\n`,
    receiptPlanAmount ? `${createReceiptLine("Plan", receiptPlanAmount)}\n` : "",
    config.ShowContactNumber
      ? `${createReceiptLine("Contact", contactNumber || "-")}\n`
      : "",
    ...(config.ShowSubscriptionCover
      ? createWrappedReceiptField(
          "Subscription Cover",
          subscriptionCover || "-",
          THERMAL_RECEIPT_CHAR_WIDTH,
          2
        )
      : []),
    receiptNextDueDate ? `${"-".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n` : "",
    receiptNextDueDate
      ? `\x1B\x45\x01\x1D\x21\x11${createReceiptLine("Next Due", receiptNextDueDate, 22)}\n\x1D\x21\x00\x1B\x45\x00`
      : "",
    `${"-".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    `${createReceiptLine("Payment Mode", receiptPaymentMode)}\n`,
    config.ShowReference && receiptHeaderReference
      ? `${createReceiptLine("Sales Invoice", receiptHeaderReference)}\n`
      : "",
    `${"-".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n`
  ];

  if (paymentRows.length) {
    paymentRows.forEach((entry) => {
      lines.push(
        `${createReceiptLine(entry.Method || "-", formatReceiptAmount(entry.Amount || 0))}\n`
      );

      if (entry.Reference) {
        lines.push(`${createReceiptLine("Ref", entry.Reference)}\n`);
      }
    });
  } else {
    lines.push(`${createReceiptLine("Amount", formatReceiptAmount(amountPaid || 0))}\n`);
  }

  lines.push(
    `${"-".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    `${createReceiptLine("Additional", formatReceiptAmount(additionalCharge || 0))}\n`,
    `${createReceiptLine("Discount", formatReceiptAmount(discount || 0))}\n`,
    `${createReceiptLine("Total Paid", formatReceiptAmount(totalAmountToPay || amountPaid || 0))}\n`,
    `${"-".repeat(THERMAL_RECEIPT_CHAR_WIDTH)}\n`,
    config.ShowCreatedBy
      ? `${createReceiptLine("Received by", createdBy || "-")}\n`
      : "",
    `${createReceiptLine("Notes", notes || "-")}\n`,
    "\n",
    "\x1B\x61\x01",
    ...footerLines.map(
      (line) => `${fitReceiptText(line, THERMAL_RECEIPT_CHAR_WIDTH)}\n`
    ),
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
      // Try the next candidate.
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

const tryAutoPrintToXprinter = async (receiptData) => {
  const qz = await loadQzTrayScript();

  if (!qz) {
    throw new Error("QZ Tray is not available.");
  }

  configureQzSecurity(qz);

  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }

  const receiptConfig = {
    ...defaultReceiptPrintConfig,
    ...(receiptData?.receiptConfig || {})
  };
  let config;

  if (isNetworkReceiptPrinter(receiptConfig)) {
    const host = String(receiptConfig.NetworkPrinterHost || "").trim();
    if (!host) {
      throw new Error("Network printer IP/host is required.");
    }

    config = qz.configs.create({
      host,
      port: normalizeReceiptPrinterPort(receiptConfig.NetworkPrinterPort)
    });
  } else {
    const printerName = await resolveReceiptPrinterName(
      qz,
      receiptConfig.PreferredPrinterName || ""
    );
    config = qz.configs.create(printerName);
  }
  const data = await buildEscPosReceiptData(receiptData);

  await qz.print(config, data);
};

const looksLikeDateOrTimeReference = (value) => {
  const normalized = String(value || "").replace(/[^\d]/g, "");

  if (!normalized) {
    return false;
  }

  if (/^\d{12}$/.test(normalized)) {
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6));
    const day = Number(normalized.slice(6, 8));
    const hour = Number(normalized.slice(8, 10));
    const minute = Number(normalized.slice(10, 12));

    if (
      year >= 2000 &&
      year <= 2100 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return true;
    }
  }

  if (/^\d{8}$/.test(normalized)) {
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6));
    const day = Number(normalized.slice(6, 8));

    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return true;
    }
  }

  return false;
};

const looksLikePhoneReference = (value) => {
  const normalized = String(value || "").replace(/[^\d]/g, "");

  return /^(?:63)?9\d{9}$/.test(normalized) || /^09\d{9}$/.test(normalized);
};

const parseMMDDYYYYToISO = (value) => {
  if (!value) return "";

  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return value;

  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
};

const getDayFromMMDDYYYY = (value) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return String(Number(match[2]));
};

const normalizeCoordinateInput = (value) =>
  String(value ?? "")
    .replace(/[^0-9.\-]/g, "")
    .trim();

const addOneMonthToDate = (value, preferredDay) => {
  if (!value) return null;

  let originalDay;
  let originalMonth;
  let originalYear;

  if (typeof value === "string") {
    const isoDateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (isoDateOnlyMatch) {
      originalYear = Number(isoDateOnlyMatch[1]);
      originalMonth = Number(isoDateOnlyMatch[2]) - 1;
      originalDay = Number(isoDateOnlyMatch[3]);
    }
  }

  if (
    originalYear === undefined ||
    originalMonth === undefined ||
    originalDay === undefined
  ) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    originalDay = date.getDate();
    originalMonth = date.getMonth();
    originalYear = date.getFullYear();
  }

  const anchorDay = Number(preferredDay) || originalDay;
  const lastDayOfNextMonth = new Date(originalYear, originalMonth + 2, 0).getDate();
  const safeDay = Math.min(anchorDay, lastDayOfNextMonth);

  return new Date(originalYear, originalMonth + 1, safeDay, 12, 0, 0, 0);
};

const resolveBillingAnchorDay = (dueDateValue, preferredDay, resetToDueDateDay = false) => {
  const normalizedPreferredDay = Number(preferredDay) || null;

  if (!dueDateValue) {
    return normalizedPreferredDay;
  }

  const parsedDueDate = new Date(dueDateValue);
  if (Number.isNaN(parsedDueDate.getTime())) {
    return normalizedPreferredDay;
  }

  const dueDay = parsedDueDate.getDate();

  if (resetToDueDateDay || !normalizedPreferredDay) {
    return dueDay;
  }

  return Math.min(Math.max(normalizedPreferredDay, 1), 31);
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

    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

const formatClientInstallDateDisplay = (client) => {
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

    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
  }

  return "N/A";
};

const getMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const buildBillingPeriodOptions = (client, disconnectAfterDueDays = 15) => {
  const installDate = getClientInstallDate(client);
  const start = new Date(installDate.getFullYear(), installDate.getMonth() + 1, 1, 12, 0, 0, 0);
  const today = new Date();
  const clientDueDate = new Date(client?.DueDate || "");
  const currentDueMonth = Number.isNaN(clientDueDate.getTime())
    ? new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0)
    : new Date(clientDueDate.getFullYear(), clientDueDate.getMonth(), 1, 12, 0, 0, 0);
  const nextDueAllowedDate = Number.isNaN(clientDueDate.getTime())
    ? null
    : new Date(
        clientDueDate.getFullYear(),
        clientDueDate.getMonth(),
        clientDueDate.getDate() + disconnectAfterDueDays,
        0,
        0,
        0,
        0
      );
  const end =
    nextDueAllowedDate && today >= nextDueAllowedDate
      ? new Date(currentDueMonth.getFullYear(), currentDueMonth.getMonth() + 1, 1, 12, 0, 0, 0)
      : currentDueMonth;
  const options = [];
  const cursor = new Date(start);
  const finalEnd = end > start ? end : start;

  while (cursor <= finalEnd) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    options.push({
      key: getMonthKey(cursor),
      year,
      month,
      label: cursor.toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric"
      })
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return options.reverse().slice(0, 6);
};

const getDefaultNewClientForm = () => {
  const nextMonth = dayjs().add(1, "month");
  const dueDate = nextMonth.format("MM/DD/YYYY");

  return {
    Email: "",
    EmailBillingEnabled: false,
    Latitude: "",
    Longitude: "",
    DueDate: dueDate,
    SubscriptionCover: String(nextMonth.date())
  };
};

const isDisconnectedPlan = (client) => {
  if (!client) return false;

  const rawPlan = String(
    client.NetPlan ?? client.Profile ?? client.Plan ?? ""
  ).toUpperCase().trim();
  const rawStatus = String(
    client.Status ?? client.status ?? ""
  ).toUpperCase().trim();
  const hasAmountDueValue =
    Object.prototype.hasOwnProperty.call(client, "AmountDue") ||
    Object.prototype.hasOwnProperty.call(client, "amountDue");
  const amountDue = hasAmountDueValue
    ? Number(client.AmountDue ?? client.amountDue ?? 0)
    : null;
  const planIsDisconnected =
    rawPlan.includes("DISCONNECTION") || rawPlan.includes("DISCONNECTED");
  const statusIsDisconnected =
    rawStatus.includes("DISCONNECTION") || rawStatus.includes("DISCONNECTED");

  if (planIsDisconnected) {
    return true;
  }

  if (statusIsDisconnected) {
    return true;
  }

  return hasAmountDueValue && amountDue === 0;
};

const isDisconnectedPlanValue = (...values) =>
  values.some((value) => {
    const normalized = String(value || "").toUpperCase().trim();
    return normalized.includes("DISCONNECTION") || normalized.includes("DISCONNECTED");
  });

const getPlanName = (plan) => plan?.Name ?? plan?.name ?? "";
const getPlanSpeed = (plan) => plan?.Speed ?? plan?.speed ?? "";
const getPlanPrice = (plan) => Number(plan?.Price ?? plan?.price ?? 0);
const getPlanType = (plan) =>
  String(plan?.TYPE ?? plan?.Type ?? plan?.type ?? "").trim().toUpperCase();

const getNormalizedAuthMode = (value) =>
  String(value || "").trim().toUpperCase();

const resolvePreviousReconnectPlan = ({ client, netPlans, authMode }) => {
  const normalizedAuthMode = getNormalizedAuthMode(
    authMode || client?.PreviousAuthenticationMode || client?.AuthenticationMode
  );
  const previousNetPlan = String(client?.PreviousNetPlan || "").trim();
  const previousProfile = String(client?.PreviousProfile || "").trim();

  if (!previousNetPlan && !previousProfile) {
    return null;
  }

  return (
    (netPlans || []).find((plan) => {
      const planType = getPlanType(plan);
      if (normalizedAuthMode && planType && planType !== normalizedAuthMode) {
        return false;
      }

      const planName = String(getPlanName(plan) || "").trim();
      const planSpeed = String(getPlanSpeed(plan) || "").trim();

      return (
        (previousNetPlan && (planName === previousNetPlan || planSpeed === previousNetPlan)) ||
        (previousProfile && planName === previousProfile)
      );
    }) || null
  );
};

const resolveCurrentReconnectPlan = ({ client, netPlans, authMode }) => {
  const normalizedAuthMode = getNormalizedAuthMode(
    authMode || client?.AuthenticationMode
  );
  const currentNetPlan = isDisconnectedPlanValue(client?.NetPlan)
    ? ""
    : String(client?.NetPlan || "").trim();
  const currentProfile = isDisconnectedPlanValue(client?.Profile)
    ? ""
    : String(client?.Profile || "").trim();

  if (!currentNetPlan && !currentProfile) {
    return null;
  }

  return (
    (netPlans || []).find((plan) => {
      const planType = getPlanType(plan);
      if (normalizedAuthMode && planType && planType !== normalizedAuthMode) {
        return false;
      }

      const planName = String(getPlanName(plan) || "").trim();
      const planSpeed = String(getPlanSpeed(plan) || "").trim();

      return (
        (currentNetPlan && (planName === currentNetPlan || planSpeed === currentNetPlan)) ||
        (currentProfile && planName === currentProfile)
      );
    }) || null
  );
};

const resolveDefaultReconnectPlan = ({ client, netPlans, authMode }) =>
  resolvePreviousReconnectPlan({ client, netPlans, authMode }) ||
  resolveCurrentReconnectPlan({ client, netPlans, authMode });

const getDisplayedPaymentStatus = (client) => {
  if (!client?.DueDate) {
    return (client?.PaymentStatus || "UNPAID").toUpperCase();
  }

  const dueDate = new Date(client.DueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return (client?.PaymentStatus || "UNPAID").toUpperCase();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const daysBeforeDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

  return daysBeforeDue <= 5 ? "UNPAID" : "PAID";
};

const normalizePaymentLineMethod = (value) =>
  String(value || "").trim().toUpperCase();

const getPaymentBreakdownLines = (row) => {
  if (Array.isArray(row?.EarningRows) && row.EarningRows.length) {
    return row.EarningRows
      .map((earning) => {
        const method = normalizePaymentLineMethod(earning?.MOP || earning?.PaymentMethod);
        const reference = String(
          earning?.MOPRef || earning?.ReferenceNumber || earning?.Reference || ""
        ).trim();

        return {
          Method: method,
          Amount: Number(earning?.Cash || earning?.TotalAmount || earning?.Amount || 0),
          Reference: method === "CASH" ? "" : reference,
          TransferDate: String(earning?.TransferDate || earning?.GCashTransferDate || "").trim(),
          ReceiverLast4: String(earning?.ReceiverLast4 || "").trim()
        };
      })
      .filter((line) => line.Method && line.Amount > 0);
  }

  if (Array.isArray(row?.PaymentBreakdown) && row.PaymentBreakdown.length) {
    return row.PaymentBreakdown
      .map((line) => ({
        Method: normalizePaymentLineMethod(line?.Method || line?.PaymentMethod),
        Amount: Number(line?.Amount || 0),
        Reference: String(line?.Reference || line?.MOPRef || line?.ReferenceNumber || "").trim(),
        TransferDate: String(line?.TransferDate || line?.GCashTransferDate || "").trim(),
        ReceiverLast4: String(line?.ReceiverLast4 || "").trim()
      }))
      .filter((line) => line.Method && line.Amount > 0);
  }

  const lines = [];
  const paymentMethod = normalizePaymentLineMethod(row?.PaymentMethod || row?.MOP);
  const cashAmount = Number(row?.CashAmount || 0);
  const gcashAmount = Number(row?.GCashAmount || 0);
  const totalAmount = Number(row?.TotalAmount || row?.Cash || 0);
  const fallbackReference = String(
    row?.MOPRef || row?.ReferenceNumber || row?.TransactionCode || ""
  ).trim();

  if (cashAmount > 0) {
    lines.push({
      Method: "CASH",
      Amount: cashAmount,
      Reference: ""
    });
  }

  if (gcashAmount > 0) {
    lines.push({
      Method: "GCASH",
      Amount: gcashAmount,
      Reference: fallbackReference
    });
  }

  if (!lines.length && paymentMethod) {
    lines.push({
      Method: paymentMethod,
      Amount: totalAmount,
      Reference: paymentMethod === "CASH" ? "" : fallbackReference
    });
  }

  if (!lines.length && fallbackReference && totalAmount > 0) {
    lines.push({
      Method: "GCASH",
      Amount: totalAmount,
      Reference: fallbackReference
    });
  }

  return lines.filter((line) => line.Amount > 0);
};

const formatPaymentBreakdown = (row) => {
  const lines = getPaymentBreakdownLines(row);

  if (!lines.length) {
    return row?.PaymentMethod || row?.MOP || "-";
  }

  if (lines.length === 1) {
    return lines[0].Method || row?.PaymentMethod || row?.MOP || "-";
  }

  return lines
    .map(
      (line) =>
        `${line.Method}: PHP ${Number(line.Amount || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`
    )
    .join(" | ");
};

const formatPaymentReferences = (row) => {
  const lines = getPaymentBreakdownLines(row).filter((line) => line.Reference);

  if (!lines.length) {
    return row?.MOPRef || row?.ReferenceNumber || row?.TransactionCode || "-";
  }

  if (lines.length === 1) {
    return lines[0].Reference || row?.MOPRef || row?.ReferenceNumber || row?.TransactionCode || "-";
  }

  return lines.map((line) => `${line.Method}: ${line.Reference}`).join(" | ");
};

const formatPrintPaymentMode = (row) => {
  const rawMode = String(row?.PaymentMethod || row?.MOP || "").trim().toUpperCase();
  if (rawMode) {
    return rawMode
      .split(/[\/,|]+/)
      .map((mode) => mode.trim())
      .filter((mode) => ["CASH", "GCASH", "PAYMAYA", "BANK"].includes(mode))
      .join("/") || rawMode;
  }

  const methods = getPaymentBreakdownLines(row)
    .map((line) => String(line.Method || "").trim().toUpperCase())
    .filter((mode) => ["CASH", "GCASH", "PAYMAYA", "BANK"].includes(mode));

  return [...new Set(methods)].join("/") || "-";
};

const formatPrintReference = (row) =>
  row?.PaymentReceipt || row?.Invoice || row?.TransactionCode || "-";

const openPaymentReceiptPrint = (receiptWindow, receiptData) => {
  if (!receiptWindow) {
    return;
  }

  const {
    clientName,
    planAmount,
    contactNumber,
    paymentReceipt,
    salesInvoice,
    paymentDate,
    paymentMethod,
    reference,
    amountPaid,
    paymentBreakdown = [],
    subscriptionCover,
    additionalCharge,
    discount,
    totalAmountToPay,
    nextDueDate,
    NextDueDate,
    createdBy,
    notes,
    receiptConfig
  } = receiptData;
  const config = {
    ...defaultReceiptPrintConfig,
    ...(receiptConfig || {})
  };

  const paymentBreakdownHtml = Array.isArray(paymentBreakdown) && paymentBreakdown.length
    ? paymentBreakdown
        .map(
          (entry) => `<div class="row"><span class="label">${escapeHtml(entry.Method || "-")}</span><span class="value">PHP ${Number(entry.Amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>${
            entry.Reference
              ? `<div class="row"><span class="label muted">Ref</span><span class="value wrap">${escapeHtml(entry.Reference)}</span></div>`
              : ""
          }`
        )
        .join("")
    : `<div class="row"><span class="label">${escapeHtml(paymentMethod)}</span><span class="value">PHP ${Number(amountPaid || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`;
  const receiptPaymentRows = getReceiptPaymentRows(paymentBreakdown);
  const customerName = String(clientName || "-").toUpperCase();
  const receiptPaymentMode = getReceiptPaymentMode(receiptPaymentRows, paymentMethod || "-");
  const receiptHeaderReference =
    String(salesInvoice || "").trim() ||
    getReceiptHeaderReference(receiptPaymentRows, reference || "");
  const receiptPlanAmount = formatReceiptPlanAmount(planAmount);
  const receiptNextDueDate = formatReceiptDate(nextDueDate || NextDueDate);
  const footerHtml = getReceiptFooterLines(
    config.FooterNote,
    defaultReceiptPrintConfig.FooterNote
  )
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");
  const receiptLogoUrl = `${window.location.origin}${RECEIPT_LOGO_SRC}`;

  receiptWindow.document.open();
  receiptWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payment Receipt ${escapeHtml(paymentReceipt)}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        margin: 0;
        font-family: Consolas, "Courier New", monospace;
        color: #000;
        background: #fff;
      }
      .receipt {
        box-sizing: border-box;
        width: 80mm;
        margin: 0;
        padding: 2mm 3mm 6mm;
        font-size: 12px;
        line-height: 1.45;
      }
      .center {
        text-align: center;
      }
      .logo {
        display: block;
        width: 58mm;
        max-width: 100%;
        height: auto;
        margin: 0 auto 3mm;
      }
      .title {
        font-size: 16px;
        font-weight: 700;
      }
      .muted {
        font-size: 11px;
      }
      .divider {
        border-top: 1px dashed #000;
        margin: 8px 0;
      }
      .divider.mini {
        margin: 6px 0 8px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .label {
        flex: 1;
      }
      .value {
        text-align: right;
        white-space: nowrap;
      }
      .wrap {
        white-space: normal;
        word-break: break-word;
      }
      .total {
        font-size: 13px;
        font-weight: 700;
      }
      .next-due {
        color: #d32f2f;
        font-size: 16px;
        font-weight: 900;
        line-height: 1.25;
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="center">
        <img class="logo" src="${receiptLogoUrl}" alt="${escapeHtml(normalizeCompanyName(config.CompanyName))}" />
        <div>${escapeHtml(config.ReceiptTitle || defaultReceiptPrintConfig.ReceiptTitle)}</div>
        ${
          config.ReceiptSubtitle
            ? `<div class="muted">${escapeHtml(config.ReceiptSubtitle)}</div>`
            : ""
        }
      </div>

      <div class="divider"></div>

      <div class="row"><span class="label">Receipt No.</span><span class="value">${escapeHtml(paymentReceipt)}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${escapeHtml(paymentDate)}</span></div>
      <div class="row"><span class="label">Name</span><span class="value wrap">${escapeHtml(customerName)}</span></div>
      ${
        receiptPlanAmount
          ? `<div class="row"><span class="label">Plan</span><span class="value wrap">${escapeHtml(receiptPlanAmount)}</span></div>`
          : ""
      }
      ${
        config.ShowContactNumber
          ? `<div class="row"><span class="label">Contact</span><span class="value">${escapeHtml(contactNumber || "-")}</span></div>`
          : ""
      }
      ${
        config.ShowSubscriptionCover
          ? `<div class="row"><span class="label">Subscription Cover</span><span class="value wrap">${escapeHtml(subscriptionCover || "-")}</span></div>`
          : ""
      }
      ${
        receiptNextDueDate ? `<div class="divider mini"></div>` : ""
      }
      ${
        receiptNextDueDate
          ? `<div class="row next-due"><span class="label">Next Due Date</span><span class="value">${escapeHtml(receiptNextDueDate)}</span></div>`
          : ""
      }

      <div class="divider"></div>

      <div class="row"><span class="label">Payment Mode</span><span class="value">${escapeHtml(receiptPaymentMode)}</span></div>
      ${
        config.ShowReference && receiptHeaderReference
          ? `<div class="row"><span class="label">Sales Invoice</span><span class="value wrap">${escapeHtml(receiptHeaderReference)}</span></div>`
          : ""
      }
      <div class="divider"></div>
      ${paymentBreakdownHtml}
      <div class="divider"></div>
      <div class="row"><span class="label">Additional</span><span class="value">PHP ${Number(additionalCharge || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      <div class="row"><span class="label">Discount</span><span class="value">PHP ${Number(discount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      <div class="row total"><span class="label">Total Paid</span><span class="value">PHP ${Number(totalAmountToPay || amountPaid || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>

      <div class="divider"></div>

      ${
        config.ShowCreatedBy
          ? `<div>Received by: ${escapeHtml(createdBy || "-")}</div>`
          : ""
      }
      <div>Notes: ${escapeHtml(notes || "-")}</div>

      <div class="divider"></div>

      <div class="center muted">${footerHtml}</div>
    </div>
    <script>
      window.onload = function () {
        window.focus();
        window.print();
      };
    </script>
  </body>
</html>`);
  receiptWindow.document.close();
};

const createReceiptPayloadFromHistoryRow = (
  row,
  receiptConfig = defaultReceiptPrintConfig,
  client = null
) => ({
  clientName: row?.ClientName || "",
  accountName: row?.AccountName || "",
  planAmount:
    row?.PlanAmount ??
    row?.MonthlyDue ??
    row?.PlanPrice ??
    row?.AmountDue ??
    row?.TotalAmount ??
    row?.Cash ??
    "",
  contactNumber: client?.ContactNumber || "",
  paymentReceipt: row?.PaymentReceipt || row?.Invoice || row?.TransactionCode || "-",
  salesInvoice: row?.Invoice || "",
  paymentDate: row?.TransactionDate
    ? new Date(row.TransactionDate).toLocaleString("en-PH")
    : row?.PaymentDate
      ? new Date(row.PaymentDate).toLocaleString("en-PH")
      : "-",
  paymentMethod: row?.PaymentMethod || row?.MOP || "-",
  reference: formatPaymentReferences(row) || "-",
  amountPaid: Number(row?.TotalAmount || row?.Cash || 0),
  paymentBreakdown: getPaymentBreakdownLines(row),
  subscriptionCover: row?.Cover || row?.SubscriptionCover || "-",
  nextDueDate: resolveReceiptHistoryNextDueDate(row, client),
  additionalCharge: Number(row?.AddCharge || 0),
  discount: Number(row?.Discount || 0),
  totalAmountToPay: Number(row?.TotalAmount || row?.Cash || 0),
  createdBy: row?.CreatedBy || row?.CreatedById || "-",
  notes: row?.Note || row?.Notes || "",
  receiptConfig
});

const getStatusChipStyles = (status) => {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "ACTIVE") {
    return {
      backgroundColor: "#e8f5e9",
      color: "#2e7d32"
    };
  }

  if (normalized === "HOLD") {
    return {
      backgroundColor: "#fff3e0",
      color: "#c2410c"
    };
  }

  if (normalized === "INACTIVE" || normalized === "NOT ACTIVE") {
    return {
      backgroundColor: "#f1f5f9",
      color: "#475569"
    };
  }

  if (normalized === "NO MAC FOUND" || normalized === "NOT FOUND") {
    return {
      backgroundColor: "#fef2f2",
      color: "#b91c1c"
    };
  }

  return {
    backgroundColor: "#ede9fe",
    color: "#6d28d9"
  };
};

function ClientList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: clientRouteId } = useParams();
  const { clients, clientMeta, fetchClients, addClient, loading } = useClient();

  const isClientAddPage = location.pathname === "/clients/new";
  const isClientEditPage =
    Boolean(clientRouteId) &&
    (location.pathname === `/clients/${clientRouteId}/edit` ||
      location.pathname === `/editclient/${clientRouteId}`);
  const isClientFormPage = isClientAddPage || isClientEditPage;

  const { user: currentUser } = useAuth();
  const currentUserType = String(
    currentUser?.type || currentUser?.role || ""
  ).trim().toUpperCase();
  const isAdminUser = currentUserType === "ADMIN";

  const [netPlans, setNetPlans] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");

  const [menu, setMenu] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientFormLoading, setClientFormLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [paymentReceiptLoading, setPaymentReceiptLoading] = useState(false);
  const [openPaymentEntriesModal, setOpenPaymentEntriesModal] = useState(false);
  const [openBillingModal, setOpenBillingModal] = useState(false);
  const [billingPeriodDialog, setBillingPeriodDialog] = useState({
    open: false,
    client: null,
    periodKey: ""
  });
  const [openPaymentHistoryModal, setOpenPaymentHistoryModal] = useState(false);
  const [openMikrotikStatusModal, setOpenMikrotikStatusModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [repairDialog, setRepairDialog] = useState({
    open: false,
    technicianId: "",
    technicianIds: [],
    repairText: "",
    smsMessage: ""
  });
  const [technicians, setTechnicians] = useState([]);
  const [repairSmsTemplate, setRepairSmsTemplate] = useState(null);
  const [repairSaving, setRepairSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [refreshModeSaving, setRefreshModeSaving] = useState(false);

  const [newClient, setNewClient] = useState(getDefaultNewClientForm());
  const [dhcpLeaseOptions, setDhcpLeaseOptions] = useState([]);
  const [loadingDhcpLeases, setLoadingDhcpLeases] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    AmountPaid: "",
    PaymentDate: getTodayLocalDate(),
    ReferenceNumber: "",
    Invoice: "",
    Notes: "",
    AdditionalCharge: "",
    Discount: "",
    ContactNumber: "",
    SendSms: true,
    ReconnectRequired: false,
    ReconnectAuthMode: "",
    ReconnectPlan: "",
    ReconnectCharge: 0,
    ReconnectMacAddress: ""
  });
  const [paymentEntries, setPaymentEntries] = useState([createPaymentEntry()]);
  const paymentReceiptRequestKeyRef = useRef("");
  const [receiptPreview, setReceiptPreview] = useState("");
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [receiptViewerSrc, setReceiptViewerSrc] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [disconnectAfterDueDays, setDisconnectAfterDueDays] = useState(15);
  const [systemCompanyName, setSystemCompanyName] = useState(DEFAULT_COMPANY_NAME);
  const [receiptPrintConfig, setReceiptPrintConfig] = useState(defaultReceiptPrintConfig);
  const [messageBox, setMessageBox] = useState({
    open: false,
    title: "",
    message: "",
    severity: "info"
  });
  const [clientActionConfirm, setClientActionConfirm] = useState({
    open: false,
    action: "",
    title: "",
    message: ""
  });
  const [paymentDetailsConfirm, setPaymentDetailsConfirm] = useState({
    open: false,
    title: "",
    message: "",
    severity: "warning",
    onConfirm: null
  });
  const [smsConfirmDialog, setSmsConfirmDialog] = useState({
    open: false,
    client: null
  });
  const [overdueDialog, setOverdueDialog] = useState({
    open: false,
    client: null
  });
  const [forcedOverdueDialog, setForcedOverdueDialog] = useState({
    open: false,
    client: null
  });
  const [paymentHistoryRows, setPaymentHistoryRows] = useState([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [paymentHistoryError, setPaymentHistoryError] = useState("");
  const [expandedPaymentHistoryRowId, setExpandedPaymentHistoryRowId] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [billingHistoryRows, setBillingHistoryRows] = useState([]);
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState(null);
  const [mikrotikStatusLoading, setMikrotikStatusLoading] = useState(false);
  const [mikrotikStatusError, setMikrotikStatusError] = useState("");
  const [mikrotikStatusData, setMikrotikStatusData] = useState(null);
  const [mikrotikStatusRefreshing, setMikrotikStatusRefreshing] = useState(false);
  const [deleteHistoryDialog, setDeleteHistoryDialog] = useState({
    open: false,
    row: null
  });
  const [adjustDueDateDialog, setAdjustDueDateDialog] = useState({
    open: false,
    value: null,
    row: null
  });
  const mapClientToForm = useCallback((client) => ({
    ...getDefaultNewClientForm(),
    ...client,
    MacAddress: client?.MacAddress || client?.macAddress || "",
    AmountDue: client?.AmountDue ?? "",
    DueDate: client?.DueDate ? formatDateToMMDDYYYY(client.DueDate) : "",
    SubscriptionCover: client?.SubscriptionCover || ""
  }), []);

  const navigateToClientList = useCallback(() => {
    navigate("/clients");
  }, [navigate]);
  const loadClients = useCallback(() => {
    return fetchClients({
      status: statusFilter,
      search: debouncedSearch,
      dueDate: dueDateFilter ? dueDateFilter.format("YYYY-MM-DD") : "",
      page: page + 1,
      limit: rowsPerPage
    });
  }, [fetchClients, statusFilter, debouncedSearch, dueDateFilter, page, rowsPerPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, debouncedSearch, dueDateFilter]);

  const selectedRepairTechnicians = technicians.filter((user) =>
    (repairDialog.technicianIds || []).includes(String(user.ID || ""))
  );
  const selectedRepairTechnicianNames = selectedRepairTechnicians
    .map((user) => user.Name || user.Username)
    .filter(Boolean)
    .join(", ");
  const repairSmsPreview = repairSmsTemplate?.Body
    ? replaceTemplateTokens(repairSmsTemplate.Body, {
        TechnicianName: selectedRepairTechnicianNames,
        ClientName:
          selectedClient?.ClientName || selectedClient?.AccountName || "",
        AccountName: selectedClient?.AccountName || "",
        AccountNumber: selectedClient?.AccountNumber || "",
        ContactNumber: selectedClient?.ContactNumber || "",
        Address: selectedClient?.Address || "",
        RepairText: repairDialog.repairText || "",
        Issue: repairDialog.repairText || ""
      })
    : "";
  const repairDetailsDisplayValue =
    repairDialog.smsMessage || repairDialog.repairText || repairSmsPreview;

  const loadReceiptPrintConfig = async (companyNameOverride = systemCompanyName) => {
    try {
      const { data } = await API.get("/print-receipt");
      const nextConfig = {
        ...defaultReceiptPrintConfig,
        ...(data || {}),
        CompanyName: normalizeCompanyName(companyNameOverride || data?.CompanyName),
        EnablePrinting: normalizeBooleanSetting(
          data?.EnablePrinting,
          defaultReceiptPrintConfig.EnablePrinting
        ),
        UseDirectPrint: normalizeBooleanSetting(
          data?.UseDirectPrint,
          defaultReceiptPrintConfig.UseDirectPrint
        ),
        ShowSubscriptionCover: normalizeBooleanSetting(
          data?.ShowSubscriptionCover,
          defaultReceiptPrintConfig.ShowSubscriptionCover
        ),
        ShowContactNumber: normalizeBooleanSetting(
          data?.ShowContactNumber,
          defaultReceiptPrintConfig.ShowContactNumber
        ),
        ShowReference: normalizeBooleanSetting(
          data?.ShowReference,
          defaultReceiptPrintConfig.ShowReference
        ),
        ShowCreatedBy: normalizeBooleanSetting(
          data?.ShowCreatedBy,
          defaultReceiptPrintConfig.ShowCreatedBy
        )
      };
      setReceiptPrintConfig(nextConfig);
      return nextConfig;
    } catch (err) {
      console.error("PRINT RECEIPT CONFIG LOAD ERROR:", err);
      const fallbackConfig = {
        ...defaultReceiptPrintConfig,
        CompanyName: normalizeCompanyName(companyNameOverride)
      };
      setReceiptPrintConfig(fallbackConfig);
      return fallbackConfig;
    }
  };

  const loadSystemSettings = async () => {
    try {
      const { data } = await API.get("/system-settings");
      const nextGraceDays = Number(data?.DisconnectAfterDueDays);
      const nextCompanyName = normalizeCompanyName(data?.CompanyName);
      setSystemCompanyName(nextCompanyName);
      setReceiptPrintConfig((prev) => ({
        ...prev,
        CompanyName: nextCompanyName
      }));
      setDisconnectAfterDueDays(
        Number.isFinite(nextGraceDays) && nextGraceDays >= 0 ? Math.floor(nextGraceDays) : 15
      );
    } catch (err) {
      console.error("SYSTEM SETTINGS LOAD ERROR:", err);
      setSystemCompanyName(DEFAULT_COMPANY_NAME);
      setReceiptPrintConfig((prev) => ({
        ...prev,
        CompanyName: DEFAULT_COMPANY_NAME
      }));
      setDisconnectAfterDueDays(15);
    }
  };

  useEffect(() => {
    if (isClientFormPage) {
      return;
    }

    loadClients();
  }, [isClientFormPage, loadClients]);

  useEffect(() => {
    if (isClientAddPage) {
      setOpenModal(false);
      setEditMode(false);
      setSelectedClient(null);
      setClientFormLoading(false);
      setNewClient(getDefaultNewClientForm());
      return;
    }

    if (!isClientEditPage || !clientRouteId) {
      setClientFormLoading(false);
      return;
    }

    let isMounted = true;
    setClientFormLoading(true);
    setSelectedClient(null);
    setNewClient(getDefaultNewClientForm());

    const loadClientForEdit = async () => {
      try {
        const { data } = await API.get(`/clients/${clientRouteId}`);

        if (!isMounted) {
          return;
        }

        setOpenModal(false);
        setEditMode(true);
        setSelectedClient(data || null);
        setNewClient(mapClientToForm(data || {}));
      } catch (err) {
        console.error("LOAD CLIENT ERROR:", err.response?.data || err.message);
        showMessage(
          "Client Load Failed",
          err.response?.data?.error || "Failed to load client details.",
          "error"
        );
        navigateToClientList();
      } finally {
        if (isMounted) {
          setClientFormLoading(false);
        }
      }
    };

    loadClientForEdit();

    return () => {
      isMounted = false;
    };
  }, [
    clientRouteId,
    isClientAddPage,
    isClientEditPage,
    mapClientToForm,
    navigateToClientList
  ]);

  useEffect(() => {
    API
      .get("/netplans")
      .then((res) => setNetPlans(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    loadSystemSettings();
    loadReceiptPrintConfig();
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_BASE_URL, {
      transports: ["websocket", "polling"]
    });

    const handleClientsChanged = () => {
      if (document.hidden) {
        return;
      }

      loadClients();
    };

    socket.on("clients:changed", handleClientsChanged);

    return () => {
      socket.off("clients:changed", handleClientsChanged);
      socket.disconnect();
    };
  }, [loadClients]);

  useEffect(() => {
    const refreshActiveClientView = () => {
      if (document.hidden) {
        return;
      }

      loadClients();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshActiveClientView();
      }
    };

    window.addEventListener("focus", refreshActiveClientView);
    window.addEventListener("pageshow", refreshActiveClientView);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshActiveClientView);
      window.removeEventListener("pageshow", refreshActiveClientView);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadClients]);

  useEffect(() => {
      const selectedClientOverdueDays = getClientOverdueDays(selectedClient);
      const paymentNeedsReconnectFlow =
        isDisconnectedPlan(selectedClient) ||
        Boolean(paymentForm.ReconnectRequired) ||
        selectedClientOverdueDays > disconnectAfterDueDays;
      const paymentNeedsDhcp =
        openPaymentModal &&
        getNormalizedAuthMode(
          paymentForm.ReconnectAuthMode || selectedClient?.AuthenticationMode
        ) === "IPOE" &&
      paymentNeedsReconnectFlow;

    const shouldLoadClientDhcp =
      (openModal || isClientFormPage) && newClient.AuthenticationMode === "IPOE";

    if (!shouldLoadClientDhcp && !paymentNeedsDhcp) {
      setDhcpLeaseOptions([]);
      setLoadingDhcpLeases(false);
      return;
    }

    let isActive = true;

    const fetchDhcpLeases = async () => {
      setLoadingDhcpLeases(true);

      try {
        const res = await API.get("/dhcp-leases");

        if (!isActive) return;

        const options = [...new Set(
          (res.data || [])
            .map((lease) => lease.macAddress || lease["mac-address"] || "")
            .filter(Boolean)
        )];

        setDhcpLeaseOptions(options);
      } catch (err) {
        console.error("DHCP LEASE FETCH ERROR:", err);

        if (!isActive) return;
        setDhcpLeaseOptions([]);
      } finally {
        if (isActive) {
          setLoadingDhcpLeases(false);
        }
      }
    };

    fetchDhcpLeases();

    return () => {
      isActive = false;
    };
  }, [
    newClient.AuthenticationMode,
    isClientFormPage,
    openModal,
    openPaymentModal,
    paymentForm.ReconnectAuthMode,
    paymentForm.ReconnectRequired,
    selectedClient
  ]);

  useEffect(() => {
    if (!openPaymentModal || !paymentForm.PaymentDate) {
      paymentReceiptRequestKeyRef.current = "";
      return;
    }

    const requestKey = [
      selectedClient?._id || selectedClient?.id || selectedClient?.AccountNumber || "payment",
      paymentForm.PaymentDate
    ].join("::");

    if (paymentReceiptRequestKeyRef.current === requestKey) {
      return;
    }

    paymentReceiptRequestKeyRef.current = requestKey;

    let active = true;

    const refreshReceiptNumber = async () => {
      try {
        if (active) {
          setPaymentReceiptLoading(true);
        }
        const nextReceiptNumber = await fetchNextPaymentReceiptNumber(
          paymentForm.PaymentDate
        );

        if (!active) {
          return;
        }

        setPaymentForm((prev) => ({
          ...prev,
          ReferenceNumber: nextReceiptNumber,
          Invoice: toSalesInvoiceNumber(nextReceiptNumber)
        }));
      } catch (err) {
        if (!active) {
          return;
        }

        console.error(
          "PAYMENT DATE RECEIPT REFRESH ERROR:",
          err.response?.data || err.message
        );
        paymentReceiptRequestKeyRef.current = "";
        setOpenPaymentModal(false);
        setOpenPaymentEntriesModal(false);
        resetPaymentForm();
        showMessage(
          "Receipt Number Error",
          "Failed to generate the next PR receipt number.",
          "error"
        );
      } finally {
        if (active) {
          setPaymentReceiptLoading(false);
        }
      }
    };

    refreshReceiptNumber();

    return () => {
      active = false;
    };
  }, [openPaymentModal, paymentForm.PaymentDate, selectedClient]);

  const emailValue = (newClient.Email || "").trim();
  const normalizedEmail = emailValue.toLowerCase();
  const isEmailPlaceholder = normalizedEmail === "n/a";
  const hasEmail = emailValue !== "";
  const emailError =
    hasEmail && !isEmailPlaceholder && !emailRegex.test(emailValue);
  const canEnableEmailBilling =
    hasEmail && !isEmailPlaceholder && !emailError;

  useEffect(() => {
    if (canEnableEmailBilling) {
      return;
    }

    setNewClient((prev) =>
      prev.EmailBillingEnabled
        ? {
            ...prev,
            EmailBillingEnabled: false
          }
        : prev
    );
  }, [canEnableEmailBilling]);

  const compactFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: 36
    },
    "& .MuiInputBase-input": {
      fontSize: "12px",
      padding: "9px 10px"
    },
    "& .MuiInputLabel-root": {
      fontSize: "12px"
    },
    "& .MuiFormHelperText-root": {
      fontSize: "11px",
      marginLeft: 0
    }
  };
  const selectedAuthMode = String(newClient.AuthenticationMode || "").trim().toUpperCase();
  const typedNetPlans = netPlans.filter((plan) => {
    const planType = getPlanType(plan);
    return planType === selectedAuthMode;
  });
  const filteredNetPlans =
    selectedAuthMode && typedNetPlans.length > 0 ? typedNetPlans : netPlans;
  const currentMacAddress = String(
    newClient.MacAddress || newClient.macAddress || selectedClient?.MacAddress || selectedClient?.macAddress || ""
  ).trim().toUpperCase();
  const displayedDhcpLeaseOptions = [
    ...new Set(
      [currentMacAddress, ...dhcpLeaseOptions]
        .filter(Boolean)
        .map((mac) => String(mac).trim().toUpperCase())
    )
  ];
  const clientMapLatitude = normalizeCoordinateInput(
    newClient.Latitude || selectedClient?.Latitude || ""
  );
  const clientMapLongitude = normalizeCoordinateInput(
    newClient.Longitude || selectedClient?.Longitude || ""
  );
  const hasClientMapCoordinates =
    clientMapLatitude !== "" &&
    clientMapLongitude !== "" &&
    Number.isFinite(Number(clientMapLatitude)) &&
    Number.isFinite(Number(clientMapLongitude));
  const clientMapEmbedUrl = hasClientMapCoordinates
    ? `https://maps.google.com/maps?q=${encodeURIComponent(`${clientMapLatitude},${clientMapLongitude}`)}&z=17&output=embed`
    : "";
  const clientMapOpenUrl = hasClientMapCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clientMapLatitude},${clientMapLongitude}`)}`
    : "";
  const activeCount = Number(clientMeta?.activeCount || 0);
  const disconnectedCount = Number(clientMeta?.disconnectedCount || 0);
  const showClientTabCounts = isAdminUser || Boolean(debouncedSearch);
  const billingPeriodOptions = useMemo(
    () => buildBillingPeriodOptions(billingPeriodDialog.client, disconnectAfterDueDays),
    [billingPeriodDialog.client, disconnectAfterDueDays]
  );

  const handleRightClick = (event, client) => {
    event.preventDefault();
    setSelectedClient(client);
    setMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4
    });
  };

  const handleClose = () => setMenu(null);

  const handleUpdate = () => {
    navigate(`/editclient/${selectedClient._id}`);
    handleClose();
  };

  const handleOpenBillingPeriodDialog = (client) => {
    if (!client) return;

    const options = buildBillingPeriodOptions(client, disconnectAfterDueDays);
    setSelectedClient(client);
    setBillingPeriodDialog({
      open: true,
      client,
      periodKey: options[0]?.key || getMonthKey(new Date())
    });
  };

  const handleCloseBillingPeriodDialog = () => {
    setBillingPeriodDialog({
      open: false,
      client: null,
      periodKey: ""
    });
  };

  const handleOpenBillingModal = async (client, billingPeriod = null) => {
    if (!client) return;

    setSelectedClient(client);
    setSelectedBillingPeriod(billingPeriod);
    setOpenBillingModal(true);
    setBillingLoading(true);
    setBillingError("");
    setBillingHistoryRows([]);

    try {
      const { data } = await API.get("/transactions", {
        params: {
          accountNumber: client.AccountNumber || ""
        }
      });

      setBillingHistoryRows(data || []);
    } catch (err) {
      console.error("BILLING HISTORY ERROR:", err.response?.data || err.message);
      setBillingError(
        err.response?.data?.error || "Failed to load billing statement data."
      );
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCloseBillingModal = () => {
    setOpenBillingModal(false);
    setBillingLoading(false);
    setBillingError("");
    setBillingHistoryRows([]);
    setSelectedBillingPeriod(null);
  };

  const handleConfirmBillingPeriod = () => {
    const option = billingPeriodOptions.find(
      (item) => item.key === billingPeriodDialog.periodKey
    );

    if (!billingPeriodDialog.client || !option) {
      return;
    }

    handleCloseBillingPeriodDialog();
    handleOpenBillingModal(billingPeriodDialog.client, {
      year: option.year,
      month: option.month,
      label: option.label
    });
  };

  const handleBilling = () => {
    handleOpenBillingPeriodDialog(selectedClient);
    handleClose();
  };

  const handleReceipt = () => {
    navigate(`/receipt/${selectedClient._id}`);
    handleClose();
  };

  const fetchNextPaymentReceiptNumber = async (paymentDate) => {
    const targetDate =
      paymentDate || getTodayLocalDate();

    const { data } = await API.get("/payments/next-receipt-number", {
      params: {
        date: targetDate,
        _: Date.now()
      },
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    });

    return String(data?.receiptNumber || "").trim();
  };

  const getClientOverdueDays = (client) => {
    if (!client?.DueDate) return false;

    const dueDate = new Date(client.DueDate);
    if (Number.isNaN(dueDate.getTime())) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    return Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
  };

  const getDaysPastDisconnectionThreshold = (client, threshold = disconnectAfterDueDays) =>
    Math.max(0, getClientOverdueDays(client) - threshold);

  const getDisconnectDaysDisplay = (client, paymentStatus) => {
    if (!client?.DueDate) {
      return {
        label: "N/A",
        backgroundColor: "#f1f5f9",
        color: "#64748b"
      };
    }

    if (isDisconnectedPlan(client)) {
      return {
        label: "Disconnected",
        backgroundColor: "#fee2e2",
        color: "#b91c1c"
      };
    }

    const overdueDays = getClientOverdueDays(client);
    if (!Number.isFinite(Number(overdueDays))) {
      return {
        label: "N/A",
        backgroundColor: "#f1f5f9",
        color: "#64748b"
      };
    }

    if (overdueDays < 0) {
      const daysUntilDue = Math.abs(overdueDays);
      return {
        label: `Due in ${daysUntilDue}d`,
        backgroundColor: "#eff6ff",
        color: "#1d4ed8"
      };
    }

    const remainingDays = disconnectAfterDueDays - overdueDays;
    if (remainingDays > 0) {
      return {
        label: `${remainingDays}d left`,
        backgroundColor: "#fff7ed",
        color: "#c2410c"
      };
    }

    if (remainingDays === 0) {
      return {
        label: "Disconnect today",
        backgroundColor: "#fee2e2",
        color: "#b91c1c"
      };
    }

    return {
      label: `${Math.abs(remainingDays)}d late`,
      backgroundColor: "#fee2e2",
      color: "#b91c1c"
    };
  };

  const openPaymentModalForClient = async (client, options = {}) => {
    const paymentDate = getTodayLocalDate();
    const reconnectAuthMode = getNormalizedAuthMode(
      client?.PreviousAuthenticationMode || client?.AuthenticationMode
    );
    const defaultReconnectPlan = resolveDefaultReconnectPlan({
      client,
      netPlans,
      authMode: reconnectAuthMode
    });

    setSelectedClient(client);
    setPaymentForm({
      AmountPaid: String(client.Balance ?? client.AmountDue ?? ""),
      PaymentDate: paymentDate,
      ReferenceNumber: "",
      Invoice: "",
      Notes: "",
      AdditionalCharge: "",
      Discount: "",
      ContactNumber: String(client.ContactNumber || ""),
      SendSms: true,
      ReconnectRequired: Boolean(options.reconnectRequired),
      ReconnectAuthMode: reconnectAuthMode,
      ReconnectPlan: getPlanName(defaultReconnectPlan) || "",
      ReconnectCharge: defaultReconnectPlan ? getPlanPrice(defaultReconnectPlan) : 0,
      ReconnectMacAddress: String(client.PreviousMacAddress || client.MacAddress || "")
        .trim()
        .toUpperCase()
    });
    setPaymentEntries([
      createPaymentEntry({
        method: "CASH",
        amount: String(client.Balance ?? client.AmountDue ?? "")
      })
    ]);
    setOpenPaymentModal(true);
  };

  const handleOpenPaymentModal = (client) => {
    const overdueDays = getClientOverdueDays(client);

    if (overdueDays > 30) {
      setForcedOverdueDialog({
        open: true,
        client
      });
      return;
    }

    if (overdueDays > disconnectAfterDueDays) {
      setOverdueDialog({
        open: true,
        client
      });
      return;
    }

    openPaymentModalForClient(client);
  };

  const handleOpenPaymentHistoryModal = async (client) => {
    try {
      setSelectedClient(client);
      setOpenPaymentHistoryModal(true);
      setPaymentHistoryLoading(true);
      setPaymentHistoryError("");

      const { data } = await API.get("/transactions", {
        params: {
          accountNumber: client.AccountNumber || ""
        }
      });

      const rows = [...(data || [])].sort((a, b) => {
        return new Date(b.TransactionDate || 0) - new Date(a.TransactionDate || 0);
      });

      setPaymentHistoryRows(rows);
      setExpandedPaymentHistoryRowId("");
    } catch (err) {
      console.error("PAYMENT HISTORY ERROR:", err.response?.data || err.message);
      setPaymentHistoryError(
        err.response?.data?.error || "Failed to load payment history."
      );
      setPaymentHistoryRows([]);
    } finally {
      setPaymentHistoryLoading(false);
    }
  };

  const handleOpenSmsConfirmDialog = (client) => {
    setSmsConfirmDialog({
      open: true,
      client
    });
  };

  const handleCloseSmsConfirmDialog = () => {
    setSmsConfirmDialog({
      open: false,
      client: null
    });
  };

  const handleConfirmSendSms = async () => {
    const client = smsConfirmDialog.client;
    handleCloseSmsConfirmDialog();

    if (client) {
      await handleResendPaymentReceivedSms(client);
    }
  };

  const handleResendPaymentReceivedSms = async (client) => {
    try {
      const { data } = await API.post(
        `/sms/send-payment-received-latest/${client._id}`
      );

      showMessage(
        data?.sent ? "Payment SMS Sent" : "Payment SMS Skipped",
        data?.sent
          ? `Payment received SMS was sent again to ${client.AccountName || client.ClientName || "the client"}.`
          : data?.reason || data?.response || "Payment received SMS was skipped.",
        data?.sent ? "success" : "warning"
      );
    } catch (err) {
      console.error("RESEND PAYMENT SMS ERROR:", err.response?.data || err.message);
      showMessage(
        "Payment SMS Failed",
        err.response?.data?.error || "Failed to send payment received SMS.",
        "error"
      );
    }
  };

  const handleClosePaymentHistoryModal = () => {
    setOpenPaymentHistoryModal(false);
    setPaymentHistoryRows([]);
    setPaymentHistoryError("");
    setPaymentHistoryLoading(false);
    setExpandedPaymentHistoryRowId("");
  };

  const refreshMikrotikStatus = useCallback(async (clientId, options = {}) => {
    if (!clientId) {
      return;
    }

    const silent = Boolean(options.silent);

    try {
      if (silent) {
        setMikrotikStatusRefreshing(true);
      } else {
        setMikrotikStatusLoading(true);
      }
      setMikrotikStatusError("");

      const { data } = await API.get(`/clients/${clientId}/mikrotik-status`, {
        params: {
          includeOlt: silent ? "0" : "1",
          _: Date.now()
        }
      });
      setMikrotikStatusData((prev) => {
        if (silent) {
          if (!prev) {
            return prev;
          }

          return {
            ...data,
            olt: prev.olt
          };
        }

        return data || null;
      });
    } catch (err) {
      console.error("MIKROTIK STATUS ERROR:", err.response?.data || err.message);
      setMikrotikStatusError(
        err.response?.data?.error || "Failed to load MikroTik client status."
      );
    } finally {
      if (silent) {
        setMikrotikStatusRefreshing(false);
      } else {
        setMikrotikStatusLoading(false);
      }
    }
  }, []);

  const handleOpenMikrotikStatusModal = async (client) => {
    if (!client?._id) {
      return;
    }

    setSelectedClient(client);
    setOpenMikrotikStatusModal(true);
    setMikrotikStatusError("");
    setMikrotikStatusData(null);
    await refreshMikrotikStatus(client._id);
  };

  const handleCloseMikrotikStatusModal = () => {
    setOpenMikrotikStatusModal(false);
    setMikrotikStatusLoading(false);
    setMikrotikStatusRefreshing(false);
    setMikrotikStatusError("");
    setMikrotikStatusData(null);
  };

  useEffect(() => {
    if (!openMikrotikStatusModal || !selectedClient?._id || !mikrotikStatusData) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refreshMikrotikStatus(selectedClient._id, { silent: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [mikrotikStatusData, openMikrotikStatusModal, refreshMikrotikStatus, selectedClient?._id]);

  const handleOpenDeleteHistoryDialog = (row) => {
    setDeleteHistoryDialog({
      open: true,
      row
    });
  };

  const handleCloseDeleteHistoryDialog = () => {
    setDeleteHistoryDialog({
      open: false,
      row: null
    });
  };

  const handleCloseAdjustDueDateDialog = () => {
    setAdjustDueDateDialog({
      open: false,
      value: null,
      row: null,
      client: null
    });
  };

  const handleDeletePaymentHistory = async () => {
    if (!deleteHistoryDialog.row?._id) {
      showMessage("Delete Failed", "This history record can't be deleted.", "error");
      return;
    }

    try {
      await API.delete(
        `/transactions/${deleteHistoryDialog.row._id}`,
        {
          params: {
            source: deleteHistoryDialog.row.HistorySource || "transactions"
          }
        }
      );

      setPaymentHistoryRows((prev) =>
        prev.filter((row) => row._id !== deleteHistoryDialog.row._id)
      );

      setAdjustDueDateDialog({
        open: true,
        row: deleteHistoryDialog.row,
        client: selectedClient,
        value: selectedClient?.DueDate ? dayjs(selectedClient.DueDate) : dayjs()
      });
      handleCloseDeleteHistoryDialog();
    } catch (err) {
      console.error("DELETE PAYMENT HISTORY ERROR:", err.response?.data || err.message);
      showMessage(
        "Delete Failed",
        err.response?.data?.error || "Failed to delete payment history.",
        "error"
      );
    }
  };

  const handleSaveAdjustedDueDate = async () => {
    const adjustClient = adjustDueDateDialog.client || selectedClient;

    if (!adjustClient?._id || !adjustDueDateDialog.value) {
      showMessage("Due Date Required", "Please choose a due date before saving.", "warning");
      return;
    }

    try {
      const dueDateValue = adjustDueDateDialog.value.toDate();
      const subscriptionCover = String(dueDateValue.getDate());

      await API.put(`/clients/${adjustClient._id}/due-date`, {
        DueDate: dueDateValue.toISOString(),
        SubscriptionCover: subscriptionCover
      });

      let correctionSmsResult = null;
      try {
        const { data } = await API.post("/sms/send-payment-correction", {
          client: {
            ClientName: adjustClient.ClientName || adjustClient.AccountName || "",
            AccountName: adjustClient.AccountName || "",
            AccountNumber: adjustClient.AccountNumber || "",
            ContactNumber: adjustClient.ContactNumber || "",
            AmountDue: adjustClient.AmountDue || 0,
            SubscriptionCover: subscriptionCover
          },
          dueDate: dueDateValue.toISOString(),
          subscriptionCover
        });
        correctionSmsResult = data;
      } catch (smsErr) {
        console.error("PAYMENT CORRECTION SMS ERROR:", smsErr.response?.data || smsErr.message);
        correctionSmsResult = {
          sent: false,
          reason: smsErr.response?.data?.error || "Payment correction SMS request failed."
        };
      }

      setSelectedClient((prev) =>
        prev && String(prev._id || "") === String(adjustClient._id || "")
          ? {
              ...prev,
              DueDate: dueDateValue.toISOString(),
              SubscriptionCover: subscriptionCover
            }
          : prev
      );

      await loadClients();
      handleCloseAdjustDueDateDialog();
      handleClosePaymentHistoryModal();
      showMessage(
        correctionSmsResult?.sent ? "Delete Completed" : "Delete Completed, SMS Skipped",
        correctionSmsResult?.sent
          ? "Payment history was deleted, due date was updated, and correction SMS was sent."
          : `Payment history was deleted and due date was updated. ${correctionSmsResult?.reason || "Correction SMS was skipped."}`,
        correctionSmsResult?.sent ? "success" : "warning"
      );
    } catch (err) {
      console.error("ADJUST DUE DATE ERROR:", err.response?.data || err.message);
      showMessage(
        "Due Date Update Failed",
        err.response?.data?.error || "Failed to update the due date.",
        "error"
      );
    }
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;

    if (name === "ContactNumber") {
      if (!/^\d*$/.test(value)) {
        return;
      }

      if (value.length > 11) {
        return;
      }
    }

    if (["AdditionalCharge", "Discount"].includes(name) && !/^\d*\.?\d*$/.test(value)) {
      return;
    }

    setPaymentForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleReconnectPlanChange = (e) => {
    const selectedValue = e.target.value;
    const selectedPlan = netPlans.find((plan) => getPlanName(plan) === selectedValue);

    setPaymentForm((prev) => ({
      ...prev,
      ReconnectPlan: selectedValue,
      ReconnectCharge: getPlanPrice(selectedPlan)
    }));
  };

  const handleReconnectAuthModeChange = (event) => {
    const nextAuthMode = getNormalizedAuthMode(event.target.value);
    const defaultReconnectPlan = resolveDefaultReconnectPlan({
      client: selectedClient,
      netPlans,
      authMode: nextAuthMode
    });

    setPaymentForm((prev) => ({
      ...prev,
      ReconnectAuthMode: nextAuthMode,
      ReconnectPlan: getPlanName(defaultReconnectPlan) || "",
      ReconnectCharge: defaultReconnectPlan ? getPlanPrice(defaultReconnectPlan) : 0,
      ReconnectMacAddress:
        nextAuthMode === "IPOE"
          ? String(selectedClient?.PreviousMacAddress || prev.ReconnectMacAddress || "")
              .trim()
              .toUpperCase()
          : ""
    }));
  };

  const extractReferenceNumber = (text) => {
    const raw = String(text || "");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => String(line || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const cleaned = raw.replace(/\r/g, " ").replace(/\n/g, " ");

    const cleanOcrReference = (value) => {
      const candidate = String(value || "").replace(/[^A-Z0-9]/gi, "").trim();

      if (/^\d+$/.test(candidate) && candidate.length > 13 && candidate.startsWith("00")) {
        const withoutOcrPrefix = candidate.replace(/^00+/, "");
        if (withoutOcrPrefix.length >= 8) {
          return withoutOcrPrefix;
        }
      }

      return candidate;
    };

    const traceIdMatch = cleaned.match(
      /\btrace\s*id\s*[:#-]?\s*([A-Z0-9\s-]{4,30})/i
    );
    if (traceIdMatch?.[1]) {
      const traceCandidate = cleanOcrReference(traceIdMatch[1]);
      if (
        traceCandidate.length >= 4 &&
        /\d/.test(traceCandidate) &&
        !looksLikePhoneReference(traceCandidate) &&
        !looksLikeDateOrTimeReference(traceCandidate)
      ) {
        return traceCandidate;
      }
    }

    const referenceIdMatch = cleaned.match(
      /\breference\s*id\s*[:#-]?\s*([A-Z0-9\s-]{6,40})/i
    );
    if (referenceIdMatch?.[1]) {
      const referenceIdCandidate = cleanOcrReference(referenceIdMatch[1]);
      if (
        referenceIdCandidate.length >= 6 &&
        /\d/.test(referenceIdCandidate) &&
        !looksLikePhoneReference(referenceIdCandidate) &&
        !looksLikeDateOrTimeReference(referenceIdCandidate)
      ) {
        return referenceIdCandidate;
      }
    }

    const stripDateTimeTail = (value) =>
      String(value || "")
        .replace(
          /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b.*$/i,
          ""
        )
        .replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b.*$/i, "")
        .replace(/\b(?:AM|PM)\b.*$/i, "")
        .trim();

    const extractDigitsFromChunk = (chunk) => {
      const chunkText = String(chunk || "").trim();
      if (!chunkText) {
        return "";
      }

      const digitGroups = chunkText.match(/\d[\d\s-]{5,30}/g) || [];

      for (const group of digitGroups) {
        const candidate = cleanOcrReference(group);

        if (
          candidate.length >= 6 &&
          !looksLikePhoneReference(candidate) &&
          !looksLikeDateOrTimeReference(candidate)
        ) {
          return candidate;
        }
      }

      const compactCandidate = cleanOcrReference(chunkText);
      if (
        compactCandidate.length >= 6 &&
        /\d/.test(compactCandidate) &&
        !looksLikePhoneReference(compactCandidate) &&
        !looksLikeDateOrTimeReference(compactCandidate)
      ) {
        return compactCandidate;
      }

      return "";
    };

    const gcashExpressSendLineIndex = lines.findIndex((line) =>
      /\bref\s*no\.?\b/i.test(line)
    );

    if (gcashExpressSendLineIndex >= 0) {
      const gcashReferenceChunk = [
        lines[gcashExpressSendLineIndex],
        lines[gcashExpressSendLineIndex + 1] || ""
      ]
        .join(" ")
        .replace(/\bref\s*no\.?\s*[:#-]?\s*/i, "")
        .replace(
          /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b.*$/i,
          ""
        );
      const gcashReferenceCandidate = cleanOcrReference(gcashReferenceChunk);

      if (
        gcashReferenceCandidate.length >= 8 &&
        !looksLikePhoneReference(gcashReferenceCandidate) &&
        !looksLikeDateOrTimeReference(gcashReferenceCandidate)
      ) {
        return gcashReferenceCandidate;
      }
    }

    for (let index = 0; index < lines.length; index += 1) {
      const currentLine = lines[index];

      if (!/(reference(?:\s*number)?|ref(?:\s*no\.?)?|rrn|trace(?:\s*no\.?)?)/i.test(currentLine)) {
        continue;
      }

      const currentLineWithoutLabel = currentLine.replace(
        /(reference(?:\s*number)?|ref(?:\s*no\.?)?|rrn|trace(?:\s*no\.?)?)\s*[:#-]?\s*/i,
        ""
      );
      const splitReferenceParts = [stripDateTimeTail(currentLineWithoutLabel)];

      for (let offset = 1; offset <= 2; offset += 1) {
        const nextLine = String(lines[index + offset] || "").trim();
        if (!nextLine) {
          continue;
        }

        const nextDigitsOnly = stripDateTimeTail(nextLine);

        if (
          /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(nextLine) ||
          /\b\d{1,2}:\d{2}\b/.test(nextLine)
        ) {
          break;
        }

        if (/^[\d\s-]{3,}$/.test(nextDigitsOnly)) {
          splitReferenceParts.push(nextDigitsOnly);
          continue;
        }

        break;
      }

      const splitReferenceCandidate = extractDigitsFromChunk(
        splitReferenceParts.join(" ")
      );
      if (splitReferenceCandidate) {
        return splitReferenceCandidate;
      }

      const nearbyChunk = [
        currentLine,
        lines[index + 1] || "",
        lines[index + 2] || ""
      ]
        .filter(Boolean)
        .join(" ");

      const lineCandidate = extractDigitsFromChunk(nearbyChunk);
      if (lineCandidate) {
        return lineCandidate;
      }
    }

    const labelMatch = cleaned.match(
      /(reference(?:\s*number)?|ref(?:\s*no\.?)?|rrn|trace(?:\s*no\.?)?)\s*[:#-]?\s*([A-Z0-9\s-]{6,40})/i
    );

    if (labelMatch?.[2]) {
      const labelCandidate = extractDigitsFromChunk(labelMatch[2]);
      if (labelCandidate) {
        return labelCandidate;
      }
    }

    const expressSendRefMatch = cleaned.match(
      /\bref\s*no\.?\s*[:#-]?\s*((?:\d[\s-]?){6,20})(?=\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}:\d{2}|$))/i
    );
    if (expressSendRefMatch?.[1]) {
      const expressSendCandidate = cleanOcrReference(expressSendRefMatch[1]);
      if (
        expressSendCandidate.length >= 6 &&
        !looksLikePhoneReference(expressSendCandidate) &&
        !looksLikeDateOrTimeReference(expressSendCandidate)
      ) {
        return expressSendCandidate;
      }
    }

    const groupedDigitMatch = cleaned.match(/(?:\d[\s-]?){8,20}/g) || [];
    const groupedDigitReference = groupedDigitMatch
      .map((value) => cleanOcrReference(value))
      .find(
        (value) =>
          value.length >= 8 &&
          !looksLikePhoneReference(value) &&
          !looksLikeDateOrTimeReference(value)
      );

    if (groupedDigitReference) {
      return groupedDigitReference;
    }

    const genericMatches = [
      ...cleaned.matchAll(/\b([A-Z0-9][A-Z0-9-]{5,24})\b/g)
    ]
      .map((match) => cleanOcrReference(match[1]))
      .filter(
        (value) =>
          /[A-Z]/i.test(value) &&
          /\d/.test(value) &&
          !looksLikeDateOrTimeReference(value)
      );

    return genericMatches[0] || "";
  };

  const extractAmount = (text) => {
    const raw = String(text || "");
    const commaMoneyMatch = raw.match(
      /\b(?:PHP|P|₱|â‚±)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)\b/i
    );

    if (commaMoneyMatch?.[1]) {
      return commaMoneyMatch[1].replace(/,/g, "");
    }

    const cleaned = raw.replace(/,/g, "");
    const transferAmountMatch = cleaned.match(
      /(transfer\s*amount|total\s*amount(?:\s*sent)?)\s*[:#-]?\s*(php|p|₱)?\s*([0-9]+(?:\.[0-9]{2})?)/i
    );

    if (transferAmountMatch?.[3]) {
      return transferAmountMatch[3];
    }

    const labeledMatch = cleaned.match(
      /(amount|total|paid|payment)\s*[:#-]?\s*(php|₱)?\s*([0-9]+(?:\.[0-9]{2})?)/i
    );

    if (labeledMatch?.[3]) {
      return labeledMatch[3];
    }

    const moneyMatches = [
      ...cleaned.matchAll(/\b([0-9]{2,}(?:\.[0-9]{2})?)\b/g)
    ]
      .map((match) => match[1])
      .filter((value) => Number(value) > 0);

    return moneyMatches[0] || "";
  };

  const extractTransferDate = (text) => {
    const raw = String(text || "");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => String(line || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const cleaned = raw.replace(/\r/g, " ").replace(/\n/g, " ");

    const monthDateTimePattern =
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{1,2},?\s*\d{4},?\s+\d{1,2}:\d{2}\s*(?:AM|PM)\b/i;
    const dayFirstMonthDateTimePattern =
      /\b\d{1,2}\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}(?:\s+at)?\s+\d{1,2}:\d{2}\s*(?:AM|PM)\b/i;
    const monthDateTimeWithoutMeridiemPattern =
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{1,2},?\s*\d{4},?\s+\d{1,2}:\d{2}\b/i;
    const dayFirstMonthDateTimeWithoutMeridiemPattern =
      /\b\d{1,2}\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}(?:\s+at)?\s+\d{1,2}:\d{2}\b/i;
    const slashDateTimePattern =
      /\b\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)\b/i;
    const slashDateTimeWithoutMeridiemPattern =
      /\b\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\b/i;

    const monthNameMatch = cleaned.match(monthDateTimePattern);
    if (monthNameMatch?.[0]) {
      return String(monthNameMatch[0]).replace(/\s+/g, " ").trim();
    }

    const dayFirstMonthMatch = cleaned.match(dayFirstMonthDateTimePattern);
    if (dayFirstMonthMatch?.[0]) {
      return String(dayFirstMonthMatch[0]).replace(/\s+/g, " ").trim();
    }

    const slashDateTimeMatch = cleaned.match(slashDateTimePattern);
    if (slashDateTimeMatch?.[0]) {
      return String(slashDateTimeMatch[0]).replace(/\s+/g, " ").trim();
    }

    for (let index = 0; index < lines.length; index += 1) {
      const currentLine = lines[index];
      const nextLine = String(lines[index + 1] || "").trim();

      const monthNoMeridiemMatch = currentLine.match(monthDateTimeWithoutMeridiemPattern);
      if (monthNoMeridiemMatch?.[0]) {
        if (/^(AM|PM)$/i.test(nextLine)) {
          return `${String(monthNoMeridiemMatch[0]).replace(/\s+/g, " ").trim()} ${nextLine.toUpperCase()}`;
        }
        if (/\b(?:AM|PM)\b/i.test(nextLine)) {
          return `${String(monthNoMeridiemMatch[0]).replace(/\s+/g, " ").trim()} ${nextLine.match(/\b(?:AM|PM)\b/i)[0].toUpperCase()}`;
        }
      }

      const dayFirstMonthNoMeridiemMatch = currentLine.match(dayFirstMonthDateTimeWithoutMeridiemPattern);
      if (dayFirstMonthNoMeridiemMatch?.[0]) {
        if (/^(AM|PM)$/i.test(nextLine)) {
          return `${String(dayFirstMonthNoMeridiemMatch[0]).replace(/\s+/g, " ").trim()} ${nextLine.toUpperCase()}`;
        }
        if (/\b(?:AM|PM)\b/i.test(nextLine)) {
          return `${String(dayFirstMonthNoMeridiemMatch[0]).replace(/\s+/g, " ").trim()} ${nextLine.match(/\b(?:AM|PM)\b/i)[0].toUpperCase()}`;
        }
      }

      const slashNoMeridiemMatch = currentLine.match(slashDateTimeWithoutMeridiemPattern);
      if (slashNoMeridiemMatch?.[0]) {
        if (/^(AM|PM)$/i.test(nextLine)) {
          return `${String(slashNoMeridiemMatch[0]).replace(/\s+/g, " ").trim()} ${nextLine.toUpperCase()}`;
        }
        if (/\b(?:AM|PM)\b/i.test(nextLine)) {
          return `${String(slashNoMeridiemMatch[0]).replace(/\s+/g, " ").trim()} ${nextLine.match(/\b(?:AM|PM)\b/i)[0].toUpperCase()}`;
        }
      }
    }

    return "";
  };

    const extractReceiverLast4 = (text) => {
    const raw = String(text || "");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => String(line || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const phonePattern = /(?:\+?63\s*9|09)[\d*?.\-\s]{4,24}?(\d{4})\b/i;

    for (const line of lines) {
      if (!/(?:\+?63|09)/i.test(line)) {
        continue;
      }
      const lineMatch = line.match(phonePattern);
      if (lineMatch?.[1]) {
        return String(lineMatch[1]).trim();
      }
    }

    const compactPhoneLine = lines.find((line) => /(?:\+?63|09)/i.test(line));
    if (compactPhoneLine) {
      const digitsOnly = compactPhoneLine.replace(/[^\d]/g, "");
      if (digitsOnly.length >= 4) {
        return digitsOnly.slice(-4);
      }
    }

    return "";
  };

  const detectPaymentMethodFromText = (text) => {
    const normalized = text.toLowerCase();
    const hasGcashClue =
      /\bg\s*cash\b/i.test(text) ||
      /g-?xchange/i.test(text) ||
      /express\s*send/i.test(text) ||
      /sent\s+via\s+g\s*cash/i.test(text) ||
      (/\bref\s*no\.?\b/i.test(text) &&
        (/(?:\+?63\s*9|09)[\d\s*?.-]{4,24}\d{4}/i.test(text) ||
          /total\s*amount\s*sent/i.test(text))) ||
      /total\s*amount\s*sent/i.test(text) ||
      /sent\s+via\s+gcash/i.test(text);

    if (hasGcashClue) {
      return "GCASH";
    }

    if (
      /\bref\s*no\.?\b/i.test(text) &&
      /(?:\+?63\s*9|09)[\d\s*?.-]{4,24}\d{4}/i.test(text) &&
      /(total\s*amount\s*sent|amount)/i.test(text)
    ) {
      return "GCASH";
    }

    if (
      normalized.includes("express send") &&
      (normalized.includes("sent via gcash") || normalized.includes("gcash"))
    ) {
      return "GCASH";
    }

    if (
      (normalized.includes("g-xchange") || normalized.includes("gcash")) &&
      (normalized.includes("instapay qrph") || normalized.includes("sent money via") || normalized.includes("maya"))
    ) {
      return "GCASH";
    }

    if (
      (normalized.includes("maribank") || normalized.includes("transfer result")) &&
      (normalized.includes("g-xchange") || normalized.includes("gcash"))
    ) {
      return "GCASH";
    }

    if (
      normalized.includes("maribank") ||
      normalized.includes("instapay") ||
      normalized.includes("transfer result") ||
      normalized.includes("transfer successful")
    ) {
      return "BANK";
    }

    if (normalized.includes("gcash")) {
      return "GCASH";
    }

    if (
      normalized.includes("paymaya") ||
      normalized.includes("maya") ||
      normalized.includes("maya wallet")
    ) {
      return "PAYMAYA";
    }

    return "BANK";
  };

  const processReceiptImage = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setOcrMessage("Please drop an image file.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setReceiptPreview(previewUrl);
    setOcrLoading(true);
    setOcrMessage("Reading receipt...");

    try {
      const receiptImageDataUrl = await compressReceiptImageToDataUrl(file).catch(() =>
        fileToDataUrl(file)
      );
      const result = await Tesseract.recognize(file, "eng");
      const ocrText = result.data.text || "";
      const extractedRef = extractReferenceNumber(ocrText);
      const extractedAmount = extractAmount(ocrText);
      const extractedTransferDate = extractTransferDate(ocrText);
      const detectedMethod = detectPaymentMethodFromText(ocrText);
      const extractedReceiverLast4 =
        /maribank|instapay|transfer result/i.test(String(ocrText || ""))
          ? ""
          : extractReceiverLast4(ocrText);

      setPaymentEntries((prev) => {
        const isStarterEmptyEntry = (entry) => {
          const entryMethod = normalizePaymentLineMethod(entry?.method || "CASH");
          const rawAmount = String(entry?.amount ?? "").trim();
          const numericAmount = Number(entry?.amount || 0);
          const rawReference = String(entry?.reference || "").trim();
          return entryMethod === "CASH" && !rawReference && (!rawAmount || numericAmount <= 0);
        };

        let next = prev.length ? [...prev] : [createPaymentEntry()];

        if (
          next.length > 1 &&
          isStarterEmptyEntry(next[0]) &&
          next.some((entry, index) => index > 0 && (Number(entry?.amount || 0) > 0 || String(entry?.reference || "").trim()))
        ) {
          next = next.slice(1);
        }

        const targetIndex = next.findIndex((entry) => isStarterEmptyEntry(entry));
        const nextIndex = targetIndex >= 0 ? targetIndex : next.length;

        if (!next[nextIndex]) {
          next.push(createPaymentEntry());
        }

        next[nextIndex] = {
          ...next[nextIndex],
          method: detectedMethod,
          amount: extractedAmount || next[nextIndex].amount,
          reference: extractedRef || next[nextIndex].reference,
          receiptAmount: extractedAmount || next[nextIndex].receiptAmount,
          transferDate: extractedTransferDate || next[nextIndex].transferDate,
          receiverLast4: extractedReceiverLast4 || next[nextIndex].receiverLast4,
          receiptImageUrl: previewUrl,
          receiptImageDataUrl
        };
        return next;
      });

      setReceiptPreview("");
      setReceiptPreviewOpen(false);

      if (extractedRef || extractedAmount || extractedTransferDate || extractedReceiverLast4) {
        const messageParts = [];

        if (detectedMethod) {
          messageParts.push(`Method: ${detectedMethod}`);
        }
        if (extractedRef) {
          messageParts.push(`Reference: ${extractedRef}`);
        }
        if (extractedAmount) {
          messageParts.push(`Amount: ${extractedAmount}`);
        }
        if (extractedTransferDate) {
            messageParts.push(`Transfer Date: ${extractedTransferDate}`);
          }
          if (extractedReceiverLast4) {
            messageParts.push(`Receiver Last 4: ${extractedReceiverLast4}`);
          }

        setOcrMessage(messageParts.join(" | "));
      } else {
        setOcrMessage("Receipt image attached. You can type the amount and reference manually.");
      }
    } catch (error) {
      console.error("OCR ERROR:", error);
      setOcrMessage("Failed to read the receipt image.");
    } finally {
      setOcrLoading(false);
    }
  };

  const formSectionSx = {
    p: 2.25,
    borderRadius: 3,
    border: "1px solid #dbe4ee",
    backgroundColor: "#ffffff",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)"
  };

  const summaryCardSx = {
    p: 0.75,
    minHeight: 58,
    borderRadius: 3,
    border: "1px solid #dbe4ee",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)"
  };

  const showMessage = (title, message, severity = "info") => {
    setMessageBox({
      open: true,
      title,
      message,
      severity
    });
  };

  const closeMessageBox = () => {
    setMessageBox((prev) => ({
      ...prev,
      open: false
    }));
  };

  const renderMessageDialog = () => (
    <Dialog
      open={messageBox.open}
      onClose={closeMessageBox}
      maxWidth="xs"
      fullWidth
      sx={{ zIndex: 20000 }}
      BackdropProps={{
        sx: { zIndex: 19999 }
      }}
      PaperProps={{
        sx: { zIndex: 20001 }
      }}
    >
      <DialogContent sx={{ pt: 3 }}>
        <Alert severity={messageBox.severity} sx={{ mb: 2 }}>
          {messageBox.title}
        </Alert>
        <Typography>{messageBox.message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={closeMessageBox}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );

  const openClientActionConfirm = (action, client = null) => {
    if (client) {
      setSelectedClient(client);
    }

    if (action === "pullout") {
      setClientActionConfirm({
        open: true,
        action,
        title: "Confirm Pull Out",
        message:
          "Are you sure you want to pull out this client? This will set the client as disconnected and update the plan/note."
      });
      return;
    }

    if (action === "refresh") {
      setClientActionConfirm({
        open: true,
        action,
        title: "Confirm Refresh Mode",
        message:
          "Are you sure you want to refresh this PPPoE client? This will remove the active PPPoE connection."
      });
    }
  };

  const closeClientActionConfirm = () => {
    setClientActionConfirm((prev) => ({
      ...prev,
      open: false
    }));
  };

  const handleConfirmClientAction = async () => {
    const action = clientActionConfirm.action;
    closeClientActionConfirm();

    if (action === "pullout") {
      await handlePullOutClient();
      return;
    }

    if (action === "refresh") {
      await handleRefreshPppoeMode();
    }
  };

  const renderClientActionConfirmDialog = () => (
    <Dialog
      open={clientActionConfirm.open}
      onClose={closeClientActionConfirm}
      maxWidth="xs"
      fullWidth
      sx={{ zIndex: 20000 }}
      BackdropProps={{
        sx: { zIndex: 19999 }
      }}
      PaperProps={{
        sx: { zIndex: 20001, borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ fontWeight: 800 }}>
        {clientActionConfirm.title}
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Please confirm before continuing.
        </Alert>
        <Typography>{clientActionConfirm.message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={closeClientActionConfirm} sx={{ textTransform: "none", fontWeight: 700 }}>
          No
        </Button>
        <Button
          variant="contained"
          color={clientActionConfirm.action === "pullout" ? "warning" : "primary"}
          onClick={handleConfirmClientAction}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Yes
        </Button>
      </DialogActions>
    </Dialog>
  );

  const closePaymentDetailsConfirm = () => {
    setPaymentDetailsConfirm({
      open: false,
      title: "",
      message: "",
      severity: "warning",
      onConfirm: null
    });
  };

  const renderPaymentDetailsConfirmDialog = () => (
    <Dialog
      open={paymentDetailsConfirm.open}
      onClose={closePaymentDetailsConfirm}
      maxWidth="xs"
      fullWidth
      sx={{ zIndex: 20000 }}
      BackdropProps={{
        sx: { zIndex: 19999 }
      }}
      PaperProps={{
        sx: { zIndex: 20001, borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ fontWeight: 800 }}>
        {paymentDetailsConfirm.title || "Confirm Payment Details"}
      </DialogTitle>
      <DialogContent>
        <Alert severity={paymentDetailsConfirm.severity || "warning"} sx={{ mb: 2 }}>
          {paymentDetailsConfirm.message || "Are you sure your input payment details are correct?"}
        </Alert>
        {paymentDetailsConfirm.message ? null : (
          <Typography>
            Please confirm the amount, reference number, transfer date, and receiver details before saving.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={closePaymentDetailsConfirm} sx={{ textTransform: "none", fontWeight: 700 }}>
          No
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            const onConfirm = paymentDetailsConfirm.onConfirm;
            closePaymentDetailsConfirm();
            if (onConfirm) {
              onConfirm();
            }
          }}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Yes
        </Button>
      </DialogActions>
    </Dialog>
  );

  const handleCopyReceiptImage = async () => {
    if (!receiptViewerSrc) {
      return;
    }

    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard image copy is not supported by this browser.");
      }

      const blob = await dataUrlToBlob(receiptViewerSrc);
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type || "image/png"]: blob
        })
      ]);

      showMessage("Receipt Image Copied", "The receipt image was copied to the clipboard.", "success");
    } catch (err) {
      console.error("COPY RECEIPT IMAGE ERROR:", err);
      showMessage(
        "Copy Failed",
        "Browser did not allow copying the image. Click the image preview and use right-click or long-press to copy/save it.",
        "warning"
      );
    }
  };

  const handleOpenReceiptImagePreview = async (value) => {
    try {
      const previewSource = await resolveReceiptImagePreviewSource(value);
      setReceiptViewerSrc(previewSource);
      setReceiptPreviewOpen(true);
    } catch (error) {
      console.error("RECEIPT IMAGE PREVIEW ERROR:", error);
      showMessage("Receipt Image Error", "Unable to open the receipt image file.", "error");
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data } = await API.get("/auth/technicians");
      setTechnicians(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("TECHNICIAN FETCH ERROR:", err.response?.data || err.message);
      setTechnicians([]);
    }
  };

  const loadRepairSmsTemplate = async () => {
    try {
      const { data } = await API.get("/sms-recepients");
      const template = Array.isArray(data)
        ? data.find(
            (item) =>
              String(item.TYPE || "").trim().toLowerCase() ===
              REPAIR_SMS_TEMPLATE_TYPE.toLowerCase()
          ) || null
        : null;
      setRepairSmsTemplate(template);
    } catch (err) {
      console.error("REPAIR SMS TEMPLATE FETCH ERROR:", err.response?.data || err.message);
      setRepairSmsTemplate(null);
    }
  };

  const handleOpenRepairDialog = async (client) => {
    setSelectedClient(client);
    setRepairDialog({
      open: true,
      technicianId: "",
      technicianIds: [],
      repairText: "",
      smsMessage: ""
    });

    if (!technicians.length) {
      await loadTechnicians();
    }

    if (!repairSmsTemplate) {
      await loadRepairSmsTemplate();
    }
  };

  const handleCloseRepairDialog = () => {
    setRepairDialog({
      open: false,
      technicianId: "",
      technicianIds: [],
      repairText: "",
      smsMessage: ""
    });
    setRepairSaving(false);
  };

  const handleSaveRepairRequest = async () => {
    if (!selectedClient?._id) {
      showMessage("No Client Selected", "Please select a client first.", "warning");
      return;
    }

    if (!repairDialog.technicianIds?.length) {
      showMessage("Technician Required", "Please choose at least one technician.", "warning");
      return;
    }

    const finalSmsMessage = repairDetailsDisplayValue.trim();

    if (!finalSmsMessage) {
      showMessage("SMS Details Required", "Please enter the SMS details.", "warning");
      return;
    }

    try {
      setRepairSaving(true);

      const { data } = await API.post(`/clients/${selectedClient._id}/repair`, {
        technicianIds: repairDialog.technicianIds,
        technicianName: selectedRepairTechnicianNames,
        repairText: finalSmsMessage,
        smsMessage: finalSmsMessage
      });

      handleCloseRepairDialog();
      const smsSent = Boolean(data?.smsResult?.sent);
      showMessage(
        smsSent ? "Repair SMS Sent" : "Repair SMS Skipped",
        smsSent
          ? `Repair request for ${selectedClient.AccountName || selectedClient.ClientName || "client"} was sent to ${selectedRepairTechnicianNames || "the selected technicians"}.`
          : data?.message || "Repair request SMS was skipped.",
        smsSent ? "success" : "warning"
      );
    } catch (err) {
      console.error("REPAIR REQUEST SAVE ERROR:", err.response?.data || err.message);
      showMessage(
        "Repair Request Failed",
        err.response?.data?.error || "Failed to save repair request.",
        "error"
      );
    } finally {
      setRepairSaving(false);
    }
  };

  const clearReceiptUpload = () => {
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview);
    }

    setReceiptPreview("");
    setReceiptPreviewOpen(false);
    setOcrLoading(false);
    setOcrMessage("");
  };

  const revokeEntryReceiptUrls = (entries = []) => {
    entries.forEach((entry) => {
      const url = String(entry?.receiptImageUrl || "").trim();
      if (url && url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn("Failed to revoke receipt image URL:", error);
        }
      }
    });
  };

  const handleReceiptPaste = (e) => {
    const items = e.clipboardData?.items || [];

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processReceiptImage(file);
        }
        return;
      }
    }

    setOcrMessage("No image found in clipboard. Copy a receipt image first.");
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;

    if (name === "ContactNumber") {
      if (!/^\d*$/.test(value)) return;
      if (value.length > 11) return;

      setNewClient((prev) => ({
        ...prev,
        ContactNumber: value
      }));
      return;
    }

    if (name === "EmailBillingEnabled") {
      if (!canEnableEmailBilling && checked) {
        showMessage(
          "Valid Email Required",
          "Please enter a valid email address before turning on Email Billing.",
          "warning"
        );
        return;
      }

      setNewClient((prev) => ({
        ...prev,
        EmailBillingEnabled: Boolean(checked)
      }));
      return;
    }

    if (name === "Email") {
      setNewClient((prev) => ({
        ...prev,
        Email: value.trim()
      }));
      return;
    }

    if (name === "AuthenticationMode") {
      const originalAuthMode = String(
        selectedClient?.AuthenticationMode || ""
      ).trim().toUpperCase();

      if (editMode && originalAuthMode === "IPOE" && value === "PPPOE") {
        showMessage(
          "Authentication Locked",
          "IPOE clients can't be converted to PPPOE. PPPOE to IPOE is allowed.",
          "warning"
        );
        return;
      }

      setNewClient((prev) => ({
        ...prev,
        AuthenticationMode: value,
        MacAddress: value === "PPPOE" ? "" : prev.MacAddress || prev.macAddress || "",
        Profile: "",
        NetPlan: "",
        AmountDue: ""
      }));
      return;
    }

    if (name === "MacAddress") {
      setNewClient((prev) => ({
        ...prev,
        MacAddress: value.toUpperCase()
      }));
      return;
    }

    if (name === "Profile") {
      const selected = netPlans.find((p) => getPlanName(p) === value);
      const nextIsDisconnectedProfile = isDisconnectedPlanValue(
        value,
        getPlanSpeed(selected)
      );

      setNewClient((prev) => ({
        ...prev,
        Profile: value,
        NetPlan: getPlanSpeed(selected),
        AmountDue: getPlanPrice(selected),
        Status: nextIsDisconnectedProfile ? "DISCONNECTED" : "ACTIVE"
      }));
      return;
    }

    if (name === "DueDate") {
      setNewClient((prev) => ({
        ...prev,
        DueDate: value,
        SubscriptionCover: getDayFromMMDDYYYY(value)
      }));
      return;
    }

    if (name === "Latitude" || name === "Longitude") {
      setNewClient((prev) => ({
        ...prev,
        [name]: normalizeCoordinateInput(value)
      }));
      return;
    }

    setNewClient((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const generatePassword = () => {
    const randomPass = Math.random().toString(36).slice(-8);

    setNewClient((prev) => ({
      ...prev,
      Password: randomPass
    }));
  };

  const handleAddClient = async () => {
    if (!newClient.ClientName || !newClient.Profile) {
      showMessage("Required Fields", "Please fill required fields.", "warning");
      return;
    }

    if (emailError) {
      showMessage("Invalid Email", "Please enter a valid email address.", "warning");
      return;
    }

      const data = {
        ...newClient,
        SubscriptionCover: newClient.SubscriptionCover || "UN-GROUPED",
        AccountNumber: Date.now().toString(),
        DateEntry: new Date().toLocaleDateString(),
        Email: emailValue || "N/A",
        EmailBillingEnabled: canEnableEmailBilling
          ? Boolean(newClient.EmailBillingEnabled)
          : false,
        Facebook: "N/A",
        Latitude: normalizeCoordinateInput(newClient.Latitude),
        Longitude: normalizeCoordinateInput(newClient.Longitude),
        DueDate: parseMMDDYYYYToISO(newClient.DueDate),
        AmountDue: Number(String(newClient.AmountDue || 0).replace(/,/g, ""))
    };

    try {
      await addClient(data);
      await loadClients();
      handleCloseModal();
      setNewClient(getDefaultNewClientForm());
    } catch (err) {
      console.error(err);
      showMessage(
        "Save Failed",
        err.response?.data?.error || "Failed to save client.",
        "error"
      );
    }
  };

  const handleUpdateClient = async () => {
    const selectedClientId = String(selectedClient?._id || "");
    const formClientId = String(newClient?._id || "");
    const expectedClientId = String(clientRouteId || selectedClientId || "");

    if (
      clientFormLoading ||
      !selectedClientId ||
      !formClientId ||
      selectedClientId !== expectedClientId ||
      formClientId !== expectedClientId
    ) {
      showMessage(
        "Client Still Loading",
        "Please wait until the selected client details are fully loaded before saving.",
        "warning"
      );
      return;
    }

    if (emailError) {
      showMessage("Invalid Email", "Please enter a valid email address.", "warning");
      return;
    }

    try {
      const nextIsDisconnectedPlan = isDisconnectedPlanValue(
        newClient.Profile,
        newClient.NetPlan
      );
      const normalizedMacAddress = String(newClient.MacAddress || "")
        .trim()
        .toUpperCase();
      const overdueDays = getClientOverdueDays(selectedClient);

      if (!isAdminUser && overdueDays > disconnectAfterDueDays) {
        showMessage(
          "Update Not Allowed",
          `You can't update this client because the due date is already more than ${disconnectAfterDueDays} days overdue. Need to pay first before updating the client.`,
          "warning"
        );
        return;
      }

      if (selectedAuthMode === "IPOE" && !nextIsDisconnectedPlan && !normalizedMacAddress) {
        showMessage(
          "MAC Address Required",
          "Please choose a MAC Address before saving an active IPOE client.",
          "warning"
        );
        return;
      }

        const payload = {
          ...newClient,
          _id: expectedClientId,
          ForcePppoeSecretUpdate: true,
          SubscriptionCover: newClient.SubscriptionCover || "UN-GROUPED",
          Email: emailValue || "N/A",
          EmailBillingEnabled: canEnableEmailBilling
            ? Boolean(newClient.EmailBillingEnabled)
            : false,
          Latitude: normalizeCoordinateInput(newClient.Latitude),
          Longitude: normalizeCoordinateInput(newClient.Longitude),
          DueDate: parseMMDDYYYYToISO(newClient.DueDate),
          AmountDue: Number(String(newClient.AmountDue || 0).replace(/,/g, "")),
          Status: nextIsDisconnectedPlan ? "DISCONNECTED" : "ACTIVE",
        MacAddress:
          selectedAuthMode === "IPOE" && nextIsDisconnectedPlan
            ? ""
            : normalizedMacAddress
      };
      delete payload.macAddress;
      delete payload.DateEntry;
      delete payload.DateInstalled;
      delete payload.InstallDate;
      delete payload.createdAt;

      await API.put(
        `/clients/${expectedClientId}`,
        payload
      );

      await loadClients();
      handleCloseModal();
      setEditMode(false);
      setNewClient(getDefaultNewClientForm());
    } catch (err) {
      console.error("UPDATE ERROR:", err.response?.data || err.message);
      showMessage(
        "Update Failed",
        err.response?.data?.error || "Failed to update client.",
        "error"
      );
    }
  };

  const handlePullOutClient = async () => {
    if (!selectedClient?._id) {
      showMessage("No Client Selected", "Please select a client first.", "warning");
      return;
    }

    if (!["IPOE", "PPPOE"].includes(selectedAuthMode)) {
      showMessage("Pull Out Not Available", "Pull OUT is available for IPOE and PPPOE clients only.", "warning");
      return;
    }

    try {
      const todayText = dayjs().format("MM/DD/YYYY");
      const existingNote = String(newClient.Note || "").trim();
      const pullOutBy =
        currentUser?.name ||
        currentUser?.username ||
        currentUser?.Name ||
        currentUser?.Username ||
        "billing";
      const pullOutNote = `Pull out ${todayText} by ${pullOutBy}`;
      const isPppoePullOut = selectedAuthMode === "PPPOE";

      const payload = {
        ...newClient,
        MacAddress: "",
        Profile: isPppoePullOut ? "dc-putol" : "disconnection",
        NetPlan: "disconnection",
        AmountDue: 0,
        Status: "DISCONNECTED",
        DueDate: parseMMDDYYYYToISO(newClient.DueDate),
        Note: existingNote ? `${existingNote}\n${pullOutNote}` : pullOutNote
      };

      await API.put(
        `/clients/${selectedClient._id}`,
        payload
      );

      await loadClients();
      handleCloseModal();
      setEditMode(false);
      setNewClient(getDefaultNewClientForm());
      showMessage("Client Pulled Out", "The client has been pulled out successfully.", "success");
    } catch (err) {
      console.error("PULL OUT ERROR:", err.response?.data || err.message);
      showMessage(
        "Pull Out Failed",
        err.response?.data?.error || "Failed to pull out client.",
        "error"
      );
    }
  };

  const handleRefreshPppoeMode = async () => {
    if (!selectedClient?._id) {
      showMessage("No Client Selected", "Please select a client first.", "warning");
      return;
    }

    const clientAuthMode = String(selectedClient.AuthenticationMode || "").trim().toUpperCase();
    if (clientAuthMode !== "PPPOE") {
      showMessage("Refresh Mode Not Available", "Refresh Mode is only available for PPPoE clients.", "warning");
      return;
    }

    setRefreshModeSaving(true);
    try {
      const { data } = await API.post(`/clients/${selectedClient._id}/refresh-mode`);
      showMessage(
        "Refresh Mode Complete",
        data?.message || "The active PPPoE connection was refreshed.",
        "success"
      );
      await loadClients();
    } catch (err) {
      console.error("REFRESH MODE ERROR:", err.response?.data || err.message);
      showMessage(
        "Refresh Mode Failed",
        err.response?.data?.error || "Failed to remove the active PPPoE connection.",
        "error"
      );
    } finally {
      setRefreshModeSaving(false);
    }
  };

  const resetForm = () => {
    setNewClient(getDefaultNewClientForm());
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      AmountPaid: "",
      PaymentDate: getTodayLocalDate(),
      ReferenceNumber: "",
      Invoice: "",
      Notes: "",
      AdditionalCharge: "",
      Discount: "",
      ContactNumber: "",
      SendSms: true,
      ReconnectRequired: false,
      ReconnectAuthMode: "",
      ReconnectPlan: "",
      ReconnectCharge: 0,
      ReconnectMacAddress: ""
    });
    revokeEntryReceiptUrls(paymentEntries);
    setPaymentEntries([createPaymentEntry()]);
    setReceiptPreview("");
    setReceiptPreviewOpen(false);
    setReceiptViewerSrc("");
    setOcrLoading(false);
    setOcrMessage("");
    setDragActive(false);
  };

  const handleCloseModal = (event, reason) => {
    if (reason === "backdropClick") return;

    if (isClientFormPage) {
      setEditMode(false);
      setSelectedClient(null);
      resetForm();
      navigateToClientList();
      return;
    }

    setOpenModal(false);
    setEditMode(false);
    resetForm();
  };

  const handleClosePaymentModal = (event, reason) => {
    if (reason === "backdropClick") return;
    if (paymentSaving && event) return;

    setOpenPaymentModal(false);
    setPaymentReceiptLoading(false);
    setPaymentSaving(false);
    setOpenPaymentEntriesModal(false);
    resetPaymentForm();
  };

  const handleCloseOverdueDialog = () => {
    setOverdueDialog({
      open: false,
      client: null
    });
  };

  const handleCloseForcedOverdueDialog = () => {
    setForcedOverdueDialog({
      open: false,
      client: null
    });
  };

  const handleContinueSameDueDate = () => {
    if (overdueDialog.client) {
      openPaymentModalForClient(overdueDialog.client, {
        reconnectRequired: true
      });
    }
    handleCloseOverdueDialog();
  };

  const handleUseNewDueDate = () => {
    if (!overdueDialog.client) {
      handleCloseOverdueDialog();
      return;
    }

    const today = dayjs();
    const updatedClient = {
      ...overdueDialog.client,
      DueDate: today.format("YYYY-MM-DD")
    };

    openPaymentModalForClient(updatedClient, {
      reconnectRequired: true
    });
    setPaymentForm((prev) => ({
      ...prev,
      ReconnectRequired: true,
      AdditionalCharge: "500",
      Notes: "500 for balance previous"
    }));
    handleCloseOverdueDialog();
  };

  const handleForcedOverdueContinue = () => {
    if (!forcedOverdueDialog.client) {
      handleCloseForcedOverdueDialog();
      return;
    }

    const today = dayjs();
    const updatedClient = {
      ...forcedOverdueDialog.client,
      DueDate: today.format("YYYY-MM-DD")
    };

    openPaymentModalForClient(updatedClient, {
      reconnectRequired: true
    });
    setPaymentForm((prev) => ({
      ...prev,
      ReconnectRequired: true,
      AdditionalCharge: "500",
      Notes: "500 for balance previous"
    }));
    handleCloseForcedOverdueDialog();
  };

  const selectedReconnectPlan = netPlans.find(
    (plan) => getPlanName(plan) === paymentForm.ReconnectPlan
  );
  const paymentSelectedAuthMode = getNormalizedAuthMode(
    paymentForm.ReconnectAuthMode || selectedClient?.AuthenticationMode
  );
  const paymentReconnectMacAddress = String(
    paymentForm.ReconnectMacAddress || selectedClient?.MacAddress || ""
  )
    .trim()
    .toUpperCase();
  const paymentReconnectPlanOptions = netPlans.filter((plan) => {
    const planName = getPlanName(plan).toUpperCase();
    const planType = getPlanType(plan);

    return (
      !planName.includes("DISCONNECTION") &&
      (!paymentSelectedAuthMode || planType === paymentSelectedAuthMode)
    );
  });
  const displayedPaymentDhcpLeaseOptions = [
    ...new Set(
      [paymentReconnectMacAddress, ...dhcpLeaseOptions]
        .filter(Boolean)
        .map((mac) => String(mac).trim().toUpperCase())
    )
  ];
  const paymentOverdueDays = getClientOverdueDays(selectedClient);
  const paymentRequiresReconnectFlow =
      isDisconnectedPlan(selectedClient) ||
      Boolean(paymentForm.ReconnectRequired) ||
      paymentOverdueDays > disconnectAfterDueDays;
  const rawPlanAmount = Number(selectedClient?.AmountDue ?? 0);
  const planAmount = paymentRequiresReconnectFlow
    ? getPlanPrice(selectedReconnectPlan)
    : rawPlanAmount;
  const additionalCharge = Number(paymentForm.AdditionalCharge || 0);
  const discount = Number(paymentForm.Discount || 0);
  const totalAmountToPay = Math.max(planAmount + additionalCharge - discount, 0);
  const normalizedPaymentEntries = paymentEntries
    .map((entry) => ({
      method: normalizePaymentLineMethod(entry?.method),
      amount: Number(entry?.amount || 0),
      reference: String(entry?.reference || "").trim(),
      receiptAmount: Number(entry?.receiptAmount || entry?.amount || 0),
      transferDate: String(entry?.transferDate || "").trim(),
      receiverLast4: String(entry?.receiverLast4 || "").trim(),
      receiptImageUrl: String(entry?.receiptImageUrl || "").trim(),
      receiptImageDataUrl: String(entry?.receiptImageDataUrl || "").trim()
    }))
    .filter((entry) => entry.method && entry.amount > 0);
  const totalPaymentReceived = normalizedPaymentEntries.reduce(
    (sum, entry) => sum + entry.amount,
    0
  );
  const cashPaymentAmount = normalizedPaymentEntries
    .filter((entry) => entry.method === "CASH")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gcashPaymentAmount = normalizedPaymentEntries
    .filter((entry) => entry.method === "GCASH")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const hasCashPaymentEntry = normalizedPaymentEntries.some((entry) => entry.method === "CASH");
  const uniquePaymentMethods = [...new Set(normalizedPaymentEntries.map((entry) => entry.method))];
  const nonCashReferences = normalizedPaymentEntries
    .filter((entry) => entry.method !== "CASH" && entry.reference)
    .map((entry) => entry.reference);
  const uniqueNonCashReferences = [...new Set(nonCashReferences)];
  const topLevelPaymentMethod =
    uniquePaymentMethods.length === 1
      ? uniquePaymentMethods[0]
      : normalizedPaymentEntries.length > 1
        ? uniquePaymentMethods.join("/")
        : "CASH";
  const topLevelPaymentReference =
    uniqueNonCashReferences.length === 1
      ? uniqueNonCashReferences[0]
      : "";
  const hasPaymentEntries = normalizedPaymentEntries.length > 0;

  const dueDateValue = selectedClient?.DueDate ? new Date(selectedClient.DueDate) : null;
  const subscriptionStartDate = dueDateValue;
  const subscriptionAnchorDay = resolveBillingAnchorDay(
    dueDateValue,
    selectedClient?.SubscriptionCover,
    paymentRequiresReconnectFlow
  );
  const subscriptionEndDate = dueDateValue
      ? (() => {
          const nextDueDate = addOneMonthToDate(dueDateValue, subscriptionAnchorDay);
          if (!nextDueDate) return null;

          const d = new Date(nextDueDate);
          d.setDate(d.getDate() - 1);
          return d;
        })()
      : null;

  const subscriptionCoveredText =
      subscriptionStartDate && subscriptionEndDate
        ? `Subscription covered from ${subscriptionStartDate.toLocaleDateString(
            "en-PH",
          {
            year: "numeric",
            month: "long",
            day: "numeric"
          }
        )} to ${subscriptionEndDate.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric"
          })}`
        : "";

  const calculatedNextDueDate = dueDateValue
    ? addOneMonthToDate(dueDateValue, subscriptionAnchorDay)
    : null;

  const nextDueDateDisplay = dueDateValue
    ? (() => {
        return calculatedNextDueDate
          ? new Date(calculatedNextDueDate).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric"
            })
          : "N/A";
      })()
    : "N/A";

  const projectedBalance =
    totalAmountToPay - totalPaymentReceived;
  const displayedPaymentPlan =
    getPlanSpeed(selectedReconnectPlan) ||
    (paymentRequiresReconnectFlow ? "" : selectedClient?.NetPlan) ||
    "N/A";

  const handleOpenPaymentEntriesModal = () => {
    setOpenPaymentEntriesModal(true);
  };

  const handleClosePaymentEntriesModal = () => {
    setOpenPaymentEntriesModal(false);
  };

  const handlePaymentEntryChange = (index, field, value) => {
    setPaymentEntries((prev) =>
      prev.map((entry, entryIndex) => {
        if (entryIndex !== index) {
          return entry;
        }

        if (field === "amount" && !/^\d*\.?\d*$/.test(value)) {
          return entry;
        }

        const nextEntry = {
          ...entry,
          [field]: value
        };

        if (field === "amount") {
          nextEntry.receiptAmount = value;
        }

        return nextEntry;
      })
    );
  };

  const handleAddPaymentEntry = () => {
    setPaymentEntries((prev) => [...prev, createPaymentEntry()]);
  };

  const handleRemovePaymentEntry = (index) => {
    setPaymentEntries((prev) => {
      const targetUrl = String(prev[index]?.receiptImageUrl || "").trim();
      if (targetUrl) {
        try {
          URL.revokeObjectURL(targetUrl);
        } catch (error) {
          console.warn("Failed to revoke payment entry receipt image:", error);
        }
      }

      if (prev.length === 1) {
        return [createPaymentEntry()];
      }

      return prev.filter((_, entryIndex) => entryIndex !== index);
    });
  };

  const handleReprintPaymentHistory = async (row) => {
    const latestReceiptConfig = await loadReceiptPrintConfig();
    const receiptPayload = createReceiptPayloadFromHistoryRow(
      row,
      latestReceiptConfig,
      selectedClient
    );

    if (!latestReceiptConfig?.EnablePrinting) {
      showMessage("Printing Disabled", "Receipt printing is disabled in Print Receipt settings.", "info");
      return;
    }

    if (latestReceiptConfig?.UseDirectPrint) {
      try {
        await tryAutoPrintToXprinter(receiptPayload);
        return;
      } catch (printError) {
        console.error("PAYMENT HISTORY REPRINT ERROR:", printError.message || printError);
        showMessage(
          "Direct Print Failed",
          printError.response?.data?.error ||
            printError.message ||
            "Please check QZ Tray, certificate, and printer name.",
          "warning"
        );
        return;
      }
    }

    const receiptWindow =
      typeof window !== "undefined"
        ? window.open("", "_blank", "width=420,height=900")
        : null;
    openPaymentReceiptPrint(receiptWindow, receiptPayload);
  };

  const handleOpenPaymentHistoryEReceipt = async (row) => {
    const latestReceiptConfig = await loadReceiptPrintConfig();
    const receiptPayload = createReceiptPayloadFromHistoryRow(
      row,
      latestReceiptConfig,
      selectedClient
    );
    const generatedReceiptImage = await createPaymentReceiptImage(receiptPayload);

    if (!generatedReceiptImage) {
      showMessage("eReceipt Failed", "Unable to generate the eReceipt image.", "error");
      return;
    }

    setReceiptViewerSrc(generatedReceiptImage);
    setReceiptPreviewOpen(true);
  };

  const handleSavePayment = async (options = {}) => {
    if (paymentSaving) {
      return;
    }

    const amountPaid = totalPaymentReceived;
    const reconnectPlan = netPlans.find(
      (plan) => getPlanName(plan) === paymentForm.ReconnectPlan
    );
    const paymentReceiptNumber = paymentForm.ReferenceNumber || "";
    const salesInvoiceNumber = paymentForm.Invoice || toSalesInvoiceNumber(paymentReceiptNumber);
    const paymentBreakdown = normalizedPaymentEntries.map((entry) => ({
        Method: entry.method,
        Amount: entry.amount,
        Reference: entry.method === "CASH" ? "" : entry.reference,
        ReceiptAmount: entry.method === "CASH" ? entry.amount : entry.receiptAmount || entry.amount,
        TransferDate: entry.method === "CASH" ? "" : String(entry.transferDate || "").trim(),
        ReceiverLast4: entry.method === "CASH" ? "" : String(entry.receiverLast4 || "").trim()
      }));
      const topLevelTransferDate =
        normalizedPaymentEntries.find(
          (entry) => entry.method !== "CASH" && String(entry.transferDate || "").trim()
        )?.transferDate || "";
      const topLevelReceiverLast4 =
        normalizedPaymentEntries.find(
          (entry) => entry.method !== "CASH" && String(entry.receiverLast4 || "").trim()
        )?.receiverLast4 || "";
    let createdEarningIds = [];
    let createdTransactionId = null;

    if (!selectedClient?._id) {
      showMessage("No Client Selected", "Please select a client first.", "warning");
      return;
    }
    const paymentClient = selectedClient;

    if (!paymentForm.Invoice.trim()) {
      showMessage("Missing Invoice", "Please enter invoice number.", "warning");
      return;
    }

    if (!hasPaymentEntries) {
      showMessage("Payment Required", "Please add at least one payment entry.", "warning");
      return;
    }

    if (!amountPaid || amountPaid <= 0) {
      showMessage("Invalid Amount", "Please enter a valid payment amount.", "warning");
      return;
    }

    const invalidNonCashEntry = normalizedPaymentEntries.find(
      (entry) => entry.method !== "CASH" && !entry.reference
    );

    if (invalidNonCashEntry) {
      showMessage("Payment Reference Required", `Please enter the reference for ${invalidNonCashEntry.method}.`, "warning");
      return;
    }

        if (paymentRequiresReconnectFlow && !paymentSelectedAuthMode) {
          showMessage("Reconnect Type Required", "Please select whether this client will reconnect as PPPOE or IPOE.", "warning");
          return;
        }

    if (paymentRequiresReconnectFlow && !reconnectPlan) {
      showMessage("Reconnect Plan Required", "Please select the new plan for this client before receiving payment.", "warning");
      return;
    }

    if (
      paymentRequiresReconnectFlow &&
      paymentSelectedAuthMode === "IPOE" &&
      !paymentReconnectMacAddress
    ) {
      showMessage(
        "MAC Address Required",
        "Please select the MAC Address to reconnect this IPOE client.",
        "warning"
      );
      return;
    }

    if (paymentRequiresReconnectFlow && !paymentForm.ReferenceNumber.trim()) {
      showMessage("Reference Required", "Please enter the payment reference number for this client.", "warning");
      return;
    }

    if (projectedBalance !== 0) {
      showMessage("Invalid Payment", "Ending balance must be exactly 0 before saving.", "warning");
      return;
    }

    const hasUploadedNonCashReceipt = normalizedPaymentEntries.some(
      (entry) => entry.method !== "CASH" && entry.receiptImageDataUrl
    );

    if (hasUploadedNonCashReceipt && !options?.confirmed) {
      setPaymentDetailsConfirm({
        open: true,
        title: "Confirm Payment Details",
        message: "",
        severity: "warning",
        onConfirm: () => handleSavePayment({ confirmed: true })
      });
      return;
    }

    setPaymentSaving(true);

    try {
      try {
        await API.post("/payments/validate-documents", {
          paymentReceipt: paymentReceiptNumber,
          salesInvoice: salesInvoiceNumber
        });
        } catch (documentError) {
          if (documentError.response?.status === 409) {
          showMessage(
            "Duplicate Payment Reference",
            documentError.response?.data?.error ||
              "Payment receipt or sales invoice already exists.",
            "error"
          );
          throw Object.assign(new Error("Payment document validation failed."), {
            paymentValidationHandled: true
          });
        }

        if (documentError.response?.status === 400) {
          showMessage(
            "Invalid Payment Reference",
            documentError.response?.data?.error ||
              "Payment receipt or sales invoice is required.",
            "warning"
          );
          throw Object.assign(new Error("Payment document validation failed."), {
            paymentValidationHandled: true
          });
        }

          throw documentError;
        }

        if (!options?.acceptUsedReference) {
        try {
          await API.post("/payments/validate-references", {
            entries: normalizedPaymentEntries
              .filter((entry) => entry.method !== "CASH")
              .map((entry) => ({
                method: entry.method,
                amount: entry.amount,
                reference: entry.reference,
                receiptAmount: entry.receiptAmount || entry.amount
              }))
          });
        } catch (validationError) {
          if (validationError.response?.status !== 409) {
            throw validationError;
          }

          const refs = Array.isArray(validationError.response?.data?.refs)
            ? validationError.response.data.refs
            : [];
          const exceededRef = refs.find((item) => item.exceeds);
          const usedByAccounts = exceededRef?.usedByAccounts?.length
            ? ` Already used by: ${exceededRef.usedByAccounts.join(", ")}.`
            : "";
          const duplicateMessage = `${validationError.response?.data?.error || "One or more non-cash references already exceed the allowed receipt amount."}${usedByAccounts}`;

          setPaymentDetailsConfirm({
            open: true,
            title: "Duplicate Reference Detected",
            message: `${duplicateMessage} Are you sure you want to accept this record even it's been used?`,
            severity: "warning",
            onConfirm: () =>
              handleSavePayment({
                confirmed: true,
                acceptUsedReference: true
              })
          });
          throw Object.assign(new Error("Payment reference validation failed."), {
            paymentValidationHandled: true
          });
        }
        }

      const balance = totalAmountToPay - amountPaid;
      const existingNote = paymentClient.Note ? `${paymentClient.Note}\n` : "";
      const paymentNote = paymentForm.Notes
        ? `${existingNote}Payment ${paymentForm.PaymentDate}: ${paymentForm.Notes}`
        : paymentClient.Note || "";
      const transactionDateTime = new Date();
        const billingAnchorDay =
          resolveBillingAnchorDay(
            paymentClient?.DueDate || paymentForm.PaymentDate,
            paymentClient?.SubscriptionCover || paymentForm.SubscriptionCover,
            paymentRequiresReconnectFlow
          ) ||
          null;
        const nextDueDateDate =
          calculatedNextDueDate ||
          addOneMonthToDate(paymentClient.DueDate, billingAnchorDay) ||
          addOneMonthToDate(paymentForm.PaymentDate, billingAnchorDay) ||
          transactionDateTime;
        const nextDueDateIso = nextDueDateDate.toISOString();
        const nextSubscriptionCover = String(
          billingAnchorDay || nextDueDateDate.getDate()
        );
        const createdByName =
          currentUser?.name || currentUser?.username || currentUser?.Name || "";
        const createdById = currentUser?.id || currentUser?._id || currentUser?.ID || null;

      const transactionMonthLabel = transactionDateTime.toLocaleString("en-US", {
        month: "long"
      });
      const transactionDayValue = String(transactionDateTime.getDate()).padStart(2, "0");
      const transactionYearValue = String(transactionDateTime.getFullYear());
      const reconnectPlanNetPlan =
        getPlanSpeed(reconnectPlan) ||
        (isDisconnectedPlanValue(paymentClient.PreviousNetPlan)
          ? ""
          : paymentClient.PreviousNetPlan) ||
        getPlanName(reconnectPlan) ||
        paymentClient.NetPlan ||
        "";
      const transactionNetPlan = reconnectPlan ? reconnectPlanNetPlan : paymentClient.NetPlan || "";

      const transactionPayload = {
        ClientId: paymentClient._id,
        AccountName: paymentClient.AccountName || "",
        AccountNumber: paymentClient.AccountNumber || "",
        ClientName: paymentClient.ClientName || "",
        Address: paymentClient.Address || "",
        ConnectionType: paymentClient.ConnectionType || "FIBER OPTIC",
        NetPlan: transactionNetPlan,
        ServerLocation: paymentClient.ServerLocation || "",
        Type: "Payment",
        PaymentMethod: topLevelPaymentMethod,
        MOP: topLevelPaymentMethod,
        MOPRef: topLevelPaymentReference,
        ReferenceNumber: topLevelPaymentReference,
          TransferDate: topLevelTransferDate,
          GCashTransferDate: topLevelTransferDate,
          ReceiverLast4: topLevelReceiverLast4,
        Verified: false,
        CashAmount: cashPaymentAmount,
        GCashAmount: gcashPaymentAmount,
        Invoice: salesInvoiceNumber,
        PaymentReceipt: paymentReceiptNumber,
        TransactionCode: paymentReceiptNumber,
        BillingReference: "",
        MaintenanceReference: "",
        AmountDue: totalAmountToPay,
        TotalAmount: amountPaid,
        Balance: balance,
        TSales: totalAmountToPay,
        VSales: 0,
        Vat: "0 %",
        AddCharge: String(paymentForm.AdditionalCharge || ""),
        Discount: String(paymentForm.Discount || ""),
        Promo: "",
        PromoPrice: 0,
        TransactionDate: transactionDateTime,
        DueDate: paymentClient.DueDate || null,
        NextDueDate: nextDueDateIso,
        PaymentDate: paymentForm.PaymentDate,
        DcDate: null,
        Cover: subscriptionCoveredText || paymentClient.SubscriptionCover || "",
        IsReconnectPayment: Boolean(reconnectPlan),
        ReconnectedAt: reconnectPlan ? transactionDateTime : null,
        ReconnectDueDate: reconnectPlan ? nextDueDateIso : null,
        CreatedBy: createdByName || createdById,
        CreatedById: createdById,
        createdAt: transactionDateTime,
        updatedAt: transactionDateTime
      };

      const transactionResponse = await API.post(
        "/transactions",
        transactionPayload
      );
      createdTransactionId = transactionResponse?.data?._id || null;

      const earningResponses = await Promise.all(
        normalizedPaymentEntries.map((entry) =>
          API.post("/earnings", {
            PrintId: createdTransactionId,
            AccountName: paymentClient.AccountName || "",
            AccountNumber: paymentClient.AccountNumber || "",
            ClientName: paymentClient.ClientName || "",
            Invoice: salesInvoiceNumber,
            PaymentReceipt: paymentReceiptNumber,
            Item: "ISP-Client Payment",
            MOP: entry.method,
            MOPRef: entry.method === "CASH" ? "" : entry.reference,
            Cash: entry.amount,
            CashAmount: entry.method === "CASH" ? entry.amount : 0,
            GCashAmount: entry.method === "GCASH" ? entry.amount : 0,
            ReceiptAmount:
              entry.method === "CASH"
                ? entry.amount
                : Number(entry.receiptAmount || entry.amount || 0),
            TransferDate: entry.method === "CASH" ? "" : String(entry.transferDate || "").trim(),
            GCashTransferDate:
              entry.method === "GCASH" ? String(entry.transferDate || "").trim() : "",
            ReceiverLast4: entry.method === "CASH" ? "" : String(entry.receiverLast4 || "").trim(),
            ReceiptImage: entry.method === "CASH" ? "" : String(entry.receiptImageDataUrl || "").trim(),
            DeclaredBy: createdByName || createdById,
            DeclaredById: createdById,
            TransactionDate: transactionDateTime,
            PaymentDate: paymentForm.PaymentDate,
            Month: transactionMonthLabel,
            Day: transactionDayValue,
            Year: transactionYearValue,
            Quantity: "1",
            Expenses: "0",
            SupplierPrice: "0",
            createdAt: transactionDateTime,
            updatedAt: transactionDateTime
          })
        )
      );
      createdEarningIds = earningResponses
        .map((response) => response?.data?._id)
        .filter(Boolean);
      const shouldOpenGeneratedReceiptAfterSave =
        normalizedPaymentEntries.length > 0 &&
        normalizedPaymentEntries.every((entry) => entry.method !== "CASH");

      await API.put(
        `/clients/${paymentClient._id}`,
        {
          ...paymentClient,
          ContactNumber: paymentForm.ContactNumber,
          AuthenticationMode: reconnectPlan
            ? paymentSelectedAuthMode || paymentClient.AuthenticationMode
            : paymentClient.AuthenticationMode,
          Profile: reconnectPlan
            ? paymentSelectedAuthMode === "PPPOE"
              ? paymentClient.PreviousProfile || getPlanName(reconnectPlan) || paymentClient.Profile
              : getPlanName(reconnectPlan) || paymentClient.Profile
            : paymentClient.Profile,
          NetPlan: reconnectPlan
            ? paymentClient.PreviousNetPlan || getPlanSpeed(reconnectPlan) || getPlanName(reconnectPlan) || paymentClient.NetPlan
            : paymentClient.NetPlan,
          AmountDue: reconnectPlan ? getPlanPrice(reconnectPlan) : paymentClient.AmountDue,
          Status: reconnectPlan ? "ACTIVE" : paymentClient.Status,
          MacAddress:
            reconnectPlan
              ? paymentSelectedAuthMode === "IPOE"
                ? paymentReconnectMacAddress
                : ""
              : paymentClient.MacAddress,
          PreviousAuthenticationMode: reconnectPlan ? "" : paymentClient.PreviousAuthenticationMode,
          PreviousProfile: reconnectPlan ? "" : paymentClient.PreviousProfile,
          PreviousNetPlan: reconnectPlan ? "" : paymentClient.PreviousNetPlan,
          PreviousMacAddress: reconnectPlan ? "" : paymentClient.PreviousMacAddress,
          AmountPaid: amountPaid,
          CashAmount: cashPaymentAmount,
          GCashAmount: gcashPaymentAmount,
          Balance: balance,
          PaymentDate: paymentForm.PaymentDate,
          PaymentMethod: topLevelPaymentMethod,
          ReferenceNumber: topLevelPaymentReference,
          PaymentStatus: balance <= 0 ? "PAID" : "PARTIAL",
          DueDate: nextDueDateIso,
          SubscriptionCover: nextSubscriptionCover,
          LastReconnectedAt: reconnectPlan ? transactionDateTime.toISOString() : paymentClient.LastReconnectedAt,
          LastReconnectDueDate: reconnectPlan ? nextDueDateIso : paymentClient.LastReconnectDueDate,
          Note: paymentNote
        }
      );

      await loadClients();
      const receiptPayload = {
        clientName: paymentClient.ClientName || "",
        accountName: paymentClient.AccountName || "",
        planAmount: reconnectPlan ? getPlanPrice(reconnectPlan) : paymentClient.AmountDue,
        contactNumber: paymentForm.ContactNumber || paymentClient.ContactNumber || "",
        paymentReceipt: paymentReceiptNumber,
        salesInvoice: salesInvoiceNumber,
        paymentDate: new Date(transactionDateTime).toLocaleString("en-PH"),
        paymentMethod: topLevelPaymentMethod,
        reference: topLevelPaymentReference,
        amountPaid,
        paymentBreakdown,
        subscriptionCover: subscriptionCoveredText || paymentClient.SubscriptionCover || "-",
        nextDueDate: nextDueDateIso,
        NextDueDate: nextDueDateIso,
        additionalCharge,
        discount,
        totalAmountToPay,
        createdBy: createdByName || createdById,
        notes: paymentForm.Notes || "",
        receiptConfig: receiptPrintConfig
      };
      handleClosePaymentModal();

      const latestReceiptConfig = await loadReceiptPrintConfig();
      receiptPayload.receiptConfig = latestReceiptConfig;

      if (shouldOpenGeneratedReceiptAfterSave) {
        const generatedReceiptImage = await createPaymentReceiptImage(receiptPayload);
        if (generatedReceiptImage) {
          setReceiptViewerSrc(generatedReceiptImage);
          setReceiptPreviewOpen(true);
        }
      }

      if (paymentForm.SendSms !== false) {
        try {
          const { data: smsResult } = await API.post("/sms/send-payment-received", {
            client: {
              ClientName: paymentClient.ClientName || "",
              AccountName: paymentClient.AccountName || "",
              AccountNumber: paymentClient.AccountNumber || "",
              ContactNumber: paymentForm.ContactNumber || paymentClient.ContactNumber || ""
            },
            amountPaid,
            monthlyDue: reconnectPlan ? getPlanPrice(reconnectPlan) : paymentClient.AmountDue,
            subscriptionCover: subscriptionCoveredText || paymentClient.SubscriptionCover || "",
            nextDueDate: nextDueDateIso
          });

          if (!smsResult?.sent) {
            showMessage(
              "Payment Saved, SMS Skipped",
              smsResult?.reason || smsResult?.response || "Payment was saved but the SMS was not sent.",
              "warning"
            );
          }
        } catch (smsErr) {
          console.error("PAYMENT SMS ERROR:", smsErr.response?.data || smsErr.message);
          showMessage(
            "Payment Saved, SMS Failed",
            smsErr.response?.data?.error || "Payment was saved but the SMS request failed.",
            "warning"
          );
        }
      }

      if (latestReceiptConfig?.EnablePrinting && hasCashPaymentEntry) {
        try {
          if (latestReceiptConfig?.UseDirectPrint) {
            try {
              await tryAutoPrintToXprinter(receiptPayload);
            } catch (printError) {
              console.error("XPRINTER AUTO PRINT ERROR:", printError.message || printError);
              showMessage(
                "Payment Saved, Direct Print Failed",
                printError.response?.data?.error ||
                  printError.message ||
                  "Please check QZ Tray, certificate, and printer name.",
                "warning"
              );
            }
          } else {
            const receiptWindow =
              typeof window !== "undefined"
                ? window.open("", "_blank", "width=420,height=900")
                : null;
            openPaymentReceiptPrint(receiptWindow, receiptPayload);
          }
        } catch (printErr) {
          console.error("PAYMENT PRINT ERROR:", printErr.message || printErr);
          showMessage(
            "Payment Saved, Print Failed",
            "Payment was saved but the receipt print failed.",
            "warning"
          );
        }
      }
    } catch (err) {
      if (err?.paymentValidationHandled) {
        return;
      }

      console.error("PAYMENT ERROR:", err.response?.data || err.message);

      if (createdEarningIds.length || createdTransactionId) {
        try {
          await API.post("/payments/rollback", {
            earningIds: createdEarningIds,
            transactionId: createdTransactionId,
            AccountName: selectedClient?.AccountName || ""
          });
        } catch (rollbackErr) {
          console.error(
            "PAYMENT ROLLBACK ERROR:",
            rollbackErr.response?.data || rollbackErr.message
          );
        }
      }

      const serverMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to save payment.";

      showMessage("Payment Failed", serverMessage, "error");
    } finally {
      setPaymentSaving(false);
    }
  };

  const renderClientFormFields = () => (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", xl: "1.18fr 0.82fr" },
        gap: 1.5
      }}
    >
      <Paper elevation={0} sx={formSectionSx}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1, color: "#0f172a" }}>
          Basic Information
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.25 }}>
          <TextField
            label="Client Name"
            name="ClientName"
            fullWidth
            value={newClient.ClientName || ""}
            onChange={handleChange}
          />

          <TextField
            label="Account Name"
            name="AccountName"
            fullWidth
            value={newClient.AccountName || ""}
            onChange={handleChange}
          />

          {editMode ? (
            <TextField
              label="Installation Date"
              fullWidth
              value={formatClientInstallDateDisplay(newClient)}
              InputProps={{ readOnly: true }}
            />
          ) : null}
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 1, mt: 1.25 }}>
          <TextField
            label="Password"
            name="Password"
            fullWidth
            value={newClient.Password || ""}
            onChange={handleChange}
          />

          <Button
            variant="outlined"
            onClick={generatePassword}
            disabled={selectedAuthMode === "IPOE"}
            sx={{ px: 2, borderRadius: 2, textTransform: "none", fontWeight: 700 }}
          >
            Generate
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={formSectionSx}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1, color: "#0f172a" }}>
          Network Setup
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1fr 1fr 1fr" }, gap: 1.25 }}>
          <TextField
            select
            label="Authentication"
            name="AuthenticationMode"
            fullWidth
            value={newClient.AuthenticationMode || ""}
            onChange={handleChange}
          >
            <MenuItem value="PPPOE">PPPOE</MenuItem>
            <MenuItem value="IPOE">IPOE</MenuItem>
          </TextField>

          <TextField
            select
            label="MAC Address"
            name="MacAddress"
            fullWidth
            value={newClient.MacAddress || ""}
            onChange={handleChange}
            disabled={selectedAuthMode === "PPPOE"}
            helperText={
              selectedAuthMode === "IPOE"
                ? loadingDhcpLeases
                  ? "Loading DHCP leases from MikroTik..."
                  : "Showing DHCP leases with no comment"
                : "Enable IPOE to select a MAC address"
            }
          >
            {displayedDhcpLeaseOptions.map((mac) => (
              <MenuItem key={mac} value={mac}>
                {mac}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Profile"
            name="Profile"
            fullWidth
            value={newClient.Profile || ""}
            onChange={handleChange}
            helperText={
              selectedAuthMode
                ? `Showing ${selectedAuthMode} plans only`
                : "Select authentication first"
            }
          >
            {filteredNetPlans.map((plan) => (
              <MenuItem key={plan._id} value={getPlanName(plan)}>
                {getPlanName(plan)}
              </MenuItem>
            ))}
          </TextField>
        </Box>

      </Paper>

      <Paper elevation={0} sx={formSectionSx}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1, color: "#0f172a" }}>
          Contact Details
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "2.4fr 0.8fr" },
            gap: 1.25
          }}
        >
          <TextField
            label="Address"
            name="Address"
            fullWidth
            value={newClient.Address || ""}
            onChange={handleChange}
          />

          <TextField
            label="Contact Number"
            name="ContactNumber"
            fullWidth
            value={newClient.ContactNumber || ""}
            onChange={handleChange}
            inputProps={{ inputMode: "numeric", maxLength: 11 }}
            sx={{ maxWidth: { xs: "100%", md: 190 } }}
          />

          <TextField
            label="Latitude"
            name="Latitude"
            value={newClient.Latitude || ""}
            onChange={handleChange}
            placeholder="Example: 7.0731"
            helperText="Optional map latitude"
          />

          <TextField
            label="Longitude"
            name="Longitude"
            value={newClient.Longitude || ""}
            onChange={handleChange}
            placeholder="Example: 125.6128"
            helperText="Optional map longitude"
          />

          {clientMapEmbedUrl ? (
            <Box
              sx={{
                gridColumn: { xs: "1 / span 1", md: "1 / span 2" },
                border: "1px solid #dbe4ee",
                borderRadius: 2.5,
                overflow: "hidden",
                backgroundColor: "#fff"
              }}
            >
              <Box
                sx={{
                  px: 1.5,
                  py: 1.25,
                  display: "flex",
                  alignItems: { xs: "flex-start", md: "center" },
                  justifyContent: "space-between",
                  gap: 1.5,
                  flexDirection: { xs: "column", md: "row" },
                  borderBottom: "1px solid #e2e8f0"
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                    Client Map
                  </Typography>
                  <Typography sx={{ fontSize: "0.82rem", color: "#64748b" }}>
                    Preview based on the saved coordinates.
                  </Typography>
                </Box>
                <Button
                  component="a"
                  href={clientMapOpenUrl}
                  target="_blank"
                  rel="noreferrer"
                  size="small"
                  variant="outlined"
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Open in Google Maps
                </Button>
              </Box>

              <Box sx={{ height: 240, backgroundColor: "#f8fafc" }}>
                <Box
                  component="iframe"
                  title="Client location map"
                  src={clientMapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  sx={{
                    width: "100%",
                    height: "100%",
                    border: 0
                  }}
                />
              </Box>

              <Box
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderTop: "1px solid #e2e8f0"
                }}
              >
                <Typography sx={{ fontSize: "0.82rem", color: "#64748b" }}>
                  Map preview updates only from the saved coordinates.
                </Typography>
              </Box>
            </Box>
          ) : null}

          <TextField
            label="Email Address"
            name="Email"
            type="email"
            fullWidth
            value={newClient.Email || ""}
            onChange={handleChange}
            error={emailError}
            helperText={emailError ? "Enter a valid email address" : " "}
            sx={{ gridColumn: { xs: "1 / span 1", md: "1 / span 2" } }}
          />

          <Box
            sx={{
              gridColumn: { xs: "1 / span 1", md: "1 / span 2" },
              px: 1.5,
              py: 1.25,
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
                Email Billing
              </Typography>
              <Typography sx={{ fontSize: "0.85rem", color: "#64748b" }}>
                Turn this on only if the client want to receive the email.
              </Typography>
            </Box>
            <Switch
              name="EmailBillingEnabled"
              checked={Boolean(newClient.EmailBillingEnabled)}
              onChange={handleChange}
              disabled={!canEnableEmailBilling}
            />
          </Box>
        </Box>
      </Paper>

      <Paper elevation={0} sx={formSectionSx}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1, color: "#0f172a" }}>
          Plan Details
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr" },
            gap: 1.25
          }}
        >
          <TextField
            label="Net Plan"
            value={newClient.NetPlan || ""}
            fullWidth
            InputProps={{ readOnly: true }}
          />

          <TextField
            label="Amount Due"
            value={newClient.AmountDue ?? ""}
            fullWidth
            InputProps={{ readOnly: true }}
          />

          <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Due Date"
              disabled={!isAdminUser}
              value={
                newClient.DueDate
                  ? dayjs(parseMMDDYYYYToISO(newClient.DueDate))
                  : null
              }
              onChange={(value) => {
                if (!value) {
                  setNewClient((prev) => ({
                    ...prev,
                    DueDate: "",
                    SubscriptionCover: ""
                  }));
                  return;
                }

                const formatted = value.format("MM/DD/YYYY");

                setNewClient((prev) => ({
                  ...prev,
                  DueDate: formatted,
                  SubscriptionCover: String(value.date())
                }));
              }}
              slotProps={{
                textField: {
                  fullWidth: true
                }
              }}
            />
          </LocalizationProvider>

          <TextField
            label="Subscription Cover"
            name="SubscriptionCover"
            fullWidth
            value={newClient.SubscriptionCover || ""}
            InputProps={{ readOnly: true }}
          />
        </Box>

        <Box sx={{ mt: 1.25 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1, color: "#0f172a" }}>
            Notes
          </Typography>
          <TextField
            label="Notes"
            name="Note"
            fullWidth
            multiline
            rows={4}
            value={newClient.Note || ""}
            onChange={handleChange}
          />
        </Box>
      </Paper>
    </Box>
  );

  const renderClientFormActions = () => (
    <Box
      sx={{
        px: 2.25,
        py: 1.5,
        backgroundColor: "#f6f9fc",
        borderTop: "1px solid #dbe4ee",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 1.25,
        flexWrap: "wrap"
      }}
    >
      <Button
        onClick={handleCloseModal}
        sx={{ textTransform: "none", fontWeight: 700 }}
      >
        Cancel
      </Button>
      {editMode && ["IPOE", "PPPOE"].includes(selectedAuthMode) ? (
        <Button
          variant="outlined"
          color="warning"
          onClick={() => openClientActionConfirm("pullout")}
          sx={{
            px: 2.5,
            py: 0.8,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 700
          }}
        >
          Pull OUT
        </Button>
      ) : null}
      <Button
        variant="contained"
        onClick={editMode ? handleUpdateClient : handleAddClient}
        disabled={editMode && clientFormLoading}
        sx={{
          px: 3.25,
          py: 0.85,
          borderRadius: 2,
          textTransform: "none",
          fontWeight: 700,
          boxShadow: "0 10px 22px rgba(37, 99, 235, 0.18)"
        }}
      >
        {editMode && clientFormLoading ? "Loading Client..." : "Save Client"}
      </Button>
    </Box>
  );

  if (isClientFormPage) {
    return (
      <Box
        sx={{
          p: 3,
          background: "linear-gradient(180deg, #f8fafc 0%, #eef3f8 100%)",
          minHeight: "100%"
        }}
      >
        <PageHeader
          title={editMode ? "Update Client" : "Add New Client"}
          subtitle={
            editMode
              ? "Edit and save the selected client from one dedicated page."
              : "Create and save a new client from one dedicated page."
          }
        />

        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            overflow: "hidden",
            background: "#f6f9fc",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)"
          }}
        >
          <Box
            sx={{
              background: "linear-gradient(90deg, #0f4c81, #2563eb)",
              color: "#fff",
              px: 3,
              py: 1.6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PersonAddIcon />
              <Typography sx={{ fontSize: "1rem", fontWeight: 700 }}>
                {editMode ? "Update Client" : "Add New Client"}
              </Typography>
            </Box>

            <IconButton onClick={handleCloseModal} sx={{ color: "#fff" }}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ p: 2.25, backgroundColor: "#f6f9fc" }}>
            {renderClientFormFields()}
          </Box>

          {renderClientFormActions()}
        </Paper>
        {renderClientActionConfirmDialog()}
        {renderPaymentDetailsConfirmDialog()}
        {renderMessageDialog()}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        background: "linear-gradient(180deg, #f8fafc 0%, #eef3f8 100%)",
        minHeight: "100%"
      }}
    >
      <PageHeader
        title="Clients Dashboard"
        subtitle="View, update, and manage active and disconnected client accounts."
      />

      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          borderRadius: 3,
          border: "1px solid #dbe4ee",
          backgroundColor: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(6px)"
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="stretch">
          <TextField
            label="Search"
            fullWidth
            value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
                backgroundColor: "#fff"
              }
            }}
          />

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Due Date"
              value={dueDateFilter}
              onChange={(value) => {
                setDueDateFilter(value);
                setPage(0);
              }}
              slotProps={{
                textField: {
                  sx: {
                    minWidth: { xs: "100%", md: 220 },
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      backgroundColor: "#fff"
                    }
                  }
                }
              }}
            />
          </LocalizationProvider>

          {dueDateFilter ? (
            <Button
              variant="outlined"
              onClick={() => {
                setDueDateFilter(null);
                setPage(0);
              }}
              sx={{
                minWidth: { xs: "100%", md: 92 },
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700
              }}
            >
              Clear
            </Button>
          ) : null}
        </Stack>
      </Paper>

      <Box
        sx={{
          mb: 2.5,
          borderBottom: "1px solid",
          borderColor: "#d7e0ea",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5
        }}
      >
        <Tabs
          value={statusFilter}
            onChange={(_, value) => {
              setStatusFilter(value);
              setPage(0);
            }}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            minHeight: 44,
            "& .MuiTabs-indicator": {
              height: 3,
              borderRadius: "999px"
            },
            "& .MuiTab-root": {
              minHeight: 44,
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
              alignItems: "flex-start",
              color: "#64748b"
            },
            "& .Mui-selected": {
              color: "#0f172a"
            }
          }}
        >
          <Tab value="ACTIVE" label={showClientTabCounts ? `Active (${activeCount})` : "Active"} />
          <Tab
            value="DISCONNECTED"
            label={showClientTabCounts ? `Disconnected (${disconnectedCount})` : "Disconnected"}
          />
        </Tabs>

        <Tooltip title="Add Client">
          <IconButton
            color="primary"
            onClick={() => navigate("/clients/new")}
            sx={{
              mb: 0.5,
              borderRadius: 2.5,
              border: "1px solid #bfdbfe",
              backgroundColor: "#eff6ff",
              boxShadow: "0 10px 22px rgba(37, 99, 235, 0.12)",
              "&:hover": {
                backgroundColor: "#dbeafe"
              }
            }}
          >
            <PersonAddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {loading && <p>Loading...</p>}

      <Box
        sx={{
          display: { xs: "grid", md: "none" },
          gap: 1.25
        }}
      >
        {clients.map((c) => {
          const displayedPaymentStatus = getDisplayedPaymentStatus(c);
          const isPaid = displayedPaymentStatus === "PAID";
          const disconnectDaysDisplay = getDisconnectDaysDisplay(c, displayedPaymentStatus);
          const authMode = getNormalizedAuthMode(c.AuthenticationMode) || "N/A";
          const dueDateText = c.DueDate
            ? new Date(c.DueDate).toLocaleDateString("en-PH", {
                year: "numeric",
                month: "short",
                day: "numeric"
              })
            : "N/A";

          return (
            <Paper
              key={c._id}
              onContextMenu={(e) => handleRightClick(e, c)}
              sx={{
                p: 1.5,
                borderRadius: 3,
                border: "1px solid #dbe4ee",
                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
                backgroundColor: isPaid ? "#ffffff" : "#fcfdff"
              }}
            >
              <Stack spacing={1.1}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, color: "#0f172a", fontSize: "0.9rem", wordBreak: "break-word" }}>
                      {c.ClientName || "-"}
                    </Typography>
                    <Typography sx={{ color: "#64748b", fontSize: "0.72rem", wordBreak: "break-word" }}>
                      {c.AccountName || "-"}
                    </Typography>
                  </Box>
                  <Chip
                    label={displayedPaymentStatus}
                    size="small"
                    sx={{
                      flexShrink: 0,
                      borderRadius: "999px",
                      backgroundColor: isPaid ? "#e8f5e9" : "#f1f5f9",
                      color: isPaid ? "#2e7d32" : "#475569",
                      fontWeight: 800
                    }}
                  />
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 0.75
                  }}
                >
                  <Box>
                    <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>PLAN</Typography>
                    <Typography sx={{ color: "#334155", fontWeight: 800, fontSize: "0.74rem" }}>
                      {c.NetPlan || "-"} - {authMode}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>DUE DATE</Typography>
                    <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "0.74rem" }}>
                      {dueDateText}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>AMOUNT</Typography>
                    <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "0.74rem" }}>
                      PHP {c.AmountDue}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>DISCONNECT</Typography>
                    <Chip
                      label={disconnectDaysDisplay.label}
                      size="small"
                      sx={{
                        borderRadius: "999px",
                        backgroundColor: disconnectDaysDisplay.backgroundColor,
                        color: disconnectDaysDisplay.color,
                        fontWeight: 800
                      }}
                    />
                  </Box>
                </Box>

                <Stack direction="row" spacing={0.25} flexWrap="wrap" useFlexGap>
                  <Tooltip title="Update">
                    <IconButton sx={{ color: "#2563eb" }} onClick={() => navigate(`/clients/${c._id}/edit`)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Billing">
                    <IconButton sx={{ color: "#0891b2" }} onClick={() => handleOpenBillingPeriodDialog(c)}>
                      <ReceiptIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Pay">
                    <IconButton sx={{ color: "#16a34a" }} onClick={() => handleOpenPaymentModal(c)}>
                      <PaymentIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Payment History">
                    <IconButton sx={{ color: "#7c3aed" }} onClick={() => handleOpenPaymentHistoryModal(c)}>
                      <HistoryEduOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="SMS">
                    <IconButton sx={{ color: "#0f766e" }} onClick={() => handleOpenSmsConfirmDialog(c)}>
                      <SmsOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Repair">
                    <IconButton sx={{ color: "#ea580c" }} onClick={() => handleOpenRepairDialog(c)}>
                      <BuildCircleOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip
                    title={
                      String(c.AuthenticationMode || "").trim().toUpperCase() === "PPPOE"
                        ? "Refresh Mode"
                        : "Refresh Mode is only available for PPPoE"
                    }
                  >
                    <span>
                      <IconButton
                        sx={{ color: "#0284c7" }}
                        onClick={() => openClientActionConfirm("refresh", c)}
                        disabled={
                          refreshModeSaving ||
                          String(c.AuthenticationMode || "").trim().toUpperCase() !== "PPPOE"
                        }
                      >
                        <AutorenewIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Router">
                    <IconButton sx={{ color: "#4f46e5" }} onClick={() => handleOpenMikrotikStatusModal(c)}>
                      <RouterIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Paper>
          );
        })}
      </Box>

        <TableContainer
          component={Paper}
          sx={{
            display: { xs: "none", md: "block" },
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid #dbe4ee",
            boxShadow: "0 14px 36px rgba(15, 23, 42, 0.08)"
          }}
        >
          <Table>
            <TableHead>
            <TableRow
                sx={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  background: "linear-gradient(180deg, #ffffff 0%, #f3f6fa 100%)",
                  borderBottom: "1px solid #dbe4ee"
                }}
              >
                {[
                "Name",
                "Account Name",
                "Plan",
                "Due Date",
                "Amount",
                "Payment Status",
                "Disconnect Days",
                "Actions"
              ].map((head) => (
                <TableCell
                  key={head}
                  sx={{
                    fontWeight: 700,
                    color: "#334155",
                    py: 1.75,
                    borderRight: "1px solid #e8eef5"
                  }}
                >
                  {head}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {clients.map((c) => {
              const displayedPaymentStatus = getDisplayedPaymentStatus(c);
              const isPaid = displayedPaymentStatus === "PAID";
              const disconnectDaysDisplay = getDisconnectDaysDisplay(c, displayedPaymentStatus);

              return (
                <TableRow
                  key={c._id}
                  onContextMenu={(e) => handleRightClick(e, c)}
                  sx={{
                    backgroundColor: isPaid ? "#ffffff" : "#fcfdff",
                    transition: "all 0.2s ease",
                    "& td": {
                      py: 2.25,
                      borderBottom: "1px solid #edf2f7"
                    },
                    "&:hover": {
                      backgroundColor: "#f4f8fc"
                    }
                  }}
                >
                  <TableCell>{c.ClientName}</TableCell>
                  <TableCell>{c.AccountName}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>
                      {c.NetPlan || "-"}{" "}
                      <Box component="span" sx={{ color: "#6d28d9", fontWeight: 700 }}>
                        - {getNormalizedAuthMode(c.AuthenticationMode) || "N/A"}
                      </Box>
                    </Typography>
                  </TableCell>

                  <TableCell>
                    {c.DueDate
                      ? new Date(c.DueDate).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })
                      : "N/A"}
                  </TableCell>

                  <TableCell sx={{ fontWeight: "bold" }}>
                    ₱{c.AmountDue}
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={displayedPaymentStatus}
                      size="small"
                      sx={{
                        borderRadius: "999px",
                        backgroundColor: isPaid ? "#e8f5e9" : "#f1f5f9",
                        color: isPaid ? "#2e7d32" : "#475569",
                        fontWeight: 700,
                        px: 0.5
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={disconnectDaysDisplay.label}
                      size="small"
                      sx={{
                        borderRadius: "999px",
                        backgroundColor: disconnectDaysDisplay.backgroundColor,
                        color: disconnectDaysDisplay.color,
                        fontWeight: 700,
                        px: 0.5
                      }}
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Tooltip title="Update">
                      <IconButton
                        sx={{ color: "#2563eb", "&:hover": { backgroundColor: "#eff6ff", color: "#1d4ed8" } }}
                        onClick={() => navigate(`/clients/${c._id}/edit`)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Billing">
                      <IconButton
                        sx={{ color: "#0891b2", "&:hover": { backgroundColor: "#ecfeff", color: "#0e7490" } }}
                        onClick={() => handleOpenBillingPeriodDialog(c)}
                      >
                        <ReceiptIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Pay">
                      <IconButton
                        sx={{ color: "#16a34a", "&:hover": { backgroundColor: "#f0fdf4", color: "#15803d" } }}
                        onClick={() => handleOpenPaymentModal(c)}
                      >
                        <PaymentIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Payment History">
                      <IconButton
                        sx={{ color: "#7c3aed", "&:hover": { backgroundColor: "#f5f3ff", color: "#6d28d9" } }}
                        onClick={() => handleOpenPaymentHistoryModal(c)}
                      >
                        <HistoryEduOutlinedIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="SMS">
                      <IconButton
                        sx={{ color: "#0f766e", "&:hover": { backgroundColor: "#f0fdfa", color: "#0f766e" } }}
                        onClick={() => handleOpenSmsConfirmDialog(c)}
                      >
                        <SmsOutlinedIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Repair">
                      <IconButton
                        sx={{ color: "#ea580c", "&:hover": { backgroundColor: "#fff7ed", color: "#c2410c" } }}
                        onClick={() => handleOpenRepairDialog(c)}
                      >
                        <BuildCircleOutlinedIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip
                      title={
                        String(c.AuthenticationMode || "").trim().toUpperCase() === "PPPOE"
                          ? "Refresh Mode"
                          : "Refresh Mode is only available for PPPoE"
                      }
                    >
                      <span>
                        <IconButton
                          sx={{ color: "#0284c7", "&:hover": { backgroundColor: "#f0f9ff", color: "#0369a1" } }}
                          onClick={() => openClientActionConfirm("refresh", c)}
                          disabled={
                            refreshModeSaving ||
                            String(c.AuthenticationMode || "").trim().toUpperCase() !== "PPPOE"
                          }
                        >
                          <AutorenewIcon />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Router">
                      <IconButton
                        sx={{ color: "#4f46e5", "&:hover": { backgroundColor: "#eef2ff", color: "#4338ca" } }}
                        onClick={() => handleOpenMikrotikStatusModal(c)}
                      >
                        <RouterIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
          count={Number(clientMeta?.total || 0)}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
      />

      <Menu
        open={menu !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          menu !== null
            ? { top: menu.mouseY, left: menu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleUpdate}>Update</MenuItem>
        <MenuItem onClick={handleBilling}>Billing</MenuItem>
        <MenuItem onClick={handleReceipt}>Receipt</MenuItem>
      </Menu>

      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        fullWidth
        maxWidth={false}
        PaperProps={{
          sx: {
            width: "94vw",
            maxWidth: "1380px",
            borderRadius: 4,
            overflow: "hidden",
            background: "#f6f9fc",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)"
          }
        }}
      >
        <Box
          sx={{
            background: "linear-gradient(90deg, #0f4c81, #2563eb)",
            color: "#fff",
            px: 3,
            py: 1.6,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PersonAddIcon />
            <Typography sx={{ fontSize: "1rem", fontWeight: 700 }}>
              {editMode ? "Update Client" : "Add New Client"}
            </Typography>
          </Box>

          <IconButton onClick={handleCloseModal} sx={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 2.25, backgroundColor: "#f6f9fc" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", xl: "1.18fr 0.82fr" },
              gap: 1.5
            }}
          >
            <Paper elevation={0} sx={formSectionSx}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1, color: "#0f172a" }}>
                Basic Information
              </Typography>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.25 }}>
                <TextField
                  label="Client Name"
                  name="ClientName"
                  fullWidth
                  value={newClient.ClientName || ""}
                  onChange={handleChange}
                />

                <TextField
                  label="Account Name"
                  name="AccountName"
                  fullWidth
                  value={newClient.AccountName || ""}
                  onChange={handleChange}
                />

                {editMode ? (
                  <TextField
                    label="Installation Date"
                    fullWidth
                    value={formatClientInstallDateDisplay(newClient)}
                    InputProps={{ readOnly: true }}
                  />
                ) : null}
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 1, mt: 1.25 }}>
                <TextField
                  label="Password"
                  name="Password"
                  fullWidth
                  value={newClient.Password || ""}
                  onChange={handleChange}
                />

                <Button
                  variant="outlined"
                  onClick={generatePassword}
                  disabled={selectedAuthMode === "IPOE"}
                  sx={{ px: 2, borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                >
                  Generate
                </Button>
              </Box>
            </Paper>

            <Paper elevation={0} sx={formSectionSx}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1, color: "#0f172a" }}>
                Network Setup
              </Typography>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1fr 1fr 1fr" }, gap: 1.25 }}>
                  <TextField
                    select
                    label="Authentication"
                    name="AuthenticationMode"
                    fullWidth
                  value={newClient.AuthenticationMode || ""}
                  onChange={handleChange}
                >
                    <MenuItem value="PPPOE">PPPOE</MenuItem>
                    <MenuItem value="IPOE">IPOE</MenuItem>
                  </TextField>

                  <TextField
                    select
                    label="MAC Address"
                    name="MacAddress"
                    fullWidth
                    value={newClient.MacAddress || ""}
                    onChange={handleChange}
                    disabled={selectedAuthMode === "PPPOE"}
                    helperText={
                      selectedAuthMode === "IPOE"
                        ? loadingDhcpLeases
                          ? "Loading DHCP leases from MikroTik..."
                          : "Showing DHCP leases with no comment"
                        : "Enable IPOE to select a MAC address"
                    }
                  >
                    {displayedDhcpLeaseOptions.map((mac) => (
                      <MenuItem key={mac} value={mac}>
                        {mac}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    label="Profile"
                    name="Profile"
                    fullWidth
                    value={newClient.Profile || ""}
                    onChange={handleChange}
                    helperText={
                      selectedAuthMode
                        ? `Showing ${selectedAuthMode} plans only`
                        : "Select authentication first"
                    }
                  >
                    {filteredNetPlans.map((plan) => (
                      <MenuItem key={plan._id} value={getPlanName(plan)}>
                        {getPlanName(plan)}
                      </MenuItem>
                    ))}
                </TextField>
              </Box>

            </Paper>

            <Paper elevation={0} sx={formSectionSx}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1, color: "#0f172a" }}>
                Contact Details
              </Typography>

              <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "2.4fr 0.8fr" },
                    gap: 1.25
                  }}
                >
                <TextField
                  label="Address"
                  name="Address"
                  fullWidth
                  value={newClient.Address || ""}
                  onChange={handleChange}
                />

                <TextField
                  label="Contact Number"
                  name="ContactNumber"
                  fullWidth
                  value={newClient.ContactNumber || ""}
                  onChange={handleChange}
                  inputProps={{ inputMode: "numeric", maxLength: 11 }}
                  sx={{ maxWidth: { xs: "100%", md: 190 } }}
                />

                <TextField
                  label="Latitude"
                  name="Latitude"
                  value={newClient.Latitude || ""}
                  onChange={handleChange}
                  placeholder="Example: 7.0731"
                  helperText="Optional map latitude"
                />

                <TextField
                  label="Longitude"
                  name="Longitude"
                  value={newClient.Longitude || ""}
                  onChange={handleChange}
                  placeholder="Example: 125.6128"
                  helperText="Optional map longitude"
                />

                {clientMapEmbedUrl ? (
                  <Box
                    sx={{
                      gridColumn: { xs: "1 / span 1", md: "1 / span 2" },
                      border: "1px solid #dbe4ee",
                      borderRadius: 2.5,
                      overflow: "hidden",
                      backgroundColor: "#fff"
                    }}
                  >
                    <Box
                      sx={{
                        px: 1.5,
                        py: 1.25,
                        display: "flex",
                        alignItems: { xs: "flex-start", md: "center" },
                        justifyContent: "space-between",
                        gap: 1.5,
                        flexDirection: { xs: "column", md: "row" },
                        borderBottom: "1px solid #e2e8f0"
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                          Client Map
                        </Typography>
                        <Typography sx={{ fontSize: "0.82rem", color: "#64748b" }}>
                          Preview based on the saved client address.
                        </Typography>
                      </Box>
                      <Button
                        component="a"
                        href={clientMapOpenUrl}
                        target="_blank"
                        rel="noreferrer"
                        size="small"
                        variant="outlined"
                        sx={{ textTransform: "none", fontWeight: 700 }}
                      >
                        Open in Google Maps
                      </Button>
                    </Box>

                    <Box sx={{ height: 240, backgroundColor: "#f8fafc" }}>
                      <Box
                        component="iframe"
                        title="Client location map"
                        src={clientMapEmbedUrl}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        sx={{
                          width: "100%",
                          height: "100%",
                          border: 0
                        }}
                      />
                    </Box>

                    <Box
                      sx={{
                        px: 1.5,
                        py: 1.25,
                        borderTop: "1px solid #e2e8f0"
                      }}
                    >
                      <Typography sx={{ fontSize: "0.82rem", color: "#64748b" }}>
                        Map preview updates from the saved address or coordinates.
                      </Typography>
                    </Box>
                  </Box>
                ) : null}

                  <TextField
                    label="Email Address"
                    name="Email"
                    type="email"
                  fullWidth
                  value={newClient.Email || ""}
                  onChange={handleChange}
                  error={emailError}
                    helperText={emailError ? "Enter a valid email address" : " "}
                    sx={{ gridColumn: { xs: "1 / span 1", md: "1 / span 2" } }}
                  />

                  <Box
                    sx={{
                      gridColumn: { xs: "1 / span 1", md: "1 / span 2" },
                      px: 1.5,
                      py: 1.25,
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
                        Email Billing
                      </Typography>
                      <Typography sx={{ fontSize: "0.85rem", color: "#64748b" }}>
                        Turn this on only if the client want to receive the email.  
                      </Typography>
                    </Box>
                    <Switch
                      name="EmailBillingEnabled"
                      checked={Boolean(newClient.EmailBillingEnabled)}
                      onChange={handleChange}
                      disabled={!canEnableEmailBilling}
                    />
                  </Box>
                </Box>
              </Paper>

            <Paper elevation={0} sx={formSectionSx}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1, color: "#0f172a" }}>
                Plan Details
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr" },
                  gap: 1.25
                }}
              >
                <TextField
                  label="Net Plan"
                  value={newClient.NetPlan || ""}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />

                <TextField
                  label="Amount Due"
                  value={newClient.AmountDue ?? ""}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="Due Date"
                    disabled={!isAdminUser}
                    value={
                      newClient.DueDate
                        ? dayjs(parseMMDDYYYYToISO(newClient.DueDate))
                        : null
                    }
                    onChange={(value) => {
                      if (!value) {
                        setNewClient((prev) => ({
                          ...prev,
                          DueDate: "",
                          SubscriptionCover: ""
                        }));
                        return;
                      }

                      const formatted = value.format("MM/DD/YYYY");

                      setNewClient((prev) => ({
                        ...prev,
                        DueDate: formatted,
                        SubscriptionCover: String(value.date())
                      }));
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true
                      }
                    }}
                  />
                </LocalizationProvider>

                <TextField
                  label="Subscription Cover"
                  name="SubscriptionCover"
                  fullWidth
                  value={newClient.SubscriptionCover || ""}
                  InputProps={{ readOnly: true }}
                />
              </Box>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                ...formSectionSx,
                gridColumn: { xs: "1 / span 1", lg: "1 / span 2" }
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 1, color: "#0f172a" }}>
                Notes
              </Typography>
              <TextField
                label="Notes"
                name="Note"
                fullWidth
                multiline
                rows={4}
                value={newClient.Note || ""}
                onChange={handleChange}
              />
            </Paper>
          </Box>
        </DialogContent>

      <DialogActions
          sx={{
            px: 2.25,
            py: 1.5,
            backgroundColor: "#f6f9fc",
            borderTop: "1px solid #dbe4ee"
          }}
        >
          <Button
            onClick={handleCloseModal}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Cancel
          </Button>
          {editMode && ["IPOE", "PPPOE"].includes(selectedAuthMode) ? (
            <Button
              variant="outlined"
              color="warning"
              onClick={() => openClientActionConfirm("pullout")}
              sx={{
                px: 2.5,
                py: 0.8,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700
              }}
            >
              Pull OUT
            </Button>
          ) : null}
          <Button
            variant="contained"
            onClick={editMode ? handleUpdateClient : handleAddClient}
            disabled={editMode && clientFormLoading}
            sx={{
              px: 3.25,
              py: 0.85,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              boxShadow: "0 10px 22px rgba(37, 99, 235, 0.18)"
            }}
          >
            {editMode && clientFormLoading ? "Loading Client..." : "Save Client"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openPaymentModal}
        onClose={handleClosePaymentModal}
        fullWidth
        maxWidth={false}
        PaperProps={{
          sx: {
            width: "94vw",
            maxWidth: "1400px",
            borderRadius: 4,
            overflow: "hidden",
            background: "#f6f9fc",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)"
          }
        }}
      >
        <Box
          sx={{
            background: "linear-gradient(90deg, #14532d, #16a34a)",
            color: "#fff",
            px: 2.1,
            py: 0.9,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PaymentIcon />
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, lineHeight: 1.1 }}>
              Payment Acceptance
            </Typography>
          </Box>

          <IconButton onClick={handleClosePaymentModal} sx={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 1.5, backgroundColor: "#f6f9fc" }}>
          {paymentReceiptLoading ? (
            <Box
              sx={{
                minHeight: 260,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 1.5,
                px: 3,
                py: 6
              }}
            >
              <CircularProgress size={28} thickness={4.5} />
              <Typography sx={{ fontSize: "0.88rem", color: "#475569", fontWeight: 600 }}>
                Generating payment reference...
              </Typography>
            </Box>
          ) : (
          <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", xl: "0.74fr 0.5fr 1.46fr" },
              gap: 2
            }}
          >
            <Box sx={{ display: "grid", gap: 2 }}>
              <Paper elevation={0} sx={formSectionSx}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", md: "center" },
                    flexDirection: { xs: "column", md: "row" },
                    gap: 1,
                    mb: 1.2
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 1
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.58rem",
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: 0.4
                      }}
                    >
                      Account
                    </Typography>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
                      {selectedClient?.AccountName || "N/A"}
                    </Typography>
                    <Typography sx={{ fontSize: "0.66rem", color: "#64748b", lineHeight: 1.1 }}>
                      Account No. {selectedClient?.AccountNumber || "N/A"}
                    </Typography>
                  </Box>
                </Box>

                <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", mb: 1, color: "#0f172a" }}>
                  Customer Details
                </Typography>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "1fr 1fr" },
                    gap: 0.85
                  }}
                >
                  {paymentRequiresReconnectFlow ? (
                    <Paper elevation={0} sx={summaryCardSx}>
                      <Typography sx={{ fontSize: "0.54rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.2 }}>
                        Reconnect Type
                      </Typography>
                      <TextField
                        select
                        value={paymentForm.ReconnectAuthMode}
                        onChange={handleReconnectAuthModeChange}
                        fullWidth
                        variant="standard"
                        SelectProps={{ displayEmpty: true }}
                        InputProps={{ disableUnderline: true }}
                        sx={{
                          mt: 0.2,
                          "& .MuiInputBase-input": {
                            px: 0,
                            py: 0.08,
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: "#0f172a"
                          }
                        }}
                      >
                        <MenuItem value="">Select Type</MenuItem>
                        <MenuItem value="PPPOE">PPPOE</MenuItem>
                        <MenuItem value="IPOE">IPOE</MenuItem>
                      </TextField>
                    </Paper>
                  ) : null}

                  {paymentRequiresReconnectFlow &&
                  paymentSelectedAuthMode === "IPOE" ? (
                    <Paper elevation={0} sx={summaryCardSx}>
                      <Typography sx={{ fontSize: "0.54rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.2 }}>
                        MAC Address
                      </Typography>
                      <TextField
                        select
                        value={paymentForm.ReconnectMacAddress}
                        onChange={(event) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            ReconnectMacAddress: String(event.target.value || "")
                              .trim()
                              .toUpperCase()
                          }))
                        }
                        fullWidth
                        variant="standard"
                        SelectProps={{ displayEmpty: true }}
                        InputProps={{ disableUnderline: true }}
                        sx={{
                          mt: 0.2,
                          "& .MuiInputBase-input": {
                            px: 0,
                            py: 0.08,
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: "#0f172a"
                          }
                        }}
                      >
                        <MenuItem value="">Select MAC Address</MenuItem>
                        {displayedPaymentDhcpLeaseOptions.map((mac) => (
                          <MenuItem key={mac} value={mac}>
                            {mac}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Paper>
                  ) : null}

                  <Paper elevation={0} sx={summaryCardSx}>
                    <Typography sx={{ fontSize: "0.54rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.2 }}>
                      Subscription Plan
                    </Typography>
                    {paymentRequiresReconnectFlow ? (
                      <TextField
                        select
                        value={paymentForm.ReconnectPlan}
                        onChange={handleReconnectPlanChange}
                        fullWidth
                        variant="standard"
                        SelectProps={{ displayEmpty: true }}
                        InputProps={{ disableUnderline: true }}
                        sx={{
                          mt: 0.2,
                          "& .MuiInputBase-input": {
                            px: 0,
                            py: 0.08,
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: "#0f172a"
                          }
                        }}
                      >
                        <MenuItem value="">Select New Plan</MenuItem>
                        {paymentReconnectPlanOptions.map((plan) => (
                          <MenuItem key={plan._id} value={getPlanName(plan)}>
                            {getPlanName(plan)}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <Typography sx={{ mt: 0.12, fontSize: "0.76rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
                        {displayedPaymentPlan}
                      </Typography>
                    )}
                  </Paper>

                    <Paper elevation={0} sx={summaryCardSx}>
                      <Typography sx={{ fontSize: "0.54rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.2 }}>
                        Payment Reference
                      </Typography>
                    <TextField
                      name="ReferenceNumber"
                      value={paymentForm.ReferenceNumber}
                      onChange={handlePaymentChange}
                      fullWidth
                      variant="standard"
                      InputProps={{ disableUnderline: true }}
                      sx={{
                        mt: 0.2,
                        "& .MuiInputBase-input": {
                          px: 0,
                          py: 0.08,
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "#0f172a"
                        }
                        }}
                      />
                    </Paper>

                    <Paper elevation={0} sx={summaryCardSx}>
                        <Typography sx={{ fontSize: "0.54rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.2 }}>
                          SubTotal
                        </Typography>
                      <Typography sx={{ mt: 0.12, fontSize: "0.76rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
                        PHP {planAmount}
                      </Typography>
                    </Paper>

                    <Paper elevation={0} sx={summaryCardSx}>
                      <Typography sx={{ fontSize: "0.54rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.2 }}>
                        Due Date
                      </Typography>
                      <Typography sx={{ mt: 0.12, fontSize: "0.76rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
                        {selectedClient?.DueDate
                          ? new Date(selectedClient.DueDate).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric"
                            })
                          : "N/A"}
                      </Typography>
                    </Paper>

                    <Paper elevation={0} sx={summaryCardSx}>
                      <Typography sx={{ fontSize: "0.54rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.2 }}>
                        Installation Date
                      </Typography>
                      <Typography sx={{ mt: 0.12, fontSize: "0.76rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
                        {formatClientInstallDateDisplay(selectedClient)}
                      </Typography>
                    </Paper>

                    <Paper elevation={0} sx={summaryCardSx}>
                      <Typography sx={{ fontSize: "0.54rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.2 }}>
                        Next Due Date
                      </Typography>
                      <Typography sx={{ mt: 0.12, fontSize: "0.76rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
                        {nextDueDateDisplay}
                      </Typography>
                    </Paper>
                  </Box>
                </Paper>

              <Paper elevation={0} sx={formSectionSx}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", mb: 1, color: "#0f172a" }}>
                  Receipt Details
                </Typography>

                <Box sx={{ mb: 1.5 }}>
                  <TextField
                    label="Subscription Covered"
                    value={subscriptionCoveredText}
                    fullWidth
                    multiline
                    rows={2}
                    InputProps={{ readOnly: true }}
                    sx={compactFieldSx}
                  />
                </Box>

                <TextField
                  label="Additional Charge Description"
                  name="Notes"
                  fullWidth
                  multiline
                  rows={2}
                  value={paymentForm.Notes}
                  onChange={handlePaymentChange}
                  sx={compactFieldSx}
                />
              </Paper>
            </Box>

            <Paper elevation={0} sx={formSectionSx}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", mb: 1, color: "#0f172a" }}>
                Payment Breakdown
              </Typography>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    rowGap: 3.35,
                    justifyItems: "start",
                    "& .MuiTextField-root": {
                      backgroundColor: "#fff",
                      width: "100%",
                      maxWidth: 430
                    },
                    "& .MuiTextField-root .MuiInputLabel-root": {
                      fontSize: "1.22rem",
                      fontWeight: 700
                    },
                    "& .MuiTextField-root .MuiInputBase-root": {
                      minHeight: 102
                    },
                    "& .MuiTextField-root .MuiInputBase-input": {
                      py: 2.55,
                      fontSize: "1.3rem",
                      fontWeight: 700
                    }
                  }}
                >
                <TextField
                  label="Additional Charge"
                  name="AdditionalCharge"
                  value={paymentForm.AdditionalCharge}
                  onChange={handlePaymentChange}
                  fullWidth
                  sx={compactFieldSx}
                />

                <TextField
                  label="VAT"
                  value="0"
                  fullWidth
                  InputProps={{ readOnly: true }}
                  sx={compactFieldSx}
                />

                <TextField
                  label="Discount / Others"
                  name="Discount"
                  value={paymentForm.Discount}
                  onChange={handlePaymentChange}
                  fullWidth
                  sx={compactFieldSx}
                />

                <TextField
                  label="Total Amount to Pay"
                  value={totalAmountToPay}
                  fullWidth
                  InputProps={{ readOnly: true }}
                  sx={compactFieldSx}
                />

                <TextField
                  label="Ending Balance"
                  value={projectedBalance}
                  fullWidth
                  InputProps={{ readOnly: true }}
                  sx={compactFieldSx}
                />

                <TextField
                  label="Payment Received Total"
                  value={totalPaymentReceived}
                  fullWidth
                  InputProps={{ readOnly: true }}
                  sx={compactFieldSx}
                />

                <TextField
                  label="Sales Invoice"
                  name="Invoice"
                  value={paymentForm.Invoice}
                  onChange={handlePaymentChange}
                  fullWidth
                  sx={compactFieldSx}
                />

                <TextField
                  label="Contact Number"
                  name="ContactNumber"
                  value={paymentForm.ContactNumber}
                  onChange={handlePaymentChange}
                  fullWidth
                  sx={compactFieldSx}
                  helperText={`Existing: ${selectedClient?.ContactNumber || "N/A"}`}
                />

                <Box
                  sx={{
                    width: "100%",
                    maxWidth: 430,
                    px: 2,
                    py: 1.5,
                    border: "1px solid #dbe4ee",
                    borderRadius: 2,
                    backgroundColor: paymentForm.SendSms === false ? "#f8fafc" : "#f0fdf4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: "#0f172a" }}>
                      Send SMS
                    </Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: "#64748b" }}>
                      {paymentForm.SendSms === false
                        ? "OFF - client will not receive payment SMS."
                        : "ON - client will receive payment SMS."}
                    </Typography>
                  </Box>
                  <Switch
                    checked={paymentForm.SendSms !== false}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        SendSms: event.target.checked
                      }))
                    }
                    color="success"
                  />
                </Box>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ ...formSectionSx, display: "grid", gap: 1.5 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap"
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                  Payment Entries
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Chip
                    label={hasPaymentEntries ? `${normalizedPaymentEntries.length} PAYMENT ${normalizedPaymentEntries.length === 1 ? "ENTRY" : "ENTRIES"}` : "NO PAYMENT ENTRY"}
                    sx={{
                      borderRadius: "999px",
                      height: 20,
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      backgroundColor: hasPaymentEntries ? "#ecfdf5" : "#f8fafc",
                      color: hasPaymentEntries ? "#166534" : "#64748b"
                    }}
                  />
                </Box>
              </Box>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: "1px solid #dbe4ee",
                  backgroundColor: "#fff"
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1
                  }}
                >
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f172a" }}>
                    Receipt Upload
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={clearReceiptUpload}
                    sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700 }}
                  >
                    Clear
                  </Button>
                </Box>

                <Typography sx={{ fontSize: "12px", mb: 0.5, color: "#334155" }}>
                  Drag a GCash, PayMaya, or bank receipt image here
                </Typography>

                <Typography sx={{ fontSize: "12px", mb: 1.5, color: "text.secondary" }}>
                  Or click here and press Ctrl+V to paste a copied receipt image
                </Typography>

                <Box
                  tabIndex={0}
                  onPaste={handleReceiptPaste}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    processReceiptImage(file);
                  }}
                  sx={{
                    border: "2px dashed",
                    borderColor: dragActive ? "#2563eb" : "#cbd5e1",
                    borderRadius: 3,
                    px: 2,
                    py: 1.5,
                    minHeight: receiptPreview ? 190 : 82,
                    textAlign: "center",
                    backgroundColor: dragActive ? "#eff6ff" : "#f8fafc",
                    outline: "none",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1
                  }}
                >
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700 }}
                  >
                    Choose Image
                    <input
                      hidden
                      accept="image/*"
                      type="file"
                      onChange={(e) => processReceiptImage(e.target.files?.[0])}
                    />
                  </Button>

                  {receiptPreview && (
                    <Box sx={{ mt: 0.75 }}>
                      <Box
                        component="img"
                        src={receiptPreview}
                        alt="Receipt preview"
                        onClick={() => setReceiptPreviewOpen(true)}
                        sx={{
                          width: 88,
                          maxWidth: "100%",
                          maxHeight: 136,
                          borderRadius: 2,
                          border: "1px solid #dbe4ee",
                          boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
                          objectFit: "cover",
                          cursor: "zoom-in"
                        }}
                      />
                      <Typography sx={{ mt: 0.6, fontSize: "0.68rem", color: "#64748b" }}>
                        Click image to enlarge
                      </Typography>
                    </Box>
                  )}

                  {(ocrLoading || ocrMessage) && (
                    <Typography sx={{ fontSize: "12px", mt: 1.25, color: "text.secondary" }}>
                      {ocrLoading ? "Scanning receipt image..." : ocrMessage}
                    </Typography>
                  )}
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #dbe4ee",
                  backgroundColor: "#fff",
                  overflow: "hidden"
                }}
              >
                <Box
                  sx={{
                    display: { xs: "none", md: "grid" },
                    gridTemplateColumns: { md: "1fr 0.82fr 1.22fr 1fr 0.56fr 0.8fr 110px" },
                    gap: 1,
                    px: 1.5,
                    py: 1.1,
                    alignItems: "center",
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #dbe4ee"
                  }}
                >
                  {["Mode of Payment", "Amount", "Reference", "Transfer Date", "Receiver Last 4", "Receipt"].map((header) => (
                    <Typography
                      key={header}
                      sx={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: 0.2
                      }}
                    >
                      {header}
                    </Typography>
                  ))}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.5 }}>
                    <Typography
                      sx={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: 0.2
                      }}
                    >
                      Action
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleAddPaymentEntry}
                      sx={{
                        width: 28,
                        height: 28,
                        color: "#2563eb",
                        border: "1px solid #bfdbfe",
                        backgroundColor: "#eff6ff",
                        "&:hover": { backgroundColor: "#dbeafe" }
                      }}
                    >
                      <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                </Box>

                <Box sx={{ display: "grid" }}>
                  {paymentEntries.map((entry, index) => (
                    <Box
                      key={`payment-entry-${index}`}
                      sx={{
                        px: 1.5,
                        py: 1.2,
                        borderTop: index === 0 ? "none" : "1px solid #eef2f7"
                      }}
                    >
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "1fr 0.82fr 1.22fr 1fr 0.56fr 0.8fr 110px" },
                          gap: 1,
                          alignItems: "start"
                        }}
                      >
                        <TextField
                          select
                          placeholder="Mode of Payment"
                          size="small"
                          value={entry.method}
                          onChange={(event) =>
                            handlePaymentEntryChange(index, "method", event.target.value)
                          }
                        >
                          <MenuItem value="CASH">CASH</MenuItem>
                          <MenuItem value="GCASH">GCASH</MenuItem>
                          <MenuItem value="PAYMAYA">PAYMAYA</MenuItem>
                          <MenuItem value="BANK">BANK</MenuItem>
                        </TextField>

                        <TextField
                          label={undefined}
                          placeholder="Amount"
                          size="small"
                          value={entry.amount}
                          onChange={(event) =>
                            handlePaymentEntryChange(index, "amount", event.target.value)
                          }
                        />

                        <TextField
                          label={undefined}
                          placeholder="Reference"
                          size="small"
                          value={entry.reference}
                          onChange={(event) =>
                            handlePaymentEntryChange(index, "reference", event.target.value)
                          }
                          disabled={normalizePaymentLineMethod(entry.method) === "CASH"}
                        />

                        <TextField
                          label={undefined}
                          placeholder="Transfer Date"
                          size="small"
                          value={entry.transferDate || ""}
                          onChange={(event) =>
                            handlePaymentEntryChange(index, "transferDate", event.target.value)
                          }
                          disabled={normalizePaymentLineMethod(entry.method) === "CASH"}
                        />

                        <TextField
                          label={undefined}
                          placeholder="Receiver Last 4"
                          size="small"
                          value={entry.receiverLast4 || ""}
                          onChange={(event) =>
                            handlePaymentEntryChange(index, "receiverLast4", event.target.value)
                          }
                          disabled={normalizePaymentLineMethod(entry.method) === "CASH"}
                        />

                        <Box sx={{ display: "flex", alignItems: "center", minHeight: 40 }}>
                          {entry.receiptImageUrl || entry.receiptImageDataUrl ? (
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => handleOpenReceiptImagePreview(entry.receiptImageDataUrl || entry.receiptImageUrl)}
                              sx={{ textTransform: "none", minWidth: 0, px: 0, fontWeight: 700 }}
                            >
                              View
                            </Button>
                          ) : (
                            <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8" }}>-</Typography>
                          )}
                        </Box>

                        <Button
                          color="error"
                          variant="outlined"
                          onClick={() => handleRemovePaymentEntry(index)}
                          sx={{ textTransform: "none", fontWeight: 700, minWidth: 92, alignSelf: "center" }}
                        >
                          Remove
                        </Button>
                      </Box>

                      {normalizePaymentLineMethod(entry.method) !== "CASH" && (
                        <Typography sx={{ mt: 0.7, fontSize: "0.68rem", color: "#64748b" }}>
                          Non-cash entry: reference, transfer date, and receiver last 4 can be saved from the receipt.
                        </Typography>
                      )}
                    </Box>
                ))}
              </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1.25,
                  borderRadius: 3,
                  border: "1px solid #dbe4ee",
                  backgroundColor: "#fff"
                }}
              >
                <Typography sx={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700 }}>
                  TOTAL RECEIVED
                </Typography>
                <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>
                  PHP {totalPaymentReceived.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Paper>
            </Paper>
          </Box>
          </>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2.25,
            backgroundColor: "#f6f9fc",
            borderTop: "1px solid #dbe4ee"
          }}
        >
          <Button
            onClick={handleClosePaymentModal}
            sx={{ textTransform: "none", fontWeight: 700 }}
            disabled={paymentSaving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSavePayment}
            disabled={paymentReceiptLoading || paymentSaving}
            startIcon={
              paymentSaving ? (
                <CircularProgress size={16} color="inherit" thickness={5} />
              ) : null
            }
            sx={{
              px: 4,
              py: 1,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              boxShadow: "0 10px 22px rgba(22, 163, 74, 0.18)"
            }}
          >
            {paymentSaving ? "Saving Payment..." : "Receive Payment"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openPaymentEntriesModal}
        onClose={handleClosePaymentEntriesModal}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden"
          }
        }}
      >
        <Box
          sx={{
            background: "linear-gradient(90deg, #1d4ed8, #2563eb)",
            color: "#fff",
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Payment Entries
          </Typography>
          <IconButton onClick={handleClosePaymentEntriesModal} sx={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 3, backgroundColor: "#f8fafc" }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 3,
              border: "1px solid #dbe4ee",
              backgroundColor: "#fff"
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1
              }}
            >
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
                Receipt Upload
              </Typography>
              <Button
                size="small"
                color="error"
                variant="outlined"
                onClick={clearReceiptUpload}
                sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700 }}
              >
                Clear
              </Button>
            </Box>

            <Typography sx={{ fontSize: "12px", mb: 0.5, color: "#334155" }}>
              Drag a GCash, PayMaya, or bank receipt image here
            </Typography>

            <Typography sx={{ fontSize: "12px", mb: 1.5, color: "text.secondary" }}>
              Or click here and press Ctrl+V to paste a copied receipt image
            </Typography>

            <Box
              tabIndex={0}
              onPaste={handleReceiptPaste}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                processReceiptImage(file);
              }}
              sx={{
                border: "2px dashed",
                borderColor: dragActive ? "#2563eb" : "#cbd5e1",
                borderRadius: 3,
                px: 2,
                py: 1.5,
                minHeight: receiptPreview ? 190 : 82,
                textAlign: "center",
                backgroundColor: dragActive ? "#eff6ff" : "#f8fafc",
                outline: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1
              }}
            >
              <Button
                variant="outlined"
                component="label"
                size="small"
                sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700 }}
              >
                Choose Image
                <input
                  hidden
                  accept="image/*"
                  type="file"
                  onChange={(e) => processReceiptImage(e.target.files?.[0])}
                />
              </Button>

              {receiptPreview && (
                <Box sx={{ mt: 0.75 }}>
                  <Box
                    component="img"
                    src={receiptPreview}
                    alt="Receipt preview"
                    onClick={() => setReceiptPreviewOpen(true)}
                    sx={{
                      width: 88,
                      maxWidth: "100%",
                      maxHeight: 136,
                      borderRadius: 2,
                      border: "1px solid #dbe4ee",
                      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
                      objectFit: "cover",
                      cursor: "zoom-in"
                    }}
                  />
                  <Typography sx={{ mt: 0.6, fontSize: "0.68rem", color: "#64748b" }}>
                    Click image to enlarge
                  </Typography>
                </Box>
              )}

              {(ocrLoading || ocrMessage) && (
                <Typography sx={{ fontSize: "12px", mt: 1.25, color: "text.secondary" }}>
                  {ocrLoading ? "Scanning receipt image..." : ocrMessage}
                </Typography>
              )}
            </Box>
          </Paper>

              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #dbe4ee",
                  backgroundColor: "#fff",
                  overflow: "hidden"
                }}
              >
                <Box
                  sx={{
                    display: { xs: "none", md: "grid" },
                    gridTemplateColumns: { md: "1fr 0.82fr 1.22fr 1fr 0.56fr 0.8fr 110px" },
                    gap: 1.25,
                    px: 1.5,
                    py: 1.1,
                    alignItems: "center",
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #dbe4ee"
                  }}
                >
                  {["Mode of Payment", "Amount", "Reference", "Transfer Date", "Receiver Last 4", "Receipt"].map((header) => (
                    <Typography
                      key={`modal-${header}`}
                      sx={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: 0.2
                      }}
                    >
                      {header}
                    </Typography>
                  ))}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.5 }}>
                    <Typography
                      sx={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: 0.2
                      }}
                    >
                      Action
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleAddPaymentEntry}
                      sx={{
                        width: 28,
                        height: 28,
                        color: "#2563eb",
                        border: "1px solid #bfdbfe",
                        backgroundColor: "#eff6ff",
                        "&:hover": { backgroundColor: "#dbeafe" }
                      }}
                    >
                      <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                </Box>

                <Box sx={{ display: "grid" }}>
                  {paymentEntries.map((entry, index) => (
                    <Box
                      key={`payment-entry-${index}`}
                      sx={{
                        px: 1.5,
                        py: 1.2,
                        borderTop: index === 0 ? "none" : "1px solid #eef2f7"
                      }}
                    >
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "1fr 0.82fr 1.22fr 1fr 0.56fr 0.8fr 110px" },
                          gap: 1.25,
                          alignItems: "start"
                        }}
                      >
                        <TextField
                          select
                          placeholder="Mode of Payment"
                          size="small"
                          value={entry.method}
                          onChange={(event) =>
                            handlePaymentEntryChange(index, "method", event.target.value)
                          }
                        >
                          <MenuItem value="CASH">CASH</MenuItem>
                          <MenuItem value="GCASH">GCASH</MenuItem>
                          <MenuItem value="PAYMAYA">PAYMAYA</MenuItem>
                          <MenuItem value="BANK">BANK</MenuItem>
                        </TextField>

                        <TextField
                          label={undefined}
                          placeholder="Amount"
                          size="small"
                          value={entry.amount}
                          onChange={(event) =>
                            handlePaymentEntryChange(index, "amount", event.target.value)
                          }
                        />

                        <TextField
                          label={undefined}
                          placeholder="Reference"
                          size="small"
                          value={entry.reference}
                          onChange={(event) =>
                            handlePaymentEntryChange(index, "reference", event.target.value)
                          }
                          disabled={normalizePaymentLineMethod(entry.method) === "CASH"}
                        />

                        <TextField
                          label={undefined}
                          placeholder="Transfer Date"
                          size="small"
                          value={entry.transferDate || ""}
                          onChange={(event) =>
                            handlePaymentEntryChange(index, "transferDate", event.target.value)
                          }
                          disabled={normalizePaymentLineMethod(entry.method) === "CASH"}
                        />

                        <TextField
                          label={undefined}
                          placeholder="Receiver Last 4"
                          size="small"
                          value={entry.receiverLast4 || ""}
                          onChange={(event) =>
                            handlePaymentEntryChange(index, "receiverLast4", event.target.value)
                          }
                          disabled={normalizePaymentLineMethod(entry.method) === "CASH"}
                        />

                        <Box sx={{ display: "flex", alignItems: "center", minHeight: 40 }}>
                          {entry.receiptImageUrl || entry.receiptImageDataUrl ? (
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => handleOpenReceiptImagePreview(entry.receiptImageDataUrl || entry.receiptImageUrl)}
                              sx={{ textTransform: "none", minWidth: 0, px: 0, fontWeight: 700 }}
                            >
                              View
                            </Button>
                          ) : (
                            <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8" }}>-</Typography>
                          )}
                        </Box>

                        <Button
                          color="error"
                          variant="outlined"
                          onClick={() => handleRemovePaymentEntry(index)}
                          sx={{ textTransform: "none", fontWeight: 700, minWidth: 96, alignSelf: "center" }}
                        >
                          Remove
                        </Button>
                      </Box>

                      {normalizePaymentLineMethod(entry.method) !== "CASH" && (
                        <Typography sx={{ mt: 0.7, fontSize: "0.68rem", color: "#64748b" }}>
                          Non-cash entry: reference, transfer date, and receiver last 4 can be saved from the receipt.
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </Paper>

          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: { xs: "flex-start", md: "center" },
              gap: 1.5,
              mt: 2.5
            }}
          >
            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1.25,
                borderRadius: 3,
                border: "1px solid #dbe4ee",
                backgroundColor: "#fff"
              }}
            >
              <Typography sx={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 700 }}>
                TOTAL RECEIVED
              </Typography>
              <Typography sx={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                PHP {totalPaymentReceived.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Paper>
          </Box>
        </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid #dbe4ee" }}>
          <Button onClick={handleClosePaymentEntriesModal} sx={{ textTransform: "none", fontWeight: 700 }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={receiptPreviewOpen}
        onClose={() => {
          setReceiptPreviewOpen(false);
          setReceiptViewerSrc("");
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden"
          }
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            backgroundColor: "#0f172a",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 700
          }}
        >
          Receipt Preview
          <IconButton
            onClick={() => {
              setReceiptPreviewOpen(false);
              setReceiptViewerSrc("");
            }}
            sx={{ color: "#fff" }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, backgroundColor: "#f8fafc" }}>
          {receiptViewerSrc && (
            <Box
              component="img"
              src={receiptViewerSrc}
              alt="Receipt large preview"
              sx={{
                width: "100%",
                maxHeight: "75vh",
                objectFit: "contain",
                borderRadius: 2,
                backgroundColor: "#fff",
                border: "1px solid #dbe4ee"
              }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 2, backgroundColor: "#f8fafc" }}>
          <Button
            variant="contained"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyReceiptImage}
            disabled={!receiptViewerSrc}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Copy Image
          </Button>
        </DialogActions>
      </Dialog>

      {renderClientActionConfirmDialog()}
      {renderPaymentDetailsConfirmDialog()}
      {renderMessageDialog()}

      <Dialog
        open={smsConfirmDialog.open}
        onClose={handleCloseSmsConfirmDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Send SMS?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography>
            Are you sure you want to send an SMS to{" "}
            <strong>
              {smsConfirmDialog.client?.AccountName ||
                smsConfirmDialog.client?.ClientName ||
                "this client"}
            </strong>
            ?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseSmsConfirmDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmSendSms}>
            Send SMS
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={billingPeriodDialog.open}
        onClose={handleCloseBillingPeriodDialog}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 3
          }
        }}
      >
        <DialogTitle>Select Billing Month</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <Typography sx={{ color: "#475569", fontSize: "0.92rem" }}>
              {billingPeriodDialog.client?.ClientName ||
                billingPeriodDialog.client?.AccountName ||
                "Client"}
            </Typography>
            <TextField
              select
              label="Month and Year"
              value={billingPeriodDialog.periodKey}
              onChange={(event) =>
                setBillingPeriodDialog((prev) => ({
                  ...prev,
                  periodKey: event.target.value
                }))
              }
              fullWidth
            >
              {billingPeriodOptions.map((option) => (
                <MenuItem key={option.key} value={option.key}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Typography sx={{ color: "#64748b", fontSize: "0.82rem" }}>
              Available months start from the month after installation.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseBillingPeriodDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmBillingPeriod}
            disabled={!billingPeriodDialog.periodKey}
          >
            Open Billing
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openBillingModal}
        onClose={handleCloseBillingModal}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            minHeight: "85vh"
          }
        }}
      >
        <DialogContent sx={{ p: 0, backgroundColor: "#f6f9fc" }}>
          <BillingStatementContent
            client={selectedClient}
            history={billingHistoryRows}
            loading={billingLoading}
            error={billingError}
            billingPeriod={selectedBillingPeriod}
            embedded
            onClose={handleCloseBillingModal}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={repairDialog.open}
        onClose={handleCloseRepairDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden"
          }
        }}
      >
        <Box
          sx={{
            background: "linear-gradient(90deg, #9a3412, #f97316)",
            color: "#fff",
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Repair Request
            </Typography>
            <Typography sx={{ fontSize: "0.92rem", opacity: 0.9 }}>
              {selectedClient?.AccountName || selectedClient?.ClientName || "Client"}
            </Typography>
          </Box>

          <IconButton onClick={handleCloseRepairDialog} sx={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 3, backgroundColor: "#f8fafc" }}>
          <Paper
            elevation={0}
            sx={{
              p: 2.25,
              borderRadius: 3,
              border: "1px solid #dbe4ee",
              backgroundColor: "#fff",
              display: "grid",
              gap: 2
            }}
          >
            <TextField
              select
              label="Technicians"
              value={repairDialog.technicianIds}
              onChange={(event) =>
                setRepairDialog((prev) => ({
                  ...prev,
                  technicianIds: event.target.value
                }))
              }
              SelectProps={{
                multiple: true,
                renderValue: (selected) =>
                  technicians
                    .filter((tech) => selected.includes(String(tech.ID || "")))
                    .map((tech) => tech.Name || tech.Username)
                    .filter(Boolean)
                    .join(", ")
              }}
              fullWidth
              helperText="Choose one or more technicians who will handle this repair."
            >
              {technicians.length === 0 ? (
                <MenuItem value="" disabled>
                  No technician available
                </MenuItem>
              ) : (
                technicians.map((tech) => (
                  <MenuItem key={tech.ID || tech.Username} value={String(tech.ID || "")}>
                    {tech.Name || tech.Username}
                  </MenuItem>
                ))
              )}
            </TextField>

            <TextField
              label="SMS Details"
              multiline
              minRows={8}
              value={repairDetailsDisplayValue}
              onChange={(event) =>
                setRepairDialog((prev) => ({
                  ...prev,
                  repairText: event.target.value,
                  smsMessage: event.target.value
                }))
              }
              placeholder="Type the repair SMS details to send to the selected technician."
              fullWidth
              helperText="Editable SMS message that will be sent to the selected technician."
            />
          </Paper>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid #dbe4ee" }}>
          <Button
            onClick={handleCloseRepairDialog}
            sx={{ textTransform: "none", fontWeight: 700 }}
            disabled={repairSaving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRepairRequest}
            sx={{ textTransform: "none", fontWeight: 700 }}
            disabled={repairSaving}
          >
            {repairSaving ? "Sending..." : "Send Repair SMS"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openPaymentHistoryModal}
        onClose={handleClosePaymentHistoryModal}
        fullWidth
        maxWidth={false}
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden",
            width: "96vw",
            maxWidth: "96vw",
            height: "88vh"
          }
        }}
      >
        <Box
          sx={{
            background: "linear-gradient(90deg, #4c1d95, #7c3aed)",
            color: "#fff",
            px: 3.5,
            py: 2.25,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Payment History
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", opacity: 0.92 }}>
              {selectedClient?.ClientName || selectedClient?.AccountName || "Client"} collection records
            </Typography>
          </Box>

          <IconButton onClick={handleClosePaymentHistoryModal} sx={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 3, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                Account: {selectedClient?.AccountName || "-"}
              </Typography>
              <Typography sx={{ color: "#64748b" }}>
                Account No.: {selectedClient?.AccountNumber || "-"}
              </Typography>
            </Box>

            <Button
              variant="outlined"
              startIcon={<ReceiptIcon />}
              onClick={() => window.print()}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Print Collection
            </Button>
          </Box>

          {paymentHistoryError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {paymentHistoryError}
            </Alert>
          ) : null}

          {paymentHistoryLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <Typography>Loading payment history...</Typography>
            </Box>
          ) : (
            <>
            <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
              {paymentHistoryRows.length === 0 ? (
                <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                  No payment history found.
                </Typography>
              ) : (
                paymentHistoryRows.map((row) => {
                  const historyRowKey = row._id || `${row.Invoice}-${row.TransactionDate}`;
                  const earningRows = Array.isArray(row.EarningRows) ? row.EarningRows : [];
                  const isExpanded = expandedPaymentHistoryRowId === String(historyRowKey);

                  return (
                    <Card
                      key={`mobile-history-${historyRowKey}`}
                      sx={{ borderRadius: 3, border: "1px solid #dbe4ee" }}
                      onClick={() =>
                        setExpandedPaymentHistoryRowId((prev) =>
                          prev === String(historyRowKey) ? "" : String(historyRowKey)
                        )
                      }
                    >
                      <CardContent>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>
                                {row.PaymentReceipt || row.Invoice || "-"}
                              </Typography>
                              <Typography sx={{ color: "#64748b", fontSize: "0.75rem" }}>
                                {row.TransactionDate ? new Date(row.TransactionDate).toLocaleString("en-PH") : "-"}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 900, color: "#15803d", flexShrink: 0 }}>
                              PHP {Number(row.TotalAmount || row.Cash || 0).toLocaleString()}
                            </Typography>
                          </Stack>

                          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                            <Box>
                              <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>MODE</Typography>
                              <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>{formatPrintPaymentMode(row)}</Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>BALANCE</Typography>
                              <Typography sx={{ fontWeight: 800 }}>PHP {Number(row.Balance || 0).toLocaleString()}</Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>DUE DATE</Typography>
                              <Typography sx={{ fontWeight: 800 }}>{row.DueDate ? new Date(row.DueDate).toLocaleDateString("en-PH") : "-"}</Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>PLAN</Typography>
                              <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>{row.NetPlan || "-"}</Typography>
                            </Box>
                          </Box>

                          <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                            Ref: {formatPrintReference(row)}
                          </Typography>
                          <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                            Cover: {row.Cover || "-"} | Created by: {row.CreatedBy || row.CreatedById || "-"}
                          </Typography>

                          <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                            <Tooltip title="Open eReceipt">
                              <span>
                                <IconButton
                                  color="success"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenPaymentHistoryEReceipt(row);
                                  }}
                                >
                                  <ContentCopyIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Reprint Receipt">
                              <span>
                                <IconButton
                                  color="primary"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleReprintPaymentHistory(row);
                                  }}
                                >
                                  <ReceiptIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                            {isAdminUser ? (
                              <Tooltip title="Delete Payment History">
                                <span>
                                  <IconButton
                                    color="error"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleOpenDeleteHistoryDialog(row);
                                    }}
                                    disabled={!row._id}
                                  >
                                    <DeleteOutlineOutlinedIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : null}
                          </Stack>

                          {earningRows.length && isExpanded ? (
                            <Box sx={{ background: "#f8fafc", borderRadius: 2, p: 1 }}>
                              <Typography sx={{ fontWeight: 800, mb: 1 }}>Payment Entries</Typography>
                              <Stack spacing={1}>
                                {earningRows.map((earningRow, index) => (
                                  <Box
                                    key={earningRow._id || `${historyRowKey}-mobile-earning-${index}`}
                                    sx={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 2, p: 1 }}
                                  >
                                    <Typography sx={{ fontWeight: 800 }}>
                                      {earningRow.MOP || earningRow.PaymentMethod || "-"} | PHP {Number(earningRow.Cash || earningRow.TotalAmount || 0).toLocaleString()}
                                    </Typography>
                                    <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                                      Ref: {earningRow.MOPRef || earningRow.ReferenceNumber || earningRow.Invoice || "-"}
                                    </Typography>
                                    <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                                      Transfer: {earningRow.TransferDate || "-"} | Receiver: {earningRow.ReceiverLast4 || "-"}
                                    </Typography>
                                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                                      {earningRow.ReceiptImage ? (
                                        <Button
                                          variant="text"
                                          size="small"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleOpenReceiptImagePreview(earningRow.ReceiptImage);
                                          }}
                                          sx={{ textTransform: "none", minWidth: 0, px: 0, fontWeight: 700 }}
                                        >
                                          View Receipt
                                        </Button>
                                      ) : null}
                                      <Typography
                                        sx={{
                                          fontSize: "0.75rem",
                                          fontWeight: 800,
                                          color: earningRow.Verified ? "#15803d" : "#b45309"
                                        }}
                                      >
                                        {earningRow.Verified ? "VALIDATED" : "PENDING"}
                                      </Typography>
                                    </Stack>
                                  </Box>
                                ))}
                              </Stack>
                            </Box>
                          ) : null}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </Box>

            <TableContainer
              component={Paper}
              sx={{
                display: { xs: "none", md: "block" },
                borderRadius: 3,
                overflow: "hidden",
                border: "1px solid #dbe4ee",
                boxShadow: "none",
                flex: 1,
                minHeight: 0
              }}
            >
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                      <TableCell sx={{ fontWeight: 700 }}>Transaction Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Mode Payment</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Payment Receipt</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Payment Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Net Plan</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Cover</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Total Amount</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Balance</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Created By</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 84 }}>eReceipt</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 84 }}>Reprint</TableCell>
                      {isAdminUser ? (
                        <TableCell sx={{ fontWeight: 700, width: 84 }}>Delete</TableCell>
                      ) : null}
                    </TableRow>
                  </TableHead>
                <TableBody>
                  {paymentHistoryRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdminUser ? 15 : 14} align="center">
                        No payment history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paymentHistoryRows.map((row) => {
                      const historyRowKey = row._id || `${row.Invoice}-${row.TransactionDate}`;
                      const earningRows = Array.isArray(row.EarningRows) ? row.EarningRows : [];
                      const isExpanded = expandedPaymentHistoryRowId === String(historyRowKey);

                      return [
                      <TableRow
                        key={historyRowKey}
                        hover
                        onClick={() =>
                          setExpandedPaymentHistoryRowId((prev) =>
                            prev === String(historyRowKey) ? "" : String(historyRowKey)
                          )
                        }
                        sx={{
                          cursor: earningRows.length ? "pointer" : "default",
                          "& > *": { borderBottom: earningRows.length && isExpanded ? "none" : undefined }
                        }}
                      >
                        <TableCell>
                          {row.TransactionDate
                            ? new Date(row.TransactionDate).toLocaleString("en-PH")
                            : "-"}
                        </TableCell>
                        <TableCell>{row.Type || row.MOP || "-"}</TableCell>
                        <TableCell>{formatPrintPaymentMode(row)}</TableCell>
                        <TableCell>{row.PaymentReceipt || "-"}</TableCell>
                        <TableCell>{formatPrintReference(row)}</TableCell>
                        <TableCell>
                          {row.PaymentDate
                            ? new Date(row.PaymentDate).toLocaleString("en-PH")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {row.DueDate
                            ? new Date(row.DueDate).toLocaleDateString("en-PH")
                            : "-"}
                        </TableCell>
                        <TableCell>{row.NetPlan || "-"}</TableCell>
                        <TableCell>{row.Cover || "-"}</TableCell>
                        <TableCell>PHP {Number(row.TotalAmount || row.Cash || 0).toLocaleString()}</TableCell>
                        <TableCell>PHP {Number(row.Balance || 0).toLocaleString()}</TableCell>
                        <TableCell>{row.CreatedBy || row.CreatedById || "-"}</TableCell>
                        <TableCell>
                          <Tooltip title="Open eReceipt">
                            <span>
                              <IconButton
                                color="success"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenPaymentHistoryEReceipt(row);
                                }}
                              >
                                <ContentCopyIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Reprint Receipt">
                            <span>
                              <IconButton
                                color="primary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleReprintPaymentHistory(row);
                                }}
                              >
                                <ReceiptIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                        {isAdminUser ? (
                          <TableCell>
                            <Tooltip title="Delete Payment History">
                              <span>
                                <IconButton
                                  color="error"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenDeleteHistoryDialog(row);
                                  }}
                                  disabled={!row._id}
                                >
                                  <DeleteOutlineOutlinedIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        ) : null}
                      </TableRow>,
                      earningRows.length && isExpanded ? (
                        <TableRow key={`${historyRowKey}-earnings`}>
                          <TableCell colSpan={isAdminUser ? 15 : 14} sx={{ backgroundColor: "#f8fafc", py: 2 }}>
                            <Typography sx={{ fontWeight: 700, color: "#0f172a", mb: 1 }}>
                              Payment Entries
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Transfer Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Receiver Last 4</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Receipt</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Verified</TableCell>
                                  </TableRow>
                              </TableHead>
                              <TableBody>
                                {earningRows.map((earningRow, index) => (
                                  <TableRow key={earningRow._id || `${historyRowKey}-earning-${index}`}>
                                    <TableCell>{earningRow.MOP || earningRow.PaymentMethod || "-"}</TableCell>
                                    <TableCell>
                                      PHP {Number(earningRow.Cash || earningRow.TotalAmount || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                      {earningRow.MOPRef || earningRow.ReferenceNumber || earningRow.Invoice || "-"}
                                    </TableCell>
                                      <TableCell>{earningRow.TransferDate || "-"}</TableCell>
                                      <TableCell>{earningRow.ReceiverLast4 || "-"}</TableCell>
                                      <TableCell>
                                        {earningRow.ReceiptImage ? (
                                          <Button
                                            variant="text"
                                            size="small"
                                            onClick={() => handleOpenReceiptImagePreview(earningRow.ReceiptImage)}
                                            sx={{ textTransform: "none", minWidth: 0, px: 0, fontWeight: 700 }}
                                          >
                                            View
                                          </Button>
                                        ) : (
                                          "-"
                                        )}
                                      </TableCell>
                                      <TableCell
                                      sx={{
                                        fontWeight: 700,
                                        color: earningRow.Verified ? "#15803d" : "#b45309"
                                      }}
                                    >
                                      {earningRow.Verified ? "VALIDATED" : "PENDING"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      ) : null
                      ];
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid #dbe4ee" }}>
          <Button onClick={handleClosePaymentHistoryModal} sx={{ textTransform: "none", fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openMikrotikStatusModal}
        onClose={handleCloseMikrotikStatusModal}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden"
          }
        }}
      >
        <Box
          sx={{
            background: "linear-gradient(90deg, #312e81, #7c3aed)",
            color: "#fff",
            px: 3.5,
            py: 2.25,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              MikroTik Client Status
            </Typography>
            <Typography sx={{ fontSize: "0.92rem", opacity: 0.9 }}>
              {selectedClient?.AccountName || selectedClient?.ClientName || "Client"}
            </Typography>
          </Box>

          <IconButton onClick={handleCloseMikrotikStatusModal} sx={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 3, backgroundColor: "#f8fafc" }}>
          {mikrotikStatusError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mikrotikStatusError}
            </Alert>
          ) : null}

          {mikrotikStatusLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <Typography>Loading MikroTik status...</Typography>
            </Box>
          ) : mikrotikStatusData ? (
            <Box sx={{ display: "grid", gap: 2.5 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.25,
                  borderRadius: 3,
                  border: "1px solid #dbe4ee",
                  backgroundColor: "#fff"
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 2
                  }}
                >
                  <Box sx={{ display: "grid", gap: 1.25 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>
                      STATUS
                    </Typography>
                    <Chip
                      label={mikrotikStatusData.status || "UNKNOWN"}
                      size="small"
                      sx={{
                        width: "fit-content",
                        fontWeight: 700,
                        ...getStatusChipStyles(mikrotikStatusData.status)
                      }}
                    />
                  </Box>

                  <Box sx={{ display: "grid", gap: 1.25 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>
                      AUTHENTICATION
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      {mikrotikStatusData.authMode || "-"}
                    </Typography>
                  </Box>

                  <Box sx={{ display: "grid", gap: 1.25 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>
                      IP ADDRESS
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      {mikrotikStatusData.ipAddress || "-"}
                    </Typography>
                  </Box>

                  <Box sx={{ display: "grid", gap: 1.25 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>
                      PLAN
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      {mikrotikStatusData.plan || "-"}
                    </Typography>
                  </Box>

                  <Box sx={{ display: "grid", gap: 1.25 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>
                      MAC ADDRESS
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      {mikrotikStatusData.macAddress || "-"}
                    </Typography>
                  </Box>

                  <Box sx={{ display: "grid", gap: 1.25 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>
                      ACCOUNT
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      {mikrotikStatusData.accountName || selectedClient?.AccountName || "-"}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.25,
                  borderRadius: 3,
                  border: "1px solid #dbe4ee",
                  backgroundColor: "#fff"
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    mb: 2
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      OLT Status
                    </Typography>
                    <Typography sx={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Uses the MAC address to check GPON first, then EPON.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => refreshMikrotikStatus(selectedClient?._id)}
                    disabled={mikrotikStatusLoading || mikrotikStatusRefreshing || !selectedClient?._id}
                    sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}
                  >
                    Refresh OLT
                  </Button>
                </Box>

                {mikrotikStatusData?.olt?.error ? (
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    {mikrotikStatusData?.olt?.error}
                  </Alert>
                ) : null}

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                    gap: 1.5
                  }}
                >
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", mb: 0.75 }}>
                      OLT STATUS
                    </Typography>
                    <Chip
                      label={mikrotikStatusData?.olt?.status || "NOT FOUND"}
                      size="small"
                      sx={{
                        width: "fit-content",
                        fontWeight: 700,
                        backgroundColor:
                          String(mikrotikStatusData?.olt?.status || "").toUpperCase().includes("READY") ||
                          String(mikrotikStatusData?.olt?.status || "").toUpperCase().includes("ONLINE")
                            ? "#e8f5e9"
                            : "#fef3c7",
                        color:
                          String(mikrotikStatusData?.olt?.status || "").toUpperCase().includes("READY") ||
                          String(mikrotikStatusData?.olt?.status || "").toUpperCase().includes("ONLINE")
                            ? "#2e7d32"
                            : "#92400e"
                      }}
                    />
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", mb: 0.75 }}>
                      FIBER READ
                    </Typography>
                    <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>
                      {formatOltFiberReadDisplay(mikrotikStatusData?.olt?.fiberRead)}
                    </Typography>
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", mb: 0.75 }}>
                      FIBER STATUS
                    </Typography>
                    <Chip
                      label={mikrotikStatusData?.olt?.fiberStatus || "NO DATA"}
                      size="small"
                      sx={{
                        width: "fit-content",
                        fontWeight: 700,
                        backgroundColor:
                          mikrotikStatusData?.olt?.fiberStatus === "OK"
                            ? "#e8f5e9"
                            : mikrotikStatusData?.olt?.fiberStatus === "CHECK FAILED"
                              ? "#fee2e2"
                              : "#fef3c7",
                        color:
                          mikrotikStatusData?.olt?.fiberStatus === "OK"
                            ? "#2e7d32"
                            : mikrotikStatusData?.olt?.fiberStatus === "CHECK FAILED"
                              ? "#b91c1c"
                              : "#92400e"
                      }}
                    />
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", mb: 0.75 }}>
                      OLT PORT
                    </Typography>
                    <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>
                      {mikrotikStatusData?.olt?.port || "-"}
                    </Typography>
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", mb: 0.75 }}>
                      OLT MAC
                    </Typography>
                    <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>
                      {mikrotikStatusData?.olt?.macAddress || "-"}
                    </Typography>
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", mb: 0.75 }}>
                      SN
                    </Typography>
                    <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>
                      {mikrotikStatusData?.olt?.authInfo || "-"}
                    </Typography>
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", mb: 0.75 }}>
                      TYPE
                    </Typography>
                    <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>
                      {mikrotikStatusData?.olt?.type || "-"}
                    </Typography>
                  </Paper>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.25,
                  borderRadius: 3,
                  border: "1px solid #dbe4ee",
                  backgroundColor: "#fff"
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    mb: 2
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      Ping Test
                    </Typography>
                    <Typography sx={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Auto-refreshes every 5 seconds while this window is open.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => refreshMikrotikStatus(selectedClient?._id, { silent: true })}
                    disabled={mikrotikStatusLoading || mikrotikStatusRefreshing || !selectedClient?._id}
                    sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}
                  >
                    {mikrotikStatusLoading || mikrotikStatusRefreshing ? "Refreshing..." : "Refresh Ping"}
                  </Button>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                    gap: 1.5
                  }}
                >
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", mb: 0.75 }}>
                      STATUS
                    </Typography>
                    <Chip
                      label={mikrotikStatusData.pingStatus || "NO IP"}
                      size="small"
                      sx={{
                        width: "fit-content",
                        fontWeight: 700,
                        backgroundColor:
                          mikrotikStatusData.pingStatus === "REACHABLE"
                            ? "#e8f5e9"
                            : "#fee2e2",
                        color:
                          mikrotikStatusData.pingStatus === "REACHABLE"
                            ? "#2e7d32"
                            : "#b91c1c"
                      }}
                    />
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", mb: 0.75 }}>
                      REPLIES
                    </Typography>
                    <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>
                      {Number(mikrotikStatusData.pingReceived || 0)} / {Number(mikrotikStatusData.pingSent || 0)}
                    </Typography>
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", mb: 0.75 }}>
                      AVERAGE
                    </Typography>
                    <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>
                      {mikrotikStatusData.pingAverageMs !== null && mikrotikStatusData.pingAverageMs !== undefined
                        ? `${mikrotikStatusData.pingAverageMs} ms`
                        : "-"}
                    </Typography>
                  </Paper>
                </Box>
              </Paper>
            </Box>
          ) : (
            <Alert severity="info">No MikroTik status data found.</Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid #dbe4ee" }}>
          <Button
            onClick={handleCloseMikrotikStatusModal}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteHistoryDialog.open}
        onClose={handleCloseDeleteHistoryDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Delete Payment History
          </Alert>
          <Typography sx={{ color: "#334155" }}>
            This will remove the selected payment history record. After deletion, please adjust the client due date.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDeleteHistoryDialog} sx={{ textTransform: "none", fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeletePaymentHistory}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={adjustDueDateDialog.open}
        onClose={handleCloseAdjustDueDateDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Adjust Due Date
          </Alert>
          <Typography sx={{ color: "#334155", mb: 2 }}>
            The payment history was deleted. Please adjust the client due date now.
          </Typography>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="New Due Date"
              value={adjustDueDateDialog.value}
              onChange={(value) =>
                setAdjustDueDateDialog((prev) => ({
                  ...prev,
                  value
                }))
              }
              slotProps={{
                textField: {
                  fullWidth: true
                }
              }}
            />
          </LocalizationProvider>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseAdjustDueDateDialog} sx={{ textTransform: "none", fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveAdjustedDueDate}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Save Due Date
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={overdueDialog.open}
        onClose={handleCloseOverdueDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden"
          }
        }}
      >
        <Box
          sx={{
            background: "linear-gradient(90deg, #9a3412, #ea580c)",
            color: "#fff",
            px: 3,
            py: 2
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Client Already Disconnected
          </Typography>
        </Box>

        <DialogContent sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This client is already {getDaysPastDisconnectionThreshold(overdueDialog.client)} day(s) past the {disconnectAfterDueDays}-day disconnection threshold.
          </Alert>

          <Typography sx={{ mb: 2, color: "#334155" }}>
            Do you want to continue using the same due date, or use today as the new due date before accepting payment? Choosing new date will also add 500 as previous balance.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={handleCloseOverdueDialog}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={handleContinueSameDueDate}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Continue Same Due Date
          </Button>
          <Button
            variant="contained"
            onClick={handleUseNewDueDate}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Use Today As New Date
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={forcedOverdueDialog.open}
        onClose={handleCloseForcedOverdueDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden"
          }
        }}
      >
        <Box
          sx={{
            background: "linear-gradient(90deg, #9a3412, #ea580c)",
            color: "#fff",
            px: 3,
            py: 2
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Client Already Disconnected
          </Typography>
        </Box>

        <DialogContent sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This client is already {getDaysPastDisconnectionThreshold(forcedOverdueDialog.client)} day(s) past the {disconnectAfterDueDays}-day disconnection threshold.
          </Alert>

          <Typography sx={{ color: "#334155" }}>
            The client will have balance in previous. Press OK to continue to the payment modal using today as the new due date.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            variant="contained"
            onClick={handleForcedOverdueContinue}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ClientList;


