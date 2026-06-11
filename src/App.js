import {
  BrowserRouter as Router,
  Navigate,
  Outlet,
  Route,
  Routes
} from "react-router-dom";

import Layout from "./layout/Layout";
import { useAuth } from "./context/auth.context";
import Billing from "./pages/Billing";
import ClientBypass from "./pages/ClientBypass";
import ClientPaymentHistory from "./pages/ClientPaymentHistory";
import ClientList from "./pages/client";
import Dashboard from "./pages/DashboardPage";
import EmailNotification from "./pages/EmailNotification";
import ExpenseInput from "./pages/ExpenseInput";
import Login from "./pages/Login";
import MikrotikChecker from "./pages/MikrotikChecker";
import MikrotikConnection from "./pages/MikrotikConnection";
import MikrotikDcBatch from "./pages/MikrotikDcBatch";
import NapLocation from "./pages/NapLocation";
import NetplanMaintenance from "./pages/NetplanMaintenance";
import OltLookup from "./pages/OltLookup";
import OltDumpScheduler from "./pages/OltDumpScheduler";
import PrintReceipt from "./pages/PrintReceipt";
import PullOutReport from "./pages/PullOutReport";
import ReportExpensesAndEarnings from "./pages/ReportExpensesAndEarnings";
import ReportTransactions from "./pages/ReportTransactions";
import RepairInformation from "./pages/RepairInformation";
import SMSBatchPrograms from "./pages/SMSBatchPrograms";
import SMSGateway from "./pages/SMSGateway";
import SMSRecepients from "./pages/SMSRecepients";
import SystemDiagnostics from "./pages/SystemDiagnostics";
import SystemSettings from "./pages/SystemSettings";
import SystemLogs from "./pages/SystemLogs";
import TechReport from "./pages/TechReport";
import TechnicianClientView from "./pages/TechnicianClientView";
import TechnicianPayrollReport from "./pages/TechnicianPayrollReport";
import TransactionVerification from "./pages/TransactionVerification";
import UserAccounts from "./pages/UserAccounts";

function ProtectedShell() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <ProtectedShell /> : <Navigate to="/login" replace />;
}

function RoleRoute({ allowedRoles }) {
  const { user } = useAuth();
  const userType = String(user?.type || "").toUpperCase();

  return allowedRoles.includes(userType) ? <Outlet /> : <Navigate to="/" replace />;
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />

          <Route element={<RoleRoute allowedRoles={["ADMIN", "CASHIER"]} />}>
            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/new" element={<ClientList />} />
            <Route path="/clients/:id/edit" element={<ClientList />} />
            <Route path="/editclient/:id" element={<ClientList />} />
            <Route path="/billing/:id" element={<Billing />} />
            <Route path="/clients/:id/payment-history" element={<ClientPaymentHistory />} />
            <Route path="/reports/transactions" element={<ReportTransactions />} />
            <Route path="/expense-input" element={<ExpenseInput />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
            <Route
              path="/reports/expenses-and-earnings"
              element={<ReportExpensesAndEarnings />}
            />
            <Route path="/reports/audit-logs" element={<SystemLogs />} />
            <Route path="/reports/pull-out" element={<PullOutReport />} />
            <Route path="/reports/technician-payroll" element={<TechnicianPayrollReport />} />
            <Route path="/account-users" element={<UserAccounts />} />
            <Route path="/sms-recepients" element={<SMSRecepients />} />
            <Route path="/sms-collection" element={<SMSGateway />} />
            <Route path="/sms-batch-programs" element={<SMSBatchPrograms />} />
            <Route path="/email-notification" element={<EmailNotification />} />
            <Route path="/netplans-maintenance" element={<NetplanMaintenance />} />
            <Route path="/print-receipt" element={<PrintReceipt />} />
            <Route path="/system-settings" element={<SystemSettings />} />
            <Route path="/client-bypass" element={<ClientBypass />} />
            <Route path="/mikrotik-connections" element={<MikrotikConnection />} />
            <Route path="/mikrotik-checker" element={<MikrotikChecker />} />
            <Route path="/mikrotik-dc-batch" element={<MikrotikDcBatch />} />
            <Route path="/olt-lookup" element={<OltLookup />} />
            <Route path="/olt-dump-scheduler" element={<OltDumpScheduler />} />
            <Route path="/transaction-verification" element={<TransactionVerification />} />
            <Route path="/system-diagnostics" element={<SystemDiagnostics />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={["ADMIN", "TECHNICIAN"]} />}>
            <Route path="/technician/clients" element={<TechnicianClientView />} />
            <Route path="/nap" element={<NapLocation />} />
            <Route path="/reports/tech-report" element={<TechReport />} />
            <Route path="/repair-information" element={<RepairInformation />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
