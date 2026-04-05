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
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        
        {/* TOPBAR */}
        {/* <Topbar toggle={() => setOpen(!open)} /> */}

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