
import React, { useState } from 'react';
import { CloudflareCredentials } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface LayoutProps {
  children: React.ReactNode;
  credentials: CloudflareCredentials | null;
  onSaveCredentials: (creds: CloudflareCredentials) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  credentials, 
  onSaveCredentials, 
  activeTab, 
  onTabChange 
}) => {
  const [showConfig, setShowConfig] = useState(!credentials);
  const [form, setForm] = useState<CloudflareCredentials>(
    credentials || { email: '', apiKey: '', zoneId: '', accountId: '' }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCredentials(form);
    setShowConfig(false);
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'M4 6h16M4 12h16m-7 6h7' },
    { id: 'addresses', label: 'Destination Addresses', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'rules', label: 'Routing Rules', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'catchall', label: 'Catch-all Rule', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'subdomains', label: 'Subdomains', icon: 'M4 6h6M4 12h8M4 18h10M16 6h4M18 4v4M16 18h4' },
    { id: 'dns', label: 'DNS Records', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="font-bold text-slate-900 tracking-tight">Email Route</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === item.id 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setShowConfig(true)}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            API Setup
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-slate-800">
            {navItems.find(n => n.id === activeTab)?.label}
          </h2>
          {credentials && (
            <div className="text-sm text-slate-500 hidden sm:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {credentials.email}
            </div>
          )}
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Config Overlay */}
      {showConfig && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Cloudflare Credentials</h3>
              <p className="text-sm text-slate-500">Enter your API details to manage your Email Routing settings.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input 
                label="Email" 
                placeholder="user@example.com" 
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                required
              />
              <Input 
                label="Global API Key / Token" 
                type="password" 
                placeholder="144c9defac04..." 
                value={form.apiKey}
                onChange={e => setForm({...form, apiKey: e.target.value})}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Zone ID" 
                  placeholder="32 chars" 
                  value={form.zoneId}
                  onChange={e => setForm({...form, zoneId: e.target.value})}
                  required
                />
                <Input 
                  label="Account ID" 
                  placeholder="32 chars" 
                  value={form.accountId}
                  onChange={e => setForm({...form, accountId: e.target.value})}
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="flex-1" 
                  onClick={() => credentials && setShowConfig(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">Save Configuration</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
