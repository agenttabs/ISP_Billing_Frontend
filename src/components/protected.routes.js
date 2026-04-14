// components/ProtectedRoute.js (Updated with debugging)
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles, user }) => {
  console.log('ProtectedRoute check:', { user, allowedRoles });
  
  if (!user) {
    console.log('No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.userType)) {
    console.log(`User role ${user.userType} not allowed. Allowed: ${allowedRoles}`);
    return <Navigate to="/clients" replace />;
  }

  console.log('Access granted');
  return children;
};

export default ProtectedRoute;