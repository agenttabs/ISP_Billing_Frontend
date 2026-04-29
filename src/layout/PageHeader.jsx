import { Box, Stack, Typography } from "@mui/material";

export default function PageHeader({ title, subtitle, action, sx }) {
  return (
    <Box
      sx={{
        mb: 3,
        p: { xs: 2.5, md: 3 },
        borderRadius: 4,
        border: "1px solid #dbe4ee",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(239,246,255,0.92))",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        ...sx
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: "#0f172a", mb: subtitle ? 0.5 : 0 }}
          >
            {title}
          </Typography>
          {subtitle ? (
            <Typography sx={{ color: "#64748b" }}>{subtitle}</Typography>
          ) : null}
        </Box>

        {action ? (
          <Box sx={{ width: { xs: "100%", md: "auto" } }}>{action}</Box>
        ) : null}
      </Stack>
    </Box>
  );
}
