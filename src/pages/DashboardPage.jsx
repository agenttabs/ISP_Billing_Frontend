import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import WifiTetheringOutlinedIcon from "@mui/icons-material/WifiTetheringOutlined";
import PowerSettingsNewOutlinedIcon from "@mui/icons-material/PowerSettingsNewOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import API from "../api/api";
import { useAuth } from "../context/auth.context";
import PageHeader from "../layout/PageHeader";

const statCards = [
  {
    group: "Client Status",
    key: "ipoeClients",
    title: "Active IPOE",
    icon: <WifiTetheringOutlinedIcon />,
    color: "#b45309"
  },
  {
    group: "Client Status",
    key: "pppoeClients",
    title: "Active PPPOE",
    icon: <RouterOutlinedIcon />,
    color: "#0f766e"
  },
  {
    group: "Client Status",
    key: "activeClients",
    title: "Total Active",
    icon: <PeopleAltOutlinedIcon />,
    color: "#1d4ed8"
  },
  {
    group: "Attention",
    key: "forDisconnectionToday",
    title: "For Disconnection Today",
    icon: <PowerSettingsNewOutlinedIcon />,
    color: "#b91c1c",
    clickable: true,
    endpoint: "/dashboard/disconnection-today",
    dialogTitle: "For Disconnection Today",
    emptyMessage: "No client is scheduled for disconnection today."
  },
  {
    group: "Attention",
    key: "dueToday",
    title: "Due Today",
    icon: <EventAvailableOutlinedIcon />,
    color: "#7c3aed",
    clickable: true,
    endpoint: "/dashboard/due-today",
    dialogTitle: "Due Today",
    emptyMessage: "No unpaid client is due today."
  },
  {
    group: "Attention",
    key: "pastDueUnpaid",
    title: "Past Due Not Yet Paid",
    icon: <WarningAmberOutlinedIcon />,
    color: "#ea580c",
    clickable: true,
    endpoint: "/dashboard/past-due-unpaid",
    dialogTitle: "Past Due Not Yet Paid",
    emptyMessage: "No unpaid client is currently past due."
  },
  {
    group: "Collection Today",
    key: "gcashPayment",
    countKey: "gcashPaidClients",
    title: "GCash Payment Today",
    icon: <AccountBalanceWalletOutlinedIcon />,
    color: "#0891b2",
    format: "currency",
    clickable: true,
    endpoint: "/dashboard/collections/gcash",
    dialogTitle: "GCash Payment Today",
    emptyMessage: "No GCash payment found for today.",
    listType: "collection"
  },
  {
    group: "Collection Today",
    key: "paymayaPayment",
    countKey: "paymayaPaidClients",
    title: "PayMaya Payment Today",
    icon: <PaymentsOutlinedIcon />,
    color: "#16a34a",
    format: "currency",
    clickable: true,
    endpoint: "/dashboard/collections/paymaya",
    dialogTitle: "PayMaya Payment Today",
    emptyMessage: "No PayMaya payment found for today.",
    listType: "collection"
  },
  {
    group: "Collection Today",
    key: "bankPayment",
    countKey: "bankPaidClients",
    title: "Bank Payment Today",
    icon: <AccountBalanceOutlinedIcon />,
    color: "#4338ca",
    format: "currency",
    clickable: true,
    endpoint: "/dashboard/collections/bank",
    dialogTitle: "Bank Payment Today",
    emptyMessage: "No bank payment found for today.",
    listType: "collection"
  },
  {
    group: "Collection Today",
    key: "cashPayment",
    countKey: "cashPaidClients",
    title: "Cash Payment Today",
    icon: <PointOfSaleOutlinedIcon />,
    color: "#ca8a04",
    format: "currency",
    clickable: true,
    endpoint: "/dashboard/collections/cash",
    dialogTitle: "Cash Payment Today",
    emptyMessage: "No cash payment found for today.",
    listType: "collection"
  }
];

const groupedStatCards = statCards.reduce((acc, card) => {
  const groupName = card.group || "Overview";
  if (!acc[groupName]) {
    acc[groupName] = [];
  }
  acc[groupName].push(card);
  return acc;
}, {});

const groupOrder = ["Client Status", "Collection Today", "Attention"];

const canViewDashboardGroup = (groupName, userType) => {
  if (groupName === "Client Status") {
    return userType === "ADMIN";
  }

  if (groupName === "Collection Today") {
    return userType === "ADMIN" || userType === "CASHIER";
  }

  if (groupName === "Attention") {
    return userType === "ADMIN" || userType === "CASHIER" || userType === "TECHNICIAN";
  }

  return true;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value || 0));

const normalizePaymentMethod = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const getEarningMethod = (row) =>
  normalizePaymentMethod(row?.MOP || row?.Type || row?.PaymentMethod);

const getEarningAmount = (row) => Number(row?.Cash || row?.TotalAmount || 0);

const getEarningAccountKey = (row) =>
  String(row?.AccountName || row?.ClientName || row?._id || "").trim();

