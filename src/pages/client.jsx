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
  Switch,
  Tabs,
  Tab,
  CircularProgress
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
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
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
import { useClient } from "../context/client.context";

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
  ...overrides
});

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

const defaultReceiptPrintConfig = {
  Name: "Default Thermal Receipt",
  CompanyName: "DNS NETWORKS",
  ReceiptTitle: "Official Payment Receipt",
  ReceiptSubtitle: "For Xprinter / Thermal Printer",
  FooterNote: "Thank you for your payment.",
  PreferredPrinterName: "Xprinter",
  EnablePrinting: true,
  UseDirectPrint: true,
  ShowSubscriptionCover: true,
  ShowContactNumber: true,
  ShowReference: true,
  ShowCreatedBy: true
};

const QZ_TRAY_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js";
const RECEIPT_PRINTER_STORAGE_KEY = "isp_billing_receipt_printer_name";

const formatReceiptAmount = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const fitReceiptText = (value, maxLength = 32) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? normalized.slice(0, Math.max(maxLength - 3, 1)) + "..."
    : normalized;
};

const createReceiptLine = (label, value, width = 32) => {
  const safeLabel = fitReceiptText(label, width - 8);
  const safeValue = fitReceiptText(value, width - safeLabel.length - 1);
  const gap = Math.max(width - safeLabel.length - safeValue.length, 1);
  return `${safeLabel}${" ".repeat(gap)}${safeValue}`;
};

