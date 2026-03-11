<?php
// ============================================================================
// BACKEND PHP (PENGGANTI FIREBASE)
// ============================================================================
$tokens_file = __DIR__ . '/db_tokens.json';
$files_file = __DIR__ . '/db_files.json';

// Inisialisasi file database otomatis jika belum ada di server cPanel
if (!file_exists($tokens_file)) file_put_contents($tokens_file, json_encode([]));
if (!file_exists($files_file)) file_put_contents($files_file, json_encode(["domain.txt" => ["content" => "", "updatedAt" => ["seconds" => time()]]]));

// Menangani permintaan API dari Frontend (React)
$action = $_GET['action'] ?? '';
if ($action) {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true) ?: [];

    // API: Dapatkan semua token
    if ($action === 'get_tokens') {
        echo file_get_contents($tokens_file);
        exit;
    }
    // API: Tambah/Timpa token
    if ($action === 'add_token' && $method === 'POST') {
        $tokens = json_decode(file_get_contents($tokens_file), true) ?: [];
        $newToken = [
            'id' => uniqid(),
            'title' => $input['title'] ?? 'Token',
            'token' => $input['token'],
            'createdAt' => ['seconds' => time()]
        ];
        
        if (!empty($input['autoReplace'])) {
            $tokens = [$newToken]; // Mode timpa
        } else {
            array_unshift($tokens, $newToken); // Mode akumulasi (tambah ke atas)
        }
        
        file_put_contents($tokens_file, json_encode($tokens, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'data' => $newToken]);
        exit;
    }
    // API: Hapus token
    if ($action === 'delete_token' && $method === 'POST') {
        $tokens = json_decode(file_get_contents($tokens_file), true) ?: [];
        $id = $input['id'] ?? '';
        $tokens = array_filter($tokens, fn($t) => $t['id'] !== $id);
        file_put_contents($tokens_file, json_encode(array_values($tokens), JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
        exit;
    }

    // API: Dapatkan semua file editor
    if ($action === 'get_files') {
        echo file_get_contents($files_file);
        exit;
    }
    // API: Simpan isi file editor
    if ($action === 'save_file' && $method === 'POST') {
        $files = json_decode(file_get_contents($files_file), true) ?: [];
        $filename = $input['filename'];
        $files[$filename] = [
            'content' => $input['content'],
            'updatedAt' => ['seconds' => time()]
        ];
        file_put_contents($files_file, json_encode($files, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
        exit;
    }
    // API: Hapus file editor permanen
    if ($action === 'delete_file' && $method === 'POST') {
        $files = json_decode(file_get_contents($files_file), true) ?: [];
        $filename = $input['filename'];
        unset($files[$filename]);
        file_put_contents($files_file, json_encode($files, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
        exit;
    }
    // API: Buat file editor baru
    if ($action === 'create_file' && $method === 'POST') {
         $files = json_decode(file_get_contents($files_file), true) ?: [];
         $filename = $input['filename'];
         if (!isset($files[$filename])) {
             $files[$filename] = ['content' => '', 'updatedAt' => ['seconds' => time()]];
             file_put_contents($files_file, json_encode($files, JSON_PRETTY_PRINT));
         }
         echo json_encode(['success' => true]);
         exit;
    }
    exit;
}
// ============================================================================
// FRONTEND HTML & REACT
// ============================================================================
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Public Token Vault & File Editor (PHP Backend)</title>
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- React & ReactDOM -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    
    <!-- Babel for JSX -->
    <script src="https://unpkg.com/@babel/standalone@7.23.6/babel.min.js"></script>

    <!-- Tailwind Config for Animations -->
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    animation: {
                        'in': 'fade-in 0.3s ease-out',
                        'bounce': 'bounce 1s infinite',
                    },
                    keyframes: {
                        'fade-in': {
                            '0%': { opacity: '0', transform: 'translateY(10px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' },
                        }
                    }
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .code-block { background: #1e293b; color: #a5b4fc; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    </style>
</head>
<body class="bg-slate-50 text-slate-900">
    <div id="root"></div>

    <script type="text/babel" data-type="module" data-presets="react">
        const { useState, useEffect, useCallback, useRef } = React;

        // --- Helper Fungsi Pemanggilan API ke Backend PHP ---
        const fetchAPI = async (action, data = null) => {
            const url = `${window.location.pathname}?action=${action}`;
            const options = {
                method: data ? 'POST' : 'GET',
                headers: data ? { 'Content-Type': 'application/json' } : {},
            };
            if (data) options.body = JSON.stringify(data);
            const res = await fetch(url, options);
            return await res.json();
        };

        // --- Icon Components ---
        const IconBase = ({ children, className, ...props }) => (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>{children}</svg>
        );
        const Key = (props) => <IconBase {...props}><path d="m21 2-2 2m-7.6 7.6a6.5 6.5 0 1 1 5.3 5.3L3 21l-3-3 8-8Z"/><path d="M16 3a6 6 0 1 1-6 6"/></IconBase>;
        const Copy = (props) => <IconBase {...props}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></IconBase>;
        const Eye = (props) => <IconBase {...props}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></IconBase>;
        const EyeOff = (props) => <IconBase {...props}><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></IconBase>;
        const CheckCheck = (props) => <IconBase {...props}><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></IconBase>;
        const Clipboard = (props) => <IconBase {...props}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></IconBase>;
        const X = (props) => <IconBase {...props}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></IconBase>;
        const Trash2 = (props) => <IconBase {...props}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></IconBase>;
        const AlertCircle = (props) => <IconBase {...props}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></IconBase>;
        const Zap = (props) => <IconBase {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></IconBase>;
        const Home = (props) => <IconBase {...props}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></IconBase>;
        const Settings = (props) => <IconBase {...props}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.35a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></IconBase>;
        const Save = (props) => <IconBase {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></IconBase>;
        const Terminal = (props) => <IconBase {...props}><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></IconBase>;
        const Code = (props) => <IconBase {...props}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></IconBase>;
        const Loader2 = (props) => <IconBase {...props}><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/></IconBase>;
        const FileText = (props) => <IconBase {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></IconBase>;
        const ExternalLink = (props) => <IconBase {...props}><path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></IconBase>;
        const Plus = (props) => <IconBase {...props}><path d="M5 12h14"/><path d="M12 5v14"/></IconBase>;
        const RefreshCw = (props) => <IconBase {...props}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></IconBase>;

        // --- Helper Copy ---
        const copyToClipboard = async (text) => {
            if (!text) return;
            const fallbackCopy = (text) => {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } finally {
                    document.body.removeChild(textArea);
                }
            };
            try {
                if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
                else fallbackCopy(text);
            } catch (err) { fallbackCopy(text); }
        };

        // --- Components ---
        function ApiModal({ onClose, fileList }) {
            const baseUrl = window.location.origin + window.location.pathname;

            return (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                      <div className="bg-slate-900 text-slate-200 rounded-xl shadow-2xl w-full max-w-2xl p-6 border border-slate-700 overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                            <h3 className="font-bold text-xl flex items-center gap-2 text-indigo-400">
                                <Terminal className="w-6 h-6" />
                                API Fetching Guide (Local PHP)
                            </h3>
                            <button onClick={onClose}><X className="w-6 h-6 text-slate-400 hover:text-white" /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl">
                                <h4 className="font-bold text-sm text-indigo-300 mb-2 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                                    GET ALL TOKENS (VAULT)
                                </h4>
                                <pre className="code-block p-4 rounded-lg overflow-x-auto text-xs font-mono select-all cursor-pointer" onClick={(e) => copyToClipboard(e.target.innerText)}>{`curl "${baseUrl}?action=get_tokens"`}</pre>
                                <p className="text-[9px] text-right text-slate-500 mt-1">*Klik untuk menyalin cURL</p>
                            </div>

                            <div className="pt-4 border-t border-slate-700">
                                <h4 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    Endpoints File Editor (File Aktif)
                                </h4>
                                <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                                    {fileList.map(file => (
                                        <div key={file} className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                                            <div className="flex justify-between items-center mb-2">
                                                <code className="text-xs font-bold text-blue-300">{file}</code>
                                                <div className="flex gap-2">
                                                     <button onClick={() => copyToClipboard(`${baseUrl}?token=TOKEN_DISINI&file=${file}#/editor/${file}`)} className="text-[10px] bg-indigo-700 hover:bg-indigo-600 px-2 py-1 rounded text-white flex items-center gap-1">
                                                        <Zap className="w-3 h-3" /> URL Auto-Fill
                                                    </button>
                                                    <button onClick={() => copyToClipboard(`${baseUrl}?action=get_files`)} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300 flex items-center gap-1">
                                                        <Copy className="w-3 h-3" /> API URL
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono break-all line-clamp-1">
                                                ?token=...&file={file}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-700">
                                <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-lg transition-colors">Tutup Panduan API</button>
                            </div>
                        </div>
                      </div>
                </div>
            )
        }

        function SettingsModal({ onClose, autoReplace, onToggleReplace }) {
            return (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Settings className="w-5 h-5 text-indigo-600" />Pengaturan</h3>
                            <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="mb-6 p-3 bg-indigo-50 rounded-lg border border-indigo-100 transition-colors hover:bg-indigo-100">
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-bold text-indigo-900 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Mode Timpa (Satu Token)</span>
                                <input type="checkbox" checked={autoReplace} onChange={(e) => onToggleReplace(e.target.checked)} className="accent-indigo-600 w-5 h-5 cursor-pointer" />
                            </label>
                            <p className="text-xs text-indigo-600 mt-2 leading-relaxed">Jika aktif, input token baru (Manual/Ekstensi) akan otomatis <strong>menghapus/menggantikan</strong> token lama.</p>
                        </div>
                        <button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all"><Save className="w-4 h-4" /> Tutup & Simpan</button>
                      </div>
                </div>
            )
        }

        function ConfirmationModal({ tokenText, onConfirm, onCancel, isDeleting, confirmLabel = "Ya, Hapus" }) {
            return (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">Konfirmasi Tindakan</h3>
                        <div className="bg-slate-100 p-2 rounded text-xs font-mono text-slate-600 line-clamp-3 mb-4 break-all">{tokenText}</div>
                        <div className="flex gap-2 justify-center">
                            <button onClick={onCancel} disabled={isDeleting} className="px-4 py-2 text-sm bg-slate-100 rounded-lg">Batal</button>
                            <button onClick={onConfirm} disabled={isDeleting} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg flex items-center gap-1">
                                {isDeleting ? 'Memproses...' : <><Trash2 className="w-4 h-4" /> {confirmLabel}</>}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        function TokenCard({ note, onDelete, isLinkView }) {
            const [copied, setCopied] = useState(false);
            const [headerCopied, setHeaderCopied] = useState(false);
            const [revealed, setRevealed] = useState(true);

            const handleCopy = () => { copyToClipboard(note.token).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
            const handleCopyHeader = () => { copyToClipboard(`Authorization: Bearer ${note.token}`).then(() => { setHeaderCopied(true); setTimeout(() => setHeaderCopied(false), 2000); }); };

            return (
                <div className={`bg-white rounded-2xl shadow-xl border-2 overflow-hidden ${isLinkView ? 'border-indigo-600 ring-4 ring-indigo-100' : 'border-indigo-100'}`}>
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-full ${isLinkView ? 'bg-indigo-600 text-white' : 'bg-white border text-indigo-600'}`}><Zap className="w-5 h-5" fill={isLinkView ? "white" : "none"} /></div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">{isLinkView ? "TOKEN DITERIMA" : (note.title || "Token Terbaru")}</h3>
                                <p className="text-[10px] text-slate-500">{note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000).toLocaleString() : new Date().toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => setRevealed(!revealed)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">{revealed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                            <button onClick={() => onDelete(note.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-5 h-5" /></button>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div onClick={handleCopy} className={`w-full bg-slate-800 text-slate-200 font-mono text-sm p-4 rounded-xl cursor-pointer hover:bg-slate-900 transition-colors relative ${revealed ? 'break-all' : 'truncate'}`}>
                            {revealed ? note.token : `${note.token.slice(0, 60)}•••••••`}
                            <div className="absolute top-2 right-2">{copied ? <CheckCheck className="text-green-400 w-4 h-4" /> : <Copy className="text-slate-500 w-4 h-4" />}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleCopy} className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 border ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                                {copied ? <><CheckCheck className="w-4 h-4" /> Disalin</> : <><Copy className="w-4 h-4" /> Salin Token</>}
                            </button>
                            <button onClick={handleCopyHeader} className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 text-white ${headerCopied ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                {headerCopied ? <><CheckCheck className="w-4 h-4" /> Header Ready!</> : <><Terminal className="w-4 h-4" /> Salin Auth Header</>}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        function FileEditor({ extensionToken, setExtensionToken, autoReplace, filesData, fetchFiles }) {
            const [activeFile, setActiveFile] = useState(() => {
                const hash = (window.location.hash || '').replace(/^#/, '');
                const m = hash.match(/^\/editor\/?(.*)$/i);
                return m && m[1] ? decodeURIComponent(m[1]) : '';
            });
            const fileList = Object.keys(filesData).sort();

            const [content, setContent] = useState('');
            const [isSaving, setIsSaving] = useState(false);
            const [lastSaved, setLastSaved] = useState(null);
            const [statusMsg, setStatusMsg] = useState('');
            
            const [appendInput, setAppendInput] = useState('');
            const [isAppending, setIsAppending] = useState(false);
            
            const [showDeleteModal, setShowDeleteModal] = useState(false);
            const [deleteAction, setDeleteAction] = useState(null);
            const timeoutRef = useRef(null);

            // 1. Sync URL hash -> activeFile (Mendengarkan perubahan URL manual/Back browser)
            useEffect(() => {
                const onHashChange = () => {
                    const hash = (window.location.hash || '').replace(/^#/, '');
                    const m = hash.match(/^\/editor\/?(.*)$/i);
                    const fileFromHash = m && m[1] ? decodeURIComponent(m[1]) : '';
                    if (fileFromHash && fileFromHash !== activeFile) {
                        setActiveFile(fileFromHash);
                    }
                };
                window.addEventListener('hashchange', onHashChange);
                return () => window.removeEventListener('hashchange', onHashChange);
            }, [activeFile]);

            // 2. Default ke file pertama HANYA JIKA tidak ada activeFile sama sekali
            useEffect(() => {
                if (!activeFile && fileList.length > 0) {
                    setActiveFile(fileList[0]);
                }
            }, [activeFile, fileList.join(',')]);

            // 3. Sync activeFile -> URL hash (Update URL saat ganti tab file)
            useEffect(() => {
                if (activeFile) {
                    const expectedHash = `#/editor/${encodeURIComponent(activeFile)}`;
                    if (window.location.hash !== expectedHash) {
                        window.history.replaceState(null, '', expectedHash);
                    }
                }
            }, [activeFile]);

            // 4. Sync data content local
            useEffect(() => {
                if (activeFile && filesData[activeFile]) {
                    // Update content only if not currently typing
                    const serverContent = filesData[activeFile].content || '';
                    if (content === '' && serverContent !== '') setContent(serverContent);
                    if (filesData[activeFile].updatedAt) setLastSaved(new Date(filesData[activeFile].updatedAt.seconds * 1000));
                } else if (activeFile && Object.keys(filesData).length > 0 && !filesData[activeFile]) {
                    // Hanya reset content jika filesData sudah selesai di-fetch dan file benar-benar tidak ada di server
                    setContent('');
                    setLastSaved(null);
                }
            }, [activeFile, filesData[activeFile]]);

            // Force refresh when clicked
            const refreshContent = () => {
                if(activeFile && filesData[activeFile]) setContent(filesData[activeFile].content || '');
            };

            // Auto-paste URL token
            useEffect(() => {
                if (extensionToken && activeFile) {
                    const appendToActiveFile = async () => {
                        setIsSaving(true);
                        setStatusMsg(`Memproses ke ${activeFile}...`);
                        try {
                            const serverContent = filesData[activeFile]?.content || '';
                            let newContent = extensionToken;
                            if (!autoReplace && serverContent.trim()) newContent = serverContent + '\n' + extensionToken;

                            await fetchAPI('save_file', { filename: activeFile, content: newContent });
                            setContent(newContent);
                            await fetchFiles();

                            setStatusMsg(`Sukses! Token ${autoReplace ? 'ditimpa' : 'ditambahkan'}`);
                            const newUrl = new URL(window.location);
                            newUrl.searchParams.delete('token');
                            newUrl.searchParams.delete('file');
                            window.history.replaceState({}, '', newUrl);
                            setExtensionToken(null);
                        } catch (e) {
                            setStatusMsg('Gagal memproses data.');
                        } finally {
                            setIsSaving(false);
                            setTimeout(() => setStatusMsg(''), 3000);
                        }
                    };
                    appendToActiveFile();
                }
            }, [extensionToken, activeFile, autoReplace, filesData]);

            const saveContent = async (textToWrite, silent = false) => {
                if (!activeFile) return;
                setIsSaving(true);
                try {
                    await fetchAPI('save_file', { filename: activeFile, content: textToWrite });
                    setLastSaved(new Date());
                    fetchFiles(); // update background
                    if (!silent) { setStatusMsg('Berhasil menyimpan!'); setTimeout(() => setStatusMsg(''), 3000); }
                } finally { setIsSaving(false); }
            };

            const handleContentChange = (e) => { 
                const newVal = e.target.value; setContent(newVal); 
                if (timeoutRef.current) clearTimeout(timeoutRef.current); 
                timeoutRef.current = setTimeout(() => { saveContent(newVal, true); }, 750); 
            };
            const handlePaste = () => { setTimeout(() => { saveContent(content, false); }, 100); };
            
            const [headerCopied, setHeaderCopied] = useState(false);
            const copyHeader = () => { const tokens = content.split(/\r?\n/).map(s => s.trim()).filter(Boolean); const header = tokens.map(t => 'Authorization: Bearer ' + t).join('\n'); copyToClipboard(header).then(() => { setHeaderCopied(true); setTimeout(() => setHeaderCopied(false), 2000); }); };
            const openRawView = (autoCopy = false) => { const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); if (autoCopy) { navigator.clipboard.writeText(content).then(() => { window.open(url, '_blank'); }); } else { window.open(url, '_blank'); } };

            const confirmAction = async () => {
                if (deleteAction === 'clear_content') {
                    setContent('');
                    await saveContent('', true);
                } else if (deleteAction === 'delete_file') {
                    if(!activeFile) return;
                    setIsSaving(true);
                    try {
                        await fetchAPI('delete_file', { filename: activeFile });
                        setStatusMsg(`File ${activeFile} dihapus.`);
                        await fetchFiles();
                    } finally { setIsSaving(false); }
                }
                setShowDeleteModal(false);
                setDeleteAction(null);
            };

            const handleAppend = async (textToAppend) => {
                if (!textToAppend.trim() || !activeFile) return;
                setIsAppending(true);
                const newContent = (content || '').trim().length > 0 ? (content + '\n' + textToAppend.trim()) : textToAppend.trim();
                setContent(newContent); setAppendInput('');
                try {
                    await fetchAPI('save_file', { filename: activeFile, content: newContent });
                    setStatusMsg('Berhasil menambahkan item!');
                    fetchFiles();
                    setTimeout(() => setStatusMsg(''), 2000);
                } finally { setIsAppending(false); }
            };

            const handleCreateFile = async () => {
                const name = prompt("Masukkan nama file baru (contoh: notes.txt):");
                if (!name) return;
                const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '');
                if (!safeName) { alert("Nama file tidak valid."); return; }
                if (fileList.includes(safeName)) { alert("File sudah ada!"); setActiveFile(safeName); return; }
                setIsSaving(true);
                try {
                    await fetchAPI('create_file', { filename: safeName });
                    await fetchFiles();
                    setActiveFile(safeName);
                    setContent('');
                    setStatusMsg(`File ${safeName} dibuat!`);
                } finally { setIsSaving(false); }
            };

            return (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative animate-in slide-in-from-bottom-4 duration-500">
                    {showDeleteModal && (
                        <ConfirmationModal tokenText={deleteAction === 'delete_file' ? `HAPUS file "${activeFile}"?` : `Kosongkan file "${activeFile}"?`} onConfirm={confirmAction} onCancel={() => setShowDeleteModal(false)} isDeleting={isSaving} confirmLabel={deleteAction === 'delete_file' ? "Ya, Hapus" : "Kosongkan"} />
                    )}
                    {isSaving && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                            <div className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /><span className="font-semibold">Menyimpan...</span></div>
                        </div>
                    )}
                    <div className="bg-slate-50 border-b border-slate-200 overflow-x-auto flex items-center justify-between pr-2">
                        <div className="flex px-2 overflow-x-auto">
                            {fileList.map((file) => (
                                <button key={file} onClick={() => {setActiveFile(file); refreshContent();}} className={`px-4 py-3 text-sm font-mono whitespace-nowrap border-b-2 transition-colors ${activeFile === file ? 'border-blue-600 text-blue-700 font-bold bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>{file}</button>
                            ))}
                        </div>
                        <button onClick={handleCreateFile} className="ml-2 p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold whitespace-nowrap" title="Buat File Baru"><Plus className="w-4 h-4" /> Baru</button>
                    </div>
                    
                    {fileList.length === 0 ? (
                         <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-64"><FileText className="w-12 h-12 mb-4 opacity-20" /><p className="mb-4">Tidak ada file.</p><button onClick={handleCreateFile} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Buat File</button></div>
                    ) : (
                        <div className="p-6">
                            {statusMsg && (
                                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center justify-between text-sm"><span className="flex items-center gap-2"><CheckCheck className="w-4 h-4" /> {statusMsg}</span></div>
                            )}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    File Aktif: <code className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold">{activeFile}</code>
                                    <button onClick={() => {setDeleteAction('delete_file'); setShowDeleteModal(true);}} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                                    <button onClick={refreshContent} className="p-1 text-slate-400 hover:text-blue-500 rounded" title="Tarik Update dari Server"><RefreshCw className="w-4 h-4" /></button>
                                </label>
                                {lastSaved && (<span className="text-xs text-slate-400">Disimpan: {lastSaved.toLocaleString()}</span>)}
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <button onClick={() => openRawView(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-slate-100 text-slate-700 hover:bg-slate-200"><ExternalLink className="w-3 h-3" /> Lihat Raw</button>
                                <button onClick={() => openRawView(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-green-50 text-green-700 hover:bg-green-100"><Clipboard className="w-3 h-3" /> Auto Salin (Raw)</button>
                                <button onClick={copyHeader} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded text-white ${headerCopied ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}><Terminal className="w-3 h-3" /> Salin Header</button>
                            </div>
                            <div className="relative mb-4">
                                <textarea value={content} onChange={handleContentChange} onPaste={handlePaste} placeholder="Ketik atau paste konten di sini..." spellCheck={false} className="w-full h-64 p-4 border border-slate-300 rounded-lg shadow-inner font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-800 resize-y" />
                            </div>
                            <div className="flex flex-wrap gap-3 mb-6">
                                <button onClick={() => saveContent(content)} disabled={isSaving} className="py-2 px-5 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 flex items-center gap-2"><Save className="w-4 h-4" /> Simpan Manual</button>
                                <button onClick={() => {setDeleteAction('clear_content'); setShowDeleteModal(true);}} className="py-2 px-5 bg-orange-50 text-orange-600 font-medium rounded-lg hover:bg-orange-100 ml-auto flex items-center gap-1"><X className="w-4 h-4" /> Kosongkan</button>
                            </div>
                            <div className="bg-slate-100 rounded-xl border border-slate-300 p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2"><Plus className="w-4 h-4" /> Quick Append</label>
                                </div>
                                <textarea value={appendInput} onChange={(e) => { const v = e.target.value; setAppendInput(v); if(v.length > 20) handleAppend(v); }} placeholder="Paste untuk menambahkan ke baris paling bawah..." className="w-full p-3 rounded-lg border border-slate-300 focus:border-indigo-500 outline-none font-mono text-xs h-20 resize-none bg-white" />
                                <p className="text-[10px] text-slate-500 mt-1 text-right flex justify-between">
                                    <span className="flex items-center gap-1 text-indigo-400 font-semibold"><RefreshCw className="w-3 h-3" /> {autoReplace ? 'Mode Timpa' : 'Akumulasi'}</span>
                                    <span>Auto-upload &gt; 20 char</span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // --- Main App Component ---
        function App() {
            const [notes, setNotes] = useState([]);
            const [filesData, setFilesData] = useState({});
            const [loading, setLoading] = useState(true);
            
            const [tokenInput, setTokenInput] = useState('');
            const [isSubmitting, setIsSubmitting] = useState(false);
            const [directViewToken, setDirectViewToken] = useState(null);
            
            const [isDeleting, setIsDeleting] = useState(false);
            const [tokenToDeleteId, setTokenToDeleteId] = useState(null);

            const [isSettingsOpen, setIsSettingsOpen] = useState(false);
            const [isApiModalOpen, setIsApiModalOpen] = useState(false); 
            const [extensionToken, setExtensionToken] = useState(null); 

            const [autoReplace, setAutoReplace] = useState(() => localStorage.getItem('autoReplace') === 'true');
            const [activeTab, setActiveTab] = useState('tokens');

            useEffect(() => { localStorage.setItem('autoReplace', autoReplace); }, [autoReplace]);

            // Set tab from Hash
            useEffect(() => {
                const setTabFromLocation = () => {
                    const hash = (location.hash || '').toLowerCase();
                    const path = location.pathname.toLowerCase();
                    const src = hash ? hash.replace(/^#/, '') : path;
                    if (src.startsWith('/editor')) setActiveTab('editor'); else setActiveTab('tokens');
                };
                setTabFromLocation();
                window.addEventListener('hashchange', setTabFromLocation);
                return () => window.removeEventListener('hashchange', setTabFromLocation);
            }, []);

            // Polling Data Server (Tokens & Files)
            const fetchTokens = async () => {
                try {
                    const data = await fetchAPI('get_tokens');
                    setNotes(data || []); setLoading(false);
                } catch(e) { console.error("Err fetch tokens", e); }
            };
            const fetchFiles = async () => {
                try {
                    const data = await fetchAPI('get_files');
                    setFilesData(data || {});
                } catch(e) { console.error("Err fetch files", e); }
            };

            useEffect(() => {
                fetchTokens(); fetchFiles();
                const int1 = setInterval(fetchTokens, 3000);
                const int2 = setInterval(fetchFiles, 3000);
                return () => { clearInterval(int1); clearInterval(int2); };
            }, []);

            // Save Token Logic
            const saveToken = async (tokenValue) => {
                if (!tokenValue.trim()) return;
                setIsSubmitting(true);
                try {
                    const autoTitle = `Token ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
                    await fetchAPI('add_token', { token: tokenValue.trim(), title: autoTitle, autoReplace });
                    setTokenInput(''); 
                    fetchTokens();
                } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
            };

            // URL Params
            useEffect(() => {
                try {
                    const params = new URLSearchParams(window.location.search);
                    const urlToken = params.get('token');
                    const targetFile = params.get('file'); 

                    if (targetFile) {
                          location.hash = `#/editor/${encodeURIComponent(targetFile)}`;
                          setActiveTab('editor');
                    }
                    if (urlToken && urlToken.length > 5) {
                        const hash = location.hash || '';
                        if (targetFile || hash.startsWith('#/editor')) {
                            setExtensionToken(urlToken);
                            setActiveTab('editor');
                        } else {
                            setDirectViewToken(urlToken);
                            saveToken(urlToken);
                        }
                    }
                } catch (e) { }
            }, []); 

            // Delete Token Logic
            const deleteToken = async (id) => {
                if (tokenToDeleteId !== id) { setTokenToDeleteId(id); return; }
                setIsDeleting(true);
                try {
                    let realId = id;
                    if (id === 'temp-link-view') realId = notes.find(n => n.token === directViewToken)?.id;
                    
                    if (realId) await fetchAPI('delete_token', { id: realId });
                    
                    if (directViewToken && (id === 'temp-link-view' || realId === id)) {
                        setDirectViewToken(null);
                        window.history.replaceState({}, '', window.location.pathname);
                    }
                    setTokenToDeleteId(null);
                    fetchTokens();
                } catch (err) { console.error(err); } finally { setIsDeleting(false); }
            };

            const viewFromLink = directViewToken ? { id: 'temp-link-view', title: 'Token dari Link', token: directViewToken, createdAt: { seconds: Date.now() / 1000 } } : null;
            const displayNote = viewFromLink || (notes.length > 0 ? notes[0] : null);
            const isLinkMode = !!directViewToken;

            const resetView = () => { setDirectViewToken(null); setTokenInput(''); window.history.replaceState({}, '', window.location.pathname); };
            const tokenToConfirm = isLinkMode ? (tokenToDeleteId === 'temp-link-view' ? viewFromLink : null) : notes.find(n => n.id === tokenToDeleteId);

            return (
                <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col items-center pt-8 px-4 pb-12 relative">
                
                {tokenToConfirm && (
                    <ConfirmationModal tokenText={tokenToConfirm.token} onConfirm={() => deleteToken(tokenToConfirm.id)} onCancel={() => setTokenToDeleteId(null)} isDeleting={isDeleting} />
                )}

                {isSettingsOpen && (
                    <SettingsModal autoReplace={autoReplace} onToggleReplace={setAutoReplace} onClose={() => setIsSettingsOpen(false)} />
                )}

                {isApiModalOpen && (
                    <ApiModal onClose={() => setIsApiModalOpen(false)} fileList={Object.keys(filesData)} />
                )}

                <div className="w-full max-w-3xl flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <Key className="w-8 h-8" />
                        <h1 className="text-2xl font-bold tracking-tight">{activeTab === 'editor' ? 'Web File Editor' : 'Token Vault (Local)'}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex gap-1 items-center">
                            <button onClick={() => { window.location.hash = ''; setActiveTab('tokens'); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tokens' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}><Key className="w-4 h-4" /> Vault</button>
                            <button onClick={() => { window.location.hash = '#/editor'; setActiveTab('editor'); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'editor' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><FileText className="w-4 h-4" /> Editor</button>
                        </div>
                        <div className="h-6 w-px bg-slate-300 mx-1"></div>
                        <button onClick={() => setIsApiModalOpen(true)} className="p-2 flex items-center gap-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all text-xs font-bold border border-transparent hover:border-indigo-100" title="Cara Fetch API"><Code className="w-5 h-5" /><span className="hidden sm:inline">API</span></button>
                        <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-1.5 p-2 pr-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all group border border-transparent hover:border-indigo-100" title="Pengaturan">
                            <Settings className="w-6 h-6 group-hover:rotate-45 transition-transform duration-500" />
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded group-hover:bg-indigo-100 group-hover:text-indigo-700 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3" /> {autoReplace ? 'Timpa' : 'Akumulasi'}
                            </span>
                        </button>
                    </div>
                </div>

                {activeTab === 'editor' ? (
                    <div className="w-full max-w-3xl">
                        <FileEditor extensionToken={extensionToken} setExtensionToken={setExtensionToken} autoReplace={autoReplace} filesData={filesData} fetchFiles={fetchFiles} />
                    </div>
                ) : (
                    <div className="w-full max-w-3xl space-y-6">
                        {loading && !displayNote ? (
                            <div className="h-48 bg-slate-200 rounded-xl animate-pulse" />
                        ) : displayNote ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {isLinkMode && (<div className="text-center mb-2 animate-bounce"><span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">LINK MODE</span></div>)}
                                <TokenCard note={displayNote} onDelete={deleteToken} isLinkView={isLinkMode} />
                                {isLinkMode && (<button onClick={resetView} className="mt-6 mx-auto flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors"><Home className="w-4 h-4" />Tutup & Kembali ke Input Manual</button>)}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center text-slate-400">
                                <Key className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p>Belum ada token.</p>
                                <div className="mt-4 text-xs bg-slate-100 px-3 py-1 rounded-full inline-block flex items-center justify-center gap-2 max-w-[200px] mx-auto">
                                    <RefreshCw className="w-3 h-3 text-slate-400" />
                                    <span>Mode: <strong>{autoReplace ? 'Timpa (Satu Token)' : 'Akumulasi'}</strong></span>
                                </div>
                            </div>
                        )}
                        {!isLinkMode && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mt-8 opacity-90 hover:opacity-100 transition-opacity">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Upload Manual</label>
                                </div>
                                <textarea value={tokenInput} onChange={(e) => { const v = e.target.value; setTokenInput(v); if(v.length > 20) saveToken(v); }} placeholder="Paste token disini..." className="w-full p-3 rounded-lg border border-slate-300 focus:border-indigo-500 outline-none font-mono text-xs h-20 resize-none bg-slate-50" />
                                <p className="text-[10px] text-slate-400 mt-1 text-right flex justify-between">
                                    <span className="flex items-center gap-1 text-indigo-400 font-semibold"><RefreshCw className="w-3 h-3" /> {autoReplace ? 'Mode Timpa Aktif' : 'Mode Akumulasi'}</span>
                                    <span>Auto-upload &gt; 20 char</span>
                                </p>
                            </div>
                        )}
                    </div>
                )}
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>