import { motion } from "framer-motion";
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge,
  Box,
  Tooltip,
  IconButton
} from "@mui/material";

import {
  Dashboard,
  People,
  Menu as MenuIcon
} from "@mui/icons-material";

import { Link, useLocation } from "react-router-dom";
import { useClient } from "../context/client.context";
import { useState } from "react";

export default function Sidebar() {
  const location = useLocation();
  const { clients } = useClient();
const [open, setOpen] = useState(false);
  const unpaidCount = clients.filter(
    (c) => (c.PaymentStatus || "").toUpperCase() !== "PAID"
  ).length;

  const menu = [
    { text: "Dashboard", path: "/", icon: <Dashboard /> },
    { text: "Clients", path: "/clients", icon: <People /> }
  ];

  return (
    <motion.div
      animate={{ width: open ? 230 : 70 }}
      transition={{ duration: 0.25 }}
      style={{
        height: "100vh",
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
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: open ? "space-between" : "center"
        }}
      >
        {open && (
          <Box sx={{ fontWeight: "bold", fontSize: 16 }}>
            ISP SYSTEM
          </Box>
        )}

        <IconButton onClick={() => setOpen(!open)}>
          <MenuIcon />
        </IconButton>
      </Box>

      {/* MENU */}
      <List>
        {menu.map((item) => {
          const active = location.pathname === item.path;

          const button = (
            <ListItemButton
              key={item.text}
              component={Link}
              to={item.path}
              sx={{
                mx: 1,
                my: 0.5,
                borderRadius: 2,
                position: "relative",
                background: active ? "rgba(99,102,241,0.12)" : "transparent",
                "&:hover": {
                  background: "rgba(0,0,0,0.05)"
                }
              }}
            >
              {/* ACTIVE SIDE BAR */}
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
                  minWidth: 40,
                  color: active ? "#6366f1" : "#6b7280"
                }}
              >
                {item.icon}
              </ListItemIcon>

              {open && (
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: active ? 600 : 500
                  }}
                />
              )}

              {/* UNPAID BADGE */}
              {item.text === "Clients" && unpaidCount > 0 && (
                <Badge
                  badgeContent={unpaidCount}
                  color="error"
                  sx={{ mr: open ? 1 : 0 }}
                />
              )}
            </ListItemButton>
          );

          return open ? (
            button
          ) : (
            <Tooltip title={item.text} placement="right" key={item.text}>
              {button}
            </Tooltip>
          );
        })}
      </List>
    </motion.div>
  );
}