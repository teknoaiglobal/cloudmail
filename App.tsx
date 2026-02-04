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
  const [availableZones, setAvailableZones] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Step 1: Subdomain State ---
  const [subdomainInput, setSubdomainInput] = useState('');
  const [subdomainLoading, setSubdomainLoading] = useState(false);
  const [useEdu, setUseEdu] = useState(false);
  
  // Cooldown State
  const [cooldownTime, setCooldownTime] = useState<string | null>(null);

  // Cooldown Timer Logic
  useEffect(() => {
    const checkCooldown = () => {
        const lastCreated = localStorage.getItem('last_subdomain_created');
        if (lastCreated) {
            const diff = Date.now() - parseInt(lastCreated);
            const eightHours = 8 * 60 * 60 * 1000;
            if (diff < eightHours) {
                const remaining = eightHours - diff;
                const h = Math.floor(remaining / (1000 * 60 * 60));
                const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((remaining % (1000 * 60)) / 1000);
                setCooldownTime(`${h} jam ${m} menit ${s} detik`);
            } else {
                setCooldownTime(null);
            }
        }
    };
    
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Step 2: Email & Forwarding State ---
  const [selectedSubdomain, setSelectedSubdomain] = useState('');
  const [emailLocalPart, setEmailLocalPart] = useState('');
  const [forwardingType, setForwardingType] = useState<'default' | 'custom'>('default');
  const [customForwardEmail, setCustomForwardEmail] = useState('');
  const [emailCreationLoading, setEmailCreationLoading] = useState(false);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [createdEmailsList, setCreatedEmailsList] = useState<{ email: string; createdAt: number }[]>([]);
  const [subdomainTimer, setSubdomainTimer] = useState<string>('');
  // catchAllDestination removed

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
  const lastMessageIdRef = useRef<string | null>(null);

  const playNotificationSound = () => {
    try {
      // Cool ding sound
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.6;
      audio.play().catch(e => console.error('Audio play failed:', e));
    } catch (e) {
      console.error('Audio initialization failed:', e);
    }
  };

  // Reset lastMessageIdRef when token changes (logout/login)
  useEffect(() => {
    if (!mailboxToken) {
      lastMessageIdRef.current = null;
    }
  }, [mailboxToken]);

  // --- Initialization ---
  useEffect(() => {
    // Load created emails history
    try {
      const savedEmails = localStorage.getItem('created_emails_history');
      if (savedEmails) {
        const parsed: { email: string; createdAt: number }[] = JSON.parse(savedEmails);
        const now = Date.now();
        // Filter valid emails (1 hour = 3600000 ms)
        const valid = parsed.filter(e => now - e.createdAt < 3600000);
        setCreatedEmailsList(valid);
        if (valid.length !== parsed.length) {
           localStorage.setItem('created_emails_history', JSON.stringify(valid));
        }
      }
    } catch {}

    // Cleanup interval every minute
    const interval = setInterval(() => {
       setCreatedEmailsList(prev => {
          const now = Date.now();
          const valid = prev.filter(e => now - e.createdAt < 3600000);
          if (valid.length !== prev.length) {
              localStorage.setItem('created_emails_history', JSON.stringify(valid));
          }
          return valid;
       });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

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
      const [s, a, r, ca, dns, zonesRes] = await Promise.all([
        api.getSettings(),
        api.listAddresses(),
        api.listRules(),
        api.getCatchAll(),
        api.getDnsSettings(),
        api.listZones()
      ]);
      setSettings(s.result);
      setAddresses(a.result);
      setRules(r.result);
      setCatchAll(ca.result);
      setDnsRecords(dns.result || dns);
      setAvailableZones(zonesRes.result.map((z: any) => ({ id: z.id, name: z.name })));
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

  // Catch-all effect removed

  // --- Helper Data ---
  const emailRoutingRecords = useMemo(() => {
    const list = Array.isArray(dnsRecords) ? dnsRecords : dnsRecords ? [dnsRecords] : [];
    return list
      .map((record: DNSRecord & { value?: string }) => ({
        type: record.type,
        content: record.content || record.value,
        priority: record.priority,
        ttl: record.ttl,
        name: record.name
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
    const normalize = (s: string) => s ? s.toLowerCase().replace(/\.$/, '').replace(/^"|"$/g, '') : '';

    // Filter requirements to those likely needed for subdomains
    // API for subdomains typically returns MX and SPF, but NOT DKIM (_domainkey)
    const effectiveRequirements = emailRoutingRecords.filter(req => !req.name.includes('_domainkey'));

    // Helper to extract subdomain based on requirement pattern
    const extractSubdomain = (recordName: string, reqName: string) => {
        const cleanRecordName = recordName.replace(/\.$/, '');
        const cleanReqName = reqName.replace(/\.$/, '');
        const cleanDomainName = domainName;

        if (!cleanRecordName.endsWith(cleanDomainName)) return null;
        
        // Get prefix relative to domain
        const reqPrefix = cleanReqName === cleanDomainName ? '' : cleanReqName.slice(0, -(cleanDomainName.length + 1));
        const recordPrefix = cleanRecordName === cleanDomainName ? '' : cleanRecordName.slice(0, -(cleanDomainName.length + 1));

        if (reqPrefix === '') {
            // Requirement is root-level (e.g. MX), so recordPrefix IS the subdomain
            return recordPrefix;
        } else {
            // Requirement has prefix (e.g. _domainkey), record should be prefix.subdomain
            if (recordPrefix.startsWith(reqPrefix + '.')) {
                return recordPrefix.slice(reqPrefix.length + 1);
            }
        }
        return null;
    };

    const rows = new Map<string, { subdomain: string; matchedReqs: Set<number>; lastUpdate?: string }>();

    zoneDnsRecords.forEach((record) => {
      if (!record.name || !record.type || !record.content) return;
      
      effectiveRequirements.forEach((req, index) => {
          if (record.type !== req.type) return;
          if (normalize(record.content) !== normalize(req.content)) return;
          if (req.priority !== undefined && record.priority !== req.priority) return;

          const sub = extractSubdomain(record.name, req.name);
          if (sub) {
              const existing = rows.get(sub);
              const lastUpdate = record.modified_on || record.created_on;
              if (existing) {
                  existing.matchedReqs.add(index);
                  if (lastUpdate && (!existing.lastUpdate || new Date(lastUpdate) > new Date(existing.lastUpdate))) {
                      existing.lastUpdate = lastUpdate;
                  }
              } else {
                  rows.set(sub, { subdomain: sub, matchedReqs: new Set([index]), lastUpdate });
              }
          }
      });
    });

    const requiredCount = effectiveRequirements.length;
    return Array.from(rows.values())
      .filter(row => row.matchedReqs.size >= requiredCount)
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
      const finalSubdomain = useEdu ? `${raw}.edu` : raw;
      const fullSubdomain = `${finalSubdomain}.${domainName}`;
      
      // Enable Email Routing for this subdomain explicitly
      // This ensures the subdomain is registered in Cloudflare Email Routing dashboard
      try {
        await api.enableRouting(fullSubdomain);
        // Wait a bit for propagation internally in Cloudflare
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.warn('Attempt to enable routing for subdomain failed or already enabled:', e);
        // Continue anyway as creating DNS records might be enough or the main goal
      }

      // Fetch EXISTING records AFTER enabling routing, as Cloudflare might have created some
      const existing = await api.listZoneDnsRecords();
      const existingRecords = existing.result || [];
      const normalize = (s: string) => s ? s.toLowerCase().replace(/\.$/, '').replace(/^"|"$/g, '') : '';

      // Fetch SPECIFIC DNS requirements for this subdomain from Cloudflare
      let requiredRecords: any[] = [];
      try {
        const reqs = await api.getDnsSettings(fullSubdomain);
        if (reqs.result && Array.isArray(reqs.result.records)) {
            requiredRecords = reqs.result.records;
        } else if (reqs.result && Array.isArray(reqs.result)) {
            // Fallback if API returns array (unlikely for subdomain query but safe to handle)
            requiredRecords = reqs.result;
        }
      } catch (e) {
          console.error('Failed to fetch subdomain specific requirements, falling back to root logic', e);
          // Fallback to manual calculation if API fails
          requiredRecords = emailRoutingRecords.map(req => {
            const reqName = req.name.replace(/\.$/, '');
            const reqPrefix = reqName === domainName ? '' : reqName.slice(0, -(domainName.length + 1));
            const targetName = reqPrefix ? `${reqPrefix}.${finalSubdomain}.${domainName}` : `${finalSubdomain}.${domainName}`;
            return {
                ...req,
                name: targetName
            };
          });
      }

      // If API returned no records (empty array), it might mean the subdomain is already "active" or API weirdness.
      // But usually it returns the required records. 
      // If it returns empty, we might fallback to root logic just in case.
      if (requiredRecords.length === 0) {
           requiredRecords = emailRoutingRecords.map(req => {
            const reqName = req.name.replace(/\.$/, '');
            const reqPrefix = reqName === domainName ? '' : reqName.slice(0, -(domainName.length + 1));
            const targetName = reqPrefix ? `${reqPrefix}.${finalSubdomain}.${domainName}` : `${finalSubdomain}.${domainName}`;
            return {
                ...req,
                name: targetName
            };
          });
      }

      const toCreate = requiredRecords.filter((req) => {
        return !existingRecords.some((record: ZoneDnsRecord) => {
          const recordName = record.name.replace(/\.$/, '');
          const reqName = req.name.replace(/\.$/, '');
          return recordName === reqName && 
                 record.type === req.type && 
                 normalize(record.content) === normalize(req.content);
        });
      });

      if (toCreate.length > 0) {
        await Promise.all(toCreate.map(async (req) => {
          // Use exact values from requirement
          const payload: any = {
            type: req.type,
            name: req.name,
            content: req.content,
            ttl: req.ttl ?? 1
          };
          if (req.type === 'MX' && req.priority !== undefined) {
            payload.priority = req.priority;
          }

          try {
            await api.createZoneDnsRecord(payload);
          } catch (e: any) {
            const msg = e.message || '';
            // Ignore if managed by email routing (meaning it's already handled) or already exists
            if (msg.includes('managed by Email Routing') || msg.includes('already exists')) {
                console.log(`Record ${req.name} already handled/managed: ${msg}`);
            } else {
                console.error(`Failed to create record ${req.name}:`, e);
            }
          }
        }));
      }
      
      // Store creation time for 24h timer and rate limiting
      const now = Date.now();
      localStorage.setItem(`subdomain_timer_${finalSubdomain}`, now.toString());
      localStorage.setItem('last_subdomain_created', now.toString());
      
      setSubdomainInput('');
      setUseEdu(false);
      await refreshZoneDnsRecords();
      setSelectedSubdomain(finalSubdomain);
      setActiveTab('emails');
    } catch (err: any) {
      setError(err.message || 'Gagal membuat subdomain.');
    } finally {
      setSubdomainLoading(false);
    }
  };

  const handleDeleteSubdomain = async (subdomain: string, skipConfirm = false) => {
    if (!api || !settings) return;
    if (!skipConfirm && !confirm(`Apakah Anda yakin ingin menghapus subdomain ${subdomain}?`)) return;

    try {
      if (!skipConfirm) setSubdomainLoading(true);
      const domainName = settings.name.replace(/\.$/, '');
      const fullSubdomain = `${subdomain}.${domainName}`;

      // 1. Disable Email Routing for the subdomain (Crucial step)
      try {
        await api.disableRouting(fullSubdomain);
        // Wait for propagation
        await new Promise(r => setTimeout(r, 1000));
      } catch (e: any) {
         console.warn(`Failed to disable routing for ${fullSubdomain} (might be already disabled):`, e);
      }

      const normalize = (s: string) => s ? s.toLowerCase().replace(/\.$/, '').replace(/^"|"$/g, '') : '';

      // Find records to delete
      const recordsToDelete = zoneDnsRecords.filter(record => {
         if (!record.name || !record.type || !record.content) return false;
         
         // Check if this record belongs to the subdomain based on ANY requirement pattern
         return emailRoutingRecords.some(req => {
            if (record.type !== req.type) return false;
            if (normalize(record.content) !== normalize(req.content)) return false;
            
            const reqName = req.name.replace(/\.$/, '');
            const reqPrefix = reqName === domainName ? '' : reqName.slice(0, -(domainName.length + 1));
            const targetName = reqPrefix ? `${reqPrefix}.${subdomain}.${domainName}` : `${subdomain}.${domainName}`;
            
            return record.name.replace(/\.$/, '') === targetName;
         });
      });

      if (recordsToDelete.length > 0) {
        await Promise.all(recordsToDelete.map(record => api.deleteZoneDnsRecord(record.id)));
      }
      
      // Remove timer
      localStorage.removeItem(`subdomain_timer_${subdomain}`);

      await refreshZoneDnsRecords();
      if (selectedSubdomain === subdomain) {
          setSelectedSubdomain('');
      }
    } catch (err: any) {
      if (!skipConfirm) setError(err.message || 'Gagal menghapus subdomain.');
      console.error('Delete subdomain error:', err);
    } finally {
      if (!skipConfirm) setSubdomainLoading(false);
    }
  };

  // Auto-delete effect
  const handleDeleteRef = useRef(handleDeleteSubdomain);
  useEffect(() => { handleDeleteRef.current = handleDeleteSubdomain; }, [handleDeleteSubdomain]);

  useEffect(() => {
    const checkExpired = () => {
       const now = Date.now();
       const keys = Object.keys(localStorage);
       keys.forEach(key => {
          if (key.startsWith('subdomain_timer_')) {
             const sub = key.replace('subdomain_timer_', '');
             const createdStr = localStorage.getItem(key);
             if (createdStr) {
                const created = parseInt(createdStr, 10);
                // 24 hours = 24 * 60 * 60 * 1000 = 86400000
                if (now - created > 86400000) {
                   console.log(`Auto-deleting expired subdomain: ${sub}`);
                   handleDeleteRef.current(sub, true);
                }
             }
          }
       });
    };
    
    // Check every minute
    const interval = setInterval(checkExpired, 60000);
    // Also check on mount
    checkExpired();
    
    return () => clearInterval(interval);
  }, []);

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
      setCreatedEmailsList(prev => {
        const updated = [{ email, createdAt: Date.now() }, ...prev];
        localStorage.setItem('created_emails_history', JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      setError(err.message || 'Gagal membuat forwarding rule.');
    } finally {
      setEmailCreationLoading(false);
    }
  };

  // handleUpdateCatchAll removed

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
      const messages = data?.['hydra:member'] || [];
      
      // Check for new messages to play sound
      if (messages.length > 0) {
        const latestId = messages[0].id;
        // If we have a last ID (meaning not first load) and it's different, play sound
        if (lastMessageIdRef.current && lastMessageIdRef.current !== latestId) {
          playNotificationSound();
        }
        lastMessageIdRef.current = latestId;
      }
      
      setMailboxMessages(messages);
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

  // Auto-login to mailbox when tab is active
  useEffect(() => {
    if (activeTab === 'mailbox' && !mailboxToken && !mailboxLoading) {
       handleMailboxExecuteLogin('teknomail@virgilian.com', 'teknoaiglobal');
    }
  }, [activeTab, mailboxToken, mailboxLoading]);

  const detectedOtp = useMemo(() => {
    if (!mailboxSelectedMessage) return null;
    const content = mailboxSelectedMessage.html?.[0] || mailboxSelectedMessage.text || '';
    const textContent = content.replace(/<[^>]*>/g, ' ');
    
    // Prioritize 6 digits (most common for OTP)
    const match6 = textContent.match(/\b\d{6}\b/);
    if (match6) return match6[0];
    
    // Fallback to 4-8 digits, excluding common years
    const matches = textContent.match(/\b\d{4,8}\b/g);
    if (matches) {
      for (const m of matches) {
        // Exclude generic years if 4 digits
        if (m.length === 4) {
           const val = parseInt(m);
           if (val > 1990 && val < 2030) continue;
        }
        return m;
      }
    }
    
    return null;
  }, [mailboxSelectedMessage]);

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
          <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
            
            {cooldownTime ? (
               <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-2">
                     <svg className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Akses Dibatasi Sementara</h3>
                  <p className="text-slate-500 max-w-md">
                     Untuk mencegah penyalahgunaan, Anda harus menunggu <strong>8 jam</strong> setelah membuat subdomain sebelum dapat mengakses menu ini kembali.
                  </p>
                  <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-100 text-orange-700 font-mono font-bold text-lg">
                     {cooldownTime}
                  </div>
                  <p className="text-xs text-slate-400 mt-4">
                     Subdomain Anda yang sudah ada akan dihapus otomatis dalam 24 jam.
                  </p>
               </div>
            ) : (
             <>
            {/* Domain Selector (Universal) */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col md:flex-row md:items-center gap-4">
               <div className="flex-1">
                 <label className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1 block">Domain Aktif</label>
                 <select
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-md text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={credentials?.zoneId || ''}
                    onChange={(e) => {
                      if (!credentials) return;
                      const newZoneId = e.target.value;
                      const newCreds = { ...credentials, zoneId: newZoneId };
                      saveCredentials(newCreds);
                    }}
                  >
                    {availableZones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                    {!availableZones.find(z => z.id === credentials?.zoneId) && credentials?.zoneId && (
                       <option value={credentials.zoneId}>{settings?.name || credentials.zoneId}</option>
                    )}
                  </select>
               </div>
               <div className="text-xs text-blue-600 md:max-w-[50%]">
                  Pilih domain yang ingin dikelola. Semua pengaturan di bawah (Subdomain, Email, Forwarding) akan menyesuaikan dengan domain yang dipilih.
               </div>
            </div>

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
                  <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-md border border-slate-300">
                     <input 
                       type="checkbox" 
                       id="useEdu" 
                       checked={useEdu} 
                       onChange={e => setUseEdu(e.target.checked)}
                       className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                     />
                     <label htmlFor="useEdu" className="text-sm font-medium text-slate-700 select-none cursor-pointer">.edu</label>
                  </div>
                  <Button variant="outline" onClick={handleGenerateRandomSubdomain}>
                    Generate Otomatis
                  </Button>
                </div>
                {subdomainInput && settings?.name && (
                  <p className="text-sm text-slate-500">
                    Preview: <span className="font-mono font-medium text-blue-600">{subdomainInput.toLowerCase()}{useEdu ? '.edu' : ''}.{settings.name}</span>
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
                    <div key={sub} className="inline-flex items-center bg-slate-100 rounded-full border border-slate-200 overflow-hidden">
                      <button 
                        onClick={() => { setSelectedSubdomain(sub); setActiveTab('emails'); }}
                        className="px-3 py-1 text-xs text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        {sub}
                      </button>
                      <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSubdomain(sub);
                        }}
                        className="pr-2 pl-1 py-1 text-slate-400 hover:text-red-600 hover:bg-slate-200 transition-colors border-l border-slate-200"
                        title="Hapus Subdomain"
                        disabled={subdomainLoading}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History List moved */}
             </>
            )}
          </div>
        )}

        {/* STEP 2: EMAIL & FORWARDING */}
        {activeTab === 'emails' && (
          <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Langkah 2: Email & Forwarding</h2>
              <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                Domain: <span className="font-semibold text-slate-700">{settings?.name}</span>
              </div>
            </div>
            
            {/* Catch-All Configuration removed */}
            
            {!createdEmail ? (
              <>
                <div className="grid gap-4 md:gap-6 md:grid-cols-2">
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

                {/* Forwarding option removed, using default */}

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

            {/* History List */}
            {createdEmailsList.length > 0 && (
              <div className="pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Riwayat Email (Aktif 1 Jam)</h3>
                <div className="space-y-2">
                  {createdEmailsList
                    .filter(item => {
                      if (!settings?.name) return false;
                      const domain = settings.name.replace(/\.$/, '').toLowerCase();
                      return item.email.toLowerCase().endsWith(domain);
                    })
                    .map((item) => (
                    <div key={item.email} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex flex-col min-w-0">
                         <code className="text-sm font-mono text-slate-700 break-all">{item.email}</code>
                         <span className="text-xs text-slate-400">
                           Exp: {new Date(item.createdAt + 3600000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </span>
                      </div>
                      <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(item.email)}
                          title="Salin Email"
                          className="shrink-0"
                      >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: MAILBOX */}
        {activeTab === 'mailbox' && (
          <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-2">
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
                      <span className="hidden xs:inline">Auto Refresh</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {!mailboxToken ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p className="text-slate-500">Memuat Inbox...</p>
              </div>
            ) : (
              <div className="flex flex-col h-[60vh] md:h-[calc(100vh-16rem)] min-h-[400px]">
                <div className="flex-1 overflow-auto border rounded-lg border-slate-200">
                  {mailboxSelectedMessage ? (
                    <div className="p-4 md:p-6 space-y-4 select-text selection:bg-blue-100 selection:text-blue-900">
                      <button 
                        onClick={() => setMailboxSelectedMessage(null)}
                        className="text-sm text-blue-600 hover:underline mb-2 flex items-center gap-1"
                      >
                        &larr; Kembali ke daftar
                      </button>
                      <h3 className="text-xl font-bold select-text">{mailboxSelectedMessage.subject || '(No Subject)'}</h3>
                      <div className="text-sm text-slate-500 flex justify-between flex-wrap gap-2 select-text">
                        <span>From: {mailboxSelectedMessage.from.address}</span>
                        <span>{new Date(mailboxSelectedMessage.createdAt).toLocaleString()}</span>
                      </div>

                      {detectedOtp && (
                        <div className="py-2">
                          <Button 
                            size="sm"
                            className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 shadow-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(detectedOtp);
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Salin OTP ({detectedOtp})
                          </Button>
                        </div>
                      )}

                      <div className="border-t pt-4 prose prose-sm max-w-none select-text" 
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
