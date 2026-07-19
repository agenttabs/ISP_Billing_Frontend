import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tabs,
  TextField,
  FormControlLabel,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import API from "../api/api";
import PageHeader from "../layout/PageHeader";

const statusColor = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "ONLINE") return "success";
  if (value.includes("PENDING")) return "warning";
  if (value === "OFFLINE") return "error";
  return "default";
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-PH");
};

const filterRowsByTab = (rows, tab) => {
  if (tab === "pending") {
    return rows.filter((row) => String(row.status || "").toUpperCase().includes("PENDING"));
  }

  if (tab === "online") {
    return rows.filter((row) => String(row.status || "").toUpperCase() === "ONLINE");
  }

  if (tab === "offline") {
    return rows.filter((row) => String(row.status || "").toUpperCase() === "OFFLINE");
  }

  return rows;
};

const getOnuIdentifier = (row = {}) =>
  row.authInfo ||
  row.macAddress ||
  row.oltPort ||
  row.ponPort ||
  row.rawLine ||
  "-";

const formatFiberReadDisplay = (value) => {
  const readings = String(value || "")
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);

  if (readings.length <= 1) return readings[0] || "-";
  return readings.reverse().join(" / ");
};

const getFiberStatusColor = (value) => {
  const status = String(value || "").toUpperCase();
  if (status === "OK") return "success";
  if (status === "BAD" || status === "CHECK FAILED") return "error";
  if (status === "CHECK") return "warning";
  return "default";
};

const parseOltPortParts = (value) => {
  const match = String(value || "").match(/^((?:gpon|epon))-onu_(\d+)\/(\d+)\/(\d+):(\d+)$/i);
  if (!match) {
    return {
      channel: "",
      board: "",
      port: "",
      onuId: ""
    };
  }

  return {
    channel: match[1].toUpperCase(),
    board: match[3],
    port: match[4],
    onuId: match[5]
  };
};

