import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import Layout from './components/layout/Layout';
import Dashboard from './components/dashboard/Dashboard';
import MakerChecker from './pages/MakerChecker';
import MyTask from './pages/MyTask';
import CircularArchive from './pages/CircularArchive';
import CircularDetail from './pages/CircularDetail';
import Settings from './pages/Settings';
import SetupPage from './pages/Setup';
import AdminPage from './pages/Admin';
import PenaltyArchive from './pages/PenaltyArchive';
import ManagerPage from './pages/Manager';
import KeyToolsPage from './pages/KeyTools';
import ReportPage from './pages/Report';

// Placeholder components for other routes
const Task = () => <div className="p-6"><h1 className="text-2xl font-bold">Task Module</h1><p>Complete task CRUD with status tracking</p></div>;
// (moved to dedicated page)

function RequireRole({ allow, children }: { allow: Array<'Admin' | 'Manager' | 'Maker' | 'Checker'>, children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (!allow.includes(user.role as any)) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <Router>
          <Layout>
            <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/maker-checker" element={<MakerChecker />} />
            <Route path="/my-task" element={<MyTask />} />
            <Route path="/manager" element={
              <RequireRole allow={['Manager', 'Admin']}>
                <ManagerPage />
              </RequireRole>
            } />
            <Route path="/admin" element={
              <RequireRole allow={['Admin']}>
                <AdminPage />
              </RequireRole>
            } />
            <Route path="/task" element={<Task />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/key-tools" element={<KeyToolsPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/circular-archive" element={<CircularArchive />} />
            <Route path="/circular/:id" element={<CircularDetail />} />
            <Route path="/penalty-archive" element={<PenaltyArchive />} />
            <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
      </NotificationsProvider>
    </AuthProvider>
  );
}

export default App;