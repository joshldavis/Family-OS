
import React, { useState, useMemo } from 'react';
import {
  User, Medication, MedicationFrequency, HealthAppointment, AppointmentType, VitalRecord,
} from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import {
  Heart, Plus, X, Pill, CalendarDays, Activity, User as UserIcon,
  Clock, MapPin, AlertTriangle, CheckCircle2, Trash2, ChevronDown,
} from 'lucide-react';
import { useFamily } from '../FamilyContext';
import { MOCK_USERS } from '../db';

const APPOINTMENT_TYPES: AppointmentType[] = ['Doctor', 'Dentist', 'Vision', 'Therapy', 'Other'];
const MED_FREQUENCIES: { value: MedicationFrequency; label: string }[] = [
  { value: 'daily', label: 'Once daily' },
  { value: 'twice-daily', label: 'Twice daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'as-needed', label: 'As needed' },
];

const APPT_COLORS: Record<AppointmentType, string> = {
  Doctor: 'bg-blue-50 border-blue-200 text-blue-700',
  Dentist: 'bg-teal-50 border-teal-200 text-teal-700',
  Vision: 'bg-purple-50 border-purple-200 text-purple-700',
  Therapy: 'bg-rose-50 border-rose-200 text-rose-700',
  Other: 'bg-slate-50 border-slate-200 text-slate-700',
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  const now0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - now0.getTime()) / 86400000);
}

interface HealthProps {
  users?: User[];
}