export default function OltOnuStatus() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [technologyFilter, setTechnologyFilter] = useState({
    GPON: true,
    EPON: true
  });
  const [source, setSource] = useState("dump");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [generatedAt, setGeneratedAt] = useState("");
  const [cached, setCached] = useState(false);
  const [cacheExpiresAt, setCacheExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [fiberDetail, setFiberDetail] = useState(null);
  const [vlanLoading, setVlanLoading] = useState(false);
  const [vlanError, setVlanError] = useState("");
  const [availableVlans, setAvailableVlans] = useState([]);
  const [authorizeValues, setAuthorizeValues] = useState({
    cvlan: "",
    vlan: ""
  });

  const loadRows = async ({ force = false } = {}) => {
    try {
      setLoading(true);
      setError("");
      const { data } = await API.get("/olt-onu-status", {
        params: {
          source,
          ...(force && source === "live" ? { force: 1 } : {})
        }
      });
      setRows(data?.rows || []);
      setSummary(data?.summary || null);
      setGeneratedAt(data?.generatedAt || "");
      setCached(Boolean(data?.cached));
      setCacheExpiresAt(data?.cacheExpiresAt || "");
      setHasLoaded(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load OLT ONU status.");
      setRows([]);
      setSummary(null);
      setGeneratedAt("");
      setCached(false);
      setCacheExpiresAt("");
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const searchedRows = useMemo(() => {
    const tabRows = filterRowsByTab(rows, tab).filter((row) => {
      const technology = String(row.technology || "").toUpperCase();
      if (technology === "GPON") return technologyFilter.GPON;
      if (technology === "EPON") return technologyFilter.EPON;
      return technologyFilter.GPON || technologyFilter.EPON;
    });
    const keyword = String(search || "").trim().toUpperCase();

    if (!keyword) return tabRows;

    return tabRows.filter((row) =>
      [
        row.status,
        row.technology,
        row.name,
        row.authInfo,
        row.macAddress,
        row.oltPort,
        row.ponPort,
        row.rawLine,
        row.onuType,
        row.onuState,
        row.fiberRead,
        row.fiberStatus,
        row.vlan
      ]
        .map((value) => String(value || "").toUpperCase())
        .join(" ")
        .includes(keyword)
    );
  }, [rows, search, tab, technologyFilter]);
  const visibleRows = useMemo(
    () => searchedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [page, rowsPerPage, searchedRows]
  );

  const handleTabChange = (_event, value) => {
    setTab(value);
    setPage(0);
  };

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleTechnologyFilterChange = (technology) => (event) => {
    setTechnologyFilter((current) => ({
      ...current,
      [technology]: event.target.checked
    }));
    setPage(0);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value || 50));
    setPage(0);
  };

  const openDetails = async (row) => {
    setSelectedRow(row);
    setFiberDetail(null);
    setDetailError("");
    setVlanError("");
    setAvailableVlans([]);
    setAuthorizeValues({
      cvlan: "",
      vlan: ""
    });

    if (row?.oltPort) {
      try {
        setDetailLoading(true);
        const { data } = await API.post("/olt-onu-fiber-details", {
          items: [
            {
              key: row.oltPort,
              oltPort: row.oltPort,
              authInfo: row.authInfo,
              technology: row.technology
            }
          ]
        });
        const detail = data?.results?.[0] || null;
        setFiberDetail(detail);
        if (detail?.onuName && row?.oltPort) {
          setSelectedRow((current) =>
            current?.oltPort === row.oltPort ? { ...current, name: detail.onuName } : current
          );
          setRows((currentRows) =>
            currentRows.map((item) =>
              item.oltPort === row.oltPort ? { ...item, name: detail.onuName } : item
            )
          );
        }
      } catch (err) {
        setDetailError(err.response?.data?.error || "Failed to load live ONU details.");
      } finally {
        setDetailLoading(false);
      }
    }

    if (String(row?.status || "").toUpperCase().includes("PENDING")) {
      try {
        setVlanLoading(true);
        const { data } = await API.get("/olt-vlans");
        setAvailableVlans(data?.rows || []);
      } catch (err) {
        setVlanError(err.response?.data?.error || "Failed to load OLT VLANs.");
      } finally {
        setVlanLoading(false);
      }
    }
  };

  const closeDetails = () => {
    setSelectedRow(null);
    setFiberDetail(null);
    setDetailError("");
    setVlanError("");
    setAvailableVlans([]);
    setAuthorizeValues({
      cvlan: "",
      vlan: ""
    });
    setDetailLoading(false);
    setVlanLoading(false);
  };

  const selectedPortParts = parseOltPortParts(selectedRow?.oltPort);
  const isSelectedPending = String(selectedRow?.status || "").toUpperCase().includes("PENDING");
  const handleAuthorizeValueChange = (field) => (event) => {
    setAuthorizeValues((current) => ({
      ...current,
      [field]: event.target.value
    }));
  };
  const detailFiberStatus = detailLoading ? "Loading..." : fiberDetail?.fiberStatus || selectedRow?.fiberStatus || "-";
  const detailFiberRead = detailLoading
    ? "Loading..."
    : `${formatFiberReadDisplay(fiberDetail?.fiberRead || selectedRow?.fiberRead)}${
        fiberDetail?.fiberLength ? ` (${fiberDetail.fiberLength})` : ""
      }`;
  const detailSections = [
    {
      title: "Identity",
      accent: "#2563eb",
      items: [
        ["ONU Name", fiberDetail?.onuName || selectedRow?.name || "-"],
        ["App Client", selectedRow?.appClientName || "-"],
        ["Account Name", selectedRow?.appAccountName || "-"],
        ["SN / AuthInfo", selectedRow?.authInfo || "-"],
        ["ONU External ID", selectedRow?.authInfo || selectedRow?.macAddress || "-"],
        ["MAC Address", selectedRow?.macAddress || "-"]
      ]
    },
    {
      title: "OLT Location",
      accent: "#7c3aed",
      items: [
        ["Type", selectedRow?.technology || "-"],
        ["Channel", selectedPortParts.channel || selectedRow?.technology || "-"],
        ["Board", selectedPortParts.board || "-"],
        ["Port", selectedPortParts.port || "-"],
        ["ONU ID", selectedPortParts.onuId || "-"],
        ["OLT Port", selectedRow?.oltPort || selectedRow?.ponPort || "-"]
      ]
    },
    {
      title: "Signal",
      accent: "#16a34a",
      items: [
        ["Status", selectedRow?.status || "-"],
        ["ONU State", selectedRow?.onuState || "-"],
        ["ONU/OLT Rx Signal", detailFiberRead],
        ["Fiber Status", detailFiberStatus]
      ]
    },
    {
      title: "Service",
      accent: "#ea580c",
      items: [
        ["ONU Type", selectedRow?.onuType || "-"],
        ["Attached VLANs", fiberDetail?.attachedVlans || selectedRow?.vlan || "-"],
        ["Service-port ID", fiberDetail?.servicePortId || "-"],
        ["CVLAN", fiberDetail?.cvlan || "-"],
        ["User-VLAN", fiberDetail?.userVlan || "-"],
        ["Download", fiberDetail?.downloadProfile || "-"],
        ["Upload", fiberDetail?.uploadProfile || "-"],
        ["Admin State", fiberDetail?.adminState || "-"],
        ["Encrypt", fiberDetail?.encrypt || "-"]
      ]
    }
  ];

  return (
    <Box>
      <PageHeader
        title="OLT ONU Status"
        subtitle="View live OLT ONUs, pending authorization, online, offline, and LOS-style status."
        action={
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshOutlinedIcon />}
            onClick={() => loadRows({ force: true })}
            disabled={loading}
            sx={{ fontWeight: 800 }}
          >
            {source === "live" ? "Live Refresh" : "Load Dump"}
          </Button>
        }
      />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {!hasLoaded && !loading ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Choose Latest Dump for fast file-based display, or Live Telnet for direct OLT query.
        </Alert>
      ) : null}

      <Card sx={{ borderRadius: 2, border: "1px solid #dbe4ee", mb: 2 }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
            <Typography sx={{ color: "#64748b", fontWeight: 800 }}>Data Source</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={source}
              onChange={(_event, value) => {
                if (!value) return;
                setSource(value);
                setRows([]);
                setSummary(null);
                setGeneratedAt("");
                setCached(false);
                setCacheExpiresAt("");
                setHasLoaded(false);
                setPage(0);
              }}
            >
              <ToggleButton value="dump" sx={{ fontWeight: 800 }}>
                Latest Dump
              </ToggleButton>
              <ToggleButton value="live" sx={{ fontWeight: 800 }}>
                Live Telnet
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography sx={{ color: "#64748b", fontSize: "0.82rem" }}>
              {source === "dump"
                ? "Fast. Reads files from olt-dumps."
                : "Direct OLT telnet. Slower but current."}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        {[
          ["Total", summary?.total || 0, "default"],
          ["Authorized", summary?.authorized || 0, "primary"],
          ["Pending", summary?.pending || 0, "warning"],
          ["Online", summary?.online || 0, "success"],
          ["Offline / LOS", summary?.offline || 0, "error"]
        ].map(([label, value, color]) => (
          <Card key={label} sx={{ flex: 1, borderRadius: 2, border: "1px solid #dbe4ee" }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography sx={{ color: "#64748b", fontSize: "0.72rem", fontWeight: 800 }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: "1.25rem", fontWeight: 900 }}>
                <Chip label={value} color={color} sx={{ fontWeight: 900 }} />
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Card sx={{ borderRadius: 2, border: "1px solid #dbe4ee" }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Tabs
                value={tab}
                onChange={handleTabChange}
                variant="scrollable"
                allowScrollButtonsMobile
              >
                <Tab value="all" label="All" />
                <Tab value="pending" label="Pending Authorization" />
                <Tab value="online" label="Online" />
                <Tab value="offline" label="Offline / LOS" />
              </Tabs>
              <Typography sx={{ color: "#64748b", fontSize: "0.78rem", fontWeight: 700, mt: 0.75 }}>
                Last refresh: {formatDateTime(generatedAt)}
                {cached ? ` | Cached until ${formatDateTime(cacheExpiresAt)}` : ""}
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
              <Stack direction="row" spacing={1}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={technologyFilter.GPON}
                      onChange={handleTechnologyFilterChange("GPON")}
                      size="small"
                    />
                  }
                  label="GPON"
                  sx={{ mr: 0 }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={technologyFilter.EPON}
                      onChange={handleTechnologyFilterChange("EPON")}
                      size="small"
                    />
                  }
                  label="EPON"
                  sx={{ mr: 0 }}
                />
              </Stack>
              <TextField
                label="Search ONU"
                value={search}
                onChange={handleSearchChange}
                size="small"
                placeholder="SN, MAC, port, state"
                sx={{ width: { xs: "100%", md: 280 } }}
              />
            </Stack>
          </Stack>

          {!hasLoaded && !loading ? (
            <Box sx={{ textAlign: "center", color: "#64748b", py: 6 }}>
              <Typography sx={{ fontWeight: 800 }}>No scan loaded yet.</Typography>
              <Typography sx={{ fontSize: "0.85rem" }}>
                Use Refresh when you are ready to query the OLT.
              </Typography>
            </Box>
          ) : loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25 }}>
                {searchedRows.length === 0 ? (
                  <Typography sx={{ textAlign: "center", color: "#64748b", py: 2 }}>
                    No OLT ONU records found.
                  </Typography>
                ) : (
                  visibleRows.map((row, index) => (
                    <Card
                      key={`${row.oltPort || row.authInfo || row.macAddress}-${index}`}
                      onClick={() => openDetails(row)}
                      sx={{ borderRadius: 2, border: "1px solid #dbe4ee", cursor: "pointer" }}
                    >
                      <CardContent>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 900, wordBreak: "break-word" }}>
                                {getOnuIdentifier(row)}
                              </Typography>
                          <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                            {row.technology || "-"} | {row.oltPort || row.ponPort || "-"}
                          </Typography>
                          <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                            Name: {row.name || "-"}
                          </Typography>
                        </Box>
                            <Chip size="small" label={row.status || "-"} color={statusColor(row.status)} />
                          </Stack>
                          <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                            MAC: {row.macAddress || "-"}
                          </Typography>
                          {row.rawLine ? (
                            <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                              Raw: {row.rawLine}
                            </Typography>
                          ) : null}
                          <Typography sx={{ color: "#64748b", fontSize: "0.75rem", wordBreak: "break-word" }}>
                            Type: {row.onuType || "-"} | State: {row.onuState || "-"}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Box>

              <TableContainer sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>ONU Name</TableCell>
                      <TableCell>Identifier</TableCell>
                      <TableCell>SN / AuthInfo</TableCell>
                      <TableCell>MAC Address</TableCell>
                      <TableCell>OLT Port</TableCell>
                      <TableCell>Raw Pending Line</TableCell>
                      <TableCell>ONU Type</TableCell>
                      <TableCell>ONU State</TableCell>
                      <TableCell>VLAN</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {searchedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} align="center">
                          No OLT ONU records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleRows.map((row, index) => (
                        <TableRow
                          key={`${row.oltPort || row.authInfo || row.macAddress}-${index}`}
                          hover
                          onClick={() => openDetails(row)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell>
                            <Chip size="small" label={row.status || "-"} color={statusColor(row.status)} />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>{row.technology || "-"}</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>{row.name || "-"}</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>{getOnuIdentifier(row)}</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>{row.authInfo || "-"}</TableCell>
                          <TableCell>{row.macAddress || "-"}</TableCell>
                          <TableCell>{row.oltPort || row.ponPort || "-"}</TableCell>
                          <TableCell sx={{ maxWidth: 360, wordBreak: "break-word" }}>{row.rawLine || "-"}</TableCell>
                          <TableCell>{row.onuType || "-"}</TableCell>
                          <TableCell>{row.onuState || "-"}</TableCell>
                          <TableCell>{row.vlan || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={searchedRows.length}
                page={page}
                onPageChange={(_event, nextPage) => setPage(nextPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[25, 50, 100, 200]}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedRow)} onClose={closeDetails} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{
            bgcolor: "#0f172a",
            color: "#fff",
            fontWeight: 900,
            display: "flex",
            justifyContent: "space-between",
            gap: 2,
            alignItems: "center"
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            ONU Details
            <Typography sx={{ color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 700, wordBreak: "break-word" }}>
              {fiberDetail?.onuName || selectedRow?.name || getOnuIdentifier(selectedRow || {})}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Chip size="small" label={selectedRow?.status || "-"} color={statusColor(selectedRow?.status)} sx={{ fontWeight: 900 }} />
            <Chip size="small" label={detailFiberStatus} color={getFiberStatusColor(detailFiberStatus)} sx={{ fontWeight: 900 }} />
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "#f8fafc" }}>
          {detailError ? <Alert severity="error" sx={{ mb: 2 }}>{detailError}</Alert> : null}
          {vlanError ? <Alert severity="warning" sx={{ mb: 2 }}>{vlanError}</Alert> : null}
          {isSelectedPending ? (
            <Box sx={{ mb: 1.5, bgcolor: "#fff", border: "1px solid #fed7aa", borderRadius: 2, overflow: "hidden" }}>
              <Box sx={{ borderLeft: "5px solid #f97316", px: 1.5, py: 1, bgcolor: "#fff7ed" }}>
                <Typography sx={{ color: "#c2410c", fontSize: "0.86rem", fontWeight: 900 }}>
                  Authorize VLAN Choices
                </Typography>
                <Typography sx={{ color: "#9a3412", fontSize: "0.75rem", fontWeight: 700 }}>
                  Use these OLT VLANs later for CVLAN and VLAN during authorization.
                </Typography>
              </Box>
              <Box sx={{ p: 1.5 }}>
                {vlanLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography sx={{ color: "#64748b", fontWeight: 800 }}>Loading OLT VLANs...</Typography>
                  </Stack>
                ) : availableVlans.length ? (
                  <Stack spacing={1.25}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}>
                      <TextField
                        select
                        size="small"
                        label="CVLAN"
                        value={authorizeValues.cvlan}
                        onChange={handleAuthorizeValueChange("cvlan")}
                        helperText="For EPON untag flow, choose the customer VLAN."
                      >
                        <MenuItem value="">None</MenuItem>
                        {availableVlans.map((vlan) => (
                          <MenuItem key={`cvlan-${vlan.vlanId}`} value={String(vlan.vlanId)}>
                            {vlan.vlanId}{vlan.name ? ` - ${vlan.name}` : ""}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        size="small"
                        label="VLAN"
                        value={authorizeValues.vlan}
                        onChange={handleAuthorizeValueChange("vlan")}
                        helperText="OLT service VLAN for the authorization command."
                      >
                        <MenuItem value="">None</MenuItem>
                        {availableVlans.map((vlan) => (
                          <MenuItem key={`vlan-${vlan.vlanId}`} value={String(vlan.vlanId)}>
                            {vlan.vlanId}{vlan.name ? ` - ${vlan.name}` : ""}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {availableVlans.map((vlan) => (
                        <Chip
                          key={vlan.vlanId}
                          label={`VLAN ${vlan.vlanId}${vlan.name ? ` - ${vlan.name}` : ""}`}
                          color={
                            authorizeValues.cvlan === String(vlan.vlanId) ||
                            authorizeValues.vlan === String(vlan.vlanId)
                              ? "primary"
                              : "warning"
                          }
                          variant={
                            authorizeValues.cvlan === String(vlan.vlanId) ||
                            authorizeValues.vlan === String(vlan.vlanId)
                              ? "filled"
                              : "outlined"
                          }
                          sx={{ fontWeight: 900 }}
                        />
                      ))}
                    </Stack>
                  </Stack>
                ) : (
                  <Typography sx={{ color: "#64748b", fontWeight: 800 }}>
                    No VLAN list loaded.
                  </Typography>
                )}
              </Box>
            </Box>
          ) : null}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            {detailSections.map((section) => (
              <Box
                key={section.title}
                sx={{
                  bgcolor: "#fff",
                  border: "1px solid #dbe4ee",
                  borderRadius: 2,
                  overflow: "hidden"
                }}
              >
                <Box sx={{ borderLeft: `5px solid ${section.accent}`, px: 1.5, py: 1, bgcolor: "#f8fafc" }}>
                  <Typography sx={{ color: section.accent, fontSize: "0.86rem", fontWeight: 900 }}>
                    {section.title}
                  </Typography>
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "150px 1fr" } }}>
                  {section.items.map(([label, value]) => (
                    <Box
                      key={`${section.title}-${label}`}
                      sx={{
                        display: "contents",
                        "& > *": {
                          borderTop: "1px solid #eef2f7",
                          px: 1.5,
                          py: 1
                        }
                      }}
                    >
                      <Typography sx={{ color: "#64748b", fontSize: "0.76rem", fontWeight: 900 }}>
                        {label}
                      </Typography>
                      <Typography sx={{ color: "#0f172a", fontWeight: 900, wordBreak: "break-word" }}>
                        {value || "-"}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
          {selectedRow?.rawLine ? (
            <Box sx={{ mt: 1.5, bgcolor: "#fff", border: "1px solid #dbe4ee", borderRadius: 2, p: 1.5 }}>
              <Typography sx={{ color: "#64748b", fontSize: "0.76rem", fontWeight: 900, mb: 0.75 }}>
                Raw Pending Line
              </Typography>
              <Typography sx={{ color: "#0f172a", fontWeight: 800, wordBreak: "break-word" }}>
                {selectedRow.rawLine}
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetails} sx={{ fontWeight: 800 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
