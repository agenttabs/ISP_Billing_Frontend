
import { Grid, Card, CardContent, Typography } from "@mui/material";

export default function Dashboard() {
  const stats = [
    { title: "Clients", value: 120 },
    { title: "Active", value: 100 },
    { title: "Unpaid", value: 20 },
    { title: "Revenue", value: "₱50,000" }
  ];

  return (
    <Grid container spacing={2}>
      {stats.map((s, i) => (
        <Grid item xs={3} key={i}>
          <Card>
            <CardContent>
              <Typography>{s.title}</Typography>
              <Typography variant="h5">{s.value}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