const buildEscPosReceiptData = (receiptData) => {
  const {
    clientName,
    accountName,
    contactNumber,
    paymentReceipt,
    paymentDate,
    paymentMethod,
    reference,
    amountPaid,
    paymentBreakdown = [],
    subscriptionCover,
    additionalCharge,
    discount,
    totalAmountToPay,
    createdBy,
    notes,
    receiptConfig
  } = receiptData;
  const config = {
    ...defaultReceiptPrintConfig,
    ...(receiptConfig || {})
  };

  const lines = [
    "\x1B\x40",
    "\x1B\x61\x01",
    `${fitReceiptText(config.CompanyName || "DNS NETWORKS")}\n`,
    `${fitReceiptText(config.ReceiptTitle || "Official Payment Receipt")}\n`,
    config.ReceiptSubtitle
      ? `${fitReceiptText(config.ReceiptSubtitle, 32)}\n`
      : "",
    "===============================\n",
    "\x1B\x61\x00",
    `${createReceiptLine("Receipt No.", paymentReceipt)}\n`,
    `${createReceiptLine("Date", paymentDate)}\n`,
    `${createReceiptLine("Client", clientName)}\n`,
    `${createReceiptLine("Account", accountName)}\n`,
    config.ShowContactNumber
      ? `${createReceiptLine("Contact", contactNumber || "-")}\n`
      : "",
    config.ShowSubscriptionCover
      ? `${createReceiptLine("Cover", subscriptionCover || "-")}\n`
      : "",
    "-------------------------------\n",
    `${createReceiptLine("Payment Mode", paymentMethod)}\n`,
    config.ShowReference
      ? `${createReceiptLine("Reference", reference || "-")}\n`
      : "",
    "-------------------------------\n"
  ];

  if (Array.isArray(paymentBreakdown) && paymentBreakdown.length) {
    paymentBreakdown.forEach((entry) => {
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
    "-------------------------------\n",
    `${createReceiptLine("Additional", formatReceiptAmount(additionalCharge || 0))}\n`,
    `${createReceiptLine("Discount", formatReceiptAmount(discount || 0))}\n`,
    `${createReceiptLine("Total Paid", formatReceiptAmount(totalAmountToPay || amountPaid || 0))}\n`,
    "-------------------------------\n",
    config.ShowCreatedBy
      ? `${createReceiptLine("Received by", createdBy || "-")}\n`
      : "",
    `${createReceiptLine("Notes", notes || "-")}\n`,
    "\n",
    "\x1B\x61\x01",
    `${fitReceiptText(config.FooterNote || "Thank you for your payment.", 32)}\n\n\n`,
    "\x1D\x56\x00"
  );

  return lines;
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

const resolveReceiptPrinterName = async (qz, preferredPrinterName = "") => {
  const savedPrinterName =
    typeof window !== "undefined"
      ? window.localStorage.getItem(RECEIPT_PRINTER_STORAGE_KEY) || ""
      : "";

  const candidateNames = [
    preferredPrinterName,
    savedPrinterName,
    "Xprinter",
    "XP-58",
    "XP-80"
  ].filter(Boolean);

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

  if (typeof window !== "undefined") {
    const manualPrinterName = window.prompt(
      "Enter your Xprinter printer name for automatic receipt printing:",
      preferredPrinterName || savedPrinterName || "Xprinter"
    );

    if (manualPrinterName) {
      const printer = await qz.printers.find(manualPrinterName);
      window.localStorage.setItem(RECEIPT_PRINTER_STORAGE_KEY, printer);
      return printer;
    }
  }

  throw new Error("Xprinter printer was not found.");
};

const tryAutoPrintToXprinter = async (receiptData) => {
  const qz = await loadQzTrayScript();

  if (!qz) {
    throw new Error("QZ Tray is not available.");
  }

  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }

  const printerName = await resolveReceiptPrinterName(
    qz,
    receiptData?.receiptConfig?.PreferredPrinterName || ""
  );
  const config = qz.configs.create(printerName);
  const data = buildEscPosReceiptData(receiptData);

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

const resolveBillingAnchorDay = (dueDateValue, preferredDay) => {
  const normalizedPreferredDay = Number(preferredDay) || null;

  if (!dueDateValue) {
    return normalizedPreferredDay;
  }

  const parsedDueDate = new Date(dueDateValue);
  if (Number.isNaN(parsedDueDate.getTime())) {
    return normalizedPreferredDay;
  }

  const dueDay = parsedDueDate.getDate();

  if (!normalizedPreferredDay) {
    return dueDay;
  }

  return normalizedPreferredDay === dueDay ? normalizedPreferredDay : dueDay;
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
  if (Array.isArray(row?.PaymentBreakdown) && row.PaymentBreakdown.length) {
    return row.PaymentBreakdown
      .map((line) => ({
        Method: normalizePaymentLineMethod(line?.Method || line?.PaymentMethod),
        Amount: Number(line?.Amount || 0),
        Reference: String(line?.Reference || "").trim()
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

const openPaymentReceiptPrint = (receiptWindow, receiptData) => {
  if (!receiptWindow) {
    return;
  }

  const {
    clientName,
    accountName,
    contactNumber,
    paymentReceipt,
    paymentDate,
    paymentMethod,
    reference,
    amountPaid,
    paymentBreakdown = [],
    subscriptionCover,
    additionalCharge,
    discount,
    totalAmountToPay,
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

  receiptWindow.document.open();
  receiptWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payment Receipt ${escapeHtml(paymentReceipt)}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 4mm;
      }
      body {
        margin: 0;
        font-family: Consolas, "Courier New", monospace;
        color: #000;
        background: #fff;
      }
      .receipt {
        width: 72mm;
        margin: 0 auto;
        padding: 2mm 0 6mm;
        font-size: 12px;
        line-height: 1.45;
      }
      .center {
        text-align: center;
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
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="center">
        <div class="title">${escapeHtml(config.CompanyName || "DNS NETWORKS")}</div>
        <div>${escapeHtml(config.ReceiptTitle || "Official Payment Receipt")}</div>
        ${
          config.ReceiptSubtitle
            ? `<div class="muted">${escapeHtml(config.ReceiptSubtitle)}</div>`
            : ""
        }
      </div>

      <div class="divider"></div>

      <div class="row"><span class="label">Receipt No.</span><span class="value">${escapeHtml(paymentReceipt)}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${escapeHtml(paymentDate)}</span></div>
      <div class="row"><span class="label">Client</span><span class="value wrap">${escapeHtml(clientName)}</span></div>
      <div class="row"><span class="label">Account</span><span class="value wrap">${escapeHtml(accountName)}</span></div>
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

      <div class="divider"></div>

      <div class="row"><span class="label">Payment Mode</span><span class="value">${escapeHtml(paymentMethod)}</span></div>
      ${
        config.ShowReference
          ? `<div class="row"><span class="label">Reference</span><span class="value wrap">${escapeHtml(reference || "-")}</span></div>`
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

      <div class="center muted">${escapeHtml(config.FooterNote || "Thank you for your payment.")}</div>
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

const createReceiptPayloadFromHistoryRow = (row, receiptConfig = defaultReceiptPrintConfig) => ({
  clientName: row?.ClientName || "",
  accountName: row?.AccountName || "",
  contactNumber: row?.ContactNumber || "",
  paymentReceipt: row?.PaymentReceipt || row?.Invoice || row?.TransactionCode || "-",
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
  additionalCharge: Number(row?.AddCharge || 0),
  discount: Number(row?.Discount || 0),
  totalAmountToPay: Number(row?.TotalAmount || row?.Cash || 0),
  createdBy: row?.CreatedBy || row?.CreatedById || "-",
  notes: row?.Note || row?.Notes || "",
  receiptConfig
});

const getCommentValue = (comment, key) => {
  const match = String(comment || "").match(new RegExp(`${key}=([^;]+)`, "i"));
  return match?.[1]?.trim() || "";
};

const getModemStatusLabel = ({ isIpoeClient, lease }) => {
  if (!isIpoeClient) {
    return "-";
  }

  if (!lease) {
    return "NO MAC FOUND";
  }

  const leaseStatus = String(lease.status || "").trim().toUpperCase();
  const modemPlanValue = getCommentValue(lease.comment, "PLAN").toUpperCase();
  const hasComment = String(lease.comment || "").trim() !== "";

  if (leaseStatus !== "BOUND") {
    return "NOT ACTIVE";
  }

  if (!hasComment || modemPlanValue === "0M/0M") {
    return "HOLD";
  }

  return "ACTIVE";
};

const resolveIpoeLeaseForClient = ({
  client,
  leases = [],
  leaseByMacAddress = {},
  leaseByAccountName = {}
}) => {
  if (!client) {
    return null;
  }

  const normalizedAuthMode = String(
    client.AuthenticationMode || client.authMode || ""
  )
    .trim()
    .toUpperCase();

  if (normalizedAuthMode !== "IPOE") {
    return null;
  }

  const macKey = String(
    client.MacAddress || client.macAddress || ""
  )
    .trim()
    .toUpperCase();
  const accountKey = String(client.AccountName || "")
    .trim()
    .toUpperCase();

  const mappedLease =
    leaseByMacAddress[macKey] || leaseByAccountName[accountKey] || null;

  if (mappedLease) {
    return mappedLease;
  }

  return (
    leases.find((lease) => {
      const leaseCommentName = getCommentValue(lease?.comment, "NAME")
        .trim()
        .toUpperCase();
      return Boolean(accountKey) && leaseCommentName === accountKey;
    }) || null
  );
};

const formatTrafficBytes = (value) => {
  const numericValue = Number(value || 0);

  if (!numericValue) {
    return "0 B";
  }

  if (numericValue >= 1024 ** 3) {
    return `${(numericValue / 1024 ** 3).toFixed(2)} GB`;
  }

  if (numericValue >= 1024 ** 2) {
    return `${(numericValue / 1024 ** 2).toFixed(2)} MB`;
  }

  if (numericValue >= 1024) {
    return `${(numericValue / 1024).toFixed(2)} KB`;
  }

  return `${numericValue} B`;
};

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
  const { clients, clientMeta, fetchClients, addClient, loading } = useClient();

  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const currentUserType = String(
    currentUser?.type || currentUser?.role || ""
  ).trim().toUpperCase();
  const isAdminUser = currentUserType === "ADMIN";

  const [netPlans, setNetPlans] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");

  const [menu, setMenu] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  const [openModal, setOpenModal] = useState(false);
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [paymentReceiptLoading, setPaymentReceiptLoading] = useState(false);
  const [openPaymentEntriesModal, setOpenPaymentEntriesModal] = useState(false);
  const [openBillingModal, setOpenBillingModal] = useState(false);
  const [openPaymentHistoryModal, setOpenPaymentHistoryModal] = useState(false);
  const [openMikrotikStatusModal, setOpenMikrotikStatusModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [repairDialog, setRepairDialog] = useState({
    open: false,
    technicianId: "",
    repairText: ""
  });
  const [technicians, setTechnicians] = useState([]);
  const [repairSmsTemplate, setRepairSmsTemplate] = useState(null);
  const [repairSaving, setRepairSaving] = useState(false);

  const [newClient, setNewClient] = useState(getDefaultNewClientForm());
  const [dhcpLeaseOptions, setDhcpLeaseOptions] = useState([]);
  const [loadingDhcpLeases, setLoadingDhcpLeases] = useState(false);
  const [dhcpLeaseComments, setDhcpLeaseComments] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    AmountPaid: "",
    PaymentDate: getTodayLocalDate(),
    ReferenceNumber: "",
    Invoice: "",
    Notes: "",
    AdditionalCharge: "",
    Discount: "",
    ContactNumber: "",
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
  const [receiptPrintConfig, setReceiptPrintConfig] = useState(defaultReceiptPrintConfig);
  const [messageBox, setMessageBox] = useState({
    open: false,
    title: "",
    message: "",
    severity: "info"
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
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [billingHistoryRows, setBillingHistoryRows] = useState([]);
  const [mikrotikStatusLoading, setMikrotikStatusLoading] = useState(false);
  const [mikrotikStatusError, setMikrotikStatusError] = useState("");
  const [mikrotikStatusData, setMikrotikStatusData] = useState(null);
  const [deleteHistoryDialog, setDeleteHistoryDialog] = useState({
    open: false,
    row: null
  });
  const [adjustDueDateDialog, setAdjustDueDateDialog] = useState({
    open: false,
    value: null,
    row: null
  });
  const loadClients = useCallback(() => {
    return fetchClients({
      status: statusFilter,
      search: debouncedSearch,
      page: page + 1,
      limit: rowsPerPage
    });
  }, [fetchClients, statusFilter, debouncedSearch, page, rowsPerPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, debouncedSearch]);

  const selectedRepairTechnician = technicians.find(
    (user) => String(user.ID || "") === String(repairDialog.technicianId)
  );
  const repairSmsPreview = repairSmsTemplate?.Body
    ? replaceTemplateTokens(repairSmsTemplate.Body, {
        TechnicianName: selectedRepairTechnician?.Name || "",
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
  const repairDetailsDisplayValue = repairSmsPreview || repairDialog.repairText;

  const refreshDhcpLeaseComments = useCallback(async () => {
    try {
      const res = await API.get("/dhcp-leases-all");
      setDhcpLeaseComments(res.data || []);
    } catch (err) {
      console.error("DHCP LEASE COMMENT FETCH ERROR:", err);
      setDhcpLeaseComments([]);
    }
  }, []);

  const loadReceiptPrintConfig = async () => {
    try {
      const { data } = await API.get("/print-receipt");
      setReceiptPrintConfig({
        ...defaultReceiptPrintConfig,
        ...(data || {})
      });
    } catch (err) {
      console.error("PRINT RECEIPT CONFIG LOAD ERROR:", err);
      setReceiptPrintConfig(defaultReceiptPrintConfig);
    }
  };

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    API
      .get("/netplans")
      .then((res) => setNetPlans(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
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
      refreshDhcpLeaseComments();
    };

    socket.on("clients:changed", handleClientsChanged);

    return () => {
      socket.off("clients:changed", handleClientsChanged);
      socket.disconnect();
    };
  }, [loadClients, refreshDhcpLeaseComments]);

  useEffect(() => {
    const refreshActiveClientView = () => {
      if (document.hidden) {
        return;
      }

      loadClients();
      refreshDhcpLeaseComments();
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
  }, [loadClients, refreshDhcpLeaseComments]);

  useEffect(() => {
      const selectedClientOverdueDays = getClientOverdueDays(selectedClient);
      const selectedClientLease = resolveIpoeLeaseForClient({
        client: selectedClient,
        leases: dhcpLeaseComments,
        leaseByMacAddress: modemLeaseByMacAddress,
        leaseByAccountName: modemLeaseByAccountName
      });
      const selectedClientAuthMode = getNormalizedAuthMode(
        paymentForm.ReconnectAuthMode || selectedClient?.AuthenticationMode
      );
      const paymentHasActiveIpoeLease =
        selectedClientAuthMode === "IPOE" &&
        getModemStatusLabel({
          isIpoeClient: true,
          lease: selectedClientLease
        }) === "ACTIVE";
      const paymentNeedsReconnectFlow =
        !paymentHasActiveIpoeLease &&
        (
          isDisconnectedPlan(selectedClient) ||
          Boolean(paymentForm.ReconnectRequired) ||
          selectedClientOverdueDays >= 15
        );
      const paymentNeedsDhcp =
        openPaymentModal &&
        getNormalizedAuthMode(
          paymentForm.ReconnectAuthMode || selectedClient?.AuthenticationMode
        ) === "IPOE" &&
      paymentNeedsReconnectFlow;

    if ((!openModal || newClient.AuthenticationMode !== "IPOE") && !paymentNeedsDhcp) {
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
    dhcpLeaseComments,
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
  const modemLeaseByAccountName = dhcpLeaseComments.reduce((acc, lease) => {
    const accountName = getCommentValue(lease.comment, "NAME").toUpperCase();

    if (accountName) {
      acc[accountName] = lease;
    }

    return acc;
  }, {});
  const modemLeaseByMacAddress = dhcpLeaseComments.reduce((acc, lease) => {
    const macAddress = String(
      lease.macAddress || lease["mac-address"] || ""
    ).trim().toUpperCase();

    if (macAddress) {
      acc[macAddress] = lease;
    }

    return acc;
  }, {});
  const modalAccountNameKey = String(newClient.AccountName || "").trim().toUpperCase();
  const modalMacKey = String(newClient.MacAddress || "").trim().toUpperCase();
  const modalLease =
      modemLeaseByMacAddress[modalMacKey] ||
      modemLeaseByAccountName[modalAccountNameKey] ||
      null;
  const modalIsIpoeClient = selectedAuthMode === "IPOE";
  const modalModemStatus = getModemStatusLabel({
    isIpoeClient: modalIsIpoeClient,
    lease: modalLease
  });
  const modalLeaseMacAddress = String(
    modalLease?.macAddress || modalLease?.["mac-address"] || ""
  ).trim().toUpperCase();
  const modalLeaseIpAddress = String(
    modalLease?.address || modalLease?.["active-address"] || ""
  ).trim();
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
  const clientMapAddress = String(
    newClient.Address || selectedClient?.Address || ""
  ).trim();
  const encodedClientMapAddress = encodeURIComponent(clientMapAddress);
  const clientMapEmbedUrl = hasClientMapCoordinates
    ? `https://maps.google.com/maps?q=${encodeURIComponent(`${clientMapLatitude},${clientMapLongitude}`)}&z=17&output=embed`
    : clientMapAddress
      ? `https://maps.google.com/maps?q=${encodedClientMapAddress}&z=15&output=embed`
      : "";
  const clientMapOpenUrl = hasClientMapCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clientMapLatitude},${clientMapLongitude}`)}`
    : clientMapAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodedClientMapAddress}`
      : "";
  const mikrotikStatusRxBytes = Number(mikrotikStatusData?.rxBytes || 0);
  const mikrotikStatusTxBytes = Number(mikrotikStatusData?.txBytes || 0);
  const mikrotikTrafficPeak = Math.max(
    mikrotikStatusRxBytes,
    mikrotikStatusTxBytes,
    1
  );
  const mikrotikRxWidth = `${Math.max(
    12,
    Math.round((mikrotikStatusRxBytes / mikrotikTrafficPeak) * 100)
  )}%`;
  const mikrotikTxWidth = `${Math.max(
    12,
    Math.round((mikrotikStatusTxBytes / mikrotikTrafficPeak) * 100)
  )}%`;

  const activeCount = Number(clientMeta?.activeCount || 0);
  const disconnectedCount = Number(clientMeta?.disconnectedCount || 0);

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

  const handleOpenBillingModal = async (client) => {
    if (!client) return;

    setSelectedClient(client);
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
  };

  const handleBilling = () => {
    handleOpenBillingModal(selectedClient);
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

  const openPaymentModalForClient = async (client, options = {}) => {
    const paymentDate = getTodayLocalDate();
    const reconnectAuthMode = getNormalizedAuthMode(
      client?.PreviousAuthenticationMode || client?.AuthenticationMode
    );
    const previousReconnectPlan = resolvePreviousReconnectPlan({
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
      ReconnectRequired: Boolean(options.reconnectRequired),
      ReconnectAuthMode: reconnectAuthMode,
      ReconnectPlan: getPlanName(previousReconnectPlan) || "",
      ReconnectCharge: previousReconnectPlan ? getPlanPrice(previousReconnectPlan) : 0,
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

    if (overdueDays >= 15) {
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
  };

  const handleOpenMikrotikStatusModal = async (client) => {
    if (!client?._id) {
      return;
    }

    try {
      setSelectedClient(client);
      setOpenMikrotikStatusModal(true);
      setMikrotikStatusLoading(true);
      setMikrotikStatusError("");
      setMikrotikStatusData(null);

      const { data } = await API.get(`/clients/${client._id}/mikrotik-status`);
      setMikrotikStatusData(data || null);
    } catch (err) {
      console.error("MIKROTIK STATUS ERROR:", err.response?.data || err.message);
      setMikrotikStatusError(
        err.response?.data?.error || "Failed to load MikroTik client status."
      );
    } finally {
      setMikrotikStatusLoading(false);
    }
  };

  const handleCloseMikrotikStatusModal = () => {
    setOpenMikrotikStatusModal(false);
    setMikrotikStatusLoading(false);
    setMikrotikStatusError("");
    setMikrotikStatusData(null);
  };

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
      row: null
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
    if (!selectedClient?._id || !adjustDueDateDialog.value) {
      showMessage("Due Date Required", "Please choose a due date before saving.", "warning");
      return;
    }

    try {
      const dueDateValue = adjustDueDateDialog.value.toDate();
      const subscriptionCover = String(dueDateValue.getDate());

      await API.put(`/clients/${selectedClient._id}/due-date`, {
        DueDate: dueDateValue.toISOString(),
        SubscriptionCover: subscriptionCover
      });

      setSelectedClient((prev) =>
        prev
          ? {
              ...prev,
              DueDate: dueDateValue.toISOString(),
              SubscriptionCover: subscriptionCover
            }
          : prev
      );

      await Promise.allSettled([loadClients(), refreshDhcpLeaseComments()]);
      handleCloseAdjustDueDateDialog();
      handleClosePaymentHistoryModal();
      showMessage(
        "Delete Completed",
        "Payment history was deleted and the client due date was updated successfully.",
        "success"
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
    const previousReconnectPlan = resolvePreviousReconnectPlan({
      client: selectedClient,
      netPlans,
      authMode: nextAuthMode
    });

    setPaymentForm((prev) => ({
      ...prev,
      ReconnectAuthMode: nextAuthMode,
      ReconnectPlan: getPlanName(previousReconnectPlan) || "",
      ReconnectCharge: previousReconnectPlan ? getPlanPrice(previousReconnectPlan) : 0,
      ReconnectMacAddress:
        nextAuthMode === "IPOE"
          ? String(selectedClient?.PreviousMacAddress || prev.ReconnectMacAddress || "")
              .trim()
              .toUpperCase()
          : ""
    }));
  };

  const extractReferenceNumber = (text) => {
    const cleaned = text.replace(/\r/g, " ").replace(/\n/g, " ");
    const labelMatch = cleaned.match(
      /(reference(?:\s*number)?|ref(?:\s*no\.?)?|rrn|trace(?:\s*no\.?)?)\s*[:#-]?\s*([A-Z0-9\s-]{6,40})/i
    );

    if (labelMatch?.[2]) {
      const tail = String(labelMatch[2]).trim();
      const digitGroups = tail.match(/\d[\d\s-]{5,30}/g) || [];

      for (const group of digitGroups) {
        const candidate = group.replace(/[^\d]/g, "").trim();

        if (
          candidate.length >= 6 &&
          !looksLikeDateOrTimeReference(candidate)
        ) {
          return candidate;
        }
      }

      const compactCandidate = tail.replace(/[^A-Z0-9]/gi, "").trim();
      if (
        compactCandidate.length >= 6 &&
        /\d/.test(compactCandidate) &&
        !looksLikeDateOrTimeReference(compactCandidate)
      ) {
        return compactCandidate;
      }
    }

    const groupedDigitMatch = cleaned.match(/(?:\d[\s-]?){8,20}/g) || [];
    const groupedDigitReference = groupedDigitMatch
      .map((value) => value.replace(/[^\d]/g, "").trim())
      .find((value) => value.length >= 8 && !looksLikeDateOrTimeReference(value));

    if (groupedDigitReference) {
      return groupedDigitReference;
    }

    const genericMatches = [
      ...cleaned.matchAll(/\b([A-Z0-9][A-Z0-9-]{5,24})\b/g)
    ]
      .map((match) => String(match[1] || "").replace(/[^A-Z0-9]/gi, ""))
      .filter(
        (value) =>
          /[A-Z]/i.test(value) &&
          /\d/.test(value) &&
          !looksLikeDateOrTimeReference(value)
      );

    return genericMatches[0] || "";
  };

  const extractAmount = (text) => {
    const cleaned = text.replace(/,/g, "");
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
    const cleaned = String(text || "").replace(/\r/g, " ").replace(/\n/g, " ");
    const monthNameMatch = cleaned.match(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{1,2},?\s*\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)\b/i
    );

    if (monthNameMatch?.[0]) {
      return String(monthNameMatch[0]).replace(/\s+/g, " ").trim();
    }

    const slashDateTimeMatch = cleaned.match(
      /\b\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)\b/i
    );

    if (slashDateTimeMatch?.[0]) {
      return String(slashDateTimeMatch[0]).replace(/\s+/g, " ").trim();
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
      const result = await Tesseract.recognize(file, "eng");
      const ocrText = result.data.text || "";
      const extractedRef = extractReferenceNumber(ocrText);
      const extractedAmount = extractAmount(ocrText);
      const extractedTransferDate = extractTransferDate(ocrText);
        const extractedReceiverLast4 = extractReceiverLast4(ocrText);
        const detectedMethod = detectPaymentMethodFromText(ocrText);
      const normalizedExtractedRef = String(extractedRef || "").trim().toUpperCase();

      if (
        detectedMethod !== "CASH" &&
        normalizedExtractedRef &&
        paymentEntries.some(
          (entry) =>
            normalizePaymentLineMethod(entry?.method) !== "CASH" &&
            String(entry?.reference || "").trim().toUpperCase() === normalizedExtractedRef
        )
      ) {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setReceiptPreview("");
        setOcrLoading(false);
        setOcrMessage(`Duplicate reference not allowed: ${normalizedExtractedRef}`);
        showMessage(
          "Duplicate Reference Not Allowed",
          `Reference ${normalizedExtractedRef} already exists in the current payment entries.`,
          "warning"
        );
        return;
      }

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
          receiptImageUrl: previewUrl
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
        setOcrMessage("No receipt details detected. You can type them manually.");
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
      repairText: ""
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
      repairText: ""
    });
    setRepairSaving(false);
  };

  const handleSaveRepairRequest = async () => {
    if (!selectedClient?._id) {
      showMessage("No Client Selected", "Please select a client first.", "warning");
      return;
    }

    if (!repairDialog.technicianId) {
      showMessage("Technician Required", "Please choose a technician.", "warning");
      return;
    }

    if (!repairDialog.repairText.trim() && !repairSmsTemplate?.Body) {
      showMessage("Repair Details Required", "Please enter the repair details.", "warning");
      return;
    }

    try {
      setRepairSaving(true);

      const { data } = await API.post(`/clients/${selectedClient._id}/repair`, {
        technicianId: repairDialog.technicianId,
        technicianName: selectedRepairTechnician?.Name || "",
        repairText: repairDialog.repairText.trim()
      });

      handleCloseRepairDialog();
      const smsSent = Boolean(data?.smsResult?.sent);
      showMessage(
        smsSent ? "Repair SMS Sent" : "Repair SMS Skipped",
        smsSent
          ? `Repair request for ${selectedClient.AccountName || selectedClient.ClientName || "client"} was sent to ${selectedRepairTechnician?.Name || "the selected technician"}.`
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
      if (url) {
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
      await Promise.allSettled([loadClients(), refreshDhcpLeaseComments()]);
      handleCloseModal();
      setNewClient(getDefaultNewClientForm());
    } catch (err) {
      console.error(err);
      showMessage("Save Failed", "Failed to save client.", "error");
    }
  };

  const handleUpdateClient = async () => {
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

      if (overdueDays > 15) {
        showMessage(
          "Update Not Allowed",
          "You can't update this client because the due date is already more than 15 days overdue. Need to pay first before updating the client.",
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

      await API.put(
        `/clients/${selectedClient._id}`,
        payload
      );

      await Promise.allSettled([loadClients(), refreshDhcpLeaseComments()]);
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

    if (selectedAuthMode !== "IPOE") {
      showMessage("Pull Out Not Available", "Pull OUT is available for IPOE clients only.", "warning");
      return;
    }

    if (!["HOLD", "NOT ACTIVE"].includes(modalModemStatus)) {
      showMessage(
        "Pull Out Not Allowed",
        "Pull OUT is only allowed when the modem status is HOLD or NOT ACTIVE.",
        "warning"
      );
      return;
    }

    try {
      const todayText = dayjs().format("MM/DD/YYYY");
      const existingNote = String(newClient.Note || "").trim();
      const pullOutNote = `Client pull out ${todayText}`;

      const payload = {
        ...newClient,
        MacAddress: "",
        Profile: "disconnection",
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

      await Promise.allSettled([loadClients(), refreshDhcpLeaseComments()]);
      handleCloseModal();
      setEditMode(false);
      setNewClient(getDefaultNewClientForm());
      showMessage("Client Pulled Out", "The IPOE client has been pulled out successfully.", "success");
    } catch (err) {
      console.error("PULL OUT ERROR:", err.response?.data || err.message);
      showMessage(
        "Pull Out Failed",
        err.response?.data?.error || "Failed to pull out client.",
        "error"
      );
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

    setOpenModal(false);
    setEditMode(false);
    resetForm();
  };

  const handleClosePaymentModal = (event, reason) => {
    if (reason === "backdropClick") return;

    setOpenPaymentModal(false);
    setPaymentReceiptLoading(false);
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
  const paymentSelectedClientLease = resolveIpoeLeaseForClient({
    client: selectedClient,
    leases: dhcpLeaseComments,
    leaseByMacAddress: modemLeaseByMacAddress,
    leaseByAccountName: modemLeaseByAccountName
  });
  const paymentSelectedClientModemStatus = getModemStatusLabel({
    isIpoeClient: paymentSelectedAuthMode === "IPOE",
    lease: paymentSelectedClientLease
  });
  const paymentHasActiveIpoeLease =
    paymentSelectedAuthMode === "IPOE" &&
    paymentSelectedClientModemStatus === "ACTIVE";
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
      !paymentHasActiveIpoeLease &&
      (
        isDisconnectedPlan(selectedClient) ||
        Boolean(paymentForm.ReconnectRequired) ||
        paymentOverdueDays >= 15
      );
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
      receiverLast4: String(entry?.receiverLast4 || "").trim()
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
  const uniquePaymentMethods = [...new Set(normalizedPaymentEntries.map((entry) => entry.method))];
  const nonCashReferences = normalizedPaymentEntries
    .filter((entry) => entry.method !== "CASH" && entry.reference)
    .map((entry) => entry.reference);
  const uniqueNonCashReferences = [...new Set(nonCashReferences)];
  const topLevelPaymentMethod =
    uniquePaymentMethods.length === 1
      ? uniquePaymentMethods[0]
      : normalizedPaymentEntries.length > 1
        ? "MULTIPLE"
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
    selectedClient?.SubscriptionCover
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

  const nextDueDateDisplay = dueDateValue
    ? (() => {
        const nextDueDate = addOneMonthToDate(dueDateValue, subscriptionAnchorDay);
        return nextDueDate
          ? new Date(nextDueDate).toLocaleDateString("en-PH", {
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

        return {
          ...entry,
          [field]: value
        };
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
    const receiptPayload = createReceiptPayloadFromHistoryRow(row, receiptPrintConfig);

    if (!receiptPrintConfig?.EnablePrinting) {
      showMessage("Printing Disabled", "Receipt printing is disabled in Print Receipt settings.", "info");
      return;
    }

    if (receiptPrintConfig?.UseDirectPrint) {
      try {
        await tryAutoPrintToXprinter(receiptPayload);
        return;
      } catch (printError) {
        console.error("PAYMENT HISTORY REPRINT ERROR:", printError.message || printError);
      }
    }

    const receiptWindow =
      typeof window !== "undefined"
        ? window.open("", "_blank", "width=420,height=900")
        : null;
    openPaymentReceiptPrint(receiptWindow, receiptPayload);
  };

  const handleSavePayment = async () => {
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

    if (!selectedClient?._id) {
      showMessage("No Client Selected", "Please select a client first.", "warning");
      return;
    }

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

    const duplicateReferenceInCurrentSave = normalizedPaymentEntries
      .filter((entry) => entry.method !== "CASH" && entry.reference)
      .map((entry) => entry.reference.toUpperCase())
      .find((reference, index, refs) => refs.indexOf(reference) !== index);

    if (duplicateReferenceInCurrentSave) {
      showMessage(
        "Duplicate Reference Not Allowed",
        `Reference ${duplicateReferenceInCurrentSave} is already used in another payment entry in this same transaction.`,
        "warning"
      );
      return;
    }

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
          return;
        }

        if (documentError.response?.status === 400) {
          showMessage(
            "Invalid Payment Reference",
            documentError.response?.data?.error ||
              "Payment receipt or sales invoice is required.",
            "warning"
          );
          return;
        }

          throw documentError;
        }

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
          const refs = Array.isArray(validationError.response?.data?.refs)
            ? validationError.response.data.refs
            : [];
          const exceededRef = refs.find((item) => item.exceeds);
          const usedByAccounts = exceededRef?.usedByAccounts?.length
            ? ` Already used by: ${exceededRef.usedByAccounts.join(", ")}.`
            : "";

          showMessage(
            "Duplicate Reference Error",
            `${validationError.response?.data?.error || "One or more non-cash references already exceed the allowed receipt amount."}${usedByAccounts}`,
            "error"
          );
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

    try {
      const balance = totalAmountToPay - amountPaid;
      const existingNote = selectedClient.Note ? `${selectedClient.Note}\n` : "";
      const paymentNote = paymentForm.Notes
        ? `${existingNote}Payment ${paymentForm.PaymentDate}: ${paymentForm.Notes}`
        : selectedClient.Note || "";
      const transactionDateTime = new Date();
        const billingAnchorDay =
          resolveBillingAnchorDay(
            selectedClient?.DueDate || paymentForm.PaymentDate,
            selectedClient?.SubscriptionCover || paymentForm.SubscriptionCover
          ) ||
          null;
        const nextDueDateDate =
          addOneMonthToDate(selectedClient.DueDate, billingAnchorDay) ||
          addOneMonthToDate(paymentForm.PaymentDate, billingAnchorDay) ||
          transactionDateTime;
        const nextDueDateIso = nextDueDateDate.toISOString();
        const nextSubscriptionCover = String(
          billingAnchorDay || nextDueDateDate.getDate()
        );
        const createdByName =
          currentUser?.name || currentUser?.username || currentUser?.Name || "";
        const createdById = currentUser?.id || currentUser?._id || currentUser?.ID || null;

      const earningPayload = {
        AccountName: selectedClient.AccountName || "",
        Invoice: salesInvoiceNumber,
        Item: "ISP-Client Payment",
        MOP: topLevelPaymentMethod,
        MOPRef: topLevelPaymentReference,
        Cash: amountPaid,
        CashAmount: cashPaymentAmount,
        GCashAmount: gcashPaymentAmount,
        PaymentBreakdown: paymentBreakdown,
          TransferDate: topLevelTransferDate,
          GCashTransferDate: topLevelTransferDate,
          ReceiverLast4: topLevelReceiverLast4,
          GCashReceiverLast4: topLevelReceiverLast4,
        DeclaredBy: createdByName || createdById,
        DeclaredById: createdById,
        TransactionDate: transactionDateTime
      };

      const transactionPayload = {
        ClientId: selectedClient._id,
        AccountName: selectedClient.AccountName || "",
        AccountNumber: selectedClient.AccountNumber || "",
        ClientName: selectedClient.ClientName || "",
        Address: selectedClient.Address || "",
        ConnectionType: selectedClient.ConnectionType || "FIBER OPTIC",
        NetPlan: selectedClient.NetPlan || "",
        ServerLocation: selectedClient.ServerLocation || "",
        Type: "Payment",
        PaymentMethod: topLevelPaymentMethod,
        MOP: topLevelPaymentMethod,
        MOPRef: topLevelPaymentReference,
        ReferenceNumber: topLevelPaymentReference,
          TransferDate: topLevelTransferDate,
          GCashTransferDate: topLevelTransferDate,
          ReceiverLast4: topLevelReceiverLast4,
          GCashReceiverLast4: topLevelReceiverLast4,
        Verified: false,
        CashAmount: cashPaymentAmount,
        GCashAmount: gcashPaymentAmount,
        PaymentBreakdown: paymentBreakdown,
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
        DueDate: selectedClient.DueDate || null,
        PaymentDate: paymentForm.PaymentDate,
        DcDate: null,
        Cover: subscriptionCoveredText || selectedClient.SubscriptionCover || "",
        CreatedBy: createdByName || createdById,
        CreatedById: createdById,
        createdAt: transactionDateTime,
        updatedAt: transactionDateTime
      };

      await API.post("/earnings", earningPayload);
      await API.post(
        "/transactions",
        transactionPayload
      );

      await API.put(
        `/clients/${selectedClient._id}`,
        {
          ...selectedClient,
          ContactNumber: paymentForm.ContactNumber,
          AuthenticationMode: reconnectPlan
            ? paymentSelectedAuthMode || selectedClient.AuthenticationMode
            : selectedClient.AuthenticationMode,
          Profile: reconnectPlan
            ? paymentSelectedAuthMode === "PPPOE"
              ? selectedClient.PreviousProfile || getPlanName(reconnectPlan) || selectedClient.Profile
              : getPlanName(reconnectPlan) || selectedClient.Profile
            : selectedClient.Profile,
          NetPlan: reconnectPlan
            ? selectedClient.PreviousNetPlan || getPlanSpeed(reconnectPlan) || getPlanName(reconnectPlan) || selectedClient.NetPlan
            : selectedClient.NetPlan,
          AmountDue: reconnectPlan ? getPlanPrice(reconnectPlan) : selectedClient.AmountDue,
          Status: reconnectPlan ? "ACTIVE" : selectedClient.Status,
          MacAddress:
            reconnectPlan
              ? paymentSelectedAuthMode === "IPOE"
                ? paymentReconnectMacAddress
                : ""
              : selectedClient.MacAddress,
          PreviousAuthenticationMode: reconnectPlan ? "" : selectedClient.PreviousAuthenticationMode,
          PreviousProfile: reconnectPlan ? "" : selectedClient.PreviousProfile,
          PreviousNetPlan: reconnectPlan ? "" : selectedClient.PreviousNetPlan,
          PreviousMacAddress: reconnectPlan ? "" : selectedClient.PreviousMacAddress,
          AmountPaid: amountPaid,
          CashAmount: cashPaymentAmount,
          GCashAmount: gcashPaymentAmount,
          PaymentBreakdown: paymentBreakdown,
          Balance: balance,
          PaymentDate: paymentForm.PaymentDate,
          PaymentMethod: topLevelPaymentMethod,
          ReferenceNumber: topLevelPaymentReference,
          PaymentStatus: balance <= 0 ? "PAID" : "PARTIAL",
          DueDate: nextDueDateIso,
          SubscriptionCover: nextSubscriptionCover,
          Note: paymentNote
        }
      );

      await Promise.allSettled([loadClients(), refreshDhcpLeaseComments()]);
      const receiptPayload = {
        clientName: selectedClient.ClientName || "",
        accountName: selectedClient.AccountName || "",
        contactNumber: paymentForm.ContactNumber || selectedClient.ContactNumber || "",
        paymentReceipt: paymentReceiptNumber,
        paymentDate: new Date(transactionDateTime).toLocaleString("en-PH"),
        paymentMethod: topLevelPaymentMethod,
        reference: topLevelPaymentReference,
        amountPaid,
        paymentBreakdown,
        subscriptionCover: subscriptionCoveredText || selectedClient.SubscriptionCover || "-",
        additionalCharge,
        discount,
        totalAmountToPay,
        createdBy: createdByName || createdById,
        notes: paymentForm.Notes || "",
        receiptConfig: receiptPrintConfig
      };
      handleClosePaymentModal();

      try {
        const { data: smsResult } = await API.post("/sms/send-payment-received", {
          client: {
            ClientName: selectedClient.ClientName || "",
            AccountName: selectedClient.AccountName || "",
            AccountNumber: selectedClient.AccountNumber || "",
            ContactNumber: paymentForm.ContactNumber || selectedClient.ContactNumber || ""
          },
          amountPaid,
          monthlyDue: reconnectPlan ? getPlanPrice(reconnectPlan) : selectedClient.AmountDue,
          subscriptionCover: subscriptionCoveredText || selectedClient.SubscriptionCover || "",
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

      if (receiptPrintConfig?.EnablePrinting) {
        try {
          if (receiptPrintConfig?.UseDirectPrint) {
            try {
              await tryAutoPrintToXprinter(receiptPayload);
            } catch (printError) {
              console.error("XPRINTER AUTO PRINT ERROR:", printError.message || printError);
              const receiptWindow =
                typeof window !== "undefined"
                  ? window.open("", "_blank", "width=420,height=900")
                  : null;
              openPaymentReceiptPrint(receiptWindow, receiptPayload);
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
      console.error("PAYMENT ERROR:", err.response?.data || err.message);
      showMessage("Payment Failed", "Failed to save payment.", "error");
    }
  };

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
          <Tab value="ACTIVE" label={`Active (${activeCount})`} />
          <Tab
            value="DISCONNECTED"
            label={`Disconnected (${disconnectedCount})`}
          />
        </Tabs>

        <Tooltip title="Add Client">
          <IconButton
            color="primary"
            onClick={() => setOpenModal(true)}
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

        <TableContainer
          component={Paper}
          sx={{
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
                "Status Modem",
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
              const accountNameKey = String(c.AccountName || "").trim().toUpperCase();
              const macKey = String(c.MacAddress || "").trim().toUpperCase();
              const modemLease =
                modemLeaseByMacAddress[macKey] ||
                modemLeaseByAccountName[accountNameKey] ||
                null;
              const isIpoeClient =
                String(c.AuthenticationMode || "").trim().toUpperCase() === "IPOE";
              const modemStatus = getModemStatusLabel({
                isIpoeClient,
                lease: modemLease
              });

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
                      label={modemStatus}
                      size="small"
                      sx={{
                        borderRadius: "999px",
                        backgroundColor:
                          modemStatus === "ACTIVE"
                            ? "#e8f5e9"
                            : modemStatus === "HOLD"
                              ? "#fff7ed"
                            : modemStatus === "NOT ACTIVE"
                                ? "#fee2e2"
                                : modemStatus === "NO MAC FOUND"
                                  ? "#e5e7eb"
                              : modemStatus === "DEACTIVE"
                                ? "#fee2e2"
                                : "#f1f5f9",
                        color:
                          modemStatus === "ACTIVE"
                            ? "#2e7d32"
                            : modemStatus === "HOLD"
                              ? "#c2410c"
                            : modemStatus === "NOT ACTIVE"
                                ? "#b91c1c"
                                : modemStatus === "NO MAC FOUND"
                                  ? "#374151"
                              : modemStatus === "DEACTIVE"
                                ? "#b91c1c"
                                : "#475569",
                        fontWeight: 700,
                        px: 0.5
                      }}
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Tooltip title="Update">
                      <IconButton
                        sx={{ "&:hover": { color: "#1976d2" } }}
                        onClick={() => {
                          setEditMode(true);
                          setSelectedClient(c);
                          setNewClient({
                            ...c,
                            MacAddress: c.MacAddress || c.macAddress || "",
                            AmountDue: c.AmountDue ?? "",
                            DueDate: c.DueDate ? formatDateToMMDDYYYY(c.DueDate) : "",
                            SubscriptionCover: c.DueDate
                              ? String(new Date(c.DueDate).getDate())
                              : c.SubscriptionCover || ""
                          });
                          setOpenModal(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Billing">
                      <IconButton
                        sx={{ "&:hover": { color: "#0288d1" } }}
                        onClick={() => handleOpenBillingModal(c)}
                      >
                        <ReceiptIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Pay">
                      <IconButton
                        sx={{ "&:hover": { color: "#2e7d32" } }}
                        onClick={() => handleOpenPaymentModal(c)}
                      >
                        <PaymentIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Payment History">
                      <IconButton
                        sx={{ "&:hover": { color: "#7c3aed" } }}
                        onClick={() => handleOpenPaymentHistoryModal(c)}
                      >
                        <HistoryEduOutlinedIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="SMS">
                      <IconButton
                        sx={{ "&:hover": { color: "#0f766e" } }}
                        onClick={() => handleResendPaymentReceivedSms(c)}
                      >
                        <SmsOutlinedIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Repair">
                      <IconButton
                        sx={{ "&:hover": { color: "#ea580c" } }}
                        onClick={() => handleOpenRepairDialog(c)}
                      >
                        <BuildCircleOutlinedIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Router">
                      <IconButton
                        sx={{ "&:hover": { color: "#6a1b9a" } }}
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
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 1, mt: 1.25 }}>
                <TextField
                  label="Password"
                  name="Password"
                  fullWidth
                  value={newClient.Password || ""}
                  InputProps={{ readOnly: true }}
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

              <Box
                sx={{
                  mt: 1.2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap"
                }}
              >
                <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>
                  Status Modem
                </Typography>
                <Chip
                  label={modalModemStatus}
                  size="small"
                  sx={{
                    borderRadius: "999px",
                    backgroundColor:
                      modalModemStatus === "ACTIVE"
                        ? "#e8f5e9"
                        : modalModemStatus === "HOLD"
                          ? "#fff7ed"
                        : modalModemStatus === "NOT ACTIVE"
                            ? "#fee2e2"
                            : modalModemStatus === "NO MAC FOUND"
                              ? "#e5e7eb"
                          : modalModemStatus === "DEACTIVE"
                            ? "#fee2e2"
                            : "#f1f5f9",
                    color:
                      modalModemStatus === "ACTIVE"
                        ? "#2e7d32"
                        : modalModemStatus === "HOLD"
                          ? "#c2410c"
                        : modalModemStatus === "NOT ACTIVE"
                            ? "#b91c1c"
                            : modalModemStatus === "NO MAC FOUND"
                              ? "#374151"
                          : modalModemStatus === "DEACTIVE"
                            ? "#b91c1c"
                            : "#475569",
                    fontWeight: 700,
                    px: 0.5
                  }}
                />
                {modalIsIpoeClient && (modalLeaseMacAddress || modalLeaseIpAddress) ? (
                  <Typography sx={{ fontSize: "10px", color: "#64748b" }}>
                    {modalLeaseMacAddress ? `MAC: ${modalLeaseMacAddress}` : ""}
                    {modalLeaseMacAddress && modalLeaseIpAddress ? " | " : ""}
                    {modalLeaseIpAddress ? `IP: ${modalLeaseIpAddress}` : ""}
                  </Typography>
                ) : null}
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
                        py: 1.5,
                        borderTop: "1px solid #e2e8f0",
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        gap: 1.25
                      }}
                    >
                      <TextField
                        label="Latitude"
                        name="Latitude"
                        value={newClient.Latitude || ""}
                        onChange={handleChange}
                        placeholder="Example: 7.0731"
                        helperText="Edit the map point by saving latitude."
                      />
                      <TextField
                        label="Longitude"
                        name="Longitude"
                        value={newClient.Longitude || ""}
                        onChange={handleChange}
                        placeholder="Example: 125.6128"
                        helperText="Edit the map point by saving longitude."
                      />
                    </Box>
                  </Box>
                ) : null}

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
                    disabled={editMode || !isAdminUser}
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
          {editMode && selectedAuthMode === "IPOE" ? (
            <Button
              variant="outlined"
              color="warning"
              onClick={handlePullOutClient}
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
            sx={{
              px: 3.25,
              py: 0.85,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              boxShadow: "0 10px 22px rgba(37, 99, 235, 0.18)"
            }}
          >
            Save Client
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
                          {entry.receiptImageUrl ? (
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => {
                                setReceiptViewerSrc(entry.receiptImageUrl);
                                setReceiptPreviewOpen(true);
                              }}
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
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSavePayment}
            disabled={paymentReceiptLoading}
            sx={{
              px: 4,
              py: 1,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              boxShadow: "0 10px 22px rgba(22, 163, 74, 0.18)"
            }}
          >
            Receive Payment
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
                          {entry.receiptImageUrl ? (
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => {
                                setReceiptViewerSrc(entry.receiptImageUrl);
                                setReceiptPreviewOpen(true);
                              }}
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
      </Dialog>

      <Dialog
        open={messageBox.open}
        onClose={() =>
          setMessageBox((prev) => ({
            ...prev,
            open: false
          }))
        }
        maxWidth="xs"
        fullWidth
      >
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity={messageBox.severity} sx={{ mb: 2 }}>
            {messageBox.title}
          </Alert>
          <Typography>{messageBox.message}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={() =>
              setMessageBox((prev) => ({
                ...prev,
                open: false
              }))
            }
          >
            OK
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
              label="Technician"
              value={repairDialog.technicianId}
              onChange={(event) =>
                setRepairDialog((prev) => ({
                  ...prev,
                  technicianId: event.target.value
                }))
              }
              fullWidth
              helperText="Choose the technician who will handle this repair."
            >
              {technicians.length === 0 ? (
                <MenuItem value="" disabled>
                  No technician available
                </MenuItem>
              ) : (
                technicians.map((tech) => (
                  <MenuItem key={tech.ID || tech.Username} value={tech.ID}>
                    {tech.Name || tech.Username}
                  </MenuItem>
                ))
              )}
            </TextField>

            <TextField
              label="Repair SMS Details"
              multiline
              minRows={8}
              value={repairDetailsDisplayValue}
              onChange={(event) =>
                setRepairDialog((prev) => ({
                  ...prev,
                  repairText: event.target.value
                }))
              }
              placeholder="Choose a technician and type the repair issue. This box shows the SMS preview."
              fullWidth
              helperText="This box is the SMS message that will be sent to the selected technician."
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
            <TableContainer
              component={Paper}
              sx={{
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
                      <TableCell sx={{ fontWeight: 700, width: 84 }}>Reprint</TableCell>
                      {isAdminUser ? (
                        <TableCell sx={{ fontWeight: 700, width: 84 }}>Delete</TableCell>
                      ) : null}
                    </TableRow>
                  </TableHead>
                <TableBody>
                  {paymentHistoryRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdminUser ? 14 : 13} align="center">
                        No payment history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paymentHistoryRows.map((row) => (
                      <TableRow key={row._id || `${row.Invoice}-${row.TransactionDate}`}>
                        <TableCell>
                          {row.TransactionDate
                            ? new Date(row.TransactionDate).toLocaleString("en-PH")
                            : "-"}
                        </TableCell>
                        <TableCell>{row.Type || row.MOP || "-"}</TableCell>
                        <TableCell>{formatPaymentBreakdown(row)}</TableCell>
                        <TableCell>{row.PaymentReceipt || "-"}</TableCell>
                        <TableCell>{formatPaymentReferences(row)}</TableCell>
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
                          <Tooltip title="Reprint Receipt">
                            <span>
                              <IconButton
                                color="primary"
                                onClick={() => handleReprintPaymentHistory(row)}
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
                                  onClick={() => handleOpenDeleteHistoryDialog(row)}
                                  disabled={!row._id}
                                >
                                  <DeleteOutlineOutlinedIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
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
                <Typography sx={{ fontWeight: 700, color: "#0f172a", mb: 2 }}>
                  Traffic Monitor
                </Typography>

                {mikrotikStatusData.graphAvailable ? (
                  <Box sx={{ display: "grid", gap: 2 }}>
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                        <Typography sx={{ fontSize: "0.85rem", color: "#475569", fontWeight: 700 }}>
                          RX
                        </Typography>
                        <Typography sx={{ fontSize: "0.85rem", color: "#0f172a", fontWeight: 700 }}>
                          {formatTrafficBytes(mikrotikStatusRxBytes)}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          height: 14,
                          borderRadius: 999,
                          backgroundColor: "#e2e8f0",
                          overflow: "hidden"
                        }}
                      >
                        <Box
                          sx={{
                            width: mikrotikRxWidth,
                            height: "100%",
                            borderRadius: 999,
                            background: "linear-gradient(90deg, #2563eb, #38bdf8)"
                          }}
                        />
                      </Box>
                    </Box>

                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                        <Typography sx={{ fontSize: "0.85rem", color: "#475569", fontWeight: 700 }}>
                          TX
                        </Typography>
                        <Typography sx={{ fontSize: "0.85rem", color: "#0f172a", fontWeight: 700 }}>
                          {formatTrafficBytes(mikrotikStatusTxBytes)}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          height: 14,
                          borderRadius: 999,
                          backgroundColor: "#e2e8f0",
                          overflow: "hidden"
                        }}
                      >
                        <Box
                          sx={{
                            width: mikrotikTxWidth,
                            height: "100%",
                            borderRadius: 999,
                            background: "linear-gradient(90deg, #16a34a, #4ade80)"
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <Alert severity="info">
                    Live RX/TX traffic is not available for this client type right now.
                  </Alert>
                )}
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
            This client is already 15 or more days overdue.
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
            This client is already disconnected.
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


