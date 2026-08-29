import { Navigate } from 'react-router-dom';

/** Self-service registration is disabled; credentials are issued during restaurant onboarding. */
export function RegisterPage() {
  return <Navigate to="/login" replace />;
}
