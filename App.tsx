
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
  subject?: string;
  intro?: string;
  createdAt: string;
  seen?: boolean;
  html?: string[];
  text?: string;
  attachments?: Array<{ id: string; filename: string; size: number; downloadUrl: string }>;
};

const App: React.FC = () => {
  const loadCredentials = (): CloudflareCredentials | null => {
    try {
      const saved = localStorage.getItem('cf_creds');
      if (!saved) return null;
      return JSON.parse(saved);
    } catch {
      try {
        localStorage.removeItem('cf_creds');
      } catch {
        return null;
      }
      return null;
    }
  };

  const [activeTab, setActiveTab] = useState('subdomains');
  const [credentials, setCredentials] = useState<CloudflareCredentials | null>(loadCredentials);
  const [fetchedCredentials, setFetchedCredentials] = useState<Partial<CloudflareCredentials> | undefined>(undefined);

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
          setFetchedCredentials({
            email: emailMatch ? emailMatch[1] : '',
            apiKey: apiKeyMatch[1],
            zoneId: zoneIdMatch[1],
            accountId: accountIdMatch[1]
          });
        }
      } catch {
        // Ignore errors
      }
    };
    fetchFirestore();
  }, []);

  const api = useMemo(() => credentials ? new CloudflareService(credentials) : null, [credentials]);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [rules, setRules] = useState<EmailRoutingRule[]>([]);
  const [catchAll, setCatchAll] = useState<any>(null);
  const [dnsRecords, setDnsRecords] = useState<any>(null);
  const [zoneDnsRecords, setZoneDnsRecords] = useState<ZoneDnsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subdomainInput, setSubdomainInput] = useState('');
  const [subdomainLoading, setSubdomainLoading] = useState(false);
  const [randomLocalPart, setRandomLocalPart] = useState('');
  const [selectedSubdomain, setSelectedSubdomain] = useState('');
  const [randomForwardTo, setRandomForwardTo] = useState('');
  const [directForwardTo, setDirectForwardTo] = useState('');
  const [emailForwardSelect, setEmailForwardSelect] = useState('');
  const [emailForwardInput, setEmailForwardInput] = useState('');
  const [emailForwardLocked, setEmailForwardLocked] = useState(false);
  const [catchAllForwardSelect, setCatchAllForwardSelect] = useState('');
  const [catchAllForwardInput, setCatchAllForwardInput] = useState('');
  const [catchAllForwardLocked, setCatchAllForwardLocked] = useState(false);
  const [generatedEmails, setGeneratedEmails] = useState<{ email: string; ruleId: string; expiresAt: number }[]>([]);
  const generatedTimersRef = useRef<Record<string, number>>({});
  const [mailboxMode, setMailboxMode] = useState<'login' | 'create'>('login');
  const [mailboxLoginEmail, setMailboxLoginEmail] = useState('');
  const [mailboxLoginPassword, setMailboxLoginPassword] = useState('');
  const [mailboxRegisterUser, setMailboxRegisterUser] = useState('');
  const [mailboxRegisterDomain, setMailboxRegisterDomain] = useState('mail.tm');
  const [mailboxRegisterPassword, setMailboxRegisterPassword] = useState('');
  const [mailboxAutoRefresh, setMailboxAutoRefresh] = useState(true);
  const [mailboxDomains, setMailboxDomains] = useState<string[]>([
    'mail.tm',
    'inbox.testmail.app',
    'inbox.teknoaiglobal.online',
    'inbox.texamail.online'
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
  const [mailboxVaultOpen, setMailboxVaultOpen] = useState(false);
  const mailboxRefreshRef = useRef<number | null>(null);
  const mailboxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mailboxAnimationRef = useRef<number | null>(null);

  const saveCredentials = (creds: CloudflareCredentials) => {
    setCredentials(creds);
    try {
      localStorage.setItem('cf_creds', JSON.stringify(creds));
    } catch {
      setError('Gagal menyimpan kredensial di browser.');
    }
  };

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
    return Array.from(rows.values()).map((row) => ({
      ...row,
      routingStatus: row.matches >= requiredCount ? 'Enabled' : 'Partial',
      dnsStatus: row.matches >= requiredCount ? 'Configured' : 'Partial',
      mxStatus: row.matches >= requiredCount ? 'Locked' : 'Unverified'
    }));
  }, [settings?.name, zoneDnsRecords, emailRoutingRecords]);

  const subdomainDomains = useMemo(() => {
    if (!settings?.name) return [];
    const domainName = settings.name.replace(/\.$/, '');
    return subdomainRows.map((row) => `${row.subdomain}.${domainName}`);
  }, [settings?.name, subdomainRows]);

  const subdomainRuleRows = useMemo(() => {
    const domainSet = new Set(subdomainDomains);
    return rules
      .map((rule) => {
        const matcher = rule.matchers?.[0];
        const address = matcher?.value || '';
        if (matcher?.type !== 'literal' || matcher?.field !== 'to') return null;
        const atIndex = address.lastIndexOf('@');
        if (atIndex === -1) return null;
        const domain = address.slice(atIndex + 1);
        if (!domainSet.has(domain)) return null;
        return {
          id: rule.id,
          address,
          forwardTo: rule.actions?.[0]?.value?.join(', ') || '—',
          enabled: rule.enabled,
          name: rule.name
        };
      })
      .filter(Boolean) as { id: string; address: string; forwardTo: string; enabled: boolean; name: string }[];
  }, [rules, subdomainDomains]);

  useEffect(() => {
    if (selectedSubdomain && subdomainDomains.includes(selectedSubdomain)) return;
    setSelectedSubdomain(subdomainDomains[0] || '');
  }, [subdomainDomains, selectedSubdomain]);

  useEffect(() => {
    if (directForwardTo.trim() || randomForwardTo) return;
    const firstVerified = addresses.find((addr) => addr.verified)?.email || '';
    if (firstVerified) setRandomForwardTo(firstVerified);
  }, [addresses, directForwardTo, randomForwardTo]);

  useEffect(() => {
    if (!catchAll || catchAllForwardLocked || catchAllForwardInput) return;
    const current = catchAll.actions?.[0]?.value?.[0] || '';
    setCatchAllForwardSelect(current);
  }, [catchAll, catchAllForwardLocked, catchAllForwardInput]);

  const generateRandomLocalPart = () => {
    return `user-${Math.random().toString(36).slice(2, 8)}`;
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
      } catch (err: any) {
        setZoneDnsRecords([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleMailboxFillRandom = () => {
    const random = Math.random().toString(36).slice(2, 10);
    const password = Math.random().toString(36).slice(2, 14);
    setMailboxRegisterUser(random);
    setMailboxRegisterPassword(password);
  };

  const mailboxGenerateRandomString = (length: number) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i += 1) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const mailboxCopyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch {
      return;
    }
  };

  const sanitizeMailboxHtml = (value: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(value, 'text/html');
      doc.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());
      doc.querySelectorAll('*').forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          const name = attr.name.toLowerCase();
          const val = attr.value.trim().toLowerCase();
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name);
            return;
          }
          if ((name === 'href' || name === 'src') && val.startsWith('javascript:')) {
            el.removeAttribute(attr.name);
          }
        });
      });
      return doc.body.innerHTML;
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (credentials) fetchData();
  }, [credentials]);

  useEffect(() => {
    try {
      const savedEmailLock = localStorage.getItem(emailForwardLockKey) === 'true';
      const savedEmailValue = localStorage.getItem(emailForwardValueKey) || '';
      const savedCatchAllLock = localStorage.getItem(catchAllForwardLockKey) === 'true';
      const savedCatchAllValue = localStorage.getItem(catchAllForwardValueKey) || '';
      const savedGenerated = localStorage.getItem(generatedEmailKey);
      setEmailForwardLocked(savedEmailLock);
      if (savedEmailValue) {
        setEmailForwardInput(savedEmailValue);
      }
      setCatchAllForwardLocked(savedCatchAllLock);
      if (savedCatchAllValue) {
        setCatchAllForwardInput(savedCatchAllValue);
      }
      if (savedGenerated) {
        const parsed = JSON.parse(savedGenerated);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((entry) => entry?.email && entry?.ruleId && entry?.expiresAt);
          setGeneratedEmails(cleaned);
        }
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(emailForwardLockKey, String(emailForwardLocked));
      if (emailForwardLocked) {
        const value = emailForwardInput.trim() || emailForwardSelect;
        if (value) localStorage.setItem(emailForwardValueKey, value);
      } else {
        localStorage.removeItem(emailForwardValueKey);
      }
    } catch {
      return;
    }
  }, [emailForwardLocked, emailForwardInput, emailForwardSelect]);

  useEffect(() => {
    try {
      localStorage.setItem(catchAllForwardLockKey, String(catchAllForwardLocked));
      if (catchAllForwardLocked) {
        const value = catchAllForwardInput.trim() || catchAllForwardSelect;
        if (value) localStorage.setItem(catchAllForwardValueKey, value);
      } else {
        localStorage.removeItem(catchAllForwardValueKey);
      }
    } catch {
      return;
    }
  }, [catchAllForwardLocked, catchAllForwardInput, catchAllForwardSelect]);

  useEffect(() => {
    try {
      localStorage.setItem(generatedEmailKey, JSON.stringify(generatedEmails));
    } catch {
      return;
    }
  }, [generatedEmails]);

  useEffect(() => {
    const now = Date.now();
    const activeEntries = generatedEmails.filter((entry) => entry.expiresAt > now);
    const expiredEntries = generatedEmails.filter((entry) => entry.expiresAt <= now);

    expiredEntries.forEach((entry) => {
      if (api) {
        void deleteGeneratedRule(entry.ruleId);
      }
    });

    if (!api && expiredEntries.length > 0) {
      setGeneratedEmails(activeEntries);
    }

    Object.keys(generatedTimersRef.current).forEach((ruleId) => {
      if (!activeEntries.some((entry) => entry.ruleId === ruleId)) {
        window.clearTimeout(generatedTimersRef.current[ruleId]);
        delete generatedTimersRef.current[ruleId];
      }
    });

    activeEntries.forEach((entry) => {
      const remaining = entry.expiresAt - now;
      const existing = generatedTimersRef.current[entry.ruleId];
      if (existing) window.clearTimeout(existing);
      generatedTimersRef.current[entry.ruleId] = window.setTimeout(() => {
        void deleteGeneratedRule(entry.ruleId);
      }, remaining);
    });
  }, [api, generatedEmails]);

  const setMailboxSavedAccountsWithStorage = (next: MailboxAccount[]) => {
    setMailboxSavedAccounts(next);
    try {
      localStorage.setItem('tm_saved_accounts', JSON.stringify(next));
    } catch {
      return;
    }
  };

  const fetchMailboxDomains = async () => {
    try {
      const res = await fetch(`${mailboxApiBase}/domains`);
      if (!res.ok) return;
      const data = await res.json();
      const list = (data?.['hydra:member'] || []).map((item: { domain: string }) => item.domain).filter(Boolean);
      if (list.length > 0) {
        setMailboxDomains(list);
        if (!list.includes(mailboxRegisterDomain)) {
          setMailboxRegisterDomain(list[0]);
        }
      }
    } catch {
      return;
    }
  };

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
      if (!tokenRes.ok) {
        throw new Error('Autentikasi gagal. Cek kembali email/password.');
      }
      const tokenData = await tokenRes.json();
      const meRes = await fetch(`${mailboxApiBase}/me`, {
        headers: { Authorization: `Bearer ${tokenData.token}` }
      });
      if (!meRes.ok) {
        throw new Error('Gagal mengambil data akun.');
      }
      const accountData = await meRes.json();
      const newAccount: MailboxAccount = { ...accountData, password };
      try {
        localStorage.setItem('tm_account', JSON.stringify(newAccount));
        localStorage.setItem('tm_token', tokenData.token);
      } catch {
        setMailboxLoading(false);
      }
      const existingIndex = mailboxSavedAccounts.findIndex((acc) => acc.address === newAccount.address);
      if (existingIndex >= 0) {
        const next = [...mailboxSavedAccounts];
        next[existingIndex] = newAccount;
        setMailboxSavedAccountsWithStorage(next);
      }
      setMailboxAccount(newAccount);
      setMailboxToken(tokenData.token);
      setMailboxLoading(false);
      setMailboxSelectedMessage(null);
    } catch (err: any) {
      setMailboxError(err.message || 'Autentikasi gagal.');
      setMailboxLoading(false);
    }
  };

  const handleMailboxCreateAccount = async () => {
    const username = mailboxRegisterUser.trim();
    const domain = mailboxRegisterDomain.trim();
    const password = mailboxRegisterPassword.trim();
    if (!username || !domain || !password) {
      setMailboxError('Mohon lengkapi username, domain, dan password.');
      return;
    }
    const address = `${username}@${domain}`;
    setMailboxLoading(true);
    setMailboxError(null);
    try {
      const accountRes = await fetch(`${mailboxApiBase}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });
      if (!accountRes.ok) {
        const errData = await accountRes.json();
        throw new Error(errData?.['hydra:description'] || 'Gagal membuat akun. Username mungkin sudah dipakai.');
      }
      await handleMailboxExecuteLogin(address, password);
    } catch (err: any) {
      setMailboxError(err.message || 'Gagal membuat akun.');
      setMailboxLoading(false);
    }
  };

  const handleMailboxLogout = () => {
    try {
      localStorage.removeItem('tm_account');
      localStorage.removeItem('tm_token');
    } catch {
      setMailboxError('Gagal menghapus sesi tersimpan.');
    }
    if (mailboxRefreshRef.current) {
      window.clearInterval(mailboxRefreshRef.current);
      mailboxRefreshRef.current = null;
    }
    setMailboxAccount(null);
    setMailboxToken(null);
    setMailboxMessages([]);
    setMailboxSelectedMessage(null);
    setMailboxMessageLoading(false);
  };

  const fetchMailboxMessages = async (isAuto = false) => {
    if (!mailboxToken) return;
    if (!isAuto) setMailboxRefreshing(true);
    try {
      const res = await fetch(`${mailboxApiBase}/messages`, {
        headers: { Authorization: `Bearer ${mailboxToken}` }
      });
      if (res.status === 401) {
        handleMailboxLogout();
        return;
      }
      const data = await res.json();
      setMailboxMessages(data?.['hydra:member'] || []);
      if (!isAuto) setMailboxRefreshing(false);
    } catch {
      if (!isAuto) setMailboxRefreshing(false);
    }
  };

  const handleMailboxReadMessage = async (msgId: string) => {
    if (!mailboxToken) return;
    const temp = mailboxMessages.find((m) => m.id === msgId);
    if (temp) {
      setMailboxSelectedMessage(temp);
    }
    setMailboxMessageLoading(true);
    try {
      const res = await fetch(`${mailboxApiBase}/messages/${msgId}`, {
        headers: { Authorization: `Bearer ${mailboxToken}` }
      });
      if (!res.ok) {
        setMailboxMessageLoading(false);
        return;
      }
      const data = await res.json();
      setMailboxSelectedMessage(data);
      setMailboxMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, seen: true } : m)));
      setMailboxMessageLoading(false);
    } catch {
      setMailboxMessageLoading(false);
    }
  };

  const handleMailboxToggleSave = () => {
    if (!mailboxAccount) return;
    const exists = mailboxSavedAccounts.findIndex((acc) => acc.address === mailboxAccount.address);
    if (exists >= 0) {
      const next = mailboxSavedAccounts.filter((acc) => acc.address !== mailboxAccount.address);
      setMailboxSavedAccountsWithStorage(next);
      return;
    }
    setMailboxSavedAccountsWithStorage([...mailboxSavedAccounts, mailboxAccount]);
  };

  const handleMailboxDeleteSaved = (address: string) => {
    const next = mailboxSavedAccounts.filter((acc) => acc.address !== address);
    setMailboxSavedAccountsWithStorage(next);
  };

  const handleMailboxLoginSaved = (address: string) => {
    const acc = mailboxSavedAccounts.find((item) => item.address === address);
    if (!acc) return;
    void handleMailboxExecuteLogin(acc.address, acc.password);
  };

  useEffect(() => {
    try {
      const savedAccounts = localStorage.getItem('tm_saved_accounts');
      if (savedAccounts) {
        setMailboxSavedAccounts(JSON.parse(savedAccounts));
      }
      const savedAccount = localStorage.getItem('tm_account');
      const savedToken = localStorage.getItem('tm_token');
      if (savedAccount && savedToken) {
        setMailboxAccount(JSON.parse(savedAccount));
        setMailboxToken(savedToken);
      } else {
        fetchMailboxDomains();
        if (!mailboxRegisterUser && !mailboxRegisterPassword) {
          setMailboxRegisterUser(mailboxGenerateRandomString(10));
          setMailboxRegisterPassword(mailboxGenerateRandomString(12));
        }
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (mailboxMode !== 'create') return;
    fetchMailboxDomains();
    if (!mailboxRegisterUser && !mailboxRegisterPassword) {
      setMailboxRegisterUser(mailboxGenerateRandomString(10));
      setMailboxRegisterPassword(mailboxGenerateRandomString(12));
    }
  }, [mailboxMode]);

  useEffect(() => {
    if (!mailboxToken) return;
    if (mailboxAutoRefresh) {
      void fetchMailboxMessages(true);
      if (mailboxRefreshRef.current) {
        window.clearInterval(mailboxRefreshRef.current);
      }
      mailboxRefreshRef.current = window.setInterval(() => {
        void fetchMailboxMessages(true);
      }, 10000);
    } else if (mailboxRefreshRef.current) {
      window.clearInterval(mailboxRefreshRef.current);
      mailboxRefreshRef.current = null;
    }
    return () => {
      if (mailboxRefreshRef.current) {
        window.clearInterval(mailboxRefreshRef.current);
        mailboxRefreshRef.current = null;
      }
    };
  }, [mailboxAutoRefresh, mailboxToken]);

  useEffect(() => {
    if (activeTab !== 'mailbox') return;
    const canvas = mailboxCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let particles: Array<{ x: number; y: number; vx: number; vy: number; size: number }> = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      const particleCount = Math.min(window.innerWidth / 10, 100);
      particles = [];
      for (let i = 0; i < particleCount; i += 1) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          size: Math.random() * 2 + 1
        });
      }
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
        ctx.fill();
        for (let j = index + 1; j < particles.length; j += 1) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(100, 200, 255, ${1 - distance / 150})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });
      mailboxAnimationRef.current = window.requestAnimationFrame(drawParticles);
    };

    const handleResize = () => {
      resizeCanvas();
      createParticles();
    };

    window.addEventListener('resize', handleResize);
    resizeCanvas();
    createParticles();
    drawParticles();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mailboxAnimationRef.current) {
        window.cancelAnimationFrame(mailboxAnimationRef.current);
        mailboxAnimationRef.current = null;
      }
    };
  }, [activeTab]);

  const handleToggleRouting = async () => {
    if (!api || !settings) return;
    try {
      setLoading(true);
      if (settings.enabled) {
        await api.disableRouting();
      } else {
        await api.enableRouting();
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!api) return;
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      setLoading(true);
      await api.deleteRule(id);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAddress = async (email: string) => {
    if (!api) return;
    const value = email.trim();
    if (!value) {
      setError('Alamat email tidak boleh kosong.');
      return;
    }
    try {
      setLoading(true);
      await api.createAddress(value);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan alamat tujuan.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!api) return;
    if (!confirm('Hapus alamat tujuan ini?')) return;
    try {
      setLoading(true);
      await api.deleteAddress(id);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus alamat tujuan.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRandomAddress = async () => {
    if (!api) return;
    if (!selectedSubdomain) {
      setError('Subdomain belum tersedia.');
      return;
    }
    const forwardTarget = directForwardTo.trim() || randomForwardTo;
    if (!forwardTarget) {
      setError('Pilih alamat tujuan terlebih dahulu.');
      return;
    }
    let localPart = randomLocalPart.trim();
    if (!localPart) {
      localPart = generateRandomLocalPart();
      setRandomLocalPart(localPart);
    }
    const email = `${localPart}@${selectedSubdomain}`;
    if (rules.some((rule) => rule.matchers?.[0]?.value === email)) {
      setError('Alamat ini sudah ada di aturan.');
      return;
    }
    try {
      setLoading(true);
      const created = await api.createRule({
        name: `Route ${email}`,
        enabled: true,
        matchers: [{ type: 'literal', field: 'to', value: email }],
        actions: [{ type: 'forward', value: [forwardTarget] }],
        priority: 0
      });
      const ruleId = created.result?.id;
      if (ruleId) {
        const entry = { email, ruleId, expiresAt: Date.now() + 60 * 60 * 1000 };
        setGeneratedEmails((prev) => [entry, ...prev]);
      }
      setRandomLocalPart('');
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Gagal membuat email acak.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubdomain = async () => {
    if (!api || !settings) return;
    const raw = subdomainInput.trim().toLowerCase();
    if (!raw) return;
    if (raw.includes(' ')) {
      setError('Subdomain tidak valid.');
      return;
    }
    if (emailRoutingRecords.length === 0) {
      setError('Email routing DNS records belum tersedia.');
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
      if (toCreate.length === 0) {
        await refreshZoneDnsRecords();
        return;
      }
      await Promise.all(toCreate.map((record) => {
        return api.createZoneDnsRecord({
          type: record.type,
          name: fullName,
          content: record.content,
          ttl: record.ttl ?? 1,
          priority: record.priority
        });
      }));
      setSubdomainInput('');
      await refreshZoneDnsRecords();
    } catch (err: any) {
      setError(err.message || 'Gagal membuat subdomain.');
    } finally {
      setSubdomainLoading(false);
    }
  };

  const handleDeleteSubdomain = async (subdomain: string) => {
    if (!api || !settings) return;
    if (!confirm('Hapus subdomain ini beserta DNS records Email Routing?')) return;
    if (emailRoutingRecords.length === 0) {
      setError('Email routing DNS records belum tersedia.');
      return;
    }
    try {
      setSubdomainLoading(true);
      const domainName = settings.name.replace(/\.$/, '');
      const fullName = `${subdomain}.${domainName}`;
      const existing = await api.listZoneDnsRecords();
      const existingRecords = existing.result || [];
      const matchesRequired = (record: ZoneDnsRecord) => emailRoutingRecords.some((req) => {
        const reqPriority = req.priority ?? null;
        const recordPriority = record.priority ?? null;
        return record.type === req.type && record.content === req.content && (reqPriority === null || reqPriority === recordPriority);
      });
      const toDelete = existingRecords.filter((record: ZoneDnsRecord) => record.name === fullName && matchesRequired(record));
      if (toDelete.length === 0) {
        await refreshZoneDnsRecords();
        return;
      }
      await Promise.all(toDelete.map((record: ZoneDnsRecord) => api.deleteZoneDnsRecord(record.id)));
      await refreshZoneDnsRecords();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus subdomain.');
    } finally {
      setSubdomainLoading(false);
    }
  };

  const handleUpdateCatchAllForward = async (target: string) => {
    if (!api || !catchAll) return;
    const value = target.trim();
    if (!value) {
      setError('Alamat forward tidak boleh kosong.');
      return;
    }
    try {
      setLoading(true);
      await api.updateCatchAll({
        ...catchAll,
        actions: [{ type: 'forward', value: [value] }]
      });
      setCatchAllForwardInput('');
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui catch-all.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmailForwardLock = () => {
    if (emailForwardLocked) {
      setEmailForwardLocked(false);
      return;
    }
    const value = emailForwardInput.trim() || emailForwardSelect;
    if (!value) {
      setError('Masukkan alamat forward terlebih dahulu.');
      return;
    }
    setEmailForwardInput(value);
    setEmailForwardLocked(true);
  };

  const handleToggleCatchAllForwardLock = () => {
    if (catchAllForwardLocked) {
      setCatchAllForwardLocked(false);
      return;
    }
    const value = catchAllForwardInput.trim() || catchAllForwardSelect;
    if (!value) {
      setError('Masukkan alamat forward terlebih dahulu.');
      return;
    }
    setCatchAllForwardInput(value);
    setCatchAllForwardLocked(true);
  };

  const handleCopyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const deleteGeneratedRule = async (ruleId: string) => {
    if (!api) return;
    try {
      await api.deleteRule(ruleId);
    } catch {
      return;
    } finally {
      const existing = generatedTimersRef.current[ruleId];
      if (existing) {
        window.clearTimeout(existing);
        delete generatedTimersRef.current[ruleId];
      }
      setGeneratedEmails((prev) => prev.filter((entry) => entry.ruleId !== ruleId));
    }
  };

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
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Setup Required</h2>
          <p className="text-slate-500 max-w-sm">Please provide your Cloudflare API credentials in the setup panel to get started.</p>
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
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto hover:text-red-900">&times;</button>
        </div>
      )}

      {loading && !settings && (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {activeTab === 'subdomains' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Pembuatan Subdomain</h3>
              <p className="text-sm text-slate-500">Tambahkan subdomain untuk email routing.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1">
                <Input
                  label="Subdomain"
                  placeholder="support"
                  value={subdomainInput}
                  onChange={(e) => setSubdomainInput(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAddSubdomain}
                isLoading={subdomainLoading}
                disabled={!settings || emailRoutingRecords.length === 0 || !subdomainInput.trim()}
              >
                Tambah Subdomain
              </Button>
            </div>
            {emailRoutingRecords.length === 0 && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Email routing DNS records belum tersedia. Pastikan email routing sudah aktif.
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-medium">Subdomain</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Terakhir Update</th>
                    <th className="py-3 px-4 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subdomainRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">Belum ada subdomain.</td>
                    </tr>
                  ) : (
                    subdomainRows.map((row) => (
                      <tr key={row.subdomain} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-medium">{row.subdomain}{settings?.name ? `.${settings.name}` : ''}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.routingStatus === 'Enabled' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {row.routingStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {row.lastUpdate ? new Date(row.lastUpdate).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteSubdomain(row.subdomain)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                            disabled={subdomainLoading}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'emails' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Email dari Subdomain</h3>
              <p className="text-sm text-slate-500">Buat alamat email berbasis subdomain dan forward ke tujuan.</p>
            </div>

            {subdomainDomains.length === 0 ? (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Tidak ada subdomain dengan routing aktif. Tambahkan subdomain terlebih dahulu.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Subdomain</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedSubdomain}
                      onChange={(e) => setSelectedSubdomain(e.target.value)}
                    >
                      {subdomainDomains.map((domain) => (
                        <option key={domain} value={domain}>{domain}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Nama Email</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="admin"
                        value={randomLocalPart}
                        onChange={(e) => setRandomLocalPart(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRandomLocalPart(generateRandomLocalPart())}
                      >
                        Acak
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Forward ke</label>
                    <div className="space-y-2">
                      <select
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={randomForwardTo}
                        onChange={(e) => setRandomForwardTo(e.target.value)}
                      >
                        <option value="" disabled>Pilih alamat terverifikasi</option>
                        {addresses.filter(a => a.verified).map(addr => (
                          <option key={addr.id} value={addr.email}>{addr.email}</option>
                        ))}
                      </select>
                      <Input
                        placeholder="Input langsung (contoh: tujuan@domain.com)"
                        value={directForwardTo}
                        onChange={(e) => setDirectForwardTo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 border border-slate-100 rounded-lg p-4">
                  <div className="text-sm">
                    <p className="text-slate-500">Preview</p>
                    <p className="font-semibold text-slate-900">
                      {selectedSubdomain ? `${randomLocalPart.trim() || 'email'}@${selectedSubdomain}` : '—'}
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateRandomAddress}
                    isLoading={loading}
                    disabled={!selectedSubdomain || (!randomForwardTo && !directForwardTo.trim())}
                  >
                    Buat Email
                  </Button>
                </div>
                {generatedEmails.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">Hasil Generate</p>
                    <div className="space-y-2">
                      {generatedEmails.map((entry) => (
                        <div key={entry.ruleId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 border border-slate-100 rounded-lg p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{entry.email}</p>
                            <p className="text-xs text-slate-500">Hapus otomatis: {new Date(entry.expiresAt).toLocaleString('id-ID')}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyToClipboard(entry.email)}
                          >
                            Salin
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Catch-all Inbox</h3>
              <p className="text-sm text-slate-500">Semua email subdomain yang belum punya rule akan masuk ke alamat ini.</p>
            </div>
            {catchAll ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="space-y-0.5">
                    <p className="font-medium">Status</p>
                    <p className="text-xs text-slate-500">Aktifkan untuk menangkap semua email.</p>
                  </div>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      await api?.updateCatchAll({ ...catchAll, enabled: !catchAll.enabled });
                      await fetchData();
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500 ${catchAll.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${catchAll.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Forward ke</label>
                  <div className="space-y-2">
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={catchAll.actions?.[0]?.value?.[0] || ''}
                      onChange={async (e) => {
                        setLoading(true);
                        await api?.updateCatchAll({
                          ...catchAll,
                          actions: [{ type: 'forward', value: [e.target.value] }]
                        });
                        await fetchData();
                      }}
                    >
                      <option value="" disabled>Pilih alamat terverifikasi</option>
                      {addresses.filter(a => a.verified).map(addr => (
                        <option key={addr.id} value={addr.email}>{addr.email}</option>
                      ))}
                    </select>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Input langsung (contoh: tujuan@domain.com)"
                        value={catchAllForwardInput}
                        onChange={(e) => setCatchAllForwardInput(e.target.value)}
                      />
                      <Button
                        type="button"
                        onClick={() => handleUpdateCatchAllForward(catchAllForwardInput || '')}
                        disabled={!catchAllForwardInput.trim()}
                        isLoading={loading}
                      >
                        Simpan
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">Memuat pengaturan catch-all...</div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Alamat Tujuan</h3>
              <p className="text-sm text-slate-500">Tambahkan alamat email tujuan untuk menerima forward.</p>
            </div>
            <AddAddressForm onAdd={handleCreateAddress} isLoading={loading} />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-medium">Email</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {addresses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 italic">Belum ada alamat tujuan.</td>
                    </tr>
                  ) : (
                    addresses.map((addr) => (
                      <tr key={addr.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-medium">{addr.email}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${addr.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {addr.verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mailbox' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-slate-100 shadow-sm">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')", filter: 'brightness(0.6)' }}
            />
            <canvas ref={mailboxCanvasRef} className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen" />
            <div className="absolute inset-0 bg-slate-900/40" />
            <div className="relative z-10 flex flex-col md:flex-row min-h-[720px]">
              <div className="w-full md:w-80 flex flex-col border-r border-white/10 backdrop-blur-xl bg-slate-900/60">
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
                      <img
                        src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExOW5pbmtxczE2OHExN2c2MXo0aHFlcmowZDZkZXBjOXBhY2I3NnVzeCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Z5xNsrWg4867KqnIjh/giphy.gif"
                        alt="Logo"
                        className="relative w-12 h-12 object-contain rounded-lg border border-white/10 bg-black/50"
                      />
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                      TEKNO MAIL
                    </h1>
                  </div>

                  {mailboxAccount ? (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                      <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-3 border border-white/10 shadow-lg relative group">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-inner border border-white/20">
                            {mailboxAccount.address.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active ID</h3>
                              <button
                                onClick={() => mailboxCopyToClipboard(mailboxAccount.address)}
                                className="text-slate-500 hover:text-cyan-300 transition-colors"
                                title="Copy Email"
                              >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M8 16h8a2 2 0 002-2v-8a2 2 0 00-2-2H8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                            <p className="text-sm font-mono text-cyan-50 truncate" title={mailboxAccount.address}>
                              {mailboxAccount.address}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => mailboxCopyToClipboard(mailboxAccount.password || '')}
                            className="col-span-1 py-1.5 bg-black/20 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-200 border border-white/5 hover:border-cyan-500/30 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1.5"
                            title="Copy Password"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2v4a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2m0 0V6a2 2 0 012-2h2a2 2 0 012 2v1m-6 0h6" />
                            </svg>
                            Pass
                          </button>
                          <button
                            onClick={handleMailboxToggleSave}
                            className={`col-span-1 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${mailboxSavedAccounts.some((acc) => acc.address === mailboxAccount.address) ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-black/20 text-slate-300 border-white/5 hover:bg-white/10'}`}
                            title="Simpan ke Vault"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2h-1V7a5 5 0 00-10 0v3H6a2 2 0 00-2 2v7a2 2 0 002 2z" />
                            </svg>
                            {mailboxSavedAccounts.some((acc) => acc.address === mailboxAccount.address) ? 'Saved' : 'Save'}
                          </button>
                          <button
                            onClick={handleMailboxLogout}
                            className="col-span-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 border border-red-500/20 hover:border-red-500/40 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1.5"
                            title="Logout"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1m0-8V5" />
                            </svg>
                            Out
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <button
                          onClick={() => setMailboxVaultOpen((prev) => !prev)}
                          className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-cyan-400 transition-colors py-2 px-1 group"
                        >
                          <span className="flex items-center gap-1.5">
                            <svg className="w-3 h-3 group-hover:text-cyan-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2h-1V7a5 5 0 00-10 0v3H6a2 2 0 00-2 2v7a2 2 0 002 2z" />
                            </svg>
                            Account Vault ({mailboxSavedAccounts.length})
                          </span>
                          <svg className={`w-3 h-3 transition-transform duration-300 ${mailboxVaultOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <div className={`${mailboxVaultOpen ? 'block' : 'hidden'} space-y-1.5 mt-1 animate-in slide-in-from-top-2 fade-in duration-200`}>
                          {mailboxSavedAccounts.length === 0 ? (
                            <div className="text-center py-2 text-xs text-slate-600 italic border border-dashed border-white/5 rounded-lg">
                              Vault kosong
                            </div>
                          ) : (
                            mailboxSavedAccounts.map((acc) => (
                              <div
                                key={acc.address}
                                className="group flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-cyan-500/20 transition-all cursor-pointer relative"
                                onClick={() => handleMailboxLoginSaved(acc.address)}
                              >
                                {mailboxAccount.address === acc.address && (
                                  <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-green-400 rounded-r shadow-[0_0_5px_rgba(74,222,128,0.8)]" />
                                )}
                                <div className="flex items-center gap-2 overflow-hidden pl-1">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${mailboxAccount.address === acc.address ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                                  <span className="text-xs font-mono text-slate-400 truncate w-32 group-hover:text-cyan-100 transition-colors">
                                    {acc.address}
                                  </span>
                                </div>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleMailboxDeleteSaved(acc.address);
                                  }}
                                  className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  title="Hapus dari Vault"
                                >
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {mailboxMode === 'login' ? (
                        <div className="text-center py-4 animate-in fade-in slide-in-from-left-4 duration-300">
                          <h3 className="text-cyan-100 text-sm font-bold mb-4 uppercase tracking-wider">Login Akun</h3>
                          <div className="space-y-3 mb-4">
                            <input
                              type="email"
                              placeholder="Email Address"
                              value={mailboxLoginEmail}
                              onChange={(e) => setMailboxLoginEmail(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-slate-500 font-mono"
                            />
                            <input
                              type="password"
                              placeholder="Password"
                              value={mailboxLoginPassword}
                              onChange={(e) => setMailboxLoginPassword(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-slate-500 font-mono"
                            />
                          </div>
                          <button
                            onClick={handleMailboxLogin}
                            disabled={mailboxLoading}
                            className={`w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold tracking-wide transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-400/30 ${mailboxLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            {mailboxLoading ? (
                              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                                <path d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h4a2 2 0 012 2v4m-2-2H9m0 0l3-3m-3 3l3 3M5 21H3a2 2 0 01-2-2v-4m2 2h10m0 0l-3 3m3-3l-3-3" />
                              </svg>
                            )}
                            MASUK
                          </button>
                          <button
                            onClick={() => {
                              setMailboxMode('create');
                              setMailboxError(null);
                            }}
                            className="mt-4 text-xs text-slate-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
                          >
                            Belum punya akun? Buat baru
                          </button>
                          {mailboxError && (
                            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 backdrop-blur-md rounded-lg flex items-start gap-2 text-left">
                              <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-xs text-red-200">{mailboxError}</p>
                            </div>
                          )}
                          {mailboxSavedAccounts.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-white/10">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Riwayat
                              </h4>
                              <div className="space-y-1">
                                {mailboxSavedAccounts.map((acc) => (
                                  <button
                                    key={acc.address}
                                    onClick={() => handleMailboxLoginSaved(acc.address)}
                                    className="w-full flex items-center justify-between p-2 rounded hover:bg-white/5 text-xs text-slate-400 hover:text-cyan-300 transition-colors font-mono"
                                  >
                                    <span className="truncate">{acc.address}</span>
                                    <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-4 animate-in fade-in slide-in-from-right-4 duration-300">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-cyan-100 text-sm font-bold uppercase tracking-wider">Buat Akun Baru</h3>
                            <button
                              onClick={handleMailboxFillRandom}
                              title="Isi data acak"
                              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md text-cyan-400 transition-colors"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h2l3 6 4-12 3 6h5" />
                              </svg>
                            </button>
                          </div>
                          <div className="space-y-3 mb-4">
                            <input
                              type="text"
                              placeholder="User"
                              value={mailboxRegisterUser}
                              onChange={(e) => setMailboxRegisterUser(e.target.value)}
                              className="w-full min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-slate-500 font-mono"
                            />
                            <select
                              value={mailboxRegisterDomain}
                              onChange={(e) => setMailboxRegisterDomain(e.target.value)}
                              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50 transition-all font-mono appearance-none"
                            >
                              {mailboxDomains.length === 0 ? (
                                <option disabled>Loading domains...</option>
                              ) : (
                                mailboxDomains.map((domain) => (
                                  <option key={domain} value={domain}>@{domain}</option>
                                ))
                              )}
                            </select>
                            <input
                              type="password"
                              placeholder="Password"
                              value={mailboxRegisterPassword}
                              onChange={(e) => setMailboxRegisterPassword(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-slate-500 font-mono"
                            />
                          </div>
                          <button
                            onClick={handleMailboxCreateAccount}
                            disabled={mailboxLoading}
                            className={`w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold tracking-wide transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.5)] border border-cyan-400/30 ${mailboxLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            {mailboxLoading ? (
                              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                                <path d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                              </svg>
                            )}
                            BUAT AKUN
                          </button>
                          <button
                            onClick={() => {
                              setMailboxMode('login');
                              setMailboxError(null);
                            }}
                            className="mt-4 text-xs text-slate-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
                          >
                            Sudah punya akun? Login manual
                          </button>
                          {mailboxError && (
                            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 backdrop-blur-md rounded-lg flex items-start gap-2 text-left">
                              <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-xs text-red-200">{mailboxError}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 flex items-center justify-between sticky top-0 bg-slate-900/80 backdrop-blur-xl z-20 border-b border-white/10">
                  <h2 className="text-sm font-bold text-cyan-100 flex items-center gap-2 uppercase tracking-wide">
                    <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Inbox
                    <span className={`bg-cyan-600 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(8,145,178,0.5)] ${mailboxMessages.length > 0 ? '' : 'hidden'}`}>
                      {mailboxMessages.length}
                    </span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMailboxAutoRefresh((prev) => !prev)}
                      className={`p-1.5 rounded-lg transition-all border ${mailboxAutoRefresh ? 'text-green-400 bg-green-900/30 border-green-500/30' : 'text-slate-500 border-transparent hover:bg-white/5'}`}
                      title="Auto Sync"
                    >
                      <div className={`w-2 h-2 rounded-full ${mailboxAutoRefresh ? 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-slate-600'}`} />
                    </button>
                    <button
                      onClick={() => fetchMailboxMessages(false)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors border border-transparent hover:border-white/10"
                    >
                      <svg className={`w-4 h-4 ${mailboxRefreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0114-14l1 1" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {!mailboxToken ? (
                    <div className="p-8 text-center text-slate-500 text-sm">Menunggu inisialisasi identitas...</div>
                  ) : mailboxMessages.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-3 border border-white/10">
                        <svg className="w-8 h-8 text-slate-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8 5-8-5m16 8H4a2 2 0 01-2-2V7a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-slate-400 text-sm">Belum ada pesan masuk.</p>
                      <p className="text-slate-600 text-xs mt-1 font-mono">Inbox akan refresh otomatis.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/5">
                      {mailboxMessages.map((msg) => {
                        const isSelected = mailboxSelectedMessage && mailboxSelectedMessage.id === msg.id;
                        const activeClass = isSelected ? 'bg-cyan-900/20 border-cyan-400 backdrop-blur-sm' : 'border-transparent hover:border-white/20';
                        const fromName = msg.from?.name || msg.from?.address || 'Unknown';
                        const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        const unreadDot = !msg.seen;
                        const subject = msg.subject || '(Encrypted Subject)';
                        const intro = msg.intro || 'Downloading packets...';
                        return (
                          <li key={msg.id}>
                            <button
                              onClick={() => handleMailboxReadMessage(msg.id)}
                              className={`w-full text-left p-4 hover:bg-white/5 transition-all group relative border-l-2 ${activeClass}`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-sm font-bold truncate pr-2 ${msg.seen ? 'text-slate-400' : 'text-cyan-100 drop-shadow-[0_0_3px_rgba(34,211,238,0.8)]'}`}>
                                  {fromName}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">{time}</span>
                              </div>
                              <div className="text-xs text-slate-300 font-medium truncate mb-1">{subject}</div>
                              <div className="text-xs text-slate-500 truncate font-mono">{intro}</div>
                              {unreadDot && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex-1 relative z-10 flex flex-col bg-slate-900/40 backdrop-blur-sm">
                {!mailboxSelectedMessage ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-8 select-none">
                    <div className="relative mb-6">
                      <div className="absolute -inset-4 bg-cyan-500/20 rounded-full blur-xl animate-pulse" />
                      <svg className="w-20 h-20 text-cyan-900/50 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">Menunggu Transmisi</h3>
                    <p className="text-sm text-slate-500 max-w-xs text-center mt-2 font-mono">
                      Pilih pesan dari panel data stream di sebelah kiri untuk mendekripsi konten.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="p-6 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-lg z-20">
                      <div className="flex justify-between items-start mb-4">
                        <h2 className="text-2xl font-bold text-white leading-snug drop-shadow-md">
                          {mailboxSelectedMessage.subject || '(Encrypted Subject)'}
                        </h2>
                        <div className="flex gap-2">
                          <span className="bg-white/5 text-cyan-300 font-mono text-xs px-2 py-1 rounded border border-white/10">
                            {mailboxSelectedMessage.createdAt ? new Date(mailboxSelectedMessage.createdAt).toLocaleString() : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white font-bold text-xl shadow-lg border border-white/20">
                          {(mailboxSelectedMessage.from?.name || mailboxSelectedMessage.from?.address || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-cyan-50 text-lg">
                              {mailboxSelectedMessage.from?.name || mailboxSelectedMessage.from?.address || 'Unknown'}
                            </span>
                            <span className="text-xs text-slate-400 font-mono bg-black/30 px-2 py-0.5 rounded">
                              &lt;{mailboxSelectedMessage.from?.address}&gt;
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            To: <span className="text-cyan-200">{mailboxAccount?.address || '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-white/90 backdrop-blur-md p-8 shadow-[inset_0_0_50px_rgba(0,0,0,0.1)]">
                      <div className="bg-white rounded-lg shadow-sm p-4 min-h-[50vh]">
                        {mailboxMessageLoading ? (
                          <div className="flex items-center justify-center h-full text-cyan-400">
                            <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                              <path d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                            </svg>
                          </div>
                        ) : mailboxSelectedMessage.html?.[0] ? (
                          <div className="prose prose-sm max-w-none text-slate-800 overflow-x-hidden" dangerouslySetInnerHTML={{ __html: sanitizeMailboxHtml(mailboxSelectedMessage.html[0]) }} />
                        ) : mailboxSelectedMessage.text ? (
                          <pre className="whitespace-pre-wrap font-sans text-slate-800 text-sm">{mailboxSelectedMessage.text}</pre>
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-400">Loading content...</div>
                        )}

                        {mailboxSelectedMessage.attachments && mailboxSelectedMessage.attachments.length > 0 && (
                          <div className="mt-8 pt-6 border-t border-slate-300/50">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79V17a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4.21" />
                              </svg>
                              Attached Data
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {mailboxSelectedMessage.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={`${mailboxApiBase}${att.downloadUrl}?token=${mailboxToken || ''}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 bg-slate-100 hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 px-4 py-3 rounded-lg text-sm transition-colors border border-slate-200 hover:border-cyan-300 shadow-sm"
                                >
                                  <span className="font-medium">{att.filename}</span>
                                  <span className="text-xs text-slate-400">({(att.size / 1024).toFixed(1)} KB)</span>
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14m-4 7h7a2 2 0 002-2v-7" />
                                  </svg>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

const AddAddressForm: React.FC<{ onAdd: (email: string) => void, isLoading: boolean }> = ({ onAdd, isLoading }) => {
  const [email, setEmail] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onAdd(email);
      setEmail('');
    }
  };
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input 
        placeholder="recipient@dest.com" 
        className="min-w-[200px]" 
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <Button type="submit" isLoading={isLoading}>Add</Button>
    </form>
  );
};

export default App;
