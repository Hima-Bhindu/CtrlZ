import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Shield, Upload as UploadIcon, Clock, HardDrive, KeyRound, Download, Trash2, Check, AlertCircle, History as HistoryIcon, LogOut, User } from 'lucide-react';
import './premium.css';

const API_URL = 'http://127.0.0.1:8001';

function App() {
  const [user, setUser] = useState(null); // { username, secretKey }
  const [activeTab, setActiveTab] = useState('upload');
  const [notification, setNotification] = useState(null);
  const [recoveryFileId, setRecoveryFileId] = useState('');

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const goToRecovery = (fileId) => {
    setRecoveryFileId(fileId);
    setActiveTab('recovery');
  };

  const executeDirectRecovery = async (fileId) => {
    try {
      showNotification('Bypassing security... Recovering file...', 'success');
      const formData = new FormData();
      formData.append('file_id', fileId);
      formData.append('username', user.username);
      formData.append('secret_key', user.secretKey);

      const response = await axios.post(`${API_URL}/recover`, formData, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'recovered_file';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match && match[1]) filename = match[1];
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showNotification('File recovered successfully!', 'success');
    } catch (err) {
      showNotification('Recovery failed: Check Master Key or ID', 'error');
    }
  };

  const logout = () => {
    setUser(null);
    setActiveTab('upload');
    setRecoveryFileId('');
  };

  if (!user) {
    return (
      <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {notification && (
          <div className={`alert ${notification.type}`} style={{ marginBottom: '1rem', width: '100%', maxWidth: '500px' }}>
            <div className="flex items-center gap-2">
              {notification.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
              <span>{notification.msg}</span>
            </div>
          </div>
        )}
        <LoginScreen onLogin={(userObj) => { setUser(userObj); showNotification('Vault Access Granted', 'success'); }} onNotify={showNotification} />
      </div>
    );
  }

  return (
    <div className="glass-panel w-full" style={{ maxWidth: '900px' }}>
      <div className="flex justify-between items-center mb-6 border-b pb-4" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="flex items-center gap-4">
          <Shield size={40} className="text-primary shield-icon" />
          <h1 style={{ fontSize: '2rem', margin: 0 }}>CtrlZ</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-muted flex items-center gap-2" style={{ fontFamily: 'JetBrains Mono', fontSize: '0.9rem' }}>
            <User size={16} /> {user.username}
          </div>
          <button className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem', width: 'auto', background: 'var(--glass-border)', color: '#fff' }} onClick={logout}>
            <LogOut size={16} /> Exit
          </button>
        </div>
      </div>

      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        You are using a Master Secret Key. All files are automatically encrypted and decrypted with it.
      </p>

      {notification && (
        <div className={`alert ${notification.type}`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
            <span>{notification.msg}</span>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>
          <div className="flex items-center gap-2"><UploadIcon size={18} /> Upload</div>
        </button>
        <button className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>
          <div className="flex items-center gap-2"><HardDrive size={18} /> Status</div>
        </button>
        <button className={`tab-btn ${activeTab === 'recovery' ? 'active' : ''}`} onClick={() => setActiveTab('recovery')}>
          <div className="flex items-center gap-2"><KeyRound size={18} /> Recovery</div>
        </button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <div className="flex items-center gap-2"><HistoryIcon size={18} /> History</div>
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'upload' && <UploadScreen user={user} onNotify={showNotification} onUploadSuccess={(id) => setRecoveryFileId(id)} />}
        {activeTab === 'status' && <StatusScreen user={user} onNotify={showNotification} onRecover={goToRecovery} />}
        {activeTab === 'recovery' && <RecoveryScreen user={user} onNotify={showNotification} initialFileId={recoveryFileId} setInitialFileId={setRecoveryFileId} />}
        {activeTab === 'history' && <HistoryScreen user={user} onNotify={showNotification} onRecover={goToRecovery} />}
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, onNotify }) {
  const [mode, setMode] = useState('login'); // login, signup, forgot
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !secret) return;
    if ((mode === 'signup' || mode === 'forgot') && !securityAnswer) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', username.trim());
      if (mode === 'forgot') {
         formData.append('new_secret_key', secret.trim());
         formData.append('security_answer', securityAnswer.trim());
         await axios.post(`${API_URL}/forgot-password`, formData);
         onNotify('Master Key Reset! You can now login.', 'success');
         setMode('login');
         setSecret('');
         setSecurityAnswer('');
      } else if (mode === 'signup') {
         formData.append('secret_key', secret.trim());
         formData.append('security_answer', securityAnswer.trim());
         await axios.post(`${API_URL}/signup`, formData);
         onNotify('Vault Created! You can now login.', 'success');
         setMode('login');
         setSecret('');
         setSecurityAnswer('');
      } else {
         formData.append('secret_key', secret.trim());
         await axios.post(`${API_URL}/login`, formData);
         onLogin({ username: username.trim(), secretKey: secret.trim() });
      }
    } catch (err) {
      onNotify('Error: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', margin: '0 auto', textAlign: 'center' }}>
      <Shield size={64} className="text-primary shield-icon mb-4" style={{ margin: '0 auto 1.5rem auto', display: 'block' }} />
      <h1 style={{ fontSize: '2.5rem' }}>
        {mode === 'login' ? 'Login' : mode === 'signup' ? 'Sign Up' : 'Recover Vault'}
      </h1>
      <p className="text-muted mb-4">
        {mode === 'login' ? 'Enter your username and Master Secret Key to access your encrypted vault.' :
         mode === 'signup' ? 'Create a secure vault. Remember your Key and Security Answer!' :
         'Reset your Master Secret Key using your Security Answer. Note: Old files will remain locked forever.'}
      </p>
      
      <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
        <div className="form-group">
          <label>Username</label>
          <input type="text" value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. AgentZero" required />
        </div>
        
        {(mode === 'signup' || mode === 'forgot') && (
          <div className="form-group">
            <label>Security Answer (Favorite Color?)</label>
            <input type="text" value={securityAnswer} onChange={e=>setSecurityAnswer(e.target.value)} placeholder="e.g. Crimson" required />
          </div>
        )}

        <div className="form-group">
          <label>{mode === 'forgot' ? 'New Master Secret Key' : 'Master Secret Key'}</label>
          <input type="password" value={secret} onChange={e=>setSecret(e.target.value)} placeholder="UnbreakablePassword123" required />
        </div>
        
        <button className="btn w-full mt-4" disabled={loading}>
          <KeyRound size={20} /> 
          {loading ? 'PROCESSING...' : mode === 'login' ? 'ACCESS VAULT' : mode === 'signup' ? 'CREATE VAULT' : 'RESET KEY'}
        </button>
        
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
           {mode === 'login' ? (
             <>
               <span className="text-muted cursor-pointer" onClick={() => setMode('signup')} style={{ marginRight: '1rem', textDecoration: 'underline', cursor: 'pointer' }}>Create Vault</span>
               <span className="text-muted cursor-pointer" onClick={() => setMode('forgot')} style={{ textDecoration: 'underline', cursor: 'pointer' }}>Forgot Key?</span>
             </>
           ) : (
             <span className="text-muted cursor-pointer" onClick={() => {setMode('login'); setSecret(''); setSecurityAnswer('')}} style={{ textDecoration: 'underline', cursor: 'pointer' }}>Back to Login</span>
           )}
        </div>
      </form>
    </div>
  );
}