const buildCollectionSummaryFromEarnings = (rows = []) => {
  const totals = {
    gcashPayment: 0,
    paymayaPayment: 0,
    bankPayment: 0,
    cashPayment: 0,
    gcashPaidClients: 0,
    paymayaPaidClients: 0,
    bankPaidClients: 0,
    cashPaidClients: 0
  };
  const paidClientSets = {
    GCASH: new Set(),
    PAYMAYA: new Set(),
    BANK: new Set(),
    CASH: new Set()
  };

  rows.forEach((row) => {
    const method = getEarningMethod(row);
    const amount = getEarningAmount(row);
    const accountKey = getEarningAccountKey(row);

    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    if (method === "GCASH") {
      totals.gcashPayment += amount;
      if (accountKey) paidClientSets.GCASH.add(accountKey);
    } else if (method === "PAYMAYA") {
      totals.paymayaPayment += amount;
      if (accountKey) paidClientSets.PAYMAYA.add(accountKey);
    } else if (method === "BANK") {
      totals.bankPayment += amount;
      if (accountKey) paidClientSets.BANK.add(accountKey);
    } else if (method === "CASH") {
      totals.cashPayment += amount;
      if (accountKey) paidClientSets.CASH.add(accountKey);
    }
  });

  totals.gcashPaidClients = paidClientSets.GCASH.size;
  totals.paymayaPaidClients = paidClientSets.PAYMAYA.size;
  totals.bankPaidClients = paidClientSets.BANK.size;
  totals.cashPaidClients = paidClientSets.CASH.size;

  return totals;
};

const mapEarningToCollectionRow = (row) => ({
  rowId: String(row?._id || row?.Invoice || row?.AccountName || Math.random()),
  transactionDate: row?.TransactionDate || row?.createdAt || "",
  accountName: row?.AccountName || "-",
  clientName: row?.ClientName || row?.Item || "-",
  method: getEarningMethod(row),
  reference: row?.MOPRef || row?.ReferenceNumber || row?.TransactionCode || "-",
  receiptNumber: row?.PaymentReceipt || row?.Invoice || row?.TransactionCode || "-",
  amount: getEarningAmount(row),
  createdBy: row?.DeclaredBy || row?.CreatedBy || row?.CreatedById || "-"
});

