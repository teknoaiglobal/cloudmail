import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CloudflareCredentials, Settings, Address, EmailRoutingRule, DNSRecord, ZoneDnsRecord, ApiResponse } from './types';
import { CloudflareService } from './services/cloudflareApi';
import { Layout } from './components/Layout';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';

const emailForwardLockKey = 'email_forward_lock';
const emailForwardValueKey = 'email_forward_value';
const catchAllForwardLockKey = 'catchall_forward_lock';
const catchAllForwardValueKey = 'catchall_forward_value';
const generatedEmailKey = 'generated_email_entries';
const mailboxApiBase = 'https://api.mail.tm';
const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/tekno-335f8/databases/(default)/documents/artifacts/default-app-id/public/data/public_files/cloudmail?key=AIzaSyCirtabCZOy3XMnNLUc-iKIYGegZJbPqhw';

type MailboxAccount = {
  id?: string;
  address: string;
  password: string;
  createdAt?: string;
};

type MailboxMessage = {
  id: string;
  from: { name?: string; address: string };
  to: { name?: string; address: string }[];
  subject?: string;
  intro?: string;
  createdAt: string;
  seen?: boolean;
  html?: string[];
  text?: string;
  attachments?: Array<{ id: string; filename: string; size: number; downloadUrl: string }>;
};

