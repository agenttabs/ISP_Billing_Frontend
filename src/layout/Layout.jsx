// Updated Layout.jsx - Use the user prop correctly
import { Box, IconButton, Menu, MenuItem, Avatar, Typography, Badge } from "@mui/material";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Logout, Notifications, Settings as SettingsIcon } from "@mui/icons-material";

export default function Layout({ children, onLogout, user: propUser }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(propUser);

  useEffect(() => {
    console.log('Layout received user prop:', propUser);
    
    // If user not passed as prop, try to get from localStorage
    if (!propUser) {
      const userData = localStorage.getItem('user');
      console.log('Layout - getting user from localStorage:', userData);
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          console.log('Layout - parsed user:', parsed);
          setUser(parsed);
        } catch (e) {
          console.error('Failed to parse user in Layout:', e);
        }
      }
    } else {
      setUser(propUser);
    }
  }, [propUser]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    if (onLogout) {
      onLogout();
    }
    navigate('/login');
  };

  const handleSettings = () => {
    handleClose();
    navigate('/settings');
  };

  console.log('Layout rendering with user:', user);

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* SIDEBAR */}
      <Sidebar />

      {/* RIGHT SIDE */}
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", ml: "60px" }}>
        
        {/* TOPBAR
        <Box
          sx={{
            height: 60,
            bgcolor: "#ffffff",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            px: 3,
            gap: 2,
            position: "sticky",
            top: 0,
            zIndex: 99,
          }}
        >
          <IconButton size="small">
            <Badge badgeContent={3} color="error">
              <Notifications sx={{ fontSize: 20, color: "#6b7280" }} />
            </Badge>
          </IconButton>
          
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }} onClick={handleMenu}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: user?.userType === 'admin' ? "#6366f1" : "#10b981",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                {user?.username || 'User'}
              </Typography>
              <Typography variant="caption" sx={{ color: "#9ca3af", lineHeight: 1.2 }}>
                {user?.userType === 'admin' ? 'Administrator' : 'Cashier'}
              </Typography>
            </Box>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={handleSettings}>
              <SettingsIcon sx={{ mr: 1, fontSize: 18 }} /> Settings
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1, fontSize: 18 }} /> Logout
            </MenuItem>
          </Menu>
        </Box> */}

        {/* CONTENT (ONLY THIS SCROLLS) */}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            background: "#f9fafb",
            p: 3
          }}
        >
          {children}
        </Box>

      </Box>
    </Box>
  );
}