export default function DashboardPage() {
  const { user } = useAuth();
  const userType = String(user?.type || user?.role || "").trim().toUpperCase();
  const visibleGroupOrder = groupOrder.filter((groupName) =>
    canViewDashboardGroup(groupName, userType)
  );
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listRows, setListRows] = useState([]);
  const [listError, setListError] = useState("");
  const [listDialogTitle, setListDialogTitle] = useState("");
  const [listDialogType, setListDialogType] = useState("client");
  const [listEmptyMessage, setListEmptyMessage] = useState("");
  const [cashierEarningsRows, setCashierEarningsRows] = useState([]);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        const [
          dashboardSummaryResponse,
          earningsResponse,
          disconnectionResponse,
          dueTodayResponse,
          pastDueResponse
        ] = await Promise.all([
          userType === "CASHIER" ? Promise.resolve({ data: {} }) : API.get("/dashboard/summary"),
          userType === "CASHIER" ? API.get("/earnings") : Promise.resolve({ data: [] }),
          userType === "CASHIER" ? API.get("/dashboard/disconnection-today") : Promise.resolve({ data: { total: 0 } }),
          userType === "CASHIER" ? API.get("/dashboard/due-today") : Promise.resolve({ data: { total: 0 } }),
          userType === "CASHIER" ? API.get("/dashboard/past-due-unpaid") : Promise.resolve({ data: { total: 0 } })
        ]);
        const dashboardSummary = dashboardSummaryResponse?.data || {};
        const earningsRows = Array.isArray(earningsResponse?.data)
          ? earningsResponse.data
          : [];

        setCashierEarningsRows(earningsRows);
        setSummary({
          ...dashboardSummary,
          ...(userType === "CASHIER"
            ? {
                ...buildCollectionSummaryFromEarnings(earningsRows),
                forDisconnectionToday: Number(disconnectionResponse?.data?.total || 0),
                dueToday: Number(dueTodayResponse?.data?.total || 0),
                pastDueUnpaid: Number(pastDueResponse?.data?.total || 0)
              }
            : {})
        });
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [userType]);

  const openListDialog = async (card) => {
    try {
      setListDialogTitle(card.dialogTitle || card.title || "Client List");
      setListDialogType(card.listType || "client");
      setListEmptyMessage(card.emptyMessage || "No client found.");
      setListDialogOpen(true);
      setListLoading(true);

      if (userType === "CASHIER" && card.listType === "collection") {
        const method = normalizePaymentMethod(card.endpoint?.split("/").pop());
        const rows = cashierEarningsRows
          .filter((row) => getEarningMethod(row) === method)
          .map(mapEarningToCollectionRow)
          .sort((a, b) => new Date(b.transactionDate || 0) - new Date(a.transactionDate || 0));

        setListRows(rows);
        setListError("");
        return;
      }

      const { data } = await API.get(card.endpoint);
      setListRows(Array.isArray(data?.rows) ? data.rows : []);
      setListError("");
    } catch (err) {
      setListRows([]);
      setListError(err.response?.data?.error || "Failed to load dashboard client list.");
    } finally {
      setListLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome, ${user?.name || user?.username}.`}
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`Logged in as ${user?.type || "USER"}`} size="small" />
            <Chip label={`Username: ${user?.username || "-"}`} size="small" />
          </Stack>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2.25}>
          {visibleGroupOrder.map((groupName) =>
            groupedStatCards[groupName]?.length ? (
              <Box key={groupName}>
                <Typography
                  sx={{
                    mb: 1.25,
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    color: "#475569",
                    textTransform: "uppercase"
                  }}
                >
                  {groupName}
                </Typography>
                <Grid container spacing={2}>
                  {groupedStatCards[groupName].map((card) => (
                    <Grid
                      item
                      xs={12}
                      md={groupName === "Collection Today" ? 6 : 4}
                      xl={groupName === "Collection Today" ? 3 : 4}
                      key={card.key}
                    >
                      <Card sx={{ borderRadius: 3, height: "100%" }}>
                        <ButtonBase
                          onClick={card.clickable ? () => openListDialog(card) : undefined}
                          sx={{
                            width: "100%",
                            height: "100%",
                            display: "block",
                            textAlign: "left",
                            borderRadius: 3,
                            cursor: card.clickable ? "pointer" : "default"
                          }}
                        >
                          <CardContent sx={{ p: 2.25 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Box>
                                <Typography color="text.secondary" sx={{ mb: 0.75, fontSize: "0.84rem" }}>
                                  {card.title}
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.05 }}>
                                  {card.format === "currency"
                                    ? formatCurrency(summary?.[card.key] ?? 0)
                                    : summary?.[card.key] ?? 0}
                                </Typography>
                                {card.clickable ? (
                                  <Typography sx={{ mt: 0.75, fontSize: "0.76rem", color: "#64748b" }}>
                                    Click to view list
                                  </Typography>
                                ) : card.countKey ? (
                                  <Typography sx={{ mt: 0.75, fontSize: "0.76rem", color: "#64748b" }}>
                                    {summary?.[card.countKey] ?? 0} client(s) paid
                                  </Typography>
                                ) : null}
                              </Box>
                              <Box
                                sx={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 2.5,
                                  display: "grid",
                                  placeItems: "center",
                                  color: "#fff",
                                  bgcolor: card.color,
                                  "& svg": {
                                    fontSize: 24
                                  }
                                }}
                              >
                                {card.icon}
                              </Box>
                            </Stack>
                          </CardContent>
                        </ButtonBase>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ) : null
          )}
        </Stack>
      )}

      <Dialog open={listDialogOpen} onClose={() => setListDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ pb: 1.25 }}>{listDialogTitle || "Client List"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {listError ? <Alert severity="error">{listError}</Alert> : null}

          {listLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress size={24} />
            </Box>
          ) : listRows.length === 0 ? (
            <Alert severity="info">{listEmptyMessage || "No client found."}</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              {listDialogType === "collection" ? (
                <Table size="small" sx={{ minWidth: 920 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Transaction Date</TableCell>
                      <TableCell>Account Name</TableCell>
                      <TableCell>Client Name</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell>Receipt No.</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Created By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {listRows.map((row) => (
                      <TableRow key={row.rowId || row.receiptNumber || row.reference}>
                        <TableCell>{row.transactionDate ? new Date(row.transactionDate).toLocaleString("en-PH") : "-"}</TableCell>
                        <TableCell>{row.accountName || "-"}</TableCell>
                        <TableCell>{row.clientName || "-"}</TableCell>
                        <TableCell>{row.method || "-"}</TableCell>
                        <TableCell>{row.reference || "-"}</TableCell>
                        <TableCell>{row.receiptNumber || "-"}</TableCell>
                        <TableCell>{formatCurrency(row.amount)}</TableCell>
                        <TableCell>{row.createdBy || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table size="small" sx={{ minWidth: 980 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Account Name</TableCell>
                      <TableCell>Client Name</TableCell>
                      <TableCell>Auth</TableCell>
                      <TableCell>MikroTik Plan</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell>Disconnect Date</TableCell>
                      <TableCell>Days Past Due</TableCell>
                      <TableCell>Amount Due</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Address</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {listRows.map((row) => (
                      <TableRow key={row.clientId || `${row.accountName}-${row.disconnectDate}`}>
                        <TableCell>{row.accountName || "-"}</TableCell>
                        <TableCell>{row.clientName || "-"}</TableCell>
                        <TableCell>{row.authMode || "-"}</TableCell>
                        <TableCell>{row.mikrotikPlan || "-"}</TableCell>
                        <TableCell>{row.dueDate || "-"}</TableCell>
                        <TableCell>{row.disconnectDate || "-"}</TableCell>
                        <TableCell>{Number(row.daysPastDue || 0)}</TableCell>
                        <TableCell>{formatCurrency(row.amountDue)}</TableCell>
                        <TableCell>{row.contactNumber || "-"}</TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 260,
                            whiteSpace: "normal",
                            wordBreak: "break-word"
                          }}
                        >
                          {row.address || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
