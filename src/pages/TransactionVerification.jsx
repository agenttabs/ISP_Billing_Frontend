import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import PublishedWithChangesOutlinedIcon from "@mui/icons-material/PublishedWithChangesOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import CloseIcon from "@mui/icons-material/Close";
import API, { SOCKET_BASE_URL } from "../api/api";
import PageHeader from "../layout/PageHeader";

const normalizeReference = (value) =>
  String(value || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

const normalizeAmount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(normalized) ? roundAmount(normalized) : null;
};

const formatCurrency = (value) => {
  const amount = normalizeAmount(value);
  return amount !== null
    ? amount.toLocaleString("en-PH", {
        style: "currency",
        currency: "PHP"
      })
    : "PHP 0.00";
};

const formatOptionalCurrency = (value) => {
  const amount = normalizeAmount(value);
  return amount !== null ? formatCurrency(amount) : "N/A";
};

const buildSafeDateFromParts = (year, month, day, hours = 0, minutes = 0, seconds = 0) => {
  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseDisplayDateTime = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const rawValue = String(value).trim();
  if (!rawValue) return null;

  const isoLikeMatch = rawValue.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (isoLikeMatch) {
    const [, year, month, day, hours = '0', minutes = '0', seconds = '0'] = isoLikeMatch;
    return buildSafeDateFromParts(
      Number(year),
      Number(month),
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    );
  }

  const slashMatch = rawValue.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );
  if (slashMatch) {
    const [, month, day, year, rawHours = '0', minutes = '0', seconds = '0', meridiem = ''] = slashMatch;
    let hours = Number(rawHours);
    const normalizedMeridiem = String(meridiem || '').toUpperCase();

    if (normalizedMeridiem === 'PM' && hours < 12) {
      hours += 12;
    }
    if (normalizedMeridiem === 'AM' && hours === 12) {
      hours = 0;
    }

    return buildSafeDateFromParts(
      Number(year),
      Number(month),
      Number(day),
      hours,
      Number(minutes),
      Number(seconds)
    );
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const date = parseDisplayDateTime(value);
  if (!date) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
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

const extractReferencesFromText = (text) => {
  const matches = String(text || "").match(/\b\d{10,15}\b/g) || [];
  return [...new Set(matches.map(normalizeReference).filter(Boolean))];
};

const detectColumnAnchors = (items) => {
  const anchors = {
    debitX: null,
    creditX: null,
    balanceX: null
  };

  items.forEach((item) => {
    const text = String(item?.str || "").trim().toUpperCase();
    const x = item?.transform?.[4] || 0;

    if (text === "DEBIT") {
      anchors.debitX = x;
    } else if (text === "CREDIT") {
      anchors.creditX = x;
    } else if (text === "BALANCE") {
      anchors.balanceX = x;
    }
  });

  return anchors;
};

const findReferenceItem = (items, reference) => {
  const normalizedReference = normalizeReference(reference);
  return items.find(
    (item) => normalizeReference(item?.str || "") === normalizedReference
  );
};

const isAmountToken = (value) =>
  /^(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2}$/.test(String(value || "").trim());

const groupTextItemsIntoLines = (items) => {
  const lineMap = new Map();
  const yTolerance = 3;

  items.forEach((item) => {
    const text = String(item?.str || "").trim();
    if (!text) return;

    const y = Math.round(item?.transform?.[5] || 0);
    const x = item?.transform?.[4] || 0;
    const existingKey = [...lineMap.keys()].find(
      (lineY) => Math.abs(lineY - y) <= yTolerance
    );
    const targetKey = existingKey ?? y;

    if (!lineMap.has(targetKey)) {
      lineMap.set(targetKey, []);
    }

    lineMap.get(targetKey).push({ text, x });
  });

  return [...lineMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, values]) => {
      const sortedValues = values.sort((a, b) => a.x - b.x);

      return {
        text: sortedValues
          .map((value) => value.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
        values: sortedValues
      };
    })
    .filter((row) => row.text);
};

