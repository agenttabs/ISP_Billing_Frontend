import { motion } from "framer-motion";
import {
  Avatar,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge,
  Box,
  Tooltip,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Button
} from "@mui/material";

import {
  Dashboard,
  People,
  Menu as MenuIcon,
  AssessmentOutlined,
  BuildCircleOutlined,
  LogoutOutlined,
  ManageAccountsOutlined,
  SmsOutlined,
  MiscellaneousServicesOutlined,
  ScheduleSendOutlined,
  EmailOutlined,
  SettingsInputAntennaOutlined,
  PrintOutlined,
  ReceiptLongOutlined,
  FactCheckOutlined,
  RouterOutlined,
  SettingsEthernetOutlined,
  TuneOutlined,
  ShieldOutlined,
  LockResetOutlined,
  SettingsSuggestOutlined,
  FmdGoodOutlined,
  HistoryOutlined,
  ExpandLess,
  ExpandMore
} from "@mui/icons-material";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useClient } from "../context/client.context";
import { useState } from "react";
import { useAuth } from "../context/auth.context";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clients } = useClient();
  const { user, logout, changePassword, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mikrotikOpen, setMikrotikOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("");
  const unpaidCount = clients.filter(
    (c) => (c.PaymentStatus || "").toUpperCase() !== "PAID"
  ).length;
  const userType = String(user?.type || "").toUpperCase();

  const mainMenu = [
    { text: "Dashboard", path: "/", icon: <Dashboard />, roles: ["ADMIN", "CASHIER", "TECHNICIAN"] },
    { text: "Clients", path: "/clients", icon: <People />, roles: ["ADMIN", "CASHIER"] }
  ].filter((item) => item.roles.includes(userType));

  const reportMenu = [
    {
      text: "Collection",
      path: "/reports/transactions",
      icon: <AssessmentOutlined />,
      roles: ["ADMIN", "CASHIER"]
    },
    {
      text: "Expenses and Earnings",
      path: "/reports/expenses-and-earnings",
      icon: <ReceiptLongOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "Pull Out",
      path: "/reports/pull-out",
      icon: <AssessmentOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "Audit",
      path: "/reports/audit-logs",
      icon: <HistoryOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "Tech Report",
      path: "/reports/tech-report",
      icon: <BuildCircleOutlined />,
      roles: ["ADMIN", "TECHNICIAN"]
    },
    {
      text: "Repair",
      path: "/repair-information",
      icon: <BuildCircleOutlined />,
      roles: ["ADMIN", "TECHNICIAN"]
    }
  ].filter((item) => item.roles.includes(userType));

  const serviceMenu = [
    {
      text: "Account Users",
      path: "/account-users",
      icon: <ManageAccountsOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "Netplan",
      path: "/netplans-maintenance",
      icon: <RouterOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "System Settings",
      path: "/system-settings",
      icon: <TuneOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "Print Receipt",
      path: "/print-receipt",
      icon: <PrintOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "Client Bypass",
      path: "/client-bypass",
      icon: <ShieldOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "NAP",
      path: "/nap",
      icon: <FmdGoodOutlined />,
      roles: ["ADMIN", "TECHNICIAN"]
    },
    {
      text: "System Diagnostics",
      path: "/system-diagnostics",
      icon: <SettingsSuggestOutlined />,
      roles: ["ADMIN"]
    }
  ].filter((item) => item.roles.includes(userType));

  const transactionMenu = [
    {
      text: "Expense",
      path: "/expense-input",
      icon: <ReceiptLongOutlined />,
      roles: ["ADMIN", "CASHIER"]
    },
    {
      text: "Verification",
      path: "/transaction-verification",
      icon: <FactCheckOutlined />,
      roles: ["ADMIN"]
    }
  ].filter((item) => item.roles.includes(userType));

  const notificationMenu = [
    {
      text: "SMS Template",
      path: "/sms-recepients",
      icon: <SmsOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "SMS Collection",
      path: "/sms-collection",
      icon: <SettingsInputAntennaOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "SMS Batch Program",
      path: "/sms-batch-programs",
      icon: <ScheduleSendOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "Email Notification",
      path: "/email-notification",
      icon: <EmailOutlined />,
      roles: ["ADMIN"]
    }
  ].filter((item) => item.roles.includes(userType));

  const mikrotikMenu = [
    {
      text: "Connection",
      path: "/mikrotik-connections",
      icon: <SettingsEthernetOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "Mikrotik Checker",
      path: "/mikrotik-checker",
      icon: <RouterOutlined />,
      roles: ["ADMIN"]
    },
    {
      text: "Mikrotik DC Batch",
      path: "/mikrotik-dc-batch",
      icon: <ScheduleSendOutlined />,
      roles: ["ADMIN"]
    }
  ].filter((item) => item.roles.includes(userType));

  const resetChangePasswordDialog = () => {
    setChangePasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    setChangePasswordError("");
    setChangePasswordSuccess("");
  };

  const handleOpenChangePassword = () => {
    resetChangePasswordDialog();
    setChangePasswordOpen(true);
  };

  const handleCloseChangePassword = () => {
    setChangePasswordOpen(false);
    resetChangePasswordDialog();
  };

  const handleChangePasswordSubmit = async () => {
    setChangePasswordError("");
    setChangePasswordSuccess("");

    if (!changePasswordForm.currentPassword || !changePasswordForm.newPassword || !changePasswordForm.confirmPassword) {
      setChangePasswordError("Current password, new password, and confirm password are required.");
      return;
    }

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setChangePasswordError("New password and confirm password do not match.");
      return;
    }

    const result = await changePassword(
      changePasswordForm.currentPassword,
      changePasswordForm.newPassword
    );

    if (!result.success) {
      setChangePasswordError(result.error || "Failed to change password.");
      return;
    }

    setChangePasswordSuccess(result.message || "Password changed successfully.");
    setChangePasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const renderMenuButton = (item) => {
    const active = location.pathname === item.path;

    return (
      <ListItemButton
        key={item.text}
        component={Link}
        to={item.path}
        sx={{
          mx: 1,
          my: 0.25,
          minHeight: 40,
          borderRadius: 2,
          position: "relative",
          background: active ? "rgba(99,102,241,0.12)" : "transparent",
          "&:hover": {
            background: "rgba(0,0,0,0.05)"
          }
        }}
      >
        {active && (
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 6,
              bottom: 6,
              width: 4,
              borderRadius: 2,
              background: "#6366f1"
            }}
          />
        )}

        <ListItemIcon
          sx={{
            minWidth: 36,
            color: active ? "#6366f1" : "#6b7280"
          }}
        >
          {item.icon}
        </ListItemIcon>

        {open && (
          <ListItemText
            primary={item.text}
            primaryTypographyProps={{
              fontWeight: active ? 600 : 500,
              fontSize: "0.88rem",
              noWrap: true
            }}
            sx={{
              minWidth: 0,
              "& .MuiTypography-root": {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }
            }}
          />
        )}

        {item.text === "Clients" && unpaidCount > 0 && (
          <Badge
            badgeContent={unpaidCount}
            color="error"
            sx={{ mr: open ? 1 : 0 }}
          />
        )}
      </ListItemButton>
    );
  };

  const changePasswordButton = (
    <ListItemButton
      onClick={handleOpenChangePassword}
      sx={{
        mx: 1,
        mt: 1,
        minHeight: 40,
        borderRadius: 2,
        color: "#1f2937",
        "&:hover": {
          background: "rgba(99,102,241,0.08)"
        }
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, color: "#6366f1" }}>
        <LockResetOutlined />
      </ListItemIcon>
      {open && <ListItemText primary="Change password" primaryTypographyProps={{ fontSize: "0.88rem" }} />}
    </ListItemButton>
  );

  const logoutButton = (
    <ListItemButton
      onClick={handleLogout}
        sx={{
          mx: 1,
          mt: 1,
          minHeight: 40,
          borderRadius: 2,
          color: "#b91c1c",
        "&:hover": {
          background: "rgba(185,28,28,0.08)"
        }
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, color: "#b91c1c" }}>
        <LogoutOutlined />
      </ListItemIcon>
      {open && <ListItemText primary="Sign out" primaryTypographyProps={{ fontSize: "0.88rem" }} />}
    </ListItemButton>
  );

  const servicesButton = (
    <ListItemButton
      onClick={() => setServicesOpen((prev) => !prev)}
        sx={{
          mx: 1,
          my: 0.25,
          minHeight: 40,
          borderRadius: 2,
          color: "#475569",
        "&:hover": {
          background: "rgba(0,0,0,0.05)"
        }
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, color: "#64748b" }}>
        <MiscellaneousServicesOutlined />
      </ListItemIcon>

      {open ? (
        <>
          <ListItemText
            primary="System"
            primaryTypographyProps={{
              fontWeight: 700,
              fontSize: "0.88rem",
              noWrap: true
            }}
            sx={{
              minWidth: 0,
              "& .MuiTypography-root": {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }
            }}
          />
          {servicesOpen ? <ExpandLess /> : <ExpandMore />}
        </>
      ) : null}
    </ListItemButton>
  );

  const reportsButton = (
    <ListItemButton
      onClick={() => setReportsOpen((prev) => !prev)}
        sx={{
          mx: 1,
          my: 0.25,
          minHeight: 40,
          borderRadius: 2,
          color: "#475569",
        "&:hover": {
          background: "rgba(0,0,0,0.05)"
        }
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, color: "#64748b" }}>
        <AssessmentOutlined />
      </ListItemIcon>

      {open ? (
        <>
          <ListItemText
            primary="Report"
            primaryTypographyProps={{
              fontWeight: 700,
              fontSize: "0.88rem",
              noWrap: true
            }}
            sx={{
              minWidth: 0,
              "& .MuiTypography-root": {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }
            }}
          />
          {reportsOpen ? <ExpandLess /> : <ExpandMore />}
        </>
      ) : null}
    </ListItemButton>
  );

  const notificationsButton = (
    <ListItemButton
      onClick={() => setNotificationOpen((prev) => !prev)}
      sx={{
        mx: 1,
        my: 0.25,
        minHeight: 38,
        borderRadius: 2,
        color: "#475569",
        "&:hover": {
          background: "rgba(0,0,0,0.05)"
        }
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, color: "#64748b" }}>
        <EmailOutlined />
      </ListItemIcon>

      {open ? (
        <>
          <ListItemText
            primary="Notification"
            primaryTypographyProps={{
              fontWeight: 700,
              fontSize: "0.86rem",
              noWrap: true
            }}
            sx={{
              minWidth: 0,
              "& .MuiTypography-root": {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }
            }}
          />
          {notificationOpen ? <ExpandLess /> : <ExpandMore />}
        </>
      ) : null}
    </ListItemButton>
  );

  const mikrotikButton = (
    <ListItemButton
      onClick={() => setMikrotikOpen((prev) => !prev)}
      sx={{
        mx: 1,
        my: 0.25,
        minHeight: 38,
        borderRadius: 2,
        color: "#475569",
        "&:hover": {
          background: "rgba(0,0,0,0.05)"
        }
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, color: "#64748b" }}>
        <RouterOutlined />
      </ListItemIcon>

      {open ? (
        <>
          <ListItemText
            primary="Mikrotik"
            primaryTypographyProps={{
              fontWeight: 700,
              fontSize: "0.86rem",
              noWrap: true
            }}
            sx={{
              minWidth: 0,
              "& .MuiTypography-root": {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }
            }}
          />
          {mikrotikOpen ? <ExpandLess /> : <ExpandMore />}
        </>
      ) : null}
    </ListItemButton>
  );

  const transactionButton = (
    <ListItemButton
      onClick={() => setTransactionOpen((prev) => !prev)}
      sx={{
        mx: 1,
        my: 0.25,
        minHeight: 38,
        borderRadius: 2,
        color: "#475569",
        "&:hover": {
          background: "rgba(0,0,0,0.05)"
        }
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, color: "#64748b" }}>
        <FactCheckOutlined />
      </ListItemIcon>

      {open ? (
        <>
          <ListItemText
            primary="Transaction"
            primaryTypographyProps={{
              fontWeight: 700,
              fontSize: "0.86rem",
              noWrap: true
            }}
            sx={{
              minWidth: 0,
              "& .MuiTypography-root": {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }
            }}
          />
          {transactionOpen ? <ExpandLess /> : <ExpandMore />}
        </>
      ) : null}
    </ListItemButton>
  );

  return (
    <motion.div
      animate={{ width: open ? 202 : 64 }}
      transition={{ duration: 0.25 }}
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backdropFilter: "blur(12px)",
        background: "rgba(255,255,255,0.7)",
        borderRight: "1px solid rgba(0,0,0,0.05)",
        boxShadow: "4px 0 25px rgba(0,0,0,0.08)",
        position: "relative",
        zIndex: 10
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          px: 1.2,
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: open ? "space-between" : "center"
        }}
      >
        {open && (
          <Box sx={{ fontWeight: 700, fontSize: 14.5, letterSpacing: 0.2 }}>
            ISP SYSTEM
          </Box>
        )}

        <IconButton onClick={() => setOpen(!open)}>
          <MenuIcon />
        </IconButton>
      </Box>

      {/* MENU */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          pb: 1,
          "&::-webkit-scrollbar": {
            width: 8
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "rgba(148,163,184,0.55)",
            borderRadius: 999
          }
        }}
      >
        <List>
          {mainMenu.map((item) => {
            const button = renderMenuButton(item);

            return open ? (
              button
            ) : (
              <Tooltip title={item.text} placement="right" key={item.text}>
                {button}
              </Tooltip>
            );
          })}

          {transactionMenu.length > 0 ? (
            <>
              {open ? (
                transactionButton
              ) : (
                <Tooltip title="Transaction" placement="right">
                  {transactionButton}
                </Tooltip>
              )}

              <Collapse in={transactionOpen} timeout="auto" unmountOnExit>
                {transactionMenu.map((item) => {
                  const button = renderMenuButton(item);

                  return open ? (
                    <Box key={item.text} sx={{ pl: 1.5 }}>
                      {button}
                    </Box>
                  ) : (
                    <Tooltip title={item.text} placement="right" key={item.text}>
                      {button}
                    </Tooltip>
                  );
                })}
              </Collapse>
            </>
          ) : null}

          {reportMenu.length > 0 ? (
            <>
              {open ? (
                reportsButton
              ) : (
                <Tooltip title="Report" placement="right">
                  {reportsButton}
                </Tooltip>
              )}

              <Collapse in={reportsOpen} timeout="auto" unmountOnExit>
                {reportMenu.map((item) => {
                  const button = renderMenuButton(item);

                  return open ? (
                    <Box key={item.text} sx={{ pl: 1.5 }}>
                      {button}
                    </Box>
                  ) : (
                    <Tooltip title={item.text} placement="right" key={item.text}>
                      {button}
                    </Tooltip>
                  );
                })}
              </Collapse>
            </>
          ) : null}

          {mikrotikMenu.length > 0 ? (
            <>
              {open ? (
                mikrotikButton
              ) : (
                <Tooltip title="Mikrotik" placement="right">
                  {mikrotikButton}
                </Tooltip>
              )}

              <Collapse in={mikrotikOpen} timeout="auto" unmountOnExit>
                {mikrotikMenu.map((item) => {
                  const button = renderMenuButton(item);

                  return open ? (
                    <Box key={item.text} sx={{ pl: 1.5 }}>
                      {button}
                    </Box>
                  ) : (
                    <Tooltip title={item.text} placement="right" key={item.text}>
                      {button}
                    </Tooltip>
                  );
                })}
              </Collapse>
            </>
          ) : null}

          {notificationMenu.length > 0 ? (
            <>
              {open ? (
                notificationsButton
              ) : (
                <Tooltip title="Notification" placement="right">
                  {notificationsButton}
                </Tooltip>
              )}

              <Collapse in={notificationOpen} timeout="auto" unmountOnExit>
                {notificationMenu.map((item) => {
                  const button = renderMenuButton(item);

                  return open ? (
                    <Box key={item.text} sx={{ pl: 1.5 }}>
                      {button}
                    </Box>
                  ) : (
                    <Tooltip title={item.text} placement="right" key={item.text}>
                      {button}
                    </Tooltip>
                  );
                })}
              </Collapse>
            </>
          ) : null}

          {serviceMenu.length > 0 ? (
            <>
              {open ? (
                servicesButton
              ) : (
                <Tooltip title="System" placement="right">
                  {servicesButton}
                </Tooltip>
              )}

              <Collapse in={servicesOpen} timeout="auto" unmountOnExit>
                {serviceMenu.map((item) => {
                  const button = renderMenuButton(item);

                  return open ? (
                    <Box key={item.text} sx={{ pl: 1.5 }}>
                      {button}
                    </Box>
                  ) : (
                    <Tooltip title={item.text} placement="right" key={item.text}>
                      {button}
                    </Tooltip>
                  );
                })}
              </Collapse>
            </>
          ) : null}
        </List>
      </Box>

      <Box sx={{ mt: "auto", px: 1, pb: 2 }}>
        <Divider sx={{ mb: 1.5 }} />
        <Box
          sx={{
            px: open ? 1.5 : 0,
            display: "flex",
            alignItems: "center",
            justifyContent: open ? "flex-start" : "center",
            gap: 1.5
          }}
        >
          <Avatar sx={{ bgcolor: "#1d4ed8", width: 34, height: 34, fontSize: 14 }}>
            {String(user?.name || user?.username || "U").charAt(0).toUpperCase()}
          </Avatar>
          {open ? (
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>
                {user?.name || user?.username}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 11 }} noWrap>
                {user?.type || "USER"}
              </Typography>
            </Box>
          ) : null}
        </Box>
        {open ? changePasswordButton : <Tooltip title="Change password">{changePasswordButton}</Tooltip>}
        {open ? logoutButton : <Tooltip title="Sign out">{logoutButton}</Tooltip>}
      </Box>

      <Dialog open={changePasswordOpen} onClose={handleCloseChangePassword} fullWidth maxWidth="xs">
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gap: 1.5, pt: 1 }}>
            {changePasswordError ? <Alert severity="error">{changePasswordError}</Alert> : null}
            {changePasswordSuccess ? <Alert severity="success">{changePasswordSuccess}</Alert> : null}
            <TextField
              label="Current Password"
              type="password"
              value={changePasswordForm.currentPassword}
              onChange={(e) => setChangePasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="New Password"
              type="password"
              value={changePasswordForm.newPassword}
              onChange={(e) => setChangePasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="Confirm Password"
              type="password"
              value={changePasswordForm.confirmPassword}
              onChange={(e) => setChangePasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              fullWidth
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseChangePassword}>Cancel</Button>
          <Button onClick={handleChangePasswordSubmit} variant="contained" disabled={authLoading}>
            Update Password
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
}
