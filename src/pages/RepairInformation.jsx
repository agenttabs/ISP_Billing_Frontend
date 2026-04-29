import { Box, Card, CardContent, Typography } from "@mui/material";
import PageHeader from "../layout/PageHeader";

export default function RepairInformation() {
  return (
    <Box>
      <PageHeader
        title="Repair Information"
        subtitle="This module is ready for technician workflow."
      />
      <Card sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography color="text.secondary">
            We can connect the actual repair records here next.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