const pickAmountFromColumns = (row, anchors) => {
  const amountCells = row.values
    .filter((value) => isAmountToken(value.text))
    .map((value) => ({
      ...value,
      amount: normalizeAmount(value.text)
    }))
    .filter((value) => value.amount !== null);

  if (!amountCells.length) {
    return null;
  }

  const findNearestToAnchor = (anchorX) => {
    if (anchorX === null || anchorX === undefined) return null;

    return amountCells.reduce((closest, current) => {
      if (!closest) return current;

      return Math.abs(current.x - anchorX) < Math.abs(closest.x - anchorX)
        ? current
        : closest;
    }, null);
  };

  const creditCandidate = findNearestToAnchor(anchors.creditX);
  if (creditCandidate) {
    return creditCandidate.amount;
  }

  const debitCandidate = findNearestToAnchor(anchors.debitX);
  if (debitCandidate) {
    return debitCandidate.amount;
  }

  if (amountCells.length >= 2) {
    return amountCells[amountCells.length - 2].amount;
  }

  return amountCells[0].amount;
};

const extractPdfEntriesFromLines = (rows, anchors) => {
  const entries = [];

  rows.forEach((row) => {
    const referenceMatch = row.text.match(/\b\d{10,15}\b/);
    if (!referenceMatch) return;

    entries.push({
      line: row.text,
      reference: normalizeReference(referenceMatch[0]),
      amount: pickAmountFromColumns(row, anchors)
    });
  });

  return entries;
};

const extractAmountNearReference = (text, reference) => {
  const normalizedReference = normalizeReference(reference);
  if (!text || !normalizedReference) return null;

  const compactText = String(text).replace(/\s+/g, " ");
  const referenceIndex = compactText.indexOf(normalizedReference);

  if (referenceIndex === -1) return null;

  const searchWindow = compactText.slice(
    referenceIndex,
    Math.min(compactText.length, referenceIndex + 160)
  );
  const amounts = searchWindow.match(/(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2}/g) || [];
  const normalizedAmounts = amounts
    .map((value) => normalizeAmount(value))
    .filter((value) => value !== null);

  if (!normalizedAmounts.length) {
    return null;
  }

  return normalizedAmounts[0];
};

const extractAmountFromReferenceRow = (items, reference, anchors) => {
  const referenceItem = findReferenceItem(items, reference);

  if (!referenceItem) {
    return null;
  }

  const referenceY = referenceItem.transform?.[5] || 0;
  const yTolerance = 6;
  const sameRowAmounts = items
    .filter((item) => {
      const text = String(item?.str || "").trim();
      const y = item?.transform?.[5] || 0;
      return isAmountToken(text) && Math.abs(y - referenceY) <= yTolerance;
    })
    .map((item) => ({
      x: item.transform?.[4] || 0,
      amount: normalizeAmount(item.str)
    }))
    .filter((item) => item.amount !== null);

  if (!sameRowAmounts.length) {
    return null;
  }

  if (anchors.creditX !== null && anchors.creditX !== undefined) {
    const creditBandAmounts = sameRowAmounts.filter(
      (item) =>
        item.x >= anchors.creditX - 25 &&
        (anchors.balanceX === null || anchors.balanceX === undefined || item.x < anchors.balanceX - 5)
    );

    if (creditBandAmounts.length) {
      return creditBandAmounts.reduce((closest, current) => {
        if (!closest) return current;

        return Math.abs(current.x - anchors.creditX) < Math.abs(closest.x - anchors.creditX)
          ? current
          : closest;
      }, null).amount;
    }

    const nearestCreditAmount = sameRowAmounts.reduce((closest, current) => {
      if (!closest) return current;

      return Math.abs(current.x - anchors.creditX) < Math.abs(closest.x - anchors.creditX)
        ? current
        : closest;
    }, null);

    if (nearestCreditAmount) {
      return nearestCreditAmount.amount;
    }
  }

  return sameRowAmounts[0].amount;
};

const getRecordReferenceCandidates = (record) =>
  [
    record.VerificationReference,
    record.MatchReference,
    record.MOPRef,
    record.ReferenceNumber,
    record.TransactionCode,
    record.PaymentReceipt,
    record.Invoice
  ]
    .map(normalizeReference)
    .filter(Boolean);

