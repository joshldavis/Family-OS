
import React, { useState, useMemo } from 'react';
import { 
  Student, 
  Assignment, 
  Status 
} from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  BookOpen, 
  UserPlus, 
  ExternalLink,
  CheckCircle2,
  Circle,
  Sparkles,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import AIScanModal from '../components/AIScanModal';

interface SchoolworkProps {
  students: Student[];
  assignments: Assignment[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
}

const Schoolwork: React.FC<SchoolworkProps> = ({ students, assignments, setAssignments, setStudents }) => {
  const [activeTab, setActiveTab] = useState<'assignments' | 'students'>('assignments');
  const [filterStudent, setFilterStudent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Helper for timezone-safe date display
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const matchesStudent = filterStudent === 'all' || a.studentId === filterStudent;
      const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           a.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStudent && matchesSearch;
    });
  }, [assignments, filterStudent, searchQuery]);

  const toggleAssignmentStatus = (id: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.id === id) {
        const nextStatus = a.status === Status.DONE ? Status.NOT_STARTED : Status.DONE;
        return { ...a, status: nextStatus };
      }
      return a;
    }));
  };

  const deleteAssignment = (id: string) => {
    // Immediate visual feedback
    setDeletingId(id);
    
    // Delay actual state update to allow animation to complete
    setTimeout(() => {
      setAssignments(prev => prev.filter(a => a.id !== id));
      setDeletingId(null);
    }, 300);
  };

  const openEditModal = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingAssignment(null);
    setIsModalOpen(true);
  };

  const handleSaveAssignment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const assignmentData = {
      title: formData.get('title') as string,
      subject: formData.get('subject') as string,
      studentId: formData.get('studentId') as string,
      dueDate: formData.get('dueDate') as string,
      estimatedMinutes: parseInt(formData.get('estimatedMinutes') as string) || 30,
    };

    if (editingAssignment) {
      setAssignments(prev => prev.map(a => 
        a.id === editingAssignment.id ? { ...a, ...assignmentData } : a
      ));
    } else {
      const newAssignment: Assignment = {
        id: `a-${Date.now()}`,
        status: Status.NOT_STARTED,
        source: 'Manual',
        ...assignmentData
      };
      setAssignments(prev => [newAssignment, ...prev]);
    }
    
    setIsModalOpen(false);
  };

  const handleAIScanResult = (extractedList: any[]) => {
    const newAssignments = extractedList.map((item, idx) => {
      const matchedStudent = students.find(s => 
        s.name.toLowerCase().includes(item.studentName?.toLowerCase() || "")
      ) || students[0];

      return {
        id: `a-ai-${Date.now()}-${idx}`,
        studentId: matchedStudent.id,
        subject: item.subject,
        title: item.title,
        dueDate: item.dueDate,
        estimatedMinutes: 30,
        status: Status.NOT_STARTED,
        source: 'Import' as const
      };
    });
    setAssignments(prev => [...newAssignments, ...prev]);
  };

  const workloadData = useMemo(() => {
    const days: { [key: string]: number } = {};
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days[d.toISOString().split('T')[0]] = 0;
    }

    assignments.forEach(a => {
      if (days[a.dueDate] !== undefined && a.status !== Status.DONE) {
        days[a.dueDate] += a.estimatedMinutes;
      }
    });

    return Object.entries(days).map(([date, mins]) => ({
      date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
      minutes: mins,
      fullDate: date
    }));
  }, [assignments]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Schoolwork</h1>
          <p className="text-slate-500 mt-1">Manage homework, projects, and learning goals.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
          >
            <Sparkles size={18} />
            Magic Scan
          </button>
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            New Assignment
          </button>
        </div>
      </header>

      {/* Homework Load Chart */}
      <section className="bg-white border rounded-2xl p-6 notion-shadow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-slate-900">Homework Load</h3>
            <p className="text-xs text-slate-500">Minutes due this week by day</p>
          </div>
          <div className="bg-slate-50 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase">Forecast</div>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workloadData}>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                {workloadData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.minutes > 60 ? '#f59e0b' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('assignments')}
          className={`px-6 py-3 text-sm font-semibold transition-colors relative ${activeTab === 'assignments' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Assignments
          {activeTab === 'assignments' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('students')}
          className={`px-6 py-3 text-sm font-semibold transition-colors relative ${activeTab === 'students' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Students
          {activeTab === 'students' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>}
        </button>
      </div>

      {activeTab === 'assignments' ? (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search titles, subjects..." 
                className="w-full pl-10 pr-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select 
                className="bg-white border rounded-lg px-4 py-2 text-sm focus:outline-none notion-shadow"
                value={filterStudent}
                onChange={(e) => setFilterStudent(e.target.value)}
              >
                <option value="all">All Students</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="p-2 border rounded-lg bg-white hover:bg-slate-50 transition-colors">
                <Filter size={18} className="text-slate-500" />
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-2xl overflow-hidden notion-shadow">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 border-b text-slate-500 uppercase text-[10px] font-bold tracking-widest">
                <tr>
                  <th className="px-6 py-4 w-12 text-center">Done</th>
                  <th className="px-6 py-4">Assignment</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Effort</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.length > 0 ? filteredAssignments.map(a => (
                  <tr 
                    key={a.id} 
                    className={`hover:bg-slate-50/50 transition-all duration-300 group overflow-hidden ${deletingId === a.id ? 'opacity-0 scale-95 -translate-x-4 pointer-events-none' : 'opacity-100'}`}
                  >
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => toggleAssignmentStatus(a.id)}>
                        {a.status === Status.DONE ? (
                          <CheckCircle2 className="text-green-500 mx-auto" size={20} />
                        ) : (
                          <Circle className="text-slate-300 group-hover:text-indigo-400 mx-auto" size={20} />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className={`font-bold ${a.status === Status.DONE ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{a.title}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <BookOpen size={12} /> {a.subject}
                          {a.source === 'Import' && <span className="ml-2 bg-blue-50 text-blue-600 px-1 rounded text-[10px]">Imported</span>}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {students.find(s => s.id === a.studentId)?.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        a.dueDate < new Date().toISOString().split('T')[0] && a.status !== Status.DONE 
                        ? 'bg-red-50 text-red-600' 
                        : 'bg-slate-100 text-slate-600'
                      }`}>
                        {formatDisplayDate(a.dueDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-500">
                        <Clock size={14} />
                        <span>{a.estimatedMinutes}m</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(a)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => deleteAssignment(a.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No assignments found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map(student => (
            <div key={student.id} className="bg-white border rounded-2xl p-6 notion-shadow hover:border-indigo-200 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-lg">
                  {student.name.charAt(0)}
                </div>
                <button className="p-2 text-slate-400 hover:text-slate-600">
                  <ExternalLink size={18} />
                </button>
              </div>
              <h3 className="font-bold text-slate-900 text-lg">{student.name}</h3>
              <p className="text-indigo-600 text-sm font-medium">{student.grade}</p>
              <p className="text-slate-500 text-sm mt-3">{student.notes}</p>
              
              <div className="mt-6 pt-6 border-t flex justify-between">
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-slate-900">
                    {assignments.filter(a => a.studentId === student.id && a.status !== Status.DONE).length}
                  </p>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Open Tasks</p>
                </div>
                <div className="text-center flex-1 border-x">
                  <p className="text-xl font-bold text-slate-900">
                    {assignments.filter(a => a.studentId === student.id && a.status === Status.DONE).length}
                  </p>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Completed</p>
                </div>
              </div>
            </div>
          ))}
          <button className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all group">
            <UserPlus size={32} className="group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Add Student</span>
          </button>
        </div>
      )}

      {/* Assignment Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-50/30">
              <h2 className="text-xl font-bold text-slate-900">
                {editingAssignment ? 'Edit Assignment' : 'New Assignment'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveAssignment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Title</label>
                <input 
                  name="title" 
                  defaultValue={editingAssignment?.title} 
                  required 
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="e.g. History Essay"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Subject</label>
                  <input 
                    name="subject" 
                    defaultValue={editingAssignment?.subject} 
                    required 
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    placeholder="e.g. History"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Student</label>
                  <select 
                    name="studentId" 
                    defaultValue={editingAssignment?.studentId || students[0]?.id}
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  >
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Due Date</label>
                  <input 
                    type="date" 
                    name="dueDate" 
                    defaultValue={editingAssignment?.dueDate} 
                    required 
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Effort (Mins)</label>
                  <input 
                    type="number" 
                    name="estimatedMinutes" 
                    defaultValue={editingAssignment?.estimatedMinutes || 30} 
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
                  {editingAssignment ? 'Save Changes' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AIScanModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        context="schoolwork" 
        onDataExtracted={handleAIScanResult} 
        students={students}
      />
    </div>
  );
};

export default Schoolwork;
