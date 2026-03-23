import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('qa_dashboard_token');
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-dark-bg text-slate-200 font-sans selection:bg-primary selection:text-white">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