function UploadScreen({ user, onNotify, onUploadSuccess }) {
  const [filePath, setFilePath] = useState('');
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!filePath) return;
    
    // Ensure all parsing handles empty string / NaN properly
    let d = parseInt(days) || 0;
    let h = parseInt(hours) || 0;
    let m = parseInt(minutes) || 0;
    let s = parseInt(seconds) || 0;
    
    const totalSeconds = (d * 86400) + (h * 3600) + (m * 60) + s;
    if (totalSeconds <= 0) {
       onNotify('Timer must be strictly greater than 0 seconds.', 'error');
       return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file_path', filePath.trim());
      formData.append('expires_in_secs', totalSeconds);
      formData.append('username', user.username);
      formData.append('secret_key', user.secretKey);

      const res = await axios.post(`${API_URL}/upload`, formData);
      if (onUploadSuccess) onUploadSuccess(res.data.file_id);
      onNotify('File vanished from system and encrypted successfully!', 'success');
      setFilePath('');
    } catch (err) {
      let errDetail = err.response?.data?.detail || err.message;
      if (typeof errDetail === 'object') errDetail = JSON.stringify(errDetail);
      onNotify('Upload failed: ' + errDetail, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div className="file-drop-area" style={{ cursor: 'default' }}>
        <UploadIcon size={48} className="text-primary" style={{ marginBottom: '1rem' }} />
        <h2>CtrlZ Extraction</h2>
        <p className="text-muted">Provide the exact local path to vanish the file from your computer.</p>
        <div style={{ textAlign: 'left', width: '100%', maxWidth: '400px', margin: '0 auto', marginTop: '1rem' }}>
           <input type="text" value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="e.g. C:\Users\ammu9\Desktop\secret.txt" />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: '1.5rem' }}>
        <label><Clock size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> Self-Destruct Timer</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Days</label>
            <input type="number" value={days} onChange={(e) => setDays(e.target.value)} min="0" />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hours</label>
            <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} min="0" />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Minutes</label>
            <input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} min="0" />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Seconds</label>
            <input type="number" value={seconds} onChange={(e) => setSeconds(e.target.value)} min="0" />
          </div>
        </div>
      </div>

      <button className="btn" onClick={handleUpload} disabled={!filePath || isUploading}>
        <Shield size={20} /> {isUploading ? 'ENCRYPTING...' : 'VANISH & ENCRYPT'}
      </button>
    </div>
  );
}

