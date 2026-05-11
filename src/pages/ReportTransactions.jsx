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
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import API from "../api/api";
import { useAuth } from "../context/auth.context";
import PageHeader from "../layout/PageHeader";

const getTodayIsoDate = () => new Date().toISOString().split("T")[0];

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

export default function ReportTransactions() {
  const { user } = useAuth();
  const isCashier = String(user?.type || "").toUpperCase() === "CASHIER";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(isCashier);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(() => ({
    startDate: isCashier ? getTodayIsoDate() : "",
    endDate: isCashier ? getTodayIsoDate() : ""
  }));
  const [searchText, setSearchText] = useState("");
  const shouldWaitForAdminDateRange =
    !isCashier && (!filters.startDate || !filters.endDate);

  useEffect(() => {
    setFilters({
      startDate: isCashier ? getTodayIsoDate() : "",
      endDate: isCashier ? getTodayIsoDate() : ""
    });
    setRows([]);
    setError("");
    setLoading(isCashier);
  }, [isCashier]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = String(searchText || "").trim().toLowerCase();

    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) => {
      const accountName = String(row.AccountName || "").toLowerCase();
      return accountName.includes(normalizedSearch);
    });
  }, [rows, searchText]);

  const totalCollection = useMemo(
    () =>
      shouldWaitForAdminDateRange
        ? 0
        : filteredRows.reduce(
            (total, row) => total + Number(row.Cash || row.TotalAmount || 0),
            0
          ),
    [filteredRows, shouldWaitForAdminDateRange]
  );

  const paymentTypeCounts = useMemo(() => {
    if (shouldWaitForAdminDateRange) {
      return {
        CASH: 0,
        GCASH: 0,
        PAYMAYA: 0,
        BANK: 0
      };
    }

    return filteredRows.reduce(
      (counts, row) => {
        const method = String(row.MOP || row.Type || "")
          .trim()
          .toUpperCase();

        if (method === "CASH") {
          counts.CASH += 1;
        } else if (method === "GCASH") {
          counts.GCASH += 1;
        } else if (method === "PAYMAYA") {
          counts.PAYMAYA += 1;
        } else if (method === "BANK") {
          counts.BANK += 1;
        }

        return counts;
      },
      {
        CASH: 0,
        GCASH: 0,
        PAYMAYA: 0,
        BANK: 0
      }
    );
  }, [filteredRows, shouldWaitForAdminDateRange]);

  const displayedRecordCount = shouldWaitForAdminDateRange
    ? 0
    : filteredRows.length;

  useEffect(() => {
    const loadEarnings = async () => {
      if (shouldWaitForAdminDateRange) {
        setRows([]);
        setLoading(false);
        setError("");
        return;
      }

      try {
        setLoading(true);
        const params = {};

        if (filters.startDate) {
          params.startDate = filters.startDate;
        }

        if (filters.endDate) {
          params.endDate = filters.endDate;
        }

        const config =
          isCashier || Object.keys(params).length === 0 ? {} : { params };

        const { data } = await API.get("/earnings", config);
        setRows(data || []);
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load earnings.");
      } finally {
        setLoading(false);
      }
    };

    loadEarnings();
  }, [filters.endDate, filters.startDate, isCashier, shouldWaitForAdminDateRange]);

  return (
    <Box>
      <PageHeader
        title="Collection Report"
        subtitle={
          isCashier
            ? "Showing today's earnings collection for cashier access."
            : "Select a start date and end date first before viewing earnings records."
        }
        action={
          <Button
            variant="outlined"
            startIcon={<PrintOutlinedIcon />}
            onClick={() => window.print()}
          >
            Print Collection
          </Button>
        }
      />

      <Card sx={{ borderRadius: 4, mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap">
            <TextField
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, startDate: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              disabled={isCashier}
            />
            <TextField
              label="End Date"
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, endDate: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              disabled={isCashier}
            />
            <TextField
              label="Search Account Name"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Type account name"
              sx={{ minWidth: { xs: "100%", md: 260 } }}
            />
            {!isCashier ? (
              <Button
                variant="outlined"
                onClick={() =>
                  setFilters({
                    startDate: "",
                    endDate: ""
                  })
                }
              >
                Clear Filter
              </Button>
            ) : null}
            <Box sx={{ alignSelf: "center" }}>
              <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                Records: {displayedRecordCount}
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
              <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                Cash: {paymentTypeCounts.CASH}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                GCash: {paymentTypeCounts.GCASH}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                PayMaya: {paymentTypeCounts.PAYMAYA}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                Bank: {paymentTypeCounts.BANK}
              </Typography>
              <Box sx={{ ml: { md: 1 }, alignSelf: "center" }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Total: {formatMoney(totalCollection)}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error ? <Alert severity="error">{error}</Alert> : null}

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
                    <TableCell>Transaction Date</TableCell>
                      <TableCell>Receiver Last 4</TableCell>
                      <TableCell>Transfer Date</TableCell>
                      <TableCell>Created</TableCell>
                    <TableCell>Account Name</TableCell>
                    <TableCell>Client Name</TableCell>
                    <TableCell>Invoice</TableCell>
                    <TableCell>Total Amount</TableCell>
                    <TableCell>Payment Type</TableCell>
                    <TableCell>Verification</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shouldWaitForAdminDateRange ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      Select a date range to view earnings.
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      No earnings found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row._id || `${row.Invoice}-${row.AccountName}-${row.TransactionDate}`}>
                      <TableCell>
                        {row.TransactionDate
                          ? new Date(row.TransactionDate).toLocaleString("en-PH")
                          : "-"}
                      </TableCell>
                      <TableCell>{row.ReceiverLast4 || row.GCashReceiverLast4 || "-"}</TableCell>
                        <TableCell>{row.TransferDate || row.GCashTransferDate || "-"}</TableCell>
                        <TableCell>{row.DeclaredBy || row.CreatedBy || row.CreatedById || "-"}</TableCell>
                      <TableCell>{row.AccountName || "-"}</TableCell>
                      <TableCell>{row.Item || row.ClientName || "-"}</TableCell>
                      <TableCell>{row.Invoice || "-"}</TableCell>
                      <TableCell>{formatMoney(row.Cash || row.TotalAmount)}</TableCell>
                      <TableCell>{row.MOP || row.Type || "-"}</TableCell>
                      <TableCell>
                        {String(row.MOP || row.Type || "").trim().toUpperCase() === "CASH" ? (
                          "-"
                        ) : row.Verified ? (
                          <Box component="span" sx={{ fontWeight: 800, color: "success.main", letterSpacing: 0.3 }}>
                            VALIDATED
                          </Box>
                        ) : (
                          <Box component="span" sx={{ fontWeight: 700, color: "warning.main", letterSpacing: 0.2 }}>
                            PENDING
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
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


