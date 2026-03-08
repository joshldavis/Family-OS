
import React, { useState } from 'react';
import { User, Role, Family, EmailScanConfig } from '../types';
import ModuleSettings from '../components/ModuleSettings';
import { useFamily } from '../FamilyContext';
import {
  Shield,
  Users,
  Bell,
  Download,
  Trash2,
  Lock,
  FileText,
  Globe,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Mail,
  Plus,
  X as XIcon,
  Settings as SettingsIcon,
} from 'lucide-react';

interface SettingsProps {
  family: Family;
  familyUsers: User[];
  onResetData: () => void;
  emailScanConfig: EmailScanConfig;
  onUpdateEmailConfig: (config: Partial<EmailScanConfig>) => void;
}

const Settings: React.FC<SettingsProps> = ({
  family,
  familyUsers,
  onResetData,
  emailScanConfig,
  onUpdateEmailConfig,
}) => {
  const { state, dispatch } = useFamily();
  const isGoogleLinked = state.isGoogleLinked;

  const [isLinking, setIsLinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newSender, setNewSender] = useState('');
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});

  const handleAvatarError = (userId: string) =>
    setAvatarErrors(prev => ({ ...prev, [userId]: true }));

  const handleLinkGoogle = () => {
    setIsLinking(true);
    setTimeout(() => {
      dispatch({ type: 'SET_GOOGLE_LINKED', payload: true });
      setIsLinking(false);
    }, 1500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(family.inviteCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard write failed (permissions or insecure context)
      });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your family workspace and personal preferences.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">

          {/* Modules */}
          <section className="bg-white border rounded-2xl notion-shadow overflow-hidden">
            <div className="p-6 border-b bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <SettingsIcon size={18} className="text-indigo-500" />
                Modules
              </h3>
              <p className="text-xs text-slate-500 mt-1">Enable or disable features to customise your Family OS experience.</p>
            </div>
            <div className="p-6">
              <ModuleSettings />
            </div>
          </section>

          {/* Integrations */}
          <section className="bg-white border rounded-2xl notion-shadow overflow-hidden">
            <div className="p-6 border-b bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Globe size={18} className="text-blue-500" />
                Integrations
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white border rounded-xl flex items-center justify-center shadow-sm">
                    <img src="https://www.gstatic.com/images/branding/product/1x/calendar_2020q4_48dp.png" className="w-8 h-8" alt="Google Calendar" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Google Calendar</p>
                    <p className="text-xs text-slate-500">Sync family events and school deadlines.</p>
                  </div>
                </div>
                {isGoogleLinked ? (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                    <button
                      onClick={() => dispatch({ type: 'SET_GOOGLE_LINKED', payload: false })}
                      className="text-xs text-slate-400 hover:text-red-600 font-bold"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLinkGoogle}
                    disabled={isLinking}
                    className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isLinking ? <RefreshCw size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                    {isLinking ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>

              {isGoogleLinked && (
                <div className="space-y-4 pt-2 animate-in slide-in-from-top-2">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Auto-sync Schoolwork</p>
                      <p className="text-xs text-slate-500">Post school assignments to your Google Calendar automatically.</p>
                    </div>
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" defaultChecked />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Sync External Meetings</p>
                      <p className="text-xs text-slate-500">Show work meetings from your primary Google Calendar in Family OS.</p>
                    </div>
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" defaultChecked />
                  </label>
                </div>
              )}
            </div>
          </section>

          {/* Email Intelligence */}
          <section className="bg-white border rounded-2xl notion-shadow overflow-hidden">
            <div className="p-6 border-b bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Mail size={18} className="text-indigo-500" />
                Email Intelligence
              </h3>
              <p className="text-xs text-slate-500 mt-1">Auto-classify school emails into events, assignments, and action items.</p>
            </div>
            <div className="p-6 space-y-6">

              {/* Enable toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-semibold text-slate-800">Scan emails for school content</p>
                  <p className="text-xs text-slate-500 mt-0.5">When enabled, you can paste school emails to auto-classify them.</p>
                </div>
                <div
                  onClick={() => onUpdateEmailConfig({ enabled: !emailScanConfig.enabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${emailScanConfig.enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${emailScanConfig.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </label>

              {emailScanConfig.enabled && (
                <div className="space-y-6 animate-in slide-in-from-top-2">

                  {/* Platform toggles */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Platform Sources</p>
                    {[
                      { key: 'includeClassDojo', label: 'ClassDojo notifications', desc: 'Points, messages, class stories from @classdojo.com' },
                      { key: 'includeGoogleClassroom', label: 'Google Classroom', desc: 'Assignment posts and announcements' },
                    ].map(({ key, label, desc }) => (
                      <label key={key} className="flex items-center justify-between cursor-pointer">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{label}</p>
                          <p className="text-xs text-slate-500">{desc}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={emailScanConfig[key as 'includeClassDojo' | 'includeGoogleClassroom']}
                          onChange={e => onUpdateEmailConfig({ [key]: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>
                    ))}
                  </div>

                  {/* School domains */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">School Email Domains</p>
                    <p className="text-xs text-slate-500">Add your school's email domain to recognize their emails automatically.</p>
                    <div className="flex flex-wrap gap-2">
                      {emailScanConfig.schoolDomains.map(domain => (
                        <span key={domain} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-lg">
                          {domain}
                          <button onClick={() => onUpdateEmailConfig({ schoolDomains: emailScanConfig.schoolDomains.filter(d => d !== domain) })} className="hover:text-red-600 ml-0.5">
                            <XIcon size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDomain}
                        onChange={e => setNewDomain(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newDomain.trim()) {
                            onUpdateEmailConfig({ schoolDomains: [...emailScanConfig.schoolDomains, newDomain.trim()] });
                            setNewDomain('');
                          }
                        }}
                        placeholder="@riverside.k12.us"
                        className="flex-1 px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          if (newDomain.trim()) {
                            onUpdateEmailConfig({ schoolDomains: [...emailScanConfig.schoolDomains, newDomain.trim()] });
                            setNewDomain('');
                          }
                        }}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Known senders */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Known Senders (Optional)</p>
                    <p className="text-xs text-slate-500">Specific teacher or admin addresses to always classify.</p>
                    <div className="flex flex-wrap gap-2">
                      {emailScanConfig.knownSenders.map(sender => (
                        <span key={sender} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-lg">
                          {sender}
                          <button onClick={() => onUpdateEmailConfig({ knownSenders: emailScanConfig.knownSenders.filter(s => s !== sender) })} className="hover:text-red-600 ml-0.5">
                            <XIcon size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSender}
                        onChange={e => setNewSender(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newSender.trim()) {
                            onUpdateEmailConfig({ knownSenders: [...emailScanConfig.knownSenders, newSender.trim()] });
                            setNewSender('');
                          }
                        }}
                        placeholder="teacher@school.edu"
                        className="flex-1 px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          if (newSender.trim()) {
                            onUpdateEmailConfig({ knownSenders: [...emailScanConfig.knownSenders, newSender.trim()] });
                            setNewSender('');
                          }
                        }}
                        className="px-3 py-2 bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Family Membership — dynamic */}
          <section className="bg-white border rounded-2xl notion-shadow overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-slate-400" />
                Family Membership
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{family.name}</p>
                  <p className="text-xs text-slate-500">Share your invite code with new members to join your workspace.</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-slate-100 px-3 py-1 rounded font-mono text-sm font-bold">{family.inviteCode}</code>
                  <button
                    onClick={handleCopyCode}
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm font-semibold mb-4 text-slate-900">Workspace Members</p>
                <div className="space-y-3">
                  {familyUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {avatarErrors[u.id] ? (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <img
                            src={u.avatar}
                            className="w-8 h-8 rounded-full bg-slate-100 object-cover flex-shrink-0"
                            alt={u.name}
                            onError={() => handleAvatarError(u.id)}
                          />
                        )}
                        <div>
                          <span className="font-medium text-slate-800">{u.name}</span>
                          <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            u.role === Role.PARENT
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'bg-green-50 text-green-600'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                      </div>
                      <button className="text-xs text-slate-400 hover:text-slate-600">Edit</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Privacy & Data */}
          <section className="bg-white border rounded-2xl notion-shadow overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Shield size={18} className="text-slate-400" />
                Privacy & Data
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Lock size={20} className="text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Private by Design</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Your family data is private and encrypted. Only members of "{family.name}" workspace can view your assignments, chores, and calendar events.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="flex items-center justify-center gap-2 border p-3 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold">
                  <Download size={18} className="text-slate-400" />
                  Export All Data (JSON)
                </button>
                <button
                  onClick={onResetData}
                  className="flex items-center justify-center gap-2 border border-amber-100 p-3 rounded-xl hover:bg-amber-50 text-amber-600 transition-colors text-sm font-semibold"
                >
                  <RefreshCw size={18} />
                  Reset Demo Data
                </button>
                <button className="flex items-center justify-center gap-2 border border-red-100 p-3 rounded-xl hover:bg-red-50 text-red-600 transition-colors text-sm font-semibold">
                  <Trash2 size={18} />
                  Delete Family Workspace
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-50 border rounded-2xl p-6">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Bell size={18} className="text-slate-400" />
              Notifications
            </h4>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-700">Daily Morning Briefing</span>
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" defaultChecked />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-700">Assignment Deadlines</span>
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" defaultChecked />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-700">Chore Reminders</span>
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" defaultChecked />
              </label>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-6 notion-shadow">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <FileText size={18} className="text-slate-400" />
              Upcoming Beta
            </h4>
            <p className="text-xs text-slate-500 mb-4">Features currently being built:</p>
            <ul className="space-y-2">
              {['Gmail Auto-Sync (MCP)', 'Canvas Import', 'Google Classroom Direct Sync', 'Family Goal Marketplace'].map(f => (
                <li key={f} className="text-xs flex items-center gap-2 text-slate-400">
                  <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