function StatusScreen({ user, onNotify, onRecover }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = async () => {
    try {
      const res = await axios.get(`${API_URL}/files?username=${encodeURIComponent(user.username)}`);
      setFiles(res.data.files);
    } catch (err) {
      onNotify('Failed to fetch status', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, 1000);
    return () => clearInterval(interval);
  }, [user.username]);

  const formatTime = (secs) => {
    if (secs <= 0) return "00:00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div>Loading vault node...</div>;

  if (files.length === 0) return <div className="text-center text-muted py-8">No files in your vault</div>;

  return (
    <div className="file-list">
      {files.map(file => (
        <div key={file.file_id}>
          <div className={`file-item ${file.status === 'Deleted' ? 'deleted' : ''}`} style={{ marginBottom: 0 }}>
            <div>
              <div className="font-bold flex items-center gap-2">
                <HardDrive size={18} className={file.status === 'Deleted' ? 'text-danger' : 'text-primary'} />
                {file.filename}
              </div>
              <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                ID: {file.file_id}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-bold ${file.status === 'Deleted' ? 'text-danger' : ''}`} style={{ fontFamily: 'JetBrains Mono', fontSize: '1.2rem' }}>
                {file.status === 'Deleted' ? 'DESTRUCTED' : formatTime(file.expires_in_secs)}
              </div>
              {file.status === 'Active' && (
                <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', marginTop: '0.5rem' }} onClick={() => onRecover(file.file_id)}>
                  <KeyRound size={14} /> Recover
                </button>
              )}
            </div>
          </div>
          
          {file.status === 'Deleted' && file.ai_caption && (
            <div style={{ padding: '1rem', background: 'rgba(255, 51, 102, 0.05)', borderBottom: '1px solid rgba(255, 51, 102, 0.2)', borderLeft: '4px solid var(--danger-color)', animation: 'slideDownFade 0.4s ease' }}>
               <div style={{ color: 'var(--danger-color)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', marginBottom: '8px', letterSpacing: '2px' }}>[ SIMULATED AI ANALYSIS ]</div>
               <div 
                 style={{ color: '#ff99aa', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '4px', fontStyle: 'italic', fontSize: '0.95rem' }}
                 onClick={() => onRecover(file.file_id)}
               >
                 "{file.ai_caption}"
               </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RecoveryScreen({ user, onNotify, initialFileId, setInitialFileId }) {
  const [fileId, setFileId] = useState(initialFileId || '');
  const [manualSecret, setManualSecret] = useState('');
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (initialFileId) setFileId(initialFileId);
  }, [initialFileId]);

  const handleRecover = async () => {
    if (!fileId || !manualSecret) {
      onNotify('File ID and Master Key are required', 'error');
      return;
    }
    setRecovering(true);
    try {
      const formData = new FormData();
      formData.append('file_id', fileId.trim());
      formData.append('username', user.username);
      formData.append('secret_key', manualSecret.trim());

      const response = await axios.post(`${API_URL}/recover`, formData);

      onNotify(`Success! File magically restored back to: ${response.data.restored_path}`, 'success');
      setFileId('');
      if (setInitialFileId) setInitialFileId('');
      
    } catch (err) {
      onNotify('Recovery failed: Invalid ID or Key', 'error');
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div>
      <h2><KeyRound size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}/> Execute Recovery</h2>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        Please provide the File ID and manually enter your Master Key to decrypt.
      </p>

      <div className="form-group">
        <label>File ID</label>
        <input 
          type="text" 
          value={fileId} 
          onChange={(e) => setFileId(e.target.value)}
          placeholder="e.g. 1f4a8b9c-..."
        />
      </div>

      <div className="form-group">
        <label>Master Key</label>
        <input 
          type="password" 
          value={manualSecret} 
          onChange={(e) => setManualSecret(e.target.value)}
          placeholder="Enter your Master Key"
          required
        />
      </div>

      <button className="btn" onClick={handleRecover} disabled={recovering}>
        <Download size={20} /> {recovering ? 'DECRYPTING...' : 'RECOVER FILE'}
      </button>
    </div>
  );
}

function HistoryScreen({ user, onNotify, onRecover }) {
  const [history, setHistory] = useState([]);
  const [deletedFiles, setDeletedFiles] = useState([]);
  const [filter, setFilter] = useState('all'); 
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [histRes, filesRes] = await Promise.all([
        axios.get(`${API_URL}/history?username=${encodeURIComponent(user.username)}`),
        axios.get(`${API_URL}/files?username=${encodeURIComponent(user.username)}`)
      ]);
      setHistory(histRes.data.history);
      setDeletedFiles(filesRes.data.files.filter(f => f.status === 'Deleted'));
    } catch (err) {
      onNotify('Failed to fetch history data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [user.username]);

  if (loading) return <div>Loading history...</div>;

  let displayItems = [];
  if (filter === 'all' || filter === 'recovered' || filter === 'upload') {
     let filteredHistory = history;
     if (filter === 'recovered') filteredHistory = history.filter(h => h.action === 'RECOVER');
     if (filter === 'upload') filteredHistory = history.filter(h => h.action === 'UPLOAD');
     
     displayItems = [...displayItems, ...filteredHistory.map(h => ({
         id: `hist_${h.id}`,
         filename: h.filename,
         action: h.action,
         timestamp: h.timestamp
     }))];
  }
  
  if (filter === 'all' || filter === 'deleted') {
     displayItems = [...displayItems, ...deletedFiles.map(f => ({
         id: `del_${f.file_id}`,
         file_id: f.file_id,
         filename: f.filename,
         action: 'DELETED',
         timestamp: f.expiry_time,
         ai_caption: f.ai_caption
     }))];
  }

  displayItems.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div>
      <div className="flex gap-2 mb-4" style={{ fontSize: '0.85rem' }}>
         <button className="btn" style={{ padding: '0.4rem', background: filter==='all'?'rgba(255,255,255,0.15)':'transparent', color: filter==='all'?'#fff':'var(--text-muted)', borderColor: filter==='all'?'rgba(255,255,255,0.3)':'transparent' }} onClick={() => setFilter('all')}>All</button>
         <button className="btn" style={{ padding: '0.4rem', background: filter==='upload'?'rgba(0, 255, 204, 0.2)':'transparent', color: filter==='upload'?'var(--primary-color)':'var(--text-muted)', borderColor: filter==='upload'?'var(--primary-color)':'transparent' }} onClick={() => setFilter('upload')}>Uploads</button>
         <button className="btn" style={{ padding: '0.4rem', background: filter==='recovered'?'rgba(188, 19, 254, 0.2)':'transparent', color: filter==='recovered'?'#bc13fe':'var(--text-muted)', borderColor: filter==='recovered'?'#bc13fe':'transparent' }} onClick={() => setFilter('recovered')}>Recovered</button>
         <button className="btn" style={{ padding: '0.4rem', background: filter==='deleted'?'rgba(255, 51, 102, 0.2)':'transparent', color: filter==='deleted'?'var(--danger-color)':'var(--text-muted)', borderColor: filter==='deleted'?'var(--danger-color)':'transparent' }} onClick={() => setFilter('deleted')}>Deleted</button>
      </div>

      <div className="file-list">
        {displayItems.length === 0 ? (
           <div className="text-center text-muted py-8">No matching history found</div>
        ) : (
          displayItems.map(item => (
            <div key={item.id}>
              <div className="file-item" style={{ borderLeftWidth: '0', marginBottom: 0 }}>
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {item.action === 'UPLOAD' && <UploadIcon size={16} className="text-primary" />}
                    {item.action === 'RECOVER' && <Download size={16} style={{ color: '#bc13fe' }} />}
                    {item.action === 'DELETED' && <Trash2 size={16} className="text-danger" />}
                    {item.filename}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                    Action: <span style={{ 
                      color: item.action === 'UPLOAD' ? 'var(--primary-color)' : item.action === 'DELETED' ? 'var(--danger-color)' : '#bc13fe', 
                      fontWeight: 'bold' 
                    }}>{item.action}</span>
                  </div>
                </div>
                <div className="text-right text-muted" style={{ fontSize: '0.85rem' }}>
                  <Clock size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }}/>
                  {new Date(item.timestamp * 1000).toLocaleString()}
                </div>
              </div>
              
              {item.action === 'DELETED' && item.ai_caption && (
                <div style={{ padding: '1rem', background: 'rgba(255, 51, 102, 0.03)', borderBottom: '1px solid rgba(255, 51, 102, 0.1)', animation: 'slideDownFade 0.4s ease' }}>
                   <div style={{ color: 'var(--danger-color)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', marginBottom: '8px', letterSpacing: '2px' }}>[ SIMULATED AI ANALYSIS ]</div>
                   <div 
                     style={{ color: '#ff99aa', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '4px', fontStyle: 'italic', fontSize: '0.95rem' }}
                     onClick={() => onRecover(item.file_id)}
                   >
                     "{item.ai_caption}"
                   </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