const getDraftForMatch = (record, reference, comment = "") => ({
  method:
    String(record.VerificationMethod || record.PaymentMethod || record.MOP || "MANUAL")
      .trim()
      .toUpperCase(),
  source: "PDF",
  reference: normalizeReference(reference) || normalizeReference(record.MatchReference),
  comment: String(comment || "").trim()
});

const collectReferenceEntriesFromItems = (items, anchors) => {
  const references = items
    .map((item) => normalizeReference(item?.str || ""))
    .filter((value) => /^\d{10,15}$/.test(value));

  return [...new Set(references)].map((reference) => ({
    reference,
    amount: extractAmountFromReferenceRow(items, reference, anchors)
  }));
};

async function extractPdfReferences(file, password) {
  const pdfjs = await import("pdfjs-dist/legacy/webpack.mjs");
  const rawBytes = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(rawBytes),
    password: password || undefined
  });
  const pdf = await loadingTask.promise;

  let fullText = "";
  const entries = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    const columnAnchors = detectColumnAnchors(content.items);
    const rows = groupTextItemsIntoLines(content.items);
    const lineEntries = extractPdfEntriesFromLines(rows, columnAnchors).map((entry) => ({
      ...entry,
      amount:
        entry.amount !== null
          ? entry.amount
          : extractAmountFromReferenceRow(content.items, entry.reference, columnAnchors)
            ?? extractAmountNearReference(pageText, entry.reference)
    }));
    const directEntries = collectReferenceEntriesFromItems(
      content.items,
      columnAnchors
    ).map((entry) => ({
      line: "",
      reference: entry.reference,
      amount: entry.amount
    }));

    fullText += `${pageText}\n`;
    entries.push(...lineEntries, ...directEntries);
  }

  return {
    pageCount: pdf.numPages,
    references: extractReferencesFromText(fullText),
    entries
  };
}

