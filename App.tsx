
import React, { useState, useEffect, useMemo } from 'react';
import { CloudflareCredentials, Settings, Address, EmailRoutingRule, ApiResponse } from './types';
import { CloudflareService } from './services/cloudflareApi';
import { Layout } from './components/Layout';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [credentials, setCredentials] = useState<CloudflareCredentials | null>(() => {
    const saved = localStorage.getItem('cf_creds');
    return saved ? JSON.parse(saved) : null;
  });

  const api = useMemo(() => credentials ? new CloudflareService(credentials) : null, [credentials]);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [rules, setRules] = useState<EmailRoutingRule[]>([]);
  const [catchAll, setCatchAll] = useState<any>(null);
  const [dnsRecords, setDnsRecords] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveCredentials = (creds: CloudflareCredentials) => {
    setCredentials(creds);
    localStorage.setItem('cf_creds', JSON.stringify(creds));
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
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (credentials) fetchData();
  }, [credentials]);

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

  const handleCreateAddress = async (email: string) => {
    if (!api) return;
    try {
      setLoading(true);
      await api.createAddress(email);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!api) return;
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      setLoading(true);
      await api.deleteAddress(id);
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

  if (!credentials) {
    return (
      <Layout 
        credentials={null} 
        onSaveCredentials={saveCredentials} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
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

      {activeTab === 'overview' && settings && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Email Routing Status</h3>
              <p className="text-sm text-slate-500">Enable or disable email routing for <strong>{settings.name}</strong>.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${settings.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {settings.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <Button 
                variant={settings.enabled ? 'danger' : 'primary'} 
                isLoading={loading}
                onClick={handleToggleRouting}
              >
                {settings.enabled ? 'Disable Routing' : 'Enable Routing'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Status</span>
              <p className="text-2xl font-bold text-blue-600">{settings.status.toUpperCase()}</p>
              <p className="text-xs text-slate-500">Cloudflare zone connectivity</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Addresses</span>
              <p className="text-2xl font-bold text-slate-900">{addresses.length}</p>
              <p className="text-xs text-slate-500">Verified destination addresses</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Active Rules</span>
              <p className="text-2xl font-bold text-slate-900">{rules.filter(r => r.enabled).length}</p>
              <p className="text-xs text-slate-500">Including {catchAll?.enabled ? '1 catch-all' : '0 catch-all'}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold mb-4">Quick Stats</h3>
            <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center border border-dashed border-slate-300">
               <p className="text-slate-400 text-sm italic">Analytics coming soon based on Cloudflare Logs</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'addresses' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Destination Addresses</h3>
                <p className="text-sm text-slate-500">Addresses where you want to forward your custom emails.</p>
              </div>
              <AddAddressForm onAdd={handleCreateAddress} isLoading={loading} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-medium">Email Address</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Created</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {addresses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">No destination addresses found.</td>
                    </tr>
                  ) : (
                    addresses.map((addr) => (
                      <tr key={addr.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-medium">{addr.email}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${addr.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {addr.verified ? 'Verified' : 'Pending Verification'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{new Date(addr.created).toLocaleDateString()}</td>
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

      {activeTab === 'rules' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Email Routing Rules</h3>
                <p className="text-sm text-slate-500">Define how incoming emails should be routed based on the recipient.</p>
              </div>
              <Button onClick={() => alert('New Rule functionality would open a modal/drawer.')}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Rule
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {rules.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No routing rules configured.
                </div>
              ) : (
                rules.map((rule) => (
                  <div key={rule.id} className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-slate-900">{rule.name || 'Untitled Rule'}</h4>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${rule.enabled ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                          {rule.enabled ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <div className="bg-slate-50 px-2 py-1 rounded border border-slate-100">
                          <span className="text-slate-400 font-medium mr-2">IF:</span>
                          <span className="text-slate-700">{rule.matchers[0].value}</span>
                        </div>
                        <div className="flex items-center text-slate-300">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                        <div className="bg-blue-50 px-2 py-1 rounded border border-blue-100">
                          <span className="text-blue-400 font-medium mr-2">THEN:</span>
                          <span className="text-blue-700">{rule.actions[0].type} to {rule.actions[0].value.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'catchall' && (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Catch-all Routing</h3>
              <p className="text-sm text-slate-500">Handle emails sent to addresses that don't match any specific rule.</p>
            </div>

            {catchAll ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="space-y-0.5">
                    <p className="font-medium">Rule Status</p>
                    <p className="text-xs text-slate-500">Enable to route all unassigned email.</p>
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
                  <label className="text-sm font-medium text-slate-700">Forward to</label>
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
                    <option value="" disabled>Select a verified destination</option>
                    {addresses.filter(a => a.verified).map(addr => (
                      <option key={addr.id} value={addr.email}>{addr.email}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Only verified destination addresses are shown.</p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">Loading catch-all settings...</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dns' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
             <div className="space-y-1">
              <h3 className="text-lg font-bold">Required DNS Records</h3>
              <p className="text-sm text-slate-500">These records must exist in your Cloudflare DNS settings for email routing to function.</p>
            </div>

            <div className="overflow-x-auto border rounded-lg">
               <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 px-4 font-medium uppercase text-[10px]">Type</th>
                    <th className="py-2 px-4 font-medium uppercase text-[10px]">Name</th>
                    <th className="py-2 px-4 font-medium uppercase text-[10px]">Value</th>
                    <th className="py-2 px-4 font-medium uppercase text-[10px]">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dnsRecords ? (
                    (Array.isArray(dnsRecords) ? dnsRecords : [dnsRecords]).map((rec: any, i: number) => (
                       <tr key={i}>
                        <td className="py-3 px-4 font-bold text-blue-600">{rec.type || 'MX'}</td>
                        <td className="py-3 px-4 text-slate-600">{rec.name || '@'}</td>
                        <td className="py-3 px-4 font-mono text-xs bg-slate-50/50">{rec.content || rec.value}</td>
                        <td className="py-3 px-4 text-slate-600">{rec.priority || 'N/A'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">No DNS information available. Ensure routing is enabled.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 flex gap-3">
               <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Auto-configuration</p>
                <p>Cloudflare usually handles these records automatically when you click "Enable Email Routing". Manually changing them might break your setup.</p>
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
