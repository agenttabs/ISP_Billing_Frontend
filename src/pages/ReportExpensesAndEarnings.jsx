import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
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

export default function ReportExpensesAndEarnings() {
  const { user } = useAuth();
  const isCashier = String(user?.type || "").toUpperCase() === "CASHIER";
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    totalCredit: 0,
    totalDebit: 0,
    balance: 0,
    rowCount: 0
  });
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
    setSummary({
      totalCredit: 0,
      totalDebit: 0,
      balance: 0,
      rowCount: 0
    });
    setError("");
    setLoading(isCashier);
  }, [isCashier]);

  const filteredRows = useMemo(() => {
    const keyword = String(searchText || "").trim().toLowerCase();

    if (!keyword) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.Invoice,
        row.Name,
        row.AccountName,
        row.CreatedBy,
        row.Type,
        row.EntryType,
        row.Source
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [rows, searchText]);

  const filteredSummary = useMemo(() => ({
    totalCredit: filteredRows.reduce((sum, row) => sum + Number(row.CreditAmount || 0), 0),
    totalDebit: filteredRows.reduce((sum, row) => sum + Number(row.DebitAmount || 0), 0),
    balance:
      filteredRows.reduce((sum, row) => sum + Number(row.CreditAmount || 0), 0) -
      filteredRows.reduce((sum, row) => sum + Number(row.DebitAmount || 0), 0),
    rowCount: filteredRows.length
  }), [filteredRows]);

  useEffect(() => {
    const loadReport = async () => {
      if (shouldWaitForAdminDateRange) {
        setRows([]);
        setSummary({
          totalCredit: 0,
          totalDebit: 0,
          balance: 0,
          rowCount: 0
        });
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

        const { data } = await API.get("/reports/expenses-and-earnings", config);
        setRows(Array.isArray(data?.rows) ? data.rows : []);
        setSummary(data?.summary || {
          totalCredit: 0,
          totalDebit: 0,
          balance: 0,
          rowCount: 0
        });
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load expenses and earnings.");
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [filters.endDate, filters.startDate, isCashier, shouldWaitForAdminDateRange]);

  return (
    <Box>
      <PageHeader
        title="Expenses and Earnings"
        subtitle={
          isCashier
            ? "Showing today's credit and debit entries for cashier access."
            : "Select a start date and end date first before viewing expenses and earnings."
        }
        action={
          <Button
            variant="outlined"
            startIcon={<PrintOutlinedIcon />}
            onClick={() => window.print()}
          >
            Print Report
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
              label="Search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Invoice, name, account"
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
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="overline" sx={{ fontWeight: 700, color: "#64748b" }}>
                Credit Total
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#15803d" }}>
                {formatMoney(filteredSummary.totalCredit)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="overline" sx={{ fontWeight: 700, color: "#64748b" }}>
                Debit Total
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#b91c1c" }}>
                {formatMoney(filteredSummary.totalDebit)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="overline" sx={{ fontWeight: 700, color: "#64748b" }}>
                Balance
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a" }}>
                {formatMoney(filteredSummary.balance)}
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5 }}>
                Records: {filteredSummary.rowCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                  <TableCell>Date</TableCell>
                  <TableCell>Entry</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Account Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell>Credit</TableCell>
                  <TableCell>Debit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shouldWaitForAdminDateRange ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      Select a date range to view the report.
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      No expense or earning records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell>
                        {row.TransactionDate
                          ? new Date(row.TransactionDate).toLocaleString("en-PH")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.EntryType || "-"}
                          color={row.EntryType === "CREDIT" ? "success" : "error"}
                        />
                      </TableCell>
                      <TableCell>{row.Source || "-"}</TableCell>
                      <TableCell>{row.Invoice || "-"}</TableCell>
                      <TableCell>{row.Name || "-"}</TableCell>
                      <TableCell>{row.AccountName || "-"}</TableCell>
                      <TableCell>{row.Type || "-"}</TableCell>
                      <TableCell>{row.CreatedBy || "-"}</TableCell>
                      <TableCell sx={{ color: "#15803d", fontWeight: 700 }}>
                        {row.CreditAmount ? formatMoney(row.CreditAmount) : "-"}
                      </TableCell>
                      <TableCell sx={{ color: "#b91c1c", fontWeight: 700 }}>
                        {row.DebitAmount ? formatMoney(row.DebitAmount) : "-"}
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
