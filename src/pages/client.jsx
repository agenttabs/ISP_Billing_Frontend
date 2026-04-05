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
  DialogActions
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import ReceiptIcon from "@mui/icons-material/Receipt";
import PaymentIcon from "@mui/icons-material/Payment";
import RouterIcon from "@mui/icons-material/Router";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { keyframes } from "@mui/system";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CloseIcon from "@mui/icons-material/Close";


import { useClient } from "../context/client.context";

// 🔥 BLINK ANIMATION
const blink = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
`;

function ClientList() {
  const navigate = useNavigate();

  const { clients, fetchClients, addClient, loading } = useClient();

  const [netPlans, setNetPlans] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState("");

  const [menu, setMenu] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  const [openModal, setOpenModal] = useState(false);
  const [newClient, setNewClient] = useState({});

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    axios.get("http://localhost:5000/api/netplans")
      .then(res => setNetPlans(res.data))
      .catch(err => console.error(err));
  }, []);

  // SEARCH
  const filtered = clients.filter((c) => {
    const s = search.toLowerCase();

    // ✅ format date same as table
    const formattedDate = c.DueDate
      ? new Date(c.DueDate).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).toLowerCase()
      : "";

    return (
      (c.ClientName || "").toLowerCase().includes(s) ||
      (c.AccountName || "").toLowerCase().includes(s) ||
      formattedDate.includes(s) ||              // 🔥 search formatted date
      (c.DueDate || "").toLowerCase().includes(s) // 🔥 raw date fallback
    );
  });

  const paginated = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // RIGHT CLICK MENU
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

  const handleBilling = () => {
    navigate(`/billing/${selectedClient._id}`);
    handleClose();
  };

  const handleReceipt = () => {
    navigate(`/receipt/${selectedClient._id}`);
    handleClose();
  };

  // INPUT
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "ContactNumber") {
      if (!/^\d*$/.test(value)) return;
      if (value.length > 11) return;

      setNewClient({
        ...newClient,
        ContactNumber: value
      });
      return;
    }

    if (name === "Profile") {
      const selected = netPlans.find(p => p.Name === value);

      setNewClient({
        ...newClient,
        Profile: value,
        NetPlan: selected?.Speed || "",
        AmountDue: selected?.Price || ""
      });
    } else {
      setNewClient({
        ...newClient,
        [name]: value
      });
    }
  };
  // PASSWORD GENERATOR
  const generatePassword = () => {
    const randomPass = Math.random().toString(36).slice(-8);

    setNewClient({
      ...newClient,
      Password: randomPass
    });
  };


  // ADD CLIENT
  const handleAddClient = async () => {
    if (!newClient.ClientName || !newClient.Profile) {
      alert("Please fill required fields");
      return;
    }

    const data = {
      ...newClient,
      SubscriptionCover: newClient.SubscriptionCover
        ? getOrdinal(Number(newClient.SubscriptionCover))
        : "UN-GROUPED",
      AccountNumber: Date.now().toString(),
      DateEntry: new Date().toLocaleDateString(),
      Email: "N/A",
      Facebook: "N/A",
      AmountDue: Number(String(newClient.AmountDue).replace(/,/g, ""))
    };

    try {
      await addClient(data);
      handleCloseModal();
      setNewClient({});
    } catch (err) {
      console.error(err);
      alert("Failed to save client");
    }
  };

  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const handleUpdateClient = async () => {
    try {
      const payload = {
        ...newClient,

        // ✅ SAFE FIX HERE
        SubscriptionCover: newClient.SubscriptionCover
          ? getOrdinal(Number(newClient.SubscriptionCover))
          : "UN-GROUPED", // or "" if your DB allows empty
        AmountDue: Number(String(newClient.AmountDue).replace(/,/g, ""))
      };

      console.log("UPDATE PAYLOAD:", payload); // 🔥 debug

      await axios.put(
        `http://localhost:5000/api/clients/${selectedClient._id}`,
        payload
      );

      fetchClients();
      handleCloseModal();
      setEditMode(false);
      setNewClient({});
    } catch (err) {
      console.error("UPDATE ERROR:", err.response?.data || err.message);
      alert("Failed to update client");
    }
  };

  const resetForm = () => {
    setNewClient({});
  };


  const handleCloseModal = (event, reason) => {
    if (reason === "backdropClick") return;

    setOpenModal(false);
    setEditMode(false); // 🔥 important
    resetForm();
  };


  const [editMode, setEditMode] = useState(false);


  return (
    <Box sx={{ p: 3 }}>

      {/* HEADER */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4">Clients Dashboard</Typography>

        <Button variant="contained" onClick={() => setOpenModal(true)}>
          + Add Client
        </Button>
      </Box>

      {/* SEARCH */}
      <TextField
        label="Search"
        fullWidth
        sx={{ mb: 3 }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p>Loading...</p>}

      {/* TABLE */}
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
        }}
      >
        <Table>

          {/* 🔥 PREMIUM HEADER */}
          <TableHead>
            <TableRow
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "linear-gradient(to bottom, #fafafa, #e0e0e0)",
                boxShadow:
                  "inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(0,0,0,0.15)",
                borderBottom: "2px solid #ccc"
              }}
            >
              {["Name", "Account Name", "Plan", "Due Date", "Amount", "Status", "Actions"].map((head) => (
                <TableCell
                  key={head}
                  sx={{
                    fontWeight: "bold",
                    color: "#333",
                    textShadow: "0 1px 0 #fff",
                    borderRight: "1px solid #ddd"
                  }}
                >
                  {head}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          {/* 🔥 BODY */}
          <TableBody>
            {paginated.map((c, index) => {
              const isPaid = (c.PaymentStatus || "").toUpperCase() === "PAID";

              return (
                <TableRow
                  key={c._id}
                  onContextMenu={(e) => handleRightClick(e, c)}
                  sx={{
                    backgroundColor: isPaid ? "#ffffff" : "#f5f5f5",
                    transition: "all 0.2s ease",

                    "&:hover": {
                      backgroundColor: "#e3f2fd",
                      transform: "scale(1.001)"
                    }
                  }}
                >
                  <TableCell>{c.ClientName}</TableCell>
                  <TableCell>{c.AccountName}</TableCell>
                  <TableCell>{c.NetPlan}</TableCell>

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

                  {/* STATUS */}
                  <TableCell>
                    <Chip
                      label={c.PaymentStatus || "UNPAID"}
                      size="small"
                      sx={{
                        borderRadius: "6px",
                        backgroundColor: isPaid ? "#e8f5e9" : "#eeeeee",
                        color: isPaid ? "#2e7d32" : "#555",
                        fontWeight: "bold"
                      }}
                    />
                  </TableCell>

                  {/* ACTIONS */}
                  <TableCell align="center">
                    <Tooltip title="Update">
                      <IconButton
                        sx={{
                          "&:hover": { color: "#1976d2" }
                        }}
                        onClick={() => {
                          setEditMode(true);
                          setSelectedClient(c);

                          setNewClient({
                            ...c,
                            DueDate: c.DueDate
                              ? new Date(c.DueDate).toISOString().split("T")[0]
                              : "",
                            SubscriptionCover: c.SubscriptionCover
                              ? parseInt(c.SubscriptionCover)
                              : ""
                          });

                          setOpenModal(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Billing">
                      <IconButton
                        sx={{
                          "&:hover": { color: "#0288d1" }
                        }}
                        onClick={() => navigate(`/billing/${c._id}`)}
                      >
                        <ReceiptIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Pay">
                      <IconButton
                        sx={{
                          "&:hover": { color: "#2e7d32" }
                        }}
                        onClick={() => navigate(`/payment/${c._id}`)}
                      >
                        <PaymentIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Router">
                      <IconButton
                        sx={{
                          "&:hover": { color: "#6a1b9a" }
                        }}
                        onClick={() => navigate(`/mikrotik/${c._id}`)}
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

      {/* PAGINATION */}
      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={(e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) =>
          setRowsPerPage(parseInt(e.target.value, 10))
        }
      />

      {/* MENU */}
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

      {/* MODAL */}


      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        fullWidth
        maxWidth="lg" // 🔥 wider modal
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden"
          }
        }}
      >
        {/* 🔥 HEADER BAR */}
        <Box
          sx={{
            background: "linear-gradient(90deg, #1976d2, #42a5f5)",
            color: "#fff",
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PersonAddIcon />
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              {editMode ? "Update Client" : "Add New Client"}
            </Typography>
          </Box>

          <IconButton onClick={handleCloseModal} sx={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* BODY */}
        <DialogContent sx={{ p: 3 }}>

          {/* 🔹 BASIC INFO */}
          <Typography sx={{ fontWeight: "bold", mb: 1 }}>
            Basic Information
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
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

          {/* PASSWORD */}
          <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
            <TextField
              label="Password"
              name="Password"
              fullWidth
              value={newClient.Password || ""}
              InputProps={{ readOnly: true }}
            />

            <Button variant="outlined" onClick={generatePassword}>
              Generate
            </Button>
          </Box>

          {/* 🔹 CONTACT */}
          <Typography sx={{ fontWeight: "bold", mt: 3, mb: 1 }}>
            Contact Details
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
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
            />
          </Box>

          {/* 🔹 NETWORK */}
          <Typography sx={{ fontWeight: "bold", mt: 3, mb: 1 }}>
            Network Setup
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
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
              label="Profile"
              name="Profile"
              fullWidth
              value={newClient.Profile || ""}
              onChange={handleChange}
            >
              {netPlans.map((plan) => (
                <MenuItem key={plan._id} value={plan.Name}>
                  {plan.Name}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* 🔹 PLAN */}
          <Typography sx={{ fontWeight: "bold", mt: 3, mb: 1 }}>
            Plan Details
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
            <TextField
              label="Net Plan"
              value={newClient.NetPlan || ""}
              fullWidth
              InputProps={{ readOnly: true }}
            />

            <TextField
              label="Amount Due"
              value={newClient.AmountDue || ""}
              fullWidth
              InputProps={{ readOnly: true }}
            />

            <TextField
              type="date"
              name="DueDate"
              fullWidth
              value={newClient.DueDate || ""}
              InputLabelProps={{ shrink: true }}
              onChange={handleChange}
            />
          </Box>

          {/* 🔹 SUBSCRIPTION + NOTE */}
          <Typography sx={{ fontWeight: "bold", mt: 3, mb: 1 }}>
            Subscription & Notes
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: 2,
              alignItems: "start"
            }}
          >
            <TextField
              select
              label="Subscription Cover"
              name="SubscriptionCover"
              fullWidth
              value={newClient.SubscriptionCover || ""}
              onChange={handleChange}
            >
              {[...Array(30)].map((_, i) => {
                const num = i + 1;

                const getOrdinal = (n) => {
                  const s = ["th", "st", "nd", "rd"];
                  const v = n % 100;
                  return n + (s[(v - 20) % 10] || s[v] || s[0]);
                };

                return (
                  <MenuItem key={num} value={num}>
                    {getOrdinal(num)}
                  </MenuItem>
                );
              })}
            </TextField>

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

        </DialogContent>

        {/* FOOTER */}
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseModal}>Cancel</Button>

          <Button
            variant="contained"
            onClick={editMode ? handleUpdateClient : handleAddClient}
            sx={{
              px: 4,
              fontWeight: "bold"
            }}
          >
            Save Client
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default ClientList;