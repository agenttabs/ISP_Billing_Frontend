import { motion } from "framer-motion";
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box
} from "@mui/material";
// import DashboardIcon from "@mui/icons-material/Dashboard";
// import PeopleIcon from "@mui/icons-material/People";
import { Link, useLocation } from "react-router-dom";

export default function Sidebar({ open }) {
  const location = useLocation();

  const menu = [
    { text: "Dashboard",  path: "/" },
    { text: "Clients",  path: "/clients" }
  ];

  return (
    <motion.div
      animate={{ width: open ? 220 : 70 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "#ffffff",
        height: "100vh",
        borderRight: "1px solid #eee",
        boxShadow: "2px 0 8px rgba(0,0,0,0.04)"
      }}
    >
      {/* LOGO */}
      <Box
        sx={{
          p: 2,
          fontWeight: "bold",
          fontSize: open ? 18 : 0,
          textAlign: "center",
          transition: "0.3s"
        }}
      >
        DNS NETWORK
      </Box>

      <Divider />

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
                background: active ? "#f5f7fa" : "transparent",
                "&:hover": {
                  background: "#f1f3f5"
                }
              }}
            >
              <ListItemIcon
                sx={{
                  color: active ? "#1976d2" : "#555",
                  minWidth: 40
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
            </ListItemButton>
          );
        })}
      </List>
    </motion.div>
  );
}