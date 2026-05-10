import { Box } from "@mui/material";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children }) {
  const [open, setOpen] = useState(true);

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      
      {/* SIDEBAR */}
      <Sidebar open={open} />

      {/* RIGHT SIDE */}
      <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        
        {/* TOPBAR */}
        {/* <Topbar toggle={() => setOpen(!open)} /> */}

        {/* CONTENT (ONLY THIS SCROLLS) */}
        <Box
          sx={{
            flexGrow: 1,
            width: "100%",
            minWidth: 0,
            overflowY: "auto",
            background: "#f9fafb",
            px: { xs: 1, md: 1.25, lg: 1.5 },
            py: { xs: 1, md: 1.25 }
          }}
        >
          {children}
        </Box>

      </Box>
    </Box>
  );
}
