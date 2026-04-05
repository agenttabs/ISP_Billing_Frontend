import { motion } from "framer-motion";
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge,
  Box
} from "@mui/material";

import { Link, useLocation } from "react-router-dom";
import { useClient } from "../context/client.context";

export default function Sidebar({ open }) {
  const location = useLocation();
  const { clients } = useClient();

  // 🔴 LIVE UNPAID COUNT
  const unpaidCount = clients.filter(
    (c) => (c.PaymentStatus || "").toUpperCase() !== "PAID"
  ).length;

  const menu = [
    { text: "Dashboard",  path: "/" },
    { text: "Clients",  path: "/clients" }
  ];

  return (
    <motion.div
      animate={{ width: open ? 220 : 70 }}
      transition={{ duration: 0.3 }}
      style={{
        height: "100vh",
        background: "linear-gradient(180deg, #ffffff, #f1f5f9)",
        borderRight: "1px solid rgba(0,0,0,0.05)",
        boxShadow: "4px 0 20px rgba(0,0,0,0.08)", // 🔥 3D effect
        position: "relative",
        zIndex: 10
      }}
    >
      {/* LOGO */}
      <Box sx={{ p: 2, fontWeight: "bold", textAlign: "center" }}>
        {open ? "ISP SYSTEM" : "ISP"}
      </Box>

      <List>
        {menu.map((item) => {
          const active = location.pathname === item.path;

          return (
            <ListItemButton
              key={item.text}
              component={Link}
              to={item.path}
              sx={{
                mx: 1,
                my: 0.5,
                borderRadius: 2,
                background: active ? "#e2e8f0" : "transparent",
                "&:hover": {
                  background: "#e5e7eb"
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
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

              {/* 🔴 UNPAID BADGE */}
              {item.text === "Clients" && unpaidCount > 0 && (
                <Badge
                  badgeContent={unpaidCount}
                  color="error"
                  sx={{ ml: 1 }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>
    </motion.div>
  );
}