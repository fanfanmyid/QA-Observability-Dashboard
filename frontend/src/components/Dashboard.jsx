import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Server, ActivitySquare, Terminal, RefreshCw, LogOut } from 'lucide-react';

const fetchWithAuth = async (url) => {
  const token = localStorage.getItem('qa_dashboard_token');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

const formatTimestampID = (ms) => {
  if (!ms) return '-';
  return new Date(ms).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

export default function Dashboard() {
  const [data, setData] = useState({ pipeline: null, tests: null, health: null, logs: null });
  const [logService, setLogService] = useState('backend');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [pipeline, tests, health, logs] = await Promise.all([
        fetchWithAuth('/api/qa/pipeline'),
        fetchWithAuth('/api/qa/tests'),
        fetchWithAuth('/api/qa/health'),
        fetchWithAuth(`/api/qa/logs?service=${logService}`)
      ]);
      setData({ pipeline, tests, health, logs });
      setLastUpdated(Date.now());
    } catch (err) {
      if (err.message === 'Unauthorized') {
        localStorage.removeItem('qa_dashboard_token');
        navigate('/login');
      } else {
        setError(err.message);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [logService]);

  const logout = () => {
    localStorage.removeItem('qa_dashboard_token');
    navigate('/login');
  };

  if (loading && !data.pipeline && !lastUpdated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  const JobStatus = ({ title, dataObj }) => (
    <div className="bg-slate-800/50 p-4 rounded-lg border border-dark-border mb-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">{title}</h3>
      <div className="flex justify-between items-center text-sm mb-2">
        <span className="text-slate-400">Build ID:</span>
        <span className="font-mono text-white">#{dataObj?.build_id}</span>
      </div>
      <div className="flex justify-between items-center text-sm mb-2">
        <span className="text-slate-400">Duration:</span>
        <span className="text-white">{dataObj?.duration}s</span>
      </div>
      <div className="flex justify-between items-center text-sm mb-2">
        <span className="text-slate-400">Timestamp:</span>
        <span className="text-white text-xs">{formatTimestampID(dataObj?.timestamp)}</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-400">Status:</span>
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${dataObj?.status === 'SUCCESS' ? 'bg-accent/20 text-accent' : dataObj?.status === 'FAILURE' ? 'bg-danger/20 text-danger' : 'bg-primary/20 text-primary'}`}>
          {dataObj?.status || 'UNKNOWN'}
        </span>
      </div>
    </div>
  );

  const TestStats = ({ title, dataObj, pipelineTimestamp }) => {
    const total = dataObj?.total || 1;
    const coverage = Math.round(((dataObj?.passed || 0) / total) * 100) || 0;
    return (
      <div className="bg-slate-800/50 p-4 rounded-lg border border-dark-border mb-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">{title}</h3>
        {pipelineTimestamp && (
          <div className="flex justify-between items-center text-xs mb-3">
             <span className="text-slate-400">Date:</span>
             <span className="text-white">{formatTimestampID(pipelineTimestamp)}</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="bg-slate-900/50 p-2 rounded">
            <p className="text-lg font-bold text-accent">{dataObj?.passed || 0}</p>
            <p className="text-[10px] text-slate-400 uppercase">Passed</p>
          </div>
          <div className="bg-slate-900/50 p-2 rounded">
            <p className="text-lg font-bold text-danger">{dataObj?.failed || 0}</p>
            <p className="text-[10px] text-slate-400 uppercase">Failed</p>
          </div>
          <div className="bg-slate-900/50 p-2 rounded">
            <p className="text-lg font-bold text-slate-400">{dataObj?.skipped || 0}</p>
            <p className="text-[10px] text-slate-400 uppercase">Skipped</p>
          </div>
        </div>
        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
          <div className="bg-accent h-full" style={{ width: `${coverage}%` }}></div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 glass-panel p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg border border-primary/30 text-primary">
              <ActivitySquare size={24} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">QA Observability Live</h1>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            {lastUpdated && (
              <span className="text-xs text-slate-400">
                Last updated: {formatTimestampID(lastUpdated)}
              </span>
            )}
            <button onClick={loadData} className="p-2 text-slate-400 hover:text-white transition-colors" title="Refresh">
              <RefreshCw size={20} className={loading ? "animate-spin text-primary" : ""} />
            </button>
            <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-dark-border transition-colors">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-danger/20 border border-danger/50 text-red-200 px-4 py-3 rounded-lg mb-6">
            Error loading dashboard: {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Pipeline Widget */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-6 text-primary">
              <Server size={24} />
              <h2 className="text-xl font-semibold text-white">Pipeline Jobs</h2>
            </div>
            <JobStatus title="Backend Service" dataObj={data.pipeline?.backend} />
            <JobStatus title="Frontend Service" dataObj={data.pipeline?.frontend} />
          </div>

          {/* Tests Widget */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-6 text-accent">
              <Activity size={24} />
              <h2 className="text-xl font-semibold text-white">Test Suites</h2>
            </div>
            <TestStats title="Backend API" dataObj={data.tests?.backend} pipelineTimestamp={data.pipeline?.backend?.timestamp} />
            <TestStats title="Frontend App" dataObj={data.tests?.frontend} pipelineTimestamp={data.pipeline?.frontend?.timestamp} />
          </div>

          {/* Health Widget */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-6 text-emerald-400">
              <ActivitySquare size={24} />
              <h2 className="text-xl font-semibold text-white">System Health</h2>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-lg border border-dark-border mb-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Backend API</h3>
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold ${data.health?.backend?.status === 'UP' ? 'text-accent' : 'text-danger'}`}>{data.health?.backend?.status || 'UNKNOWN'}</span>
              </div>
              <div className="text-xs text-slate-500 overflow-hidden truncate">
                {JSON.stringify(data.health?.backend?.details || data.health?.backend?.error || '{}')}
              </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-lg border border-dark-border">
              <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Frontend Proxy</h3>
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold ${data.health?.frontend?.status === 'UP' ? 'text-accent' : 'text-danger'}`}>{data.health?.frontend?.status || 'UNKNOWN'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Active Cons:</span>
                <span className="text-white">{data.health?.frontend?.active_connections || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Logs Widget */}
        <div className="glass-panel p-6">
          <div className="flex sm:flex-row flex-col items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 text-orange-400">
              <Terminal size={24} />
              <h2 className="text-xl font-semibold text-white">Live Docker Logs</h2>
            </div>
            <div className="flex bg-slate-800 rounded-lg p-1 border border-dark-border">
              <button 
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${logService === 'backend' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setLogService('backend')}
              >
                Backend
              </button>
              <button 
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${logService === 'frontend' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setLogService('frontend')}
              >
                Frontend
              </button>
            </div>
          </div>
          
          <div className="bg-[#0f111a] p-4 rounded-lg font-mono text-xs overflow-y-auto border border-slate-800 h-[250px] flex flex-col gap-1.5 custom-scrollbar">
            {data.logs && data.logs.length > 0 ? data.logs.map((log, i) => {
              const isError = log.includes('ERROR') || log.includes('Exception') || log.includes('Fail');
              const isWarn = log.includes('WARN');
              return (
                <div key={i} className={`whitespace-pre-wrap break-all ${isError ? 'text-danger' : isWarn ? 'text-orange-400' : 'text-slate-300'}`}>
                  {log}
                </div>
              );
            }) : (
              <div className="text-slate-500 italic">No logs found or waiting for connection...</div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
