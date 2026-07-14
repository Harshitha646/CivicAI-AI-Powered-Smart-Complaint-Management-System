/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShieldAlert, Users, Landmark, FileText, Bell, CheckCircle, 
  Clock, AlertTriangle, Sparkles, Filter, Search, ArrowRight, UserCheck, BarChart3, 
  Settings, LogOut, RefreshCw, Send, Check, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { User, Complaint, Department, Officer, ComplaintStatus, Priority } from '../types';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function AdminDashboard({ user, onLogout, darkMode, toggleDarkMode }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'complaints' | 'officers' | 'citizens'>('dashboard');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [citizens, setCitizens] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  
  // Selection / Assignment states
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('5');
  const [assigning, setAssigning] = useState(false);

  // Smart Reply state
  const [smartReplyText, setSmartReplyText] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);

  // Filters state
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const fetchAllAdminData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('civic_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Complaints
      const compRes = await fetch('/api/complaints', { headers });
      const compData = await compRes.json();
      if (Array.isArray(compData)) setComplaints(compData);

      // Departments
      const deptRes = await fetch('/api/departments');
      const deptData = await deptRes.json();
      if (Array.isArray(deptData)) {
        setDepartments(deptData);
        if (deptData.length > 0) setSelectedDeptId(deptData[0].id);
      }

      // Officers
      const offRes = await fetch('/api/officers');
      const offData = await offRes.json();
      if (Array.isArray(offData)) {
        setOfficers(offData);
        if (offData.length > 0) setSelectedOfficerId(offData[0].id);
      }

      // Analytics
      const analyticsRes = await fetch('/api/analytics', { headers });
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData);

      // Fetch citizens list from database
      const citizensRes = await fetch('/api/users', { headers });
      const citizensData = await citizensRes.json();
      if (Array.isArray(citizensData)) {
        setCitizens(citizensData.filter(u => u.role === 'CITIZEN'));
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAdminData();
  }, [activeTab]);

  const handleSelectComplaint = async (id: string) => {
    try {
      const token = localStorage.getItem('civic_token');
      const response = await fetch(`/api/complaints/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.complaint) {
        setSelectedComplaint(data.complaint);
        setSmartReplyText('');
        if (data.complaint.departmentId) {
          setSelectedDeptId(data.complaint.departmentId);
        }
        if (data.complaint.assignedOfficerId) {
          setSelectedOfficerId(data.complaint.assignedOfficerId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Perform assignment dispatch
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    setAssigning(true);
    try {
      const token = localStorage.getItem('civic_token');
      const response = await fetch(`/api/complaints/${selectedComplaint.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          officerId: selectedOfficerId,
          departmentId: selectedDeptId,
          estimatedDays
        })
      });

      if (response.ok) {
        alert('Complaint dispatched successfully to the designated officer.');
        handleSelectComplaint(selectedComplaint.id);
        fetchAllAdminData();
      } else {
        const d = await response.json();
        alert(d.error || 'Failed to dispatch workload.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAssigning(false);
    }
  };

  // Generate AI reply draft
  const handleGenerateSmartReply = async () => {
    if (!selectedComplaint) return;
    setGeneratingReply(true);
    try {
      const token = localStorage.getItem('civic_token');
      const response = await fetch('/api/ai/smart-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ complaintId: selectedComplaint.id })
      });
      const data = await response.json();
      if (data.reply) {
        setSmartReplyText(data.reply);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingReply(false);
    }
  };

  // Escalate Complaint manually
  const handleEscalateManual = async () => {
    if (!selectedComplaint) return;
    try {
      const token = localStorage.getItem('civic_token');
      const response = await fetch(`/api/complaints/${selectedComplaint.id}/escalate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        alert('Complaint escalated successfully. Senior executives have been notified.');
        handleSelectComplaint(selectedComplaint.id);
        fetchAllAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status: ComplaintStatus) => {
    switch (status) {
      case ComplaintStatus.SUBMITTED: return 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200';
      case ComplaintStatus.ASSIGNED: return 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200';
      case ComplaintStatus.IN_PROGRESS: return 'bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200';
      case ComplaintStatus.RESOLVED: return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200';
      case ComplaintStatus.ESCALATED: return 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200';
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.LOW: return 'text-slate-500 bg-slate-100 dark:bg-slate-800';
      case Priority.MEDIUM: return 'text-amber-600 bg-amber-50 dark:bg-amber-950/20';
      case Priority.HIGH: return 'text-orange-600 bg-orange-50 dark:bg-orange-950/20 font-semibold';
      case Priority.CRITICAL: return 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 font-bold border-l-2 border-rose-500';
    }
  };

  // Pie chart coloring parameters
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Filters calculation
  const filteredComplaints = complaints.filter(c => {
    const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus;
    const matchesCategory = filterCategory === 'ALL' || c.category === filterCategory;
    const matchesSearch = searchQuery === '' || 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  // Filter officers based on selected department in the drop-down
  const deptOfficers = officers.filter(o => o.departmentId === selectedDeptId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 shrink-0 hidden md:flex flex-col text-slate-300">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <ShieldAlert size={18} />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              Civic<span className="text-blue-500">AI</span>
            </span>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Control Tower</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          <button
            id="admin-tab-btn-dashboard"
            onClick={() => { setActiveTab('dashboard'); setSelectedComplaint(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <LayoutDashboard size={16} />
            <span>Executive Analytics</span>
          </button>

          <button
            id="admin-tab-btn-complaints"
            onClick={() => { setActiveTab('complaints'); setSelectedComplaint(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'complaints'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <FileText size={16} />
            <span>Manage Complaints</span>
          </button>

          <button
            id="admin-tab-btn-officers"
            onClick={() => { setActiveTab('officers'); setSelectedComplaint(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'officers'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Users size={16} />
            <span>Manage Officers</span>
          </button>

          <button
            id="admin-tab-btn-citizens"
            onClick={() => { setActiveTab('citizens'); setSelectedComplaint(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'citizens'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <UserCheck size={16} />
            <span>Registered Citizens</span>
          </button>
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/30">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              A
            </div>
            <div className="min-w-0 flex-1 text-left">
              <h4 className="text-xs font-bold text-white truncate">{user.name}</h4>
              <span className="text-[10px] text-slate-500 truncate block">System Admin Node</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            id="btn-admin-logout"
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-slate-800 hover:bg-rose-950/30 hover:text-rose-400 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            <LogOut size={13} />
            <span>Disconnect Server</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* TOP BAR */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center md:hidden space-x-3">
            <span className="text-md font-bold text-slate-900 dark:text-white">CivicAI Admin</span>
          </div>

          <div className="hidden md:flex items-center space-x-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-ping"></span>Database Socket Connected</span>
            <span className="text-slate-300 dark:text-slate-800">|</span>
            <span>MySQL: root@harshitha</span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Quick Mobile Navigation for Admins */}
            <div className="md:hidden flex space-x-1">
              <button onClick={() => {setActiveTab('dashboard'); setSelectedComplaint(null);}} className={`p-1.5 rounded-lg text-xs ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><LayoutDashboard size={16} /></button>
              <button onClick={() => {setActiveTab('complaints'); setSelectedComplaint(null);}} className={`p-1.5 rounded-lg text-xs ${activeTab === 'complaints' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><FileText size={16} /></button>
              <button onClick={() => {setActiveTab('officers'); setSelectedComplaint(null);}} className={`p-1.5 rounded-lg text-xs ${activeTab === 'officers' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><Users size={16} /></button>
              <button onClick={onLogout} className="p-1.5 rounded-lg text-rose-500"><LogOut size={16} /></button>
            </div>

            <button 
              onClick={fetchAllAdminData}
              className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={14} />
            </button>
            
            <div className="w-px h-6 bg-slate-100 dark:bg-slate-800"></div>

            <div className="flex items-center space-x-2 text-xs">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold uppercase shrink-0">
                A
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200 hidden sm:inline">{user.name}</span>
            </div>
          </div>
        </header>

        {/* WORKSPACE AREA */}
        <div className="flex-1 p-6">
          <AnimatePresence mode="wait">
            
            {/* SUB-TAB 1: EXECUTIVE ANALYTICS */}
            {activeTab === 'dashboard' && analytics && (
              <motion.div
                key="tab-admin-dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Total Complaints</span>
                      <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{analytics.summary.total}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Resolved (Closed)</span>
                      <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{analytics.summary.resolved}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Work In Progress</span>
                      <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{analytics.summary.inProgress}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 rounded-xl shadow-sm flex items-center space-x-4 animate-pulse">
                    <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Critical Escalated</span>
                      <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{analytics.summary.escalated}</span>
                    </div>
                  </div>
                </div>

                {/* GRAPH CARDS GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Category Distribution (Pie Chart) */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">Complaint Categories Distribution</h3>
                    <div className="flex-1 h-64 min-h-[250px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {analytics.categoryData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value} complaints`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500 mt-2">
                      {analytics.categoryData.map((entry: any, idx: number) => (
                        <div key={idx} className="flex items-center space-x-1.5 truncate">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                          <span className="truncate">{entry.name} ({entry.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Monthly Submissions vs Resolutions (Area/Line Chart) */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">Submission vs Resolution Trends</h3>
                    <div className="flex-1 h-64 min-h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.monthlyTrends}>
                          <defs>
                            <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip />
                          <Legend style={{ fontSize: 11 }} />
                          <Area type="monotone" name="New Submissions" dataKey="submitted" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSubmitted)" />
                          <Area type="monotone" name="Resolved Fixes" dataKey="resolved" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorResolved)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Department Efficiency index table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4 flex items-center">
                    <Landmark size={15} className="mr-1.5 text-blue-600" />
                    Department Workload & Resolution Efficiency Index
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                          <th className="pb-3">Dept Code</th>
                          <th className="pb-3">Total Routed</th>
                          <th className="pb-3">Total Resolved</th>
                          <th className="pb-3">Efficiency Ratings</th>
                          <th className="pb-3 pr-2 text-right">Workload Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                        {analytics.departmentStats.map((dept: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-3 font-bold text-slate-900 dark:text-white">{dept.department}</td>
                            <td className="py-3 text-slate-500 font-mono">{dept.total}</td>
                            <td className="py-3 text-emerald-600 font-mono">{dept.resolved}</td>
                            <td className="py-3">
                              <div className="flex items-center space-x-2">
                                <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shrink-0">
                                  <div className="bg-blue-500 h-full" style={{ width: `${dept.efficiency}%` }}></div>
                                </div>
                                <span className="font-mono text-[10px]">{dept.efficiency}%</span>
                              </div>
                            </td>
                            <td className="py-3 pr-2 text-right">
                              {dept.total > 2 ? (
                                <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 rounded-full">Heavy</span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-full">Optimal</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SUB-TAB 2: COMPLAINTS ALL LIST & ASSIGNMENT PANEL */}
            {activeTab === 'complaints' && (
              <motion.div
                key="tab-admin-complaints"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Left col: list of complaints */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 dark:border-slate-800/80 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Municipal Complaint Dispatch Console</h3>
                      <p className="text-[11px] text-slate-400">View live incoming community reports, AI predicted priority ratings, and assign workloads.</p>
                    </div>
                  </div>

                  {/* Filter Header controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search logs by keyword/ID..."
                        className="block w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                      />
                    </div>

                    <div>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="block w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="SUBMITTED">SUBMITTED</option>
                        <option value="ASSIGNED">ASSIGNED</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="ESCALATED">ESCALATED</option>
                      </select>
                    </div>

                    <div>
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="block w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                      >
                        <option value="ALL">All Categories</option>
                        <option value="Garbage">Garbage</option>
                        <option value="Road Damage">Road Damage</option>
                        <option value="Water Supply">Water Supply</option>
                        <option value="Street Light">Street Light</option>
                        <option value="Electricity">Electricity</option>
                      </select>
                    </div>
                  </div>

                  {/* List View */}
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/60 overflow-y-auto max-h-[500px]">
                    {filteredComplaints.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-xs text-slate-500">No matching municipal complaints found.</p>
                      </div>
                    ) : (
                      filteredComplaints.map((comp) => (
                        <div
                          key={comp.id}
                          onClick={() => handleSelectComplaint(comp.id)}
                          className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                            selectedComplaint?.id === comp.id
                              ? 'bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30'
                              : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="flex items-center space-x-2.5 mb-1">
                              <span className="text-[10px] text-slate-400 font-bold font-mono uppercase">{comp.id}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(comp.status)} font-semibold`}>
                                {comp.status}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${getPriorityColor(comp.priority)}`}>
                                {comp.priority}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{comp.title}</h4>
                            <span className="text-[10px] text-slate-400 block mt-0.5">By {comp.citizenName} | Area: {comp.area}</span>
                          </div>
                          <ArrowRight size={14} className="text-slate-400 shrink-0" />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right col: detailed Assignment / Routing pane */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                  {selectedComplaint ? (
                    <div className="space-y-5 text-xs">
                      {/* Title & Status */}
                      <div className="border-b border-slate-50 dark:border-slate-800 pb-3">
                        <span className="text-[10px] font-mono text-slate-400 block mb-1">Target Complaint Details</span>
                        <h4 className="font-bold text-slate-900 dark:text-white leading-tight">{selectedComplaint.title}</h4>
                        <span className="text-[10px] text-slate-400 block mt-1">Area: {selectedComplaint.area}, {selectedComplaint.street}</span>
                      </div>

                      {/* Description */}
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Incident description</h5>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl max-h-24 overflow-y-auto">
                          {selectedComplaint.description}
                        </p>
                      </div>

                      {/* AI Sentiment analysis indicator */}
                      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-3.5 rounded-xl space-y-2">
                        <h5 className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center">
                          <Sparkles size={13} className="mr-1.5 animate-pulse" />
                          AI Smart Grounding Assist
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-indigo-100/30 pb-2">
                          <div>
                            <span className="text-slate-400 block text-[9px]">Predicted Category</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedComplaint.category}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px]">Predicted Sentiment</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedComplaint.aiSentiment || 'Neutral'}</span>
                          </div>
                        </div>
                        {selectedComplaint.aiEvidenceAnalysis && (
                          <div className="space-y-1.5 text-[11px]">
                            <div>
                              <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Multimodal Diagnostic</span>
                              <p className="text-slate-700 dark:text-slate-300 italic leading-snug">"{selectedComplaint.aiEvidenceAnalysis}"</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-indigo-100/20">
                              <div>
                                <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Hazard Severity</span>
                                <span className="font-extrabold text-indigo-700 dark:text-indigo-300">{selectedComplaint.hazardSeverity?.toFixed(1) || 'N/A'} / 10.0</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Detected Material Traces</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {selectedComplaint.materialsDetected?.map((mat, idx) => (
                                    <span key={idx} className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] px-1.5 py-0.5 rounded border border-slate-200/40">
                                      {mat}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* AI SMART REPLY GENERATOR */}
                      <div className="space-y-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">AI Smart Reply</h5>
                          <button
                            type="button"
                            onClick={handleGenerateSmartReply}
                            disabled={generatingReply}
                            className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer flex items-center"
                          >
                            {generatingReply ? 'Drafting...' : 'Generate Draft Email'}
                          </button>
                        </div>
                        {smartReplyText && (
                          <div className="space-y-2">
                            <textarea
                              rows={5}
                              value={smartReplyText}
                              onChange={(e) => setSmartReplyText(e.target.value)}
                              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-mono leading-normal"
                            ></textarea>
                            <button
                              type="button"
                              onClick={() => { alert('Simulated Email successfully dispatched to citizen!'); setSmartReplyText(''); }}
                              className="py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors flex items-center"
                            >
                              <Send size={10} className="mr-1.5" /> Dispatch Email
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Manual Assignment dispatch Form */}
                      <form onSubmit={handleAssignSubmit} className="space-y-3.5 border-t border-slate-50 dark:border-slate-800 pt-4">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Manual Router Override</h5>
                        
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Select Department</label>
                          <select
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                            className="block w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                          >
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Assign Active Officer</label>
                          <select
                            value={selectedOfficerId}
                            onChange={(e) => setSelectedOfficerId(e.target.value)}
                            className="block w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                          >
                            {deptOfficers.length === 0 ? (
                              <option value="">No Active Officers in Dept</option>
                            ) : (
                              deptOfficers.map(o => (
                                <option key={o.id} value={o.id}>{o.name} (Rating: {o.rating})</option>
                              ))
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Estimated Days to Fix</label>
                          <input
                            type="number"
                            value={estimatedDays}
                            onChange={(e) => setEstimatedDays(e.target.value)}
                            className="block w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="submit"
                            id="btn-admin-assign"
                            disabled={assigning || !selectedOfficerId}
                            className="flex-1 py-2 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                          >
                            Dispatch Workload
                          </button>
                          
                          {selectedComplaint.status !== ComplaintStatus.ESCALATED && (
                            <button
                              type="button"
                              onClick={handleEscalateManual}
                              className="py-2 px-3 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 text-[11px] font-semibold rounded-lg cursor-pointer"
                            >
                              Escalate
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-400 flex-1 flex flex-col justify-center">
                      <FileText className="mx-auto mb-2 text-slate-300" size={32} />
                      <p className="text-xs">Select a community complaint from the list to review detailed metrics and route dispatches.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SUB-TAB 3: MANAGE OFFICERS LIST */}
            {activeTab === 'officers' && (
              <motion.div
                key="tab-admin-officers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm"
              >
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Municipal Maintenance Officers roster</h3>
                  <p className="text-xs text-slate-400">Review status, assigned departments, workload density, and dynamic ratings compiled from citizen feedback.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                        <th className="pb-3 pl-2">Name</th>
                        <th className="pb-3">Department</th>
                        <th className="pb-3">Phone</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 pr-2 text-right">Citizen Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                      {officers.map((off) => (
                        <tr key={off.id}>
                          <td className="py-3 pl-2 font-bold text-slate-900 dark:text-white">{off.name}</td>
                          <td className="py-3 text-slate-500">{off.departmentName}</td>
                          <td className="py-3 text-slate-500 font-mono">{off.phone}</td>
                          <td className="py-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              off.status === 'ACTIVE' 
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' 
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20'
                            }`}>
                              {off.status}
                            </span>
                          </td>
                          <td className="py-3 pr-2 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <Star size={13} className="fill-amber-400 text-amber-400" />
                              <span className="font-mono">{off.rating} / 5.0</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* SUB-TAB 4: CITIZENS DATABASE LIST */}
            {activeTab === 'citizens' && (
              <motion.div
                key="tab-admin-citizens"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm"
              >
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Registered Citizen Accounts</h3>
                  <p className="text-xs text-slate-400">View community nodes, phone link status, and profile registration times.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                        <th className="pb-3 pl-2">Name</th>
                        <th className="pb-3">Email Address</th>
                        <th className="pb-3">Phone Linked</th>
                        <th className="pb-3 pr-2 text-right">Registration Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                      {citizens.map((cit) => (
                        <tr key={cit.id}>
                          <td className="py-3 pl-2 font-bold text-slate-900 dark:text-white">{cit.name}</td>
                          <td className="py-3 text-slate-500">{cit.email}</td>
                          <td className="py-3 text-slate-500 font-mono">{cit.phone || 'None linked'}</td>
                          <td className="py-3 pr-2 text-right text-slate-400 font-mono text-[11px]">
                            {new Date(cit.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
