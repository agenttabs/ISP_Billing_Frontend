import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TablePagination
} from "@mui/material";
import { useState } from "react";

function ClientList({ clients }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginated = clients.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Clients Table
      </Typography>

      <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Client Name</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {paginated.map((c) => (
              <TableRow key={c._id} hover>
                <TableCell>{c.clientName}</TableCell>
                <TableCell>{c.plan}</TableCell>

                <TableCell>
                  {c.dueDate
                    ? new Date(c.dueDate).toLocaleDateString()
                    : "N/A"}
                </TableCell>

                <TableCell>{c.amountDue}</TableCell>

                <TableCell>
                  <Chip
                    label={c.paymentStatus}
                    color={c.paymentStatus === "PAID" ? "success" : "error"}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={clients.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 20]}
      />
    </Box>
  );
}

export default ClientList;