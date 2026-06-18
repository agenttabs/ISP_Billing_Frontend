import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
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
  Typography
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

export default function ClientPaymentHistory() {
  const { id } = useParams();
  const location = useLocation();
  const client = location.state?.client || null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPaid = useMemo(
    () => rows.reduce((total, row) => total + Number(row.TotalAmount || row.Cash || 0), 0),
    [rows]
  );

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        const { data } = await API.get("/transactions", {
          params: {
            clientId: id,
            accountName: client?.AccountName || "",
            accountNumber: client?.AccountNumber || ""
          }
        });
        setRows(data || []);
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load payment history.");
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [client?.AccountName, client?.AccountNumber, id]);

  return (
    <Box>
      <PageHeader
        title="Client Payment History"
        subtitle={
          client
            ? `${client.ClientName || client.AccountName} payment records`
            : "View the client's payment collection records."
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
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Total Paid: {formatMoney(totalPaid)}
          </Typography>
          {client ? (
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Account: {client.AccountName || "-"} | Account No.: {client.AccountNumber || "-"}
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: 3 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
            <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
              {rows.length === 0 ? (
                <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                  No payment history found.
                </Typography>
              ) : (
                rows.map((row) => (
                  <Card
                    key={row._id || `${row.Invoice}-${row.TransactionDate}`}
                    sx={{ borderRadius: 3, border: "1px solid #dbe4ee" }}
                  >
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800, wordBreak: "break-word" }}>
                              {row.Invoice || "-"}
                            </Typography>
                            <Typography sx={{ color: "#64748b", fontSize: "0.75rem" }}>
                              {row.TransactionDate ? new Date(row.TransactionDate).toLocaleString("en-PH") : "-"}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontWeight: 900, color: "#15803d", flexShrink: 0 }}>
                            {formatMoney(row.TotalAmount || row.Cash)}
                          </Typography>
                        </Stack>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>TYPE</Typography>
                            <Typography sx={{ fontWeight: 800 }}>{row.Type || row.MOP || "-"}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ color: "#64748b", fontSize: "0.63rem", fontWeight: 800 }}>BALANCE</Typography>
                            <Typography sx={{ fontWeight: 800 }}>{formatMoney(row.Balance)}</Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                          Created by: {row.CreatedBy || row.CreatedById || "-"}
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
                  <TableCell>Transaction Date</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Payment Type</TableCell>
                  <TableCell>Total Amount</TableCell>
                  <TableCell>Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No payment history found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row._id || `${row.Invoice}-${row.TransactionDate}`}>
                      <TableCell>
                        {row.TransactionDate
                          ? new Date(row.TransactionDate).toLocaleString("en-PH")
                          : "-"}
                      </TableCell>
                      <TableCell>{row.CreatedBy || row.CreatedById || "-"}</TableCell>
                      <TableCell>{row.Invoice || "-"}</TableCell>
                      <TableCell>{row.Type || row.MOP || "-"}</TableCell>
                      <TableCell>{formatMoney(row.TotalAmount || row.Cash)}</TableCell>
                      <TableCell>{formatMoney(row.Balance)}</TableCell>
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