const Health: React.FC<HealthProps> = ({ users: propUsers }) => {
  const { state } = useFamily();
  const rawUsers = propUsers ?? MOCK_USERS;
  const currentUser = state.currentUser;
  const allUsers = currentUser
    ? [currentUser, ...rawUsers.filter(u => u.id !== currentUser.id)]
    : rawUsers;
  const familyMembers = Array.from(new Map(allUsers.map(u => [u.id, u])).values());

  const [medications, setMedications] = useLocalStorage<Medication[]>('family_os_medications', []);
  const [appointments, setAppointments] = useLocalStorage<HealthAppointment[]>('family_os_appointments', []);
  const [vitals, setVitals] = useLocalStorage<VitalRecord[]>('family_os_vitals', []);

  const [activeTab, setActiveTab] = useState<'appointments' | 'medications' | 'vitals'>('appointments');
  const [filterMember, setFilterMember] = useState<string>('all');

  // Modal state
  const [apptModal, setApptModal] = useState(false);
  const [medModal, setMedModal] = useState(false);
  const [vitalModal, setVitalModal] = useState(false);

  // Form state — appointments
  const [apptForm, setApptForm] = useState({
    memberId: familyMembers[0]?.id ?? '',
    title: '', type: 'Doctor' as AppointmentType,
    date: '', time: '', location: '', notes: '',
  });

  // Form state — medications
  const [medForm, setMedForm] = useState({
    memberId: familyMembers[0]?.id ?? '',
    name: '', dosage: '',
    frequency: 'daily' as MedicationFrequency,
    instructions: '', startDate: '', endDate: '', refillDate: '',
  });

  // Form state — vitals
  const [vitalForm, setVitalForm] = useState({
    memberId: familyMembers[0]?.id ?? '',
    date: new Date().toISOString().split('T')[0],
    weight: '', height: '', bloodPressure: '', notes: '',
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Upcoming appointments (sorted by date)
  const upcomingAppts = useMemo(() =>
    appointments
      .filter(a => a.date >= todayStr && (filterMember === 'all' || a.memberId === filterMember))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [appointments, todayStr, filterMember]
  );

  const pastAppts = useMemo(() =>
    appointments
      .filter(a => a.date < todayStr && (filterMember === 'all' || a.memberId === filterMember))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6),
    [appointments, todayStr, filterMember]
  );

  const filteredMeds = useMemo(() =>
    medications.filter(m => filterMember === 'all' || m.memberId === filterMember),
    [medications, filterMember]
  );

  const filteredVitals = useMemo(() =>
    vitals
      .filter(v => filterMember === 'all' || v.memberId === filterMember)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [vitals, filterMember]
  );

  const getMember = (id: string) => familyMembers.find(m => m.id === id);

  const handleAddAppt = () => {
    if (!apptForm.title || !apptForm.date || !apptForm.memberId) return;
    const newAppt: HealthAppointment = {
      id: `ha-${Date.now()}`,
      familyId: 'fam-1',
      ...apptForm,
      createdAt: new Date().toISOString(),
    };
    setAppointments(prev => [...prev, newAppt]);
    setApptModal(false);
    setApptForm({ memberId: familyMembers[0]?.id ?? '', title: '', type: 'Doctor', date: '', time: '', location: '', notes: '' });
  };

  const handleAddMed = () => {
    if (!medForm.name || !medForm.memberId) return;
    const newMed: Medication = {
      id: `med-${Date.now()}`,
      familyId: 'fam-1',
      ...medForm,
      createdAt: new Date().toISOString(),
    };
    setMedications(prev => [...prev, newMed]);
    setMedModal(false);
    setMedForm({ memberId: familyMembers[0]?.id ?? '', name: '', dosage: '', frequency: 'daily', instructions: '', startDate: '', endDate: '', refillDate: '' });
  };

  const handleAddVital = () => {
    if (!vitalForm.memberId || !vitalForm.date) return;
    const newVital: VitalRecord = {
      id: `vit-${Date.now()}`,
      familyId: 'fam-1',
      memberId: vitalForm.memberId,
      date: vitalForm.date,
      weight: vitalForm.weight ? parseFloat(vitalForm.weight) : undefined,
      height: vitalForm.height ? parseFloat(vitalForm.height) : undefined,
      bloodPressure: vitalForm.bloodPressure || undefined,
      notes: vitalForm.notes || undefined,
    };
    setVitals(prev => [...prev, newVital]);
    setVitalModal(false);
    setVitalForm({ memberId: familyMembers[0]?.id ?? '', date: todayStr, weight: '', height: '', bloodPressure: '', notes: '' });
  };

  const deleteAppt = (id: string) => setAppointments(prev => prev.filter(a => a.id !== id));
  const deleteMed = (id: string) => setMedications(prev => prev.filter(m => m.id !== id));

  // Stats
  const upcoming7 = upcomingAppts.filter(a => daysUntil(a.date) <= 7).length;
  const refillsSoon = medications.filter(m => m.refillDate && daysUntil(m.refillDate) <= 14 && daysUntil(m.refillDate) >= 0).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Heart size={28} className="text-rose-500" />
            Family Health
          </h1>
          <p className="text-slate-500 mt-1">Track appointments, medications, and vitals for every family member.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Member filter */}
          <div className="relative">
            <select
              value={filterMember}
              onChange={e => setFilterMember(e.target.value)}
              className="appearance-none bg-white border rounded-xl pl-4 pr-8 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Members</option>
              {familyMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <button
            onClick={() => setApptModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm text-sm"
          >
            <Plus size={16} /> Add Appointment
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Upcoming Appts', value: upcomingAppts.length, icon: CalendarDays, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'This Week', value: upcoming7, icon: AlertTriangle, color: upcoming7 > 0 ? 'text-amber-600' : 'text-green-600', bg: upcoming7 > 0 ? 'bg-amber-50' : 'bg-green-50' },
          { label: 'Refills Soon', value: refillsSoon, icon: Pill, color: refillsSoon > 0 ? 'text-red-600' : 'text-slate-500', bg: refillsSoon > 0 ? 'bg-red-50' : 'bg-slate-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border rounded-2xl p-5 notion-shadow flex items-center gap-4">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'appointments', label: 'Appointments', icon: CalendarDays },
          { id: 'medications', label: 'Medications', icon: Pill },
          { id: 'vitals', label: 'Vitals', icon: Activity },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-colors relative ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <tab.icon size={16} />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
        ))}
      </div>

      {/* ── Appointments Tab ── */}
      {activeTab === 'appointments' && (
        <div className="space-y-8">
          {/* Upcoming */}
          <section>
            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <CalendarDays size={18} className="text-indigo-500" /> Upcoming
            </h3>
            {upcomingAppts.length === 0 ? (
              <div className="bg-white border-2 border-dashed rounded-2xl p-10 text-center">
                <CheckCircle2 size={32} className="mx-auto text-green-400 mb-3" />
                <p className="text-slate-500 font-medium">No upcoming appointments.</p>
                <button onClick={() => setApptModal(true)} className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 text-sm">
                  <Plus size={15} /> Schedule One
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAppts.map(appt => {
                  const days = daysUntil(appt.date);
                  const member = getMember(appt.memberId);
                  return (
                    <div key={appt.id} className={`flex items-start gap-4 bg-white border rounded-2xl p-5 notion-shadow hover:border-indigo-200 transition-colors ${days <= 3 ? 'border-l-4 border-l-amber-400' : ''}`}>
                      <div className={`px-2 py-1 rounded-lg text-xs font-bold ${APPT_COLORS[appt.type]}`}>
                        {appt.type}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900">{appt.title}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><UserIcon size={11} /> {member?.name ?? 'Unknown'}</span>
                          <span className="flex items-center gap-1"><Clock size={11} /> {appt.date}{appt.time ? ` · ${appt.time}` : ''}</span>
                          {appt.location && <span className="flex items-center gap-1"><MapPin size={11} /> {appt.location}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${days === 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days}d`}
                        </p>
                        <button onClick={() => deleteAppt(appt.id)} className="mt-1 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past appointments */}
          {pastAppts.length > 0 && (
            <section>
              <h3 className="font-bold text-base text-slate-500 mb-3">Recent Past</h3>
              <div className="space-y-2">
                {pastAppts.map(appt => {
                  const member = getMember(appt.memberId);
                  return (
                    <div key={appt.id} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-4 opacity-70">
                      <div className={`px-2 py-0.5 rounded text-xs font-bold ${APPT_COLORS[appt.type]}`}>{appt.type}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-700 text-sm">{appt.title}</p>
                        <p className="text-xs text-slate-400">{member?.name} · {appt.date}</p>
                      </div>
                      <button onClick={() => deleteAppt(appt.id)} className="text-slate-200 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Medications Tab ── */}
      {activeTab === 'medications' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setMedModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm text-sm"
            >
              <Plus size={16} /> Add Medication
            </button>
          </div>
          {filteredMeds.length === 0 ? (
            <div className="bg-white border-2 border-dashed rounded-2xl p-10 text-center">
              <Pill size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No medications tracked.</p>
              <button onClick={() => setMedModal(true)} className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm">
                <Plus size={15} /> Add Medication
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMeds.map(med => {
                const member = getMember(med.memberId);
                const refillDays = med.refillDate ? daysUntil(med.refillDate) : null;
                const needsRefill = refillDays !== null && refillDays <= 14 && refillDays >= 0;
                return (
                  <div key={med.id} className={`bg-white border rounded-2xl p-5 notion-shadow ${needsRefill ? 'border-l-4 border-l-orange-400' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                          <Pill size={20} className="text-rose-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{med.name}</p>
                          <p className="text-xs text-slate-500">{med.dosage} · {MED_FREQUENCIES.find(f => f.value === med.frequency)?.label}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteMed(med.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><UserIcon size={11} /> {member?.name}</span>
                      {med.instructions && <span>· {med.instructions}</span>}
                    </div>
                    {needsRefill && (
                      <div className="mt-3 flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs font-semibold text-orange-700">
                        <AlertTriangle size={12} />
                        Refill needed {refillDays === 0 ? 'today' : `in ${refillDays} day${refillDays !== 1 ? 's' : ''}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Vitals Tab ── */}
      {activeTab === 'vitals' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setVitalModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm text-sm"
            >
              <Plus size={16} /> Log Vitals
            </button>
          </div>
          {filteredVitals.length === 0 ? (
            <div className="bg-white border-2 border-dashed rounded-2xl p-10 text-center">
              <Activity size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No vitals recorded.</p>
              <button onClick={() => setVitalModal(true)} className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm">
                <Plus size={15} /> Log Now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVitals.map(v => {
                const member = getMember(v.memberId);
                return (
                  <div key={v.id} className="bg-white border rounded-2xl p-5 notion-shadow flex items-start gap-4">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Activity size={18} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-slate-900">{member?.name}</p>
                        <span className="text-xs text-slate-400">{v.date}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        {v.weight && <span className="text-slate-700"><span className="text-xs text-slate-400 mr-1">Weight</span>{v.weight} lbs</span>}
                        {v.height && <span className="text-slate-700"><span className="text-xs text-slate-400 mr-1">Height</span>{Math.floor(v.height / 12)}′{v.height % 12}″</span>}
                        {v.bloodPressure && <span className="text-slate-700"><span className="text-xs text-slate-400 mr-1">BP</span>{v.bloodPressure}</span>}
                      </div>
                      {v.notes && <p className="text-xs text-slate-500 mt-1">{v.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Add Appointment Modal ── */}
      {apptModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">New Appointment</h2>
              <button onClick={() => setApptModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Family Member</label>
                <select value={apptForm.memberId} onChange={e => setApptForm(f => ({ ...f, memberId: e.target.value }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Appointment Title *</label>
                <input autoFocus value={apptForm.title} onChange={e => setApptForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Annual Checkup" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Type</label>
                  <select value={apptForm.type} onChange={e => setApptForm(f => ({ ...f, type: e.target.value as AppointmentType }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {APPOINTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Date *</label>
                  <input type="date" value={apptForm.date} onChange={e => setApptForm(f => ({ ...f, date: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Time</label>
                  <input type="time" value={apptForm.time} onChange={e => setApptForm(f => ({ ...f, time: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Location</label>
                  <input value={apptForm.location} onChange={e => setApptForm(f => ({ ...f, location: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Office or address" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Notes</label>
                <textarea value={apptForm.notes} onChange={e => setApptForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Bring insurance card, fasting required, etc." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setApptModal(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleAddAppt} disabled={!apptForm.title || !apptForm.date} className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">Save Appointment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Medication Modal ── */}
      {medModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Add Medication</h2>
              <button onClick={() => setMedModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Family Member</label>
                <select value={medForm.memberId} onChange={e => setMedForm(f => ({ ...f, memberId: e.target.value }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Medication Name *</label>
                  <input autoFocus value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Amoxicillin" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Dosage</label>
                  <input value={medForm.dosage} onChange={e => setMedForm(f => ({ ...f, dosage: e.target.value }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 500mg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Frequency</label>
                <select value={medForm.frequency} onChange={e => setMedForm(f => ({ ...f, frequency: e.target.value as MedicationFrequency }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {MED_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Instructions</label>
                <input value={medForm.instructions} onChange={e => setMedForm(f => ({ ...f, instructions: e.target.value }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Take with food" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Start Date</label>
                  <input type="date" value={medForm.startDate} onChange={e => setMedForm(f => ({ ...f, startDate: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Refill Reminder</label>
                  <input type="date" value={medForm.refillDate} onChange={e => setMedForm(f => ({ ...f, refillDate: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setMedModal(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleAddMed} disabled={!medForm.name} className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">Save Medication</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Log Vitals Modal ── */}
      {vitalModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Log Vitals</h2>
              <button onClick={() => setVitalModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Family Member</label>
                  <select value={vitalForm.memberId} onChange={e => setVitalForm(f => ({ ...f, memberId: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Date</label>
                  <input type="date" value={vitalForm.date} onChange={e => setVitalForm(f => ({ ...f, date: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Weight (lbs)</label>
                  <input type="number" value={vitalForm.weight} onChange={e => setVitalForm(f => ({ ...f, weight: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="145" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Height (in)</label>
                  <input type="number" value={vitalForm.height} onChange={e => setVitalForm(f => ({ ...f, height: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="68" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Blood Pressure</label>
                  <input value={vitalForm.bloodPressure} onChange={e => setVitalForm(f => ({ ...f, bloodPressure: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="120/80" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Notes</label>
                <input value={vitalForm.notes} onChange={e => setVitalForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Any relevant notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setVitalModal(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleAddVital} className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-indigo-700">Save Vitals</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Health;
