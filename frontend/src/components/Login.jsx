import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock } from 'lucide-react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('qa_dashboard_token', data.token);
        navigate('/');
      } else {
        setError(data.detail || 'Invalid password');
      }
    } catch (err) {
      setError('Connection failed. Are you sure you are accessing via the proxy?');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-8 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-primary/20 blur-[60px] pointer-events-none"></div>

        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-primary/20 text-primary rounded-full flex items-center justify-center border border-primary/30">
            <ShieldCheck size={32} />
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-center text-white mb-2">QA Dashboard</h2>
        <p className="text-slate-400 text-center mb-8">System Observability Portal</p>
        
        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-slate-500" />
              </div>
              <input
                type="password"
                className="block w-full pl-10 pr-3 py-3 border border-dark-border rounded-lg bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="Enter access code"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </div>
          
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-slate-900 transition-colors"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
