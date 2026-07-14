/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ClipboardList, CheckCircle, Clock, AlertCircle, Send, LogOut, 
  RefreshCw, MapPin, Sparkles, Star, User, Camera, ShieldCheck, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserType, Complaint, ComplaintStatus, Priority } from '../types';

interface OfficerDashboardProps {
  user: UserType;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function OfficerDashboard({ user, onLogout, darkMode, toggleDarkMode }: OfficerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workload'>('dashboard');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  
  // Update status Form state
  const [status, setStatus] = useState<string>('IN_PROGRESS');
  const [remarks, setRemarks] = useState('');
  const [resImage, setResImage] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchOfficerWork = async () => {
    try {
      const token = localStorage.getItem('civic_token');
      const response = await fetch('/api/complaints', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setComplaints(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOfficerWork();
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
        setStatus(data.complaint.status);
        setRemarks('');
        setResImage('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!remarks) {
      alert('Please enter progress or resolution details in comments.');
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem('civic_token');
      const response = await fetch(`/api/complaints/${selectedComplaint.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          remarks,
          imageUrl: resImage
        })
      });

      if (response.ok) {
        alert('Complaint status updated and logged to history stream.');
        handleSelectComplaint(selectedComplaint.id);
        fetchOfficerWork();
      } else {
        alert('Failed to update status.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: ComplaintStatus) => {
    switch (status) {
      case ComplaintStatus.SUBMITTED: return 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200';
      case ComplaintStatus.ASSIGNED: return 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200';
      case ComplaintStatus.IN_PROGRESS: return 'bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200';
      case ComplaintStatus.RESOLVED: return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200';
      case ComplaintStatus.ESCALATED: return 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 animate-pulse';
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

  const totalAssigned = complaints.length;
  const resolvedCount = complaints.filter(c => c.status === ComplaintStatus.RESOLVED).length;
  const inProgressCount = complaints.filter(c => [ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS].includes(c.status)).length;
  const escalatedCount = complaints.filter(c => c.status === ComplaintStatus.ESCALATED).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 shrink-0 hidden md:flex flex-col text-slate-300">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
            <ClipboardList size={18} />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              Civic<span className="text-emerald-500">AI</span>
            </span>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Field Operative Portal</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          <button
            id="officer-tab-btn-dashboard"
            onClick={() => { setActiveTab('dashboard'); setSelectedComplaint(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <LayoutDashboard size={16} />
            <span>Operative Dashboard</span>
          </button>

          <button
            id="officer-tab-btn-workload"
            onClick={() => { setActiveTab('workload'); setSelectedComplaint(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'workload'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <ClipboardList size={16} />
            <span>My Active Workload</span>
          </button>
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/30">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {user.name.charAt(8)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <h4 className="text-xs font-bold text-white truncate">{user.name}</h4>
              <span className="text-[10px] text-slate-500 truncate block">{user.email}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            id="btn-officer-logout"
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-slate-800 hover:bg-rose-950/30 hover:text-rose-400 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            <LogOut size={13} />
            <span>Close Session</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* TOP BAR */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center md:hidden space-x-3">
            <span className="text-md font-bold text-slate-900 dark:text-white">CivicAI Operative</span>
          </div>

          <div className="hidden md:flex items-center space-x-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center text-emerald-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Operative Node Active
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Quick Mobile Navigation for Officers */}
            <div className="md:hidden flex space-x-1">
              <button onClick={() => {setActiveTab('dashboard'); setSelectedComplaint(null);}} className={`p-1.5 rounded-lg text-xs ${activeTab === 'dashboard' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}><LayoutDashboard size={16} /></button>
              <button onClick={() => {setActiveTab('workload'); setSelectedComplaint(null);}} className={`p-1.5 rounded-lg text-xs ${activeTab === 'workload' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}><ClipboardList size={16} /></button>
              <button onClick={onLogout} className="p-1.5 rounded-lg text-rose-500"><LogOut size={16} /></button>
            </div>

            <button 
              onClick={fetchOfficerWork}
              className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Refresh Queue"
            >
              <RefreshCw size={14} />
            </button>
            
            <div className="w-px h-6 bg-slate-100 dark:bg-slate-800"></div>

            <div className="flex items-center space-x-2 text-xs">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold uppercase shrink-0">
                {user.name.charAt(8)}
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200 hidden sm:inline">{user.name}</span>
            </div>
          </div>
        </header>

        {/* WORKSPACE AREA */}
        <div className="flex-1 p-6">
          <AnimatePresence mode="wait">
            
            {/* SUB-TAB 1: OPERATIVE SUMMARY DASHBOARD */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="tab-officer-dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Greeting Jumbotron */}
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                  <div className="relative z-10 space-y-2">
                    <span className="bg-white/20 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full">Secure Operative Link</span>
                    <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">Active Duty: {user.name}</h2>
                    <p className="text-xs text-teal-100 max-w-md">
                      Review dispatch logs, update repair coordinates, and capture completed resolution photos for public transparency.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => setActiveTab('workload')}
                        className="py-2 px-4 bg-white hover:bg-slate-50 text-emerald-700 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                      >
                        Review My Active Queue
                      </button>
                    </div>
                  </div>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-white/10 hidden md:block select-none pointer-events-none">
                    <ShieldCheck size={180} />
                  </div>
                </div>

                {/* Performance stats grids */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <ClipboardList size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Workload Assigned</span>
                      <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{totalAssigned}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">My Resolutions</span>
                      <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{resolvedCount}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Jobs In Progress</span>
                      <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{inProgressCount}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Jobs Escalated</span>
                      <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{escalatedCount}</span>
                    </div>
                  </div>
                </div>

                {/* Dynamic review scorecard */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">Operative Performance Metrics</h3>
                  <div className="flex items-center space-x-4 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl max-w-sm">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-700 font-bold text-lg">
                      {resolvedCount > 0 ? 'A' : 'B'}
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Current Rank Grade</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-white">Active Dispatch Priority Operative</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SUB-TAB 2: WORKLOAD INTERACTIVE QUEUE & STATUS UPDATER */}
            {activeTab === 'workload' && (
              <motion.div
                key="tab-officer-workload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Left col: list of workloads */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="border-b border-slate-50 dark:border-slate-800/80 pb-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Dispatched Duty Workload</h3>
                    <p className="text-[11px] text-slate-400">Complete repairs on assigned tickets and file status logs directly.</p>
                  </div>

                  <div className="divide-y divide-slate-50 dark:divide-slate-800/60 overflow-y-auto max-h-[500px]">
                    {complaints.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-xs text-slate-500">Your queue is currently clear! Excellent job.</p>
                      </div>
                    ) : (
                      complaints.map((comp) => (
                        <div
                          key={comp.id}
                          onClick={() => handleSelectComplaint(comp.id)}
                          className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                            selectedComplaint?.id === comp.id
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30'
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
                            <span className="text-[10px] text-slate-400 flex items-center mt-0.5">
                              <MapPin size={10} className="mr-1" />
                              {comp.street}, {comp.area}
                            </span>
                          </div>
                          <ChevronRight className="text-slate-400 shrink-0" size={14} />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right col: detail update form */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                  {selectedComplaint ? (
                    <div className="space-y-4 text-xs">
                      <div className="border-b border-slate-50 dark:border-slate-800 pb-3">
                        <span className="text-[10px] font-mono text-slate-400 block mb-1">Work Ticket Info</span>
                        <h4 className="font-bold text-slate-900 dark:text-white leading-tight">{selectedComplaint.title}</h4>
                        <span className="text-[10px] text-slate-400 block mt-1">Area: {selectedComplaint.area}, {selectedComplaint.street}</span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50 space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Citizen Description:</span>
                          <p className="text-slate-700 dark:text-slate-300 leading-normal max-h-24 overflow-y-auto mt-0.5">
                            {selectedComplaint.description}
                          </p>
                        </div>
                        {selectedComplaint.imageUrl && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Citizen Evidence photo:</span>
                            <a href={selectedComplaint.imageUrl} target="_blank" rel="noreferrer" className="block relative w-16 h-16 rounded overflow-hidden">
                              <img referrerPolicy="no-referrer" src={selectedComplaint.imageUrl} alt="evidence" className="w-full h-full object-cover" />
                            </a>
                          </div>
                        )}
                      </div>

                      {selectedComplaint.aiEvidenceAnalysis && (
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-3 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center">
                              <Sparkles size={11} className="mr-1 text-indigo-500 animate-pulse" />
                              AI Evidence analysis
                            </span>
                            {selectedComplaint.hazardSeverity !== undefined && (
                              <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-extrabold">
                                Severity: {selectedComplaint.hazardSeverity.toFixed(1)} / 10
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 italic leading-snug">
                            "{selectedComplaint.aiEvidenceAnalysis}"
                          </p>
                          {selectedComplaint.materialsDetected && selectedComplaint.materialsDetected.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1.5 border-t border-indigo-100/40 dark:border-indigo-900/30">
                              {selectedComplaint.materialsDetected.map((mat, idx) => (
                                <span key={idx} className="text-[9px] bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200/40 dark:border-slate-700/40">
                                  {mat}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rating details if resolved */}
                      {selectedComplaint.status === ComplaintStatus.RESOLVED && selectedComplaint.citizenRating && (
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-xl">
                          <div className="flex items-center space-x-1 mb-1">
                            <Star size={13} className="fill-amber-400 text-amber-400" />
                            <span className="font-bold">Citizen Rated: {selectedComplaint.citizenRating}/5</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">"{selectedComplaint.citizenFeedback || 'No comment left.'}"</p>
                        </div>
                      )}

                      {/* Status update interactive Form */}
                      {selectedComplaint.status !== ComplaintStatus.RESOLVED && (
                        <form onSubmit={handleStatusUpdateSubmit} className="space-y-4 pt-3 border-t border-slate-50 dark:border-slate-800">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">File Resolution Report</h5>
                          
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Job Progress Status</label>
                            <select
                              value={status}
                              onChange={(e) => setStatus(e.target.value)}
                              className="block w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                            >
                              <option value="IN_PROGRESS">IN_PROGRESS (En route / parts ordered)</option>
                              <option value="RESOLVED">RESOLVED (Fix completed)</option>
                              <option value="REJECTED">REJECTED (Invalid location or duplicate)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Progress Remarks & Comments *</label>
                            <textarea
                              rows={3}
                              required
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                              placeholder="Describe cleanup details, components replaced, or reasons for rejection..."
                              className="block w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                            ></textarea>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Resolution Attachment Image URL (Optional)</label>
                            <div className="relative rounded-md shadow-sm">
                              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                                <Camera size={13} />
                              </div>
                              <input
                                type="text"
                                value={resImage}
                                onChange={(e) => setResImage(e.target.value)}
                                placeholder="https://example.com/resolved_fix.jpg"
                                className="block w-full pl-8 pr-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            id="btn-officer-update"
                            disabled={updating}
                            className="w-full py-2 bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                          >
                            {updating ? 'Updating...' : 'Log Operative Report'}
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-400 flex-1 flex flex-col justify-center">
                      <ClipboardList className="mx-auto mb-2 text-slate-300" size={32} />
                      <p className="text-xs">Select a dispatched ticket from your active duty workload list to review coordinates and log progress reports.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
