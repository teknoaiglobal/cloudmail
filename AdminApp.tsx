import React, { useState, useEffect, useMemo } from 'react';
import { CloudflareCredentials, Settings } from './types';
import { CloudflareService } from './services/cloudflareApi';
import { Layout } from './components/Layout';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';

const firestoreUrl = '/creds?action=get_files';

type MemberRecord = {
  id: string;
  name: string;
  email: string;
  wa: string;
  exp?: number;
  createdAt?: string;
};

const AdminApp: React.FC = () => {
  const [credentials, setCredentials] = useState<CloudflareCredentials | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newWa, setNewWa] = useState('');
  const [durationMode, setDurationMode] = useState<'monthly' | 'custom'>('monthly');
  const [durationValue, setDurationValue] = useState<number>(1);
  const [actionLoading, setActionLoading] = useState(false);

  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem('adminPanelVerified') === 'true') {
      setIsAdminVerified(true);
    }
  }, []);

  const handleAdminLogin = () => {
    if (adminPasswordInput === 'Tekno@Project03') {
      setIsAdminVerified(true);
      localStorage.setItem('adminPanelVerified', 'true');
      setAdminLoginError(null);
    } else {
      setAdminLoginError('Password salah!');
    }
  };

  const api = useMemo(() => credentials ? new CloudflareService(credentials) : null, [credentials]);

  useEffect(() => {
    const fetchFirestore = async () => {
      try {
        const res = await fetch(firestoreUrl);
        if (!res.ok) throw new Error('Gagal memuat kredensial');
        const data = await res.json();
        const primaryNode = data?.cloudmail || data?.cloudmailbackup;
        const content = typeof primaryNode?.content === 'string'
          ? primaryNode.content
          : data?.fields?.content?.stringValue;
        if (!content) throw new Error('Data tidak ditemukan');

        const emailMatch = content.match(/Email\s*:\s*([^\s]+)/);
        const apiKeyMatch = content.match(/Global API Key \/ Token\s*:\s*([a-zA-Z0-9]+)/);
        const zoneIdMatch = content.match(/Zone ID\s*:\s*([a-zA-Z0-9]+)/);
        const accountIdMatch = content.match(/Account ID\s*:\s*([a-zA-Z0-9]+)/);

        if (apiKeyMatch && zoneIdMatch) {
          setCredentials({
            email: emailMatch ? emailMatch[1] : '',
            apiKey: apiKeyMatch[1],
            zoneId: zoneIdMatch[1],
            accountId: accountIdMatch ? accountIdMatch[1] : ''
          });
        } else {
            throw new Error('Format kredensial tidak valid');
        }
      } catch (err: any) {
          setError(err.message);
          setLoading(false);
      }
    };
    fetchFirestore();
  }, []);

  const fetchData = async () => {
    if (!api) return;
    setLoading(true);
    try {
      const s = await api.getSettings();
      setSettings(s.result);
      
      const domainName = s.result.name.replace(/\.$/, '');
      const zoneRecords = await api.listZoneDnsRecords();
      const records = zoneRecords.result || [];
      
      const memberPrefix = `_member.${domainName}`;
      
      const parsedMembers: MemberRecord[] = records
        .filter((r: any) => r.type === 'TXT' && r.name === memberPrefix)
        .map((r: any) => {
           // parse "email:xxx|wa:yyy|exp:zzz"
           const content = r.content || '';
           const emailMatch = content.match(/email:([^|]+)/);
           const waMatch = content.match(/wa:([^|]+)/);
           const expMatch = content.match(/exp:(\d+)/);
           return {
               id: r.id,
               name: r.name,
               email: emailMatch ? emailMatch[1] : 'Unknown',
               wa: waMatch ? waMatch[1] : '',
               exp: expMatch ? parseInt(expMatch[1]) : undefined,
               createdAt: r.created_on
           };
        });
        
      setMembers(parsedMembers);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (credentials) fetchData();
  }, [credentials]);

  const handleAddMember = async () => {
      if (!api || !settings) return;
      if (!newEmail || !newWa) {
          alert('Email dan WhatsApp harus diisi');
          return;
      }
      
      setActionLoading(true);
      try {
          const domainName = settings.name.replace(/\.$/, '');
          const expTimestamp = durationMode === 'monthly'
              ? Date.now() + (durationValue * 30 * 24 * 60 * 60 * 1000)
              : Date.now() + (durationValue * 24 * 60 * 60 * 1000);

          const content = `email:${newEmail}|wa:${newWa}|exp:${expTimestamp}`;
          await api.createZoneDnsRecord({
              type: 'TXT',
              name: `_member.${domainName}`,
              content: content
          });
          
          setNewEmail('');
          setNewWa('');
          await fetchData();
      } catch (err: any) {
          alert('Gagal menambah member: ' + err.message);
      } finally {
          setActionLoading(false);
      }
  };

  const handleDeleteMember = async (id: string) => {
      if (!api) return;
      if (!confirm('Yakin ingin menghapus member ini?')) return;
      
      setActionLoading(true);
      try {
          await api.deleteZoneDnsRecord(id);
          await fetchData();
      } catch (err: any) {
          alert('Gagal menghapus member: ' + err.message);
      } finally {
          setActionLoading(false);
      }
  };

  const formatWaLink = (wa: string) => {
      let cleanWa = wa.replace(/\D/g, '');
      if (cleanWa.startsWith('0')) {
          cleanWa = '62' + cleanWa.substring(1);
      } else if (!cleanWa.startsWith('62')) {
          cleanWa = '62' + cleanWa; // Assume indonesian if no country code
      }
      return `https://wa.me/${cleanWa}`;
  };

  if (!isAdminVerified) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-40"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-40"></div>
        
        <div className="bg-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative z-10">
           <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
               <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
               </svg>
           </div>
           <h2 className="text-2xl font-bold text-center mb-2 text-white">Portal Admin</h2>
           <p className="text-slate-400 text-sm mb-6 text-center">
             Akses terbatas. Masukkan password admin untuk mengelola member.
           </p>
           {adminLoginError && (
             <div className="p-3 bg-red-500/20 text-red-300 rounded-lg text-sm mb-4 border border-red-500/30 text-center">
               {adminLoginError}
             </div>
           )}
           <div className="space-y-4">
              <Input 
                 type="password"
                 placeholder="Password Admin" 
                 value={adminPasswordInput}
                 onChange={(e) => setAdminPasswordInput(e.target.value)}
                 className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                 onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                   if (e.key === 'Enter') handleAdminLogin();
                 }}
              />
              <Button 
                 onClick={handleAdminLogin} 
                 disabled={!adminPasswordInput} 
                 className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0"
              >
                 Masuk Panel Admin
              </Button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Admin - Manajemen Member Langganan</h1>
        <p className="text-slate-600">Member yang terdaftar di sini dapat menggunakan email mereka sebagai voucher untuk login ke aplikasi utama.</p>
        
        {loading && <div className="text-slate-500">Memuat data...</div>}
        {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}
        
        {!loading && !error && (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold mb-4">Tambah Member Baru</h2>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <Input 
                                placeholder="Email (Voucher)" 
                                value={newEmail} 
                                onChange={e => setNewEmail(e.target.value)}
                                className="flex-1"
                            />
                            <Input 
                                placeholder="No WhatsApp" 
                                value={newWa} 
                                onChange={e => setNewWa(e.target.value)}
                                className="flex-1"
                            />
                        </div>
                        <div className="flex flex-col md:flex-row gap-4">
                            <select 
                                value={durationMode} 
                                onChange={e => setDurationMode(e.target.value as any)}
                                className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="monthly">Bulanan</option>
                                <option value="custom">Hari (Custom)</option>
                            </select>
                            <Input 
                                type="number"
                                min={1}
                                placeholder={durationMode === 'monthly' ? "Jumlah Bulan" : "Jumlah Hari"} 
                                value={durationValue.toString()} 
                                onChange={e => setDurationValue(parseInt(e.target.value) || 1)}
                                className="flex-1"
                            />
                            <Button 
                                onClick={handleAddMember} 
                                disabled={actionLoading || !newEmail || !newWa || durationValue < 1}
                            >
                                {actionLoading ? 'Menyimpan...' : 'Tambah Member'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email (Voucher)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">WhatsApp</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status Expired</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {members.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-slate-500">Belum ada member terdaftar</td>
                                </tr>
                            ) : members.map((member) => (
                                <tr key={member.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{member.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        <a 
                                            href={formatWaLink(member.wa)} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                        >
                                            {member.wa}
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {member.exp ? (
                                            member.exp > Date.now() ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Aktif s/d {new Date(member.exp).toLocaleDateString('id-ID')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    Kedaluwarsa
                                                </span>
                                            )
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                Selamanya
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={() => handleDeleteMember(member.id)}
                                            className="text-red-600 hover:text-red-900"
                                            disabled={actionLoading}
                                        >
                                            Hapus
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminApp;