export default function TransactionVerification() {
  const uploadInputRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [verifiedDrafts, setVerifiedDrafts] = useState({});
  const [pdfAnalysis, setPdfAnalysis] = useState({});
  const [loading, setLoading] = useState(false);
  const [processingPdf, setProcessingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [pdfSummary, setPdfSummary] = useState("");
  const [pdfReferences, setPdfReferences] = useState([]);
  const [receiptPreview, setReceiptPreview] = useState({
    open: false,
    src: ""
  });
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const loadRecords = async (options = {}) => {
    try {
      setLoading(true);
      const nextFilterDate =
        options.filterDate !== undefined ? options.filterDate : filterDate;
      const params = { date: nextFilterDate };
      const { data } = await API.get("/transaction-verification", { params });
      setRecords(Array.isArray(data?.records) ? data.records : []);
      setVerifiedDrafts({});
      setPdfAnalysis({});
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load pending transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const selectedCount = useMemo(
    () => Object.keys(verifiedDrafts).length,
    [verifiedDrafts]
  );

  const matchedCount = useMemo(
    () =>
      Object.values(verifiedDrafts).filter((draft) => draft.source === "PDF")
        .length,
    [verifiedDrafts]
  );

  const handleSelectFile = (event) => {
    const file = event.target.files?.[0] || null;
    setPdfFile(file);
    setPdfSummary("");
    setPdfReferences([]);
    setPdfAnalysis({});
    setError("");
    setSuccess("");
  };

  const handleToggleRecord = (record, checked) => {
    setVerifiedDrafts((prev) => {
      const next = { ...prev };

      if (!checked) {
        delete next[record._id];
        return next;
      }

      next[record._id] = {
        method:
          prev[record._id]?.method ||
          String(record.VerificationMethod || record.PaymentMethod || record.MOP || "MANUAL")
            .trim()
            .toUpperCase(),
        source: prev[record._id]?.source || "MANUAL",
        reference:
          prev[record._id]?.reference ||
          normalizeReference(record.VerificationReference) ||
          normalizeReference(record.MatchReference) ||
          normalizeReference(record.MOPRef),
        comment:
          prev[record._id]?.comment || pdfAnalysis[record._id]?.comment || ""
      };

      return next;
    });
  };

  const handleProcessPdf = async () => {
    if (!pdfFile) {
      setError("Please upload the GCash transaction history PDF first.");
      return;
    }

    try {
      setProcessingPdf(true);
      setError("");
      setSuccess("");

      const { references, pageCount, entries } = await extractPdfReferences(
        pdfFile,
        pdfPassword
      );
      const referenceSet = new Set(references);
      const entriesByReference = entries.reduce((map, entry) => {
        const existingEntry = map.get(entry.reference);

        if (!existingEntry || (existingEntry.amount === null && entry.amount !== null)) {
          map.set(entry.reference, entry);
        }

        return map;
      }, new Map());

      setPdfReferences(references);
      const nextAnalysis = {};
      setVerifiedDrafts((prev) => {
        const manualDrafts = Object.fromEntries(
          Object.entries(prev).filter(([, value]) => value.source !== "PDF")
        );

        const autoDrafts = {};

        records.forEach((record) => {
          const match = getRecordReferenceCandidates(record).find((candidate) =>
            referenceSet.has(candidate)
          );

          if (!match) {
            nextAnalysis[record._id] = {
              status: "no_match",
              reference: "",
              pdfAmount: null,
              comment: ""
            };
            return;
          }

          const pdfEntry = entriesByReference.get(match);
          const recordAmount = normalizeAmount(
            record.VerificationAmount ?? record.TotalAmount
          );
          const pdfAmount = normalizeAmount(pdfEntry?.amount);
          const amountMatches =
            recordAmount !== null &&
            pdfAmount !== null &&
            roundAmount(recordAmount) === roundAmount(pdfAmount);
          const comment =
            !amountMatches
              ? `Amount is not equal, the PDF is ${formatOptionalCurrency(pdfAmount)} | Print value: ${formatCurrency(recordAmount)}`
              : "";

          nextAnalysis[record._id] = {
            status: amountMatches ? "matched" : "amount_mismatch",
            reference: match,
            pdfAmount,
            comment
          };

          if (amountMatches) {
            autoDrafts[record._id] = getDraftForMatch(record, match, comment);
          }
        });

        return {
          ...manualDrafts,
          ...autoDrafts
        };
      });
      setPdfAnalysis(nextAnalysis);

      const newMatchCount = Object.values(nextAnalysis).filter(
        (value) => value.status === "matched"
      ).length;
      const mismatchCount = Object.values(nextAnalysis).filter(
        (value) => value.status === "amount_mismatch"
      ).length;

      setPdfSummary(
        `${pdfFile.name} processed successfully. ${references.length} reference number(s) found across ${pageCount} page(s); ${newMatchCount} transaction(s) matched and ${mismatchCount} amount mismatch(es) need review.`
      );
    } catch (err) {
      const errorName = err?.name || "";
      let message = err?.message || "Failed to read the transaction PDF.";

      if (errorName === "PasswordException") {
        message = "The PDF password is missing or incorrect.";
      }

      setPdfSummary("");
      setPdfReferences([]);
      setPdfAnalysis({});
      setError(message);
    } finally {
      setProcessingPdf(false);
    }
  };

  const handleProceed = async () => {
    const payload = Object.entries(verifiedDrafts).map(([id, draft]) => ({
      id,
      method: draft.method,
      reference: draft.reference,
      comment: draft.comment || pdfAnalysis[id]?.comment || ""
    }));

    if (!payload.length) {
      setError("Select or match at least one transaction before proceeding.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const { data } = await API.put("/transaction-verification/verify", {
        records: payload
      });

      await loadRecords({ filterDate });
      setPdfSummary("");
      setPdfReferences([]);
      setPdfAnalysis({});
      setPdfFile(null);
      setPdfPassword("");
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
      setSuccess(
        `${data?.modifiedCount || payload.length} transaction record(s) verified successfully.`
      );
    } catch (err) {
      setError(err.response?.data?.error || "Failed to verify the selected transactions.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenReceiptPreview = async (receiptImage) => {
    try {
      const previewSource = await resolveReceiptImagePreviewSource(receiptImage);
      setReceiptPreview({
        open: true,
        src: previewSource
      });
      setError("");
    } catch (err) {
      setError(err.message || "Unable to open the uploaded receipt image.");
    }
  };

  const handleCloseReceiptPreview = () => {
    setReceiptPreview((prev) => {
      if (prev.src && prev.src.startsWith("blob:")) {
        URL.revokeObjectURL(prev.src);
      }

      return {
        open: false,
        src: ""
      };
    });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Transaction Verification"
        subtitle="Verify non-cash payment records from the print collection using a password-protected GCash PDF or manual approval."
        action={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
            <Button
              variant="outlined"
              startIcon={<ReplayOutlinedIcon />}
              onClick={loadRecords}
              disabled={loading || processingPdf || saving}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<TaskAltOutlinedIcon />}
              onClick={handleProceed}
              disabled={!selectedCount || loading || processingPdf || saving}
            >
              Proceed
            </Button>
          </Stack>
        }
      />

      <Stack spacing={2.5}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}
        {pdfSummary ? <Alert severity="info">{pdfSummary}</Alert> : null}

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          <Card sx={{ flex: 1, borderRadius: 4, boxShadow: "0 14px 30px rgba(15, 23, 42, 0.08)" }}>
            <CardContent>
              <Typography sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
                Pending Non-Cash Transactions
              </Typography>
              <Typography sx={{ color: "#64748b", fontSize: 14 }}>
                {loading
                  ? "Loading pending records..."
                  : `${records.length} payment record(s) still waiting for verification for ${filterDate}.`}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, borderRadius: 4, boxShadow: "0 14px 30px rgba(15, 23, 42, 0.08)" }}>
            <CardContent>
              <Typography sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
                Ready To Proceed
              </Typography>
              <Typography sx={{ color: "#64748b", fontSize: 14 }}>
                {selectedCount} selected, with {matchedCount} auto-matched from the uploaded PDF.
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        <Paper
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 4,
            border: "1px solid #dbe4ee",
            boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)"
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                Verification Date Filter
              </Typography>
              <Typography sx={{ color: "#64748b", fontSize: 14, mt: 0.5 }}>
                Review unverified non-cash payments for the selected date. The page defaults to today.
              </Typography>
            </Box>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <TextField
                label="Payment Date"
                type="date"
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: { xs: "100%", md: 220 } }}
              />

              <Button
                variant="contained"
                onClick={() => loadRecords({ filterDate })}
                disabled={loading || processingPdf || saving || !filterDate}
              >
                Apply Filter
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 4,
            border: "1px solid #dbe4ee",
            boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)"
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                GCash PDF Checker
              </Typography>
              <Typography sx={{ color: "#64748b", fontSize: 14, mt: 0.5 }}>
                Upload the GCash transaction history PDF, enter the PDF password, and match the reference numbers against pending print records.
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<UploadFileOutlinedIcon />}
                onClick={() => uploadInputRef.current?.click()}
              >
                {pdfFile ? "Change PDF" : "Upload PDF"}
              </Button>
              <input
                ref={uploadInputRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={handleSelectFile}
              />

              <TextField
                label="PDF Password"
                type="password"
                value={pdfPassword}
                onChange={(event) => setPdfPassword(event.target.value)}
                sx={{ minWidth: { xs: "100%", md: 240 } }}
              />

              <Button
                variant="contained"
                startIcon={<PublishedWithChangesOutlinedIcon />}
                onClick={handleProcessPdf}
                disabled={!pdfFile || processingPdf || saving}
              >
                {processingPdf ? "Checking..." : "Check PDF"}
              </Button>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }}>
              <Chip
                label={pdfFile ? pdfFile.name : "No PDF selected yet"}
                color={pdfFile ? "primary" : "default"}
                variant={pdfFile ? "filled" : "outlined"}
              />
              <Chip
                label={`${pdfReferences.length} reference(s) found`}
                variant="outlined"
              />
            </Stack>
          </Stack>
        </Paper>

        <Paper
          sx={{
            borderRadius: 4,
            border: "1px solid #dbe4ee",
            overflow: "hidden",
            boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)"
          }}
        >
          <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                  Pending Print Records
                </Typography>
                <Typography sx={{ color: "#64748b", fontSize: 14, mt: 0.5 }}>
                  Manual verification is available with the checkbox. Rows matched from the PDF are highlighted in green, while amount mismatches are highlighted in orange with the PDF amount comment.
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                Display Count: {records.length}
              </Typography>
            </Stack>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Verify</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>GCash Ref</TableCell>
                  <TableCell>Receiver Last 4</TableCell>
                  <TableCell>Transfer Date</TableCell>
                <TableCell>Uploaded Image</TableCell>
                <TableCell>Receipt No.</TableCell>
                <TableCell>Transaction Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Comment</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!records.length ? (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 4, color: "#64748b" }}>
                    {loading ? "Loading records..." : "No pending non-cash transactions found."}
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => {
                  const draft = verifiedDrafts[record._id];
                  const analysis = pdfAnalysis[record._id];
                  const isSelected = Boolean(draft);
                  const isPdfMatched = draft?.method === "PDF";
                  const hasAmountMismatch = analysis?.status === "amount_mismatch";
                  const rowComment =
                    draft?.comment || analysis?.comment || record.VerificationComment || "";

                  return (
                    <TableRow
                      key={record._id}
                      sx={{
                        backgroundColor: isPdfMatched
                          ? "rgba(34, 197, 94, 0.10)"
                          : hasAmountMismatch
                            ? "rgba(249, 115, 22, 0.10)"
                          : isSelected
                              ? "rgba(59, 130, 246, 0.08)"
                            : "transparent",
                        transition: "background-color 0.2s ease"
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          onChange={(event) => handleToggleRecord(record, event.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{record.ClientName || "-"}</TableCell>
                      <TableCell>{record.AccountName || record.AccountNumber || "-"}</TableCell>
                      <TableCell>{record.VerificationMethod || record.PaymentMethod || "-"}</TableCell>
                      <TableCell>{formatCurrency(record.VerificationAmount ?? record.TotalAmount)}</TableCell>
                        <TableCell>{record.VerificationReference || record.MOPRef || record.MatchReference || "-"}</TableCell>
                        <TableCell>{record.VerificationReceiverLast4 || record.ReceiverLast4 || record.GCashReceiverLast4 || "-"}</TableCell>
                        <TableCell>{record.VerificationTransferDate || record.TransferDate || record.GCashTransferDate || "-"}</TableCell>
                      <TableCell>
                        {record.ReceiptImage ? (
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => handleOpenReceiptPreview(record.ReceiptImage)}
                            sx={{ textTransform: "none", fontWeight: 700, minWidth: 0, px: 0 }}
                          >
                            View
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{record.PaymentReceipt || record.Invoice || "-"}</TableCell>
                      <TableCell>{formatDateTime(record.TransactionDate )}</TableCell>
                      <TableCell>
                        {isPdfMatched ? (
                          <Chip size="small" color="success" label="Matched in PDF" />
                        ) : hasAmountMismatch ? (
                          <Chip size="small" color="warning" label="Amount mismatch" />
                        ) : isSelected ? (
                          <Chip size="small" color="info" label="Manual verify" />
                        ) : (
                          <Chip size="small" variant="outlined" label="Pending" />
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 280, color: hasAmountMismatch ? "#c2410c" : "#475569" }}>
                        {rowComment || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Paper>
      </Stack>

      <Dialog
        open={receiptPreview.open}
        onClose={handleCloseReceiptPreview}
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
          Uploaded Receipt Image
          <IconButton onClick={handleCloseReceiptPreview} sx={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, backgroundColor: "#f8fafc" }}>
          {receiptPreview.src ? (
            <Box
              component="img"
              src={receiptPreview.src}
              alt="Uploaded receipt preview"
              sx={{
                width: "100%",
                maxHeight: "75vh",
                objectFit: "contain",
                borderRadius: 2,
                backgroundColor: "#fff",
                border: "1px solid #dbe4ee"
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
