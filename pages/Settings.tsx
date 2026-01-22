
import React, { useState } from 'react';
import { User, Role } from '../types';
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
  RefreshCw
} from 'lucide-react';

interface SettingsProps {
  user: User;
  isGoogleLinked: boolean;
  onToggleGoogle: (status: boolean) => void;
}

const Settings: React.FC<SettingsProps> = ({ user, isGoogleLinked, onToggleGoogle }) => {
  const [isLinking, setIsLinking] = useState(false);

  const handleLinkGoogle = () => {
    setIsLinking(true);
    // Simulate OAuth Popup
    setTimeout(() => {
      onToggleGoogle(true);
      setIsLinking(false);
    }, 1500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your family workspace and personal preferences.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Integrations Section */}
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
                      onClick={() => onToggleGoogle(false)}
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
                  <p className="font-semibold">Family Invite Code</p>
                  <p className="text-xs text-slate-500">Share this with new members to join your workspace.</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-slate-100 px-3 py-1 rounded font-mono text-sm font-bold">MILLER2024</code>
                  <button className="text-xs text-indigo-600 font-bold hover:underline">Copy Code</button>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm font-semibold mb-4 text-slate-900">Workspace Members</p>
                <div className="space-y-3">
                  {['Sarah Miller (Parent)', 'Leo Miller (Child)', 'Maya Miller (Child)'].map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                          {m.charAt(0)}
                        </div>
                        <span>{m}</span>
                      </div>
                      <button className="text-xs text-slate-400 hover:text-slate-600">Edit</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

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
                    Your family data is private and encrypted. Only members of "The Miller Family" workspace can view your assignments, chores, and calendar events.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button className="flex items-center justify-center gap-2 border p-3 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold">
                  <Download size={18} className="text-slate-400" />
                  Export All Data (JSON)
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
            <p className="text-xs text-slate-500 mb-4">The following features are currently being built and will be available soon:</p>
            <ul className="space-y-2">
              {['Google Classroom Sync', 'Canvas Import', 'OCR Assignment Scanning', 'Family Goal Marketplace'].map(f => (
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