const App: React.FC = () => {
  // --- Credentials & API ---
  const loadCredentials = (): CloudflareCredentials | null => {
    try {
      const saved = localStorage.getItem('cf_creds');
      if (!saved) return null;
      return JSON.parse(saved);
    } catch {
      return null;
    }
  };

  const [activeTab, setActiveTab] = useState('subdomains');
  const [credentials, setCredentials] = useState<CloudflareCredentials | null>(loadCredentials);
  const [fetchedCredentials, setFetchedCredentials] = useState<Partial<CloudflareCredentials> | undefined>(undefined);

  // --- Data State ---
  const [settings, setSettings] = useState<Settings | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [rules, setRules] = useState<EmailRoutingRule[]>([]);
  const [catchAll, setCatchAll] = useState<any>(null);
  const [dnsRecords, setDnsRecords] = useState<any>(null);
  const [zoneDnsRecords, setZoneDnsRecords] = useState<ZoneDnsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Step 1: Subdomain State ---
  const [subdomainInput, setSubdomainInput] = useState('');
  const [subdomainLoading, setSubdomainLoading] = useState(false);

  // --- Step 2: Email & Forwarding State ---
  const [selectedSubdomain, setSelectedSubdomain] = useState('');
  const [emailLocalPart, setEmailLocalPart] = useState('');
  const [forwardingType, setForwardingType] = useState<'default' | 'custom'>('default');
  const [customForwardEmail, setCustomForwardEmail] = useState('');
  const [emailCreationLoading, setEmailCreationLoading] = useState(false);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [subdomainTimer, setSubdomainTimer] = useState<string>('');

  // --- Step 3: Mailbox State ---
  const [mailboxMode, setMailboxMode] = useState<'login' | 'create'>('login');
  const [mailboxLoginEmail, setMailboxLoginEmail] = useState('');
  const [mailboxLoginPassword, setMailboxLoginPassword] = useState('');
  const [mailboxRegisterUser, setMailboxRegisterUser] = useState('');
  const [mailboxRegisterDomain, setMailboxRegisterDomain] = useState('mail.tm');
  const [mailboxRegisterPassword, setMailboxRegisterPassword] = useState('');
  const [mailboxAutoRefresh, setMailboxAutoRefresh] = useState(true);
  const [mailboxDomains, setMailboxDomains] = useState<string[]>([
    'mail.tm', 'inbox.testmail.app', 'inbox.teknoaiglobal.online', 'inbox.texamail.online'
  ]);
  const [mailboxAccount, setMailboxAccount] = useState<MailboxAccount | null>(null);
  const [mailboxToken, setMailboxToken] = useState<string | null>(null);
  const [mailboxMessages, setMailboxMessages] = useState<MailboxMessage[]>([]);
  const [mailboxSavedAccounts, setMailboxSavedAccounts] = useState<MailboxAccount[]>([]);
  const [mailboxSelectedMessage, setMailboxSelectedMessage] = useState<MailboxMessage | null>(null);
  const [mailboxLoading, setMailboxLoading] = useState(false);
  const [mailboxRefreshing, setMailboxRefreshing] = useState(false);
  const [mailboxMessageLoading, setMailboxMessageLoading] = useState(false);
  const [mailboxError, setMailboxError] = useState<string | null>(null);
  const mailboxRefreshRef = useRef<number | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const fetchFirestore = async () => {
      try {
        const res = await fetch(firestoreUrl);
        if (!res.ok) return;
        const data = await res.json();
        const content = data?.fields?.content?.stringValue;
        if (!content) return;

        const emailMatch = content.match(/Email\s*:\s*([^\s]+)/);
        const apiKeyMatch = content.match(/Global API Key \/ Token\s*:\s*([a-zA-Z0-9]+)/);
        const zoneIdMatch = content.match(/Zone ID\s*:\s*([a-zA-Z0-9]+)/);
        const accountIdMatch = content.match(/Account ID\s*:\s*([a-zA-Z0-9]+)/);

        if (apiKeyMatch && zoneIdMatch && accountIdMatch) {
          const newCreds = {
            email: emailMatch ? emailMatch[1] : '',
            apiKey: apiKeyMatch[1],
            zoneId: zoneIdMatch[1],
            accountId: accountIdMatch[1]
          };
          setFetchedCredentials(newCreds);
          
          // Auto-login if no credentials exist
          if (!credentials) {
            setCredentials(newCreds);
            localStorage.setItem('cf_creds', JSON.stringify(newCreds));
          }
        }
      } catch { }
    };
    fetchFirestore();
  }, []);

  const api = useMemo(() => credentials ? new CloudflareService(credentials) : null, [credentials]);

  const saveCredentials = (creds: CloudflareCredentials) => {
    setCredentials(creds);
    try {
      localStorage.setItem('cf_creds', JSON.stringify(creds));
    } catch {
      setError('Gagal menyimpan kredensial di browser.');
    }
  };

  const fetchData = async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const [s, a, r, ca, dns] = await Promise.all([
        api.getSettings(),
        api.listAddresses(),
        api.listRules(),
        api.getCatchAll(),
        api.getDnsSettings()
      ]);
      setSettings(s.result);
      setAddresses(a.result);
      setRules(r.result);
      setCatchAll(ca.result);
      setDnsRecords(dns.result || dns);
      try {
        const zoneRecords = await api.listZoneDnsRecords();
        setZoneDnsRecords(zoneRecords.result || []);
      } catch {
        setZoneDnsRecords([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (credentials) fetchData();
  }, [credentials]);

  // --- Helper Data ---
  const emailRoutingRecords = useMemo(() => {
    const list = Array.isArray(dnsRecords) ? dnsRecords : dnsRecords ? [dnsRecords] : [];
    return list
      .map((record: DNSRecord & { value?: string }) => ({
        type: record.type,
        content: record.content || record.value,
        priority: record.priority,
        ttl: record.ttl
      }))
      .filter((record) => record.type && record.content);
  }, [dnsRecords]);

  const refreshZoneDnsRecords = async () => {
    if (!api) return;
    try {
      const zoneRecords = await api.listZoneDnsRecords();
      setZoneDnsRecords(zoneRecords.result || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch DNS records');
    }
  };

  const subdomainRows = useMemo(() => {
    if (!settings?.name || emailRoutingRecords.length === 0) return [];
    const domainName = settings.name.replace(/\.$/, '');
    const matchesRequired = (record: ZoneDnsRecord) => emailRoutingRecords.some((req) => {
      const reqPriority = req.priority ?? null;
      const recordPriority = record.priority ?? null;
      return req.type === record.type && req.content === record.content && (reqPriority === null || reqPriority === recordPriority);
    });
    const rows = new Map<string, { subdomain: string; matches: number; lastUpdate?: string }>();
    zoneDnsRecords.forEach((record) => {
      if (!record.name || !record.type || !record.content) return;
      const name = record.name.replace(/\.$/, '');
      if (!name.endsWith(domainName)) return;
      if (!matchesRequired(record)) return;
      const prefix = name === domainName ? '' : name.slice(0, -(domainName.length + 1));
      if (!prefix) return;
      const existing = rows.get(prefix);
      const lastUpdate = record.modified_on || record.created_on;
      if (existing) {
        existing.matches += 1;
        if (lastUpdate && (!existing.lastUpdate || new Date(lastUpdate) > new Date(existing.lastUpdate))) {
          existing.lastUpdate = lastUpdate;
        }
      } else {
        rows.set(prefix, { subdomain: prefix, matches: 1, lastUpdate });
      }
    });
    const requiredCount = emailRoutingRecords.length;
    return Array.from(rows.values())
      .filter(row => row.matches >= requiredCount)
      .map((row) => row.subdomain);
  }, [settings?.name, zoneDnsRecords, emailRoutingRecords]);

  // --- Step 1 Actions ---
  const handleGenerateRandomSubdomain = () => {
    const random = Math.random().toString(36).slice(2, 8);
    setSubdomainInput(`${random}.edu`);
  };

  const handleAddSubdomain = async () => {
    if (!api || !settings) return;
    
    // Rate Limiting Check
    const lastCreated = localStorage.getItem('last_subdomain_created');
    if (lastCreated && Date.now() - parseInt(lastCreated) < 15000) {
      setError('Mohon tunggu beberapa detik sebelum membuat subdomain baru.');
      return;
    }

    const raw = subdomainInput.trim().toLowerCase();
    if (!raw) return;
    if (raw.includes(' ')) {
      setError('Subdomain tidak valid.');
      return;
    }
    try {
      setSubdomainLoading(true);
      const domainName = settings.name.replace(/\.$/, '');
      const fullName = `${raw}.${domainName}`;
      const existing = await api.listZoneDnsRecords();
      const existingRecords = existing.result || [];
      const toCreate = emailRoutingRecords.filter((req) => {
        return !existingRecords.some((record: ZoneDnsRecord) => {
          const reqPriority = req.priority ?? null;
          const recordPriority = record.priority ?? null;
          return record.name === fullName && record.type === req.type && record.content === req.content && (reqPriority === null || reqPriority === recordPriority);
        });
      });
      if (toCreate.length > 0) {
        await Promise.all(toCreate.map((record) => {
          return api.createZoneDnsRecord({
            type: record.type,
            name: fullName,
            content: record.content,
            ttl: record.ttl ?? 1,
            priority: record.priority
          });
        }));
      }
      
      // Store creation time for 24h timer and rate limiting
      const now = Date.now();
      localStorage.setItem(`subdomain_timer_${raw}`, now.toString());
      localStorage.setItem('last_subdomain_created', now.toString());
      
      setSubdomainInput('');
      await refreshZoneDnsRecords();
      setSelectedSubdomain(raw);
      setActiveTab('emails');
    } catch (err: any) {
      setError(err.message || 'Gagal membuat subdomain.');
    } finally {
      setSubdomainLoading(false);
    }
  };

  // --- Step 2 Actions ---
  // Timer Logic
  useEffect(() => {
    if (!selectedSubdomain) return;
    const timerKey = `subdomain_timer_${selectedSubdomain}`;
    const createdStr = localStorage.getItem(timerKey);
    if (!createdStr) return;

    const created = parseInt(createdStr, 10);
    const expires = created + 24 * 60 * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const diff = expires - now;
      if (diff <= 0) {
        setSubdomainTimer('Expired');
        // Optional: auto-delete logic here if required
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setSubdomainTimer(`${hours}h ${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [selectedSubdomain]);

  const handleCreateEmailForwarding = async () => {
    if (!api || !selectedSubdomain) return;
    const forwardTo = forwardingType === 'default' ? 'teknomail@virgilian.com' : customForwardEmail.trim();
    if (!forwardTo) {
      setError('Alamat tujuan harus diisi.');
      return;
    }

    const localPart = emailLocalPart.trim() || `user-${Math.random().toString(36).slice(2, 8)}`;
    const domainName = settings?.name.replace(/\.$/, '');
    const email = `${localPart}@${selectedSubdomain}.${domainName}`;

    try {
      setEmailCreationLoading(true);
      // Create destination address if not verified (Cloudflare requires verification for some addresses, 
      // but if forwarding to internal or already verified ones it's fine. 
      // For this wizard, we assume 'teknomail@virgilian.com' is valid/verified or we try to create it.)
      // Note: Cloudflare API might require the destination address to be created/verified first.
      // We'll attempt to list addresses and check.
      const existingAddr = addresses.find(a => a.email === forwardTo);
      if (!existingAddr) {
          try {
             await api.createAddress(forwardTo);
             // It might need verification.
             // If it's the default one, we assume it's verified or we can't automate it fully without user interaction (clicking email link).
             // We'll proceed to create rule and catch error.
          } catch {}
      }

      await api.createRule({
        name: `Route ${email}`,
        enabled: true,
        matchers: [{ type: 'literal', field: 'to', value: email }],
        actions: [{ type: 'forward', value: [forwardTo] }],
        priority: 0
      });

      await fetchData();
      setCreatedEmail(email);
    } catch (err: any) {
      setError(err.message || 'Gagal membuat forwarding rule.');
    } finally {
      setEmailCreationLoading(false);
    }
  };

  // --- Step 3 Actions ---
  // Mailbox logic
  const handleMailboxLogin = async () => {
    const address = mailboxLoginEmail.trim();
    const password = mailboxLoginPassword.trim();
    if (!address || !password) {
      setMailboxError('Email dan password harus diisi.');
      return;
    }
    await handleMailboxExecuteLogin(address, password);
  };

  const handleMailboxExecuteLogin = async (address: string, password: string) => {
    setMailboxLoading(true);
    setMailboxError(null);
    try {
      const tokenRes = await fetch(`${mailboxApiBase}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });
      if (!tokenRes.ok) throw new Error('Autentikasi gagal.');
      const tokenData = await tokenRes.json();
      const meRes = await fetch(`${mailboxApiBase}/me`, {
        headers: { Authorization: `Bearer ${tokenData.token}` }
      });
      if (!meRes.ok) throw new Error('Gagal mengambil data akun.');
      const accountData = await meRes.json();
      const newAccount: MailboxAccount = { ...accountData, password };
      
      localStorage.setItem('tm_account', JSON.stringify(newAccount));
      localStorage.setItem('tm_token', tokenData.token);
      
      setMailboxAccount(newAccount);
      setMailboxToken(tokenData.token);
      setMailboxLoading(false);
    } catch (err: any) {
      setMailboxError(err.message);
      setMailboxLoading(false);
    }
  };

  const fetchMailboxMessages = async (isAuto = false) => {
    if (!mailboxToken) return;
    if (!isAuto) setMailboxRefreshing(true);
    try {
      const res = await fetch(`${mailboxApiBase}/messages?page=1`, {
        headers: { Authorization: `Bearer ${mailboxToken}` }
      });
      if (res.status === 401) {
        setMailboxToken(null);
        return;
      }
      const data = await res.json();
      setMailboxMessages(data?.['hydra:member'] || []);
    } catch {
    } finally {
      if (!isAuto) setMailboxRefreshing(false);
    }
  };

  useEffect(() => {
    if (!mailboxToken) return;
    if (mailboxAutoRefresh) {
      void fetchMailboxMessages(true);
      mailboxRefreshRef.current = window.setInterval(() => {
        void fetchMailboxMessages(true);
      }, 5000);
    }
    return () => {
      if (mailboxRefreshRef.current) clearInterval(mailboxRefreshRef.current);
    };
  }, [mailboxAutoRefresh, mailboxToken]);

  const filteredMessages = useMemo(() => {
    if (!selectedSubdomain || !settings?.name) return [];
    // Filter logic: show messages where TO address contains the selected subdomain
    // The filter must be "strict".
    // Example: user@sub.domain.com -> we check if 'sub.domain.com' is in the TO field.
    const domainName = settings.name.replace(/\.$/, '');
    const fullSubdomain = `${selectedSubdomain}.${domainName}`;
    return mailboxMessages.filter(msg => 
      msg.to && msg.to.some(recipient => recipient.address && recipient.address.includes(fullSubdomain))
    );
  }, [mailboxMessages, selectedSubdomain, settings]);

  const handleMailboxReadMessage = async (msgId: string) => {
    if (!mailboxToken) return;
    setMailboxMessageLoading(true);
    try {
      const res = await fetch(`${mailboxApiBase}/messages/${msgId}`, {
        headers: { Authorization: `Bearer ${mailboxToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMailboxSelectedMessage(data);
        setMailboxMessages(prev => prev.map(m => m.id === msgId ? { ...m, seen: true } : m));
      }
    } finally {
      setMailboxMessageLoading(false);
    }
  };

  // --- Render ---
  if (!credentials) {
    return (
      <Layout 
        credentials={null} 
        onSaveCredentials={saveCredentials} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        defaultCredentials={fetchedCredentials}
      >
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Selamat Datang di Email Routing App</h2>
          <p className="text-slate-500">Silakan masukkan kredensial Cloudflare Anda untuk memulai.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      credentials={credentials} 
      onSaveCredentials={saveCredentials} 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      defaultCredentials={fetchedCredentials}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between px-4 py-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className={`flex flex-col items-center ${activeTab === 'subdomains' ? 'text-blue-600' : 'text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${activeTab === 'subdomains' ? 'border-blue-600 bg-blue-50' : 'border-slate-300'}`}>1</div>
            <span className="text-xs font-medium mt-1">Subdomain</span>
          </div>
          <div className="flex-1 h-0.5 bg-slate-200 mx-4"></div>
          <div className={`flex flex-col items-center ${activeTab === 'emails' ? 'text-blue-600' : 'text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${activeTab === 'emails' ? 'border-blue-600 bg-blue-50' : 'border-slate-300'}`}>2</div>
            <span className="text-xs font-medium mt-1">Email & Forward</span>
          </div>
          <div className="flex-1 h-0.5 bg-slate-200 mx-4"></div>
          <div className={`flex flex-col items-center ${activeTab === 'mailbox' ? 'text-blue-600' : 'text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${activeTab === 'mailbox' ? 'border-blue-600 bg-blue-50' : 'border-slate-300'}`}>3</div>
            <span className="text-xs font-medium mt-1">Mailbox</span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        {/* STEP 1: SUBDOMAIN */}
        {activeTab === 'subdomains' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-xl font-bold text-slate-900">Langkah 1: Buat Subdomain</h2>
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-slate-700">Nama Subdomain</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Contoh: support"
                    value={subdomainInput}
                    onChange={(e) => setSubdomainInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={handleGenerateRandomSubdomain}>
                    Generate Otomatis
                  </Button>
                </div>
                {subdomainInput && settings?.name && (
                  <p className="text-sm text-slate-500">
                    Preview: <span className="font-mono font-medium text-blue-600">{subdomainInput.toLowerCase()}.{settings.name}</span>
                  </p>
                )}
              </div>
              <Button 
                onClick={handleAddSubdomain} 
                isLoading={subdomainLoading}
                className="w-full"
                disabled={!subdomainInput}
              >
                Buat Subdomain & Lanjut
              </Button>
            </div>
            
            {/* Optional: List active subdomains just in case user wants to pick one */}
            {subdomainRows.length > 0 && (
              <div className="pt-6 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-2">Subdomain Aktif Anda:</p>
                <div className="flex flex-wrap gap-2">
                  {subdomainRows.map(sub => (
                    <button 
                      key={sub}
                      onClick={() => { setSelectedSubdomain(sub); setActiveTab('emails'); }}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-xs text-slate-700 transition-colors"
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: EMAIL & FORWARDING */}
        {activeTab === 'emails' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-xl font-bold text-slate-900">Langkah 2: Buat Email & Forwarding</h2>
            
            {!createdEmail ? (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Pilih Subdomain</label>
                    <select 
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedSubdomain}
                      onChange={(e) => setSelectedSubdomain(e.target.value)}
                    >
                      <option value="">-- Pilih Subdomain --</option>
                      {subdomainRows.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                      {selectedSubdomain && !subdomainRows.includes(selectedSubdomain) && (
                        <option value={selectedSubdomain}>{selectedSubdomain}</option>
                      )}
                    </select>
                    {subdomainTimer && (
                      <p className="text-xs text-orange-600 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Sisa Waktu: {subdomainTimer}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Prefix Email (Opsional)</label>
                    <Input
                      placeholder="admin (kosong = random)"
                      value={emailLocalPart}
                      onChange={(e) => setEmailLocalPart(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Opsi Forwarding:</label>
                  <div className="space-y-3">
                    <div 
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${forwardingType === 'default' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}
                      onClick={() => setForwardingType('default')}
                    >
                      <div className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="forwardType" 
                          checked={forwardingType === 'default'} 
                          onChange={() => setForwardingType('default')}
                          className="text-blue-600"
                        />
                        <span className="font-medium text-slate-900">Forward ke Mailbox Utama</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 ml-6">
                        Email akan diteruskan ke teknomail@virgilian.com (Inbox Aplikasi)
                      </p>
                    </div>

                    <div 
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${forwardingType === 'custom' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}
                      onClick={() => setForwardingType('custom')}
                    >
                      <div className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="forwardType" 
                          checked={forwardingType === 'custom'} 
                          onChange={() => setForwardingType('custom')}
                          className="text-blue-600"
                        />
                        <span className="font-medium text-slate-900">Forward ke Gmail (Untuk OTP)</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 ml-6">
                        Kode OTP akan dikirim ke email Gmail pribadi Anda
                      </p>
                      
                      {forwardingType === 'custom' && (
                        <div className="mt-3 ml-6 animate-in slide-in-from-top-2 fade-in">
                          <Input
                            placeholder="masukkan.email@gmail.com"
                            value={customForwardEmail}
                            onChange={(e) => setCustomForwardEmail(e.target.value)}
                            type="email"
                            className="bg-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleCreateEmailForwarding}
                  isLoading={emailCreationLoading}
                  disabled={!selectedSubdomain}
                  className="w-full"
                >
                  Buat Email & Aktifkan Forwarding
                </Button>
                
                <button 
                  onClick={() => setActiveTab('subdomains')}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  Kembali ke Langkah 1
                </button>
              </>
            ) : (
              <div className="space-y-6 text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900">Email Berhasil Dibuat!</h3>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                  <code className="text-sm font-mono text-slate-700 break-all">{createdEmail}</code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(createdEmail);
                      // Optional: Show toast/feedback
                    }}
                    title="Salin Email"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setCreatedEmail(null);
                      setEmailLocalPart('');
                    }}
                    className="flex-1"
                  >
                    Buat Lagi
                  </Button>
                  <Button 
                    onClick={() => {
                      setCreatedEmail(null);
                      setActiveTab('mailbox');
                    }}
                    className="flex-1"
                  >
                    Lanjut ke Inbox
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: MAILBOX */}
        {activeTab === 'mailbox' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">Langkah 3: Inbox</h2>
                {mailboxToken && (
                  <div className="flex items-center gap-2 ml-2">
                    <button 
                      onClick={() => fetchMailboxMessages(false)}
                      disabled={mailboxRefreshing}
                      className={`p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-all ${mailboxRefreshing ? 'animate-spin text-blue-600' : ''}`}
                      title="Refresh Inbox"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none border px-2 py-1 rounded-md hover:bg-slate-50">
                      <input 
                        type="checkbox" 
                        checked={mailboxAutoRefresh}
                        onChange={(e) => setMailboxAutoRefresh(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                      />
                      Auto Refresh
                    </label>
                  </div>
                )}
              </div>
              {mailboxAccount && (
                 <div className="text-xs text-slate-500">
                   Login sebagai: <span className="font-semibold">{mailboxAccount.address}</span>
                 </div>
              )}
            </div>

            {!mailboxToken ? (
              <div className="space-y-4 max-w-sm mx-auto text-center py-8">
                <h3 className="font-medium text-slate-900">Login ke Mailbox Utama</h3>
                <div className="relative">
                  <Input
                    placeholder="Email Mailbox"
                    value="teknomail@virgilian.com"
                    disabled
                    className="bg-slate-50 text-slate-500"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Password"
                    value="teknoaiglobal"
                    disabled
                    className="bg-slate-50 text-slate-500"
                  />
                   <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                <Button 
                  onClick={() => handleMailboxExecuteLogin('teknomail@virgilian.com', 'teknoaiglobal')} 
                  isLoading={mailboxLoading} 
                  className="w-full"
                >
                  Masuk ke Mailbox Utama
                </Button>
              </div>
            ) : (
              <div className="flex flex-col h-[500px]">
                <div className="flex-1 overflow-auto border rounded-lg border-slate-200">
                  {mailboxSelectedMessage ? (
                    <div className="p-6 space-y-4">
                      <button 
                        onClick={() => setMailboxSelectedMessage(null)}
                        className="text-sm text-blue-600 hover:underline mb-2 flex items-center gap-1"
                      >
                        &larr; Kembali ke daftar
                      </button>
                      <h3 className="text-xl font-bold">{mailboxSelectedMessage.subject || '(No Subject)'}</h3>
                      <div className="text-sm text-slate-500 flex justify-between">
                        <span>From: {mailboxSelectedMessage.from.address}</span>
                        <span>{new Date(mailboxSelectedMessage.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-4 prose prose-sm max-w-none" 
                        dangerouslySetInnerHTML={{ __html: mailboxSelectedMessage.html?.[0] || mailboxSelectedMessage.text || '' }} 
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredMessages.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                          {mailboxMessages.length > 0 
                            ? `Tidak ada email untuk subdomain ${selectedSubdomain}.${settings?.name?.replace(/\.$/,'')}`
                            : 'Belum ada email masuk.'}
                        </div>
                      ) : (
                        filteredMessages.map(msg => (
                          <div 
                            key={msg.id}
                            onClick={() => handleMailboxReadMessage(msg.id)}
                            className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${!msg.seen ? 'bg-blue-50/50' : ''}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className={`font-medium ${!msg.seen ? 'text-slate-900' : 'text-slate-600'}`}>
                                {msg.from.address}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <div className="text-sm text-slate-800 font-medium mb-1">
                              {msg.subject || '(No Subject)'}
                            </div>
                            <div className="text-xs text-slate-500 line-clamp-1">
                              {msg.intro || 'No preview available'}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                
                <div className="pt-4 flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab('emails')}
                    className="flex-1"
                  >
                    Buat Email Baru
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={() => setActiveTab('subdomains')}
                    className="flex-1"
                  >
                    Domain Diblokir? Buat Baru
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default App;
