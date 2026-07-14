/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { toast } from "sonner";
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, FileText, History, HelpCircle, User as UserIcon, Settings, 
  PlusCircle, AlertTriangle, CheckCircle, Clock, MapPin, Send, MessageCircle, 
  Search, ChevronRight, Bell, Sparkles, Star, ThumbsUp, Trash, LogOut, ArrowRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Complaint, FAQItem, ComplaintStatus, Priority } from '../types';

interface CitizenDashboardProps {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function CitizenDashboard({ user, onLogout, darkMode, toggleDarkMode }: CitizenDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'submit' | 'history' | 'faq' | 'settings'>('dashboard');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('Others');
  const [formPriority, setFormPriority] = useState<Priority>(Priority.MEDIUM);
  const [formArea, setFormArea] = useState('Downtown');
  const [formStreet, setFormStreet] = useState('');
  const [formLandmark, setFormLandmark] = useState('');
  const [formCity, setFormCity] = useState('Metro City');
  const [formPincode, setFormPincode] = useState('');
  const [formContact, setFormContact] = useState<'EMAIL' | 'SMS' | 'PHONE' | 'APP'>('APP');
  const [formImage, setFormImage] = useState('');
  const [formVideo, setFormVideo] = useState('');

  // AI Prompt results (Duplicate panel)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    message: string;
    existingComplaint: Complaint;
  } | null>(null);

  // Feedback State
  const [rating, setRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Load complaints and notifications
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('civic_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Get Complaints
      const compRes = await fetch('/api/complaints', { headers });
      const compData = await compRes.json();
      if (Array.isArray(compData)) setComplaints(compData);

      // Get Notifications
      const notRes = await fetch('/api/notifications', { headers });
      const notData = await notRes.json();
      if (Array.isArray(notData)) setNotifications(notData);

    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectComplaint = async (id: string) => {
    try {
      const token = localStorage.getItem('civic_token');
      const response = await fetch(`/api/complaints/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.complaint) {
        setSelectedComplaint(data.complaint);
        setTimeline(data.timeline || []);
        // Reset feedback state
        setRating(5);
        setFeedbackText('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!formTitle || !formDesc || !formStreet || !formPincode) {
    toast.error('Please fill out all required fields marked with *');
    return;
  }

  setIsLoading(true);
  try {
    const token = localStorage.getItem('civic_token');
    const response = await fetch('/api/complaints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: formTitle,
        description: formDesc,
        category: formCategory,
        priority: formPriority,
        area: formArea,
        street: formStreet,
        landmark: formLandmark,
        city: formCity,
        pincode: formPincode,
        preferredContact: formContact,
        imageUrl: formImage,
        videoUrl: formVideo
      })
    });

    const data = await response.json();

    if (response.status === 200 && data.duplicate) {
      setDuplicateWarning({
        message: data.message,
        existingComplaint: data.existingComplaint
      });
    } else if (response.ok) {
      toast.success("Complaint Registered Successfully!", {
        description:
          "Your complaint has been submitted successfully. The AI has categorized and routed it automatically.",
      });

      setFormTitle('');
      setFormDesc('');
      setFormStreet('');
      setFormLandmark('');
      setFormPincode('');
      setFormImage('');
      setFormVideo('');
      setActiveTab('history');
      fetchData();
    } else {
      toast.error(data.error || "Submission failed");
    }
  } catch (err) {
    console.error(err);
    toast.error("Error connecting to submission API.");
  } finally {
    setIsLoading(false);
  }
};



  // Support Duplicate Complaint
  const handleSupportDuplicate = async (compId: string) => {
    try {
      const token = localStorage.getItem('civic_token');
      const response = await fetch(`/api/complaints/${compId}/upvote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        alert('Successfully added your support! The city maintenance crew has been notified, and the complaint priority will escalate automatically with more citizen backers.');
        setDuplicateWarning(null);
        setActiveTab('history');
        fetchData();
      } else {
        alert(data.error || 'Failed to back duplicate');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    try {
      const token = localStorage.getItem('civic_token');
      const response = await fetch(`/api/complaints/${id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating, feedback: feedbackText })
      });
      if (response.ok) {
        alert('Thank you for rating our resolution service!');
        handleSelectComplaint(id);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      const token = localStorage.getItem('civic_token');
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
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

  // Preload local FAQs search
  const localFAQs: FAQItem[] = [
    { id: 'f-1', category: 'Road Damage', question: 'How long does a pothole repair take?', answer: 'Our standard response for pothole repair on arterial streets is 48 hours. Residential streets might take up to 5 business days.' },
    { id: 'f-2', category: 'Garbage', question: 'My garbage collection was missed. What should I do?', answer: 'Please submit a complaint under the "Garbage" category. Include your street name and block number so the Waste Management crew can double back.' },
    { id: 'f-3', category: 'Electricity', question: 'What do I do if street lights are flickering?', answer: 'Report it! Tickering lights often signify electrical wire damage. We aim to fix lighting grids within 3 days to maintain pedestrian security.' },
    { id: 'f-4', category: 'Water Supply', question: 'What is the process for reporting water main leakage?', answer: 'Water leakage has a HIGH standard routing priority. File a report immediately with street coordinates so our hydraulic team can shut off regional pipelines and patch the main.' }
  ];

  const filteredFAQs = localFAQs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Sparkles size={18} className="fill-white/20 animate-pulse" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Civic<span className="text-blue-600">AI</span>
            </span>
            <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Citizen Terminal</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          <button
            id="tab-btn-dashboard"
            onClick={() => { setActiveTab('dashboard'); setSelectedComplaint(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>

          <button
            id="tab-btn-submit"
            onClick={() => { setActiveTab('submit'); setSelectedComplaint(null); setDuplicateWarning(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'submit'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
            }`}
          >
            <PlusCircle size={16} />
            <span>Submit Complaint</span>
          </button>

          <button
            id="tab-btn-history"
            onClick={() => { setActiveTab('history'); setSelectedComplaint(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
            }`}
          >
            <History size={16} />
            <span>Track & History</span>
          </button>

          <button
            id="tab-btn-faq"
            onClick={() => { setActiveTab('faq'); setSelectedComplaint(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'faq'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
            }`}
          >
            <HelpCircle size={16} />
            <span>FAQ Help Center</span>
          </button>

          <button
            id="tab-btn-settings"
            onClick={() => { setActiveTab('settings'); setSelectedComplaint(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
            }`}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold text-sm shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{user.name}</h4>
              <span className="text-[10px] text-slate-400 truncate block">{user.email}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            id="btn-citizen-logout"
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            <LogOut size={14} />
            <span>Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* TOP BAR */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center md:hidden space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              C
            </div>
            <span className="text-md font-bold text-slate-900 dark:text-white">CivicAI</span>
          </div>
          
          <div className="hidden md:flex items-center text-slate-400 text-xs">
            <Clock size={14} className="mr-1.5" />
            <span className="font-semibold text-slate-500 dark:text-slate-400">Metro City Grid Active</span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Quick Mobile Navigation togglers */}
            <div className="md:hidden flex space-x-1">
              <button onClick={() => {setActiveTab('dashboard'); setSelectedComplaint(null);}} className={`p-1.5 rounded-lg text-xs ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><LayoutDashboard size={16} /></button>
              <button onClick={() => {setActiveTab('submit'); setSelectedComplaint(null);}} className={`p-1.5 rounded-lg text-xs ${activeTab === 'submit' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><PlusCircle size={16} /></button>
              <button onClick={() => {setActiveTab('history'); setSelectedComplaint(null);}} className={`p-1.5 rounded-lg text-xs ${activeTab === 'history' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><History size={16} /></button>
              <button onClick={onLogout} className="p-1.5 rounded-lg text-rose-500"><LogOut size={16} /></button>
            </div>

            {/* Notifications panel toggle */}
            <div className="relative">
              <button 
                onClick={handleMarkNotificationsRead}
                className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-lg text-slate-600 dark:text-slate-300 relative cursor-pointer"
              >
                <Bell size={16} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                )}
              </button>
            </div>

            <div className="w-px h-6 bg-slate-100 dark:bg-slate-800"></div>

            <div className="flex items-center space-x-2 text-xs">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold uppercase shrink-0">
                {user.name.charAt(0)}
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200 hidden sm:inline">{user.name}</span>
            </div>
          </div>
        </header>

        {/* WORKSPACE AREA */}
        <div className="flex-1 p-6">
          <AnimatePresence mode="wait">
            
            {/* SUB-TAB 1: CITIZEN DASHBOARD */}
            {activeTab === 'dashboard' && !selectedComplaint && (
              <motion.div
                key="tab-citizen-dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Hero Greeting Card */}
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                  <div className="relative z-10 space-y-2">
                    <span className="bg-white/25 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full">Intelligent Infrastructure Hub</span>
                    <h2 className="text-xl md:text-2xl font-extrabold tracking-tight font-sans">Hello, Resident {user.name}!</h2>
                    <p className="text-xs text-blue-100 max-w-lg">
                      Submit community concerns. Our AI Agent classifies, predicts priorities, and routes your tickets immediately to dispatch maintenance squads.
                    </p>
                    <div className="pt-2 flex space-x-3">
                      <button
                        onClick={() => setActiveTab('submit')}
                        className="py-2 px-4 bg-white hover:bg-slate-50 text-blue-700 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm flex items-center"
                      >
                        Submit New Concern
                        <ArrowRight size={13} className="ml-1.5 text-blue-700" />
                      </button>
                      <button
                        onClick={() => setActiveTab('history')}
                        className="py-2 px-4 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg cursor-pointer transition-all flex items-center border border-white/20"
                      >
                        Track Status
                      </button>
                    </div>
                  </div>
                  {/* Decorative Sparkles background */}
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-white/10 hidden md:block select-none pointer-events-none">
                    <Sparkles size={180} />
                  </div>
                </div>

                {/* Performance Summary Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">My Submissions</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white leading-none">{complaints.length}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Resolved Issues</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white leading-none">
                        {complaints.filter(c => c.status === ComplaintStatus.RESOLVED).length}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Pending Action</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white leading-none">
                        {complaints.filter(c => [ComplaintStatus.SUBMITTED, ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS].includes(c.status)).length}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 rounded-xl shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Star size={20} className="fill-indigo-100 dark:fill-transparent" />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">Citizen Rating</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white leading-none">4.8 / 5</span>
                    </div>
                  </div>
                </div>

                {/* Recent Complaints Track list */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center">
                      <History size={15} className="mr-1.5 text-blue-600" />
                      Active Complaints Tracking
                    </h3>
                    <button
                      onClick={() => setActiveTab('history')}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-semibold flex items-center"
                    >
                      View All Logs
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {complaints.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-100 dark:border-slate-800">
                      <AlertTriangle className="mx-auto text-slate-400 mb-2" size={28} />
                      <p className="text-xs text-slate-500">You haven't filed any municipal complaints yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {complaints.slice(0, 3).map((comp) => (
                        <div
                          key={comp.id}
                          onClick={() => handleSelectComplaint(comp.id)}
                          className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-all cursor-pointer"
                        >
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="flex items-center space-x-2.5 mb-1">
                              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{comp.id}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(comp.status)} font-semibold`}>
                                {comp.status}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${getPriorityColor(comp.priority)}`}>
                                {comp.priority}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{comp.title}</h4>
                            <span className="text-[10px] text-slate-400 flex items-center mt-1">
                              <MapPin size={10} className="mr-1 text-slate-400" />
                              {comp.street}, {comp.area}
                            </span>
                          </div>
                          <ChevronRight size={14} className="text-slate-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SUB-TAB 2: SUBMIT COMPLAINT FORM */}
            {activeTab === 'submit' && (
              <motion.div
                key="tab-citizen-submit"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-3xl mx-auto"
              >
                {/* Duplicate alert warning panel */}
                {duplicateWarning && (
                  <div className="mb-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" size={22} />
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {duplicateWarning.message}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Our AI duplicate detector matched your description and coordinates at <strong>85% similarity</strong> with an active city complaint filed by another citizen.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl">
                      <div className="flex items-center space-x-2.5 mb-1.5">
                        <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{duplicateWarning.existingComplaint.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(duplicateWarning.existingComplaint.status)} font-semibold`}>
                          {duplicateWarning.existingComplaint.status}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">{duplicateWarning.existingComplaint.title}</h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{duplicateWarning.existingComplaint.description}</p>
                      <div className="text-[10px] text-slate-400 mt-2 flex items-center space-x-4">
                        <span className="flex items-center"><MapPin size={10} className="mr-1" /> {duplicateWarning.existingComplaint.street}</span>
                        <span className="flex items-center"><ThumbsUp size={10} className="mr-1" /> {duplicateWarning.existingComplaint.upvotesCount} backers</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => handleSupportDuplicate(duplicateWarning.existingComplaint.id)}
                        className="py-2.5 px-4 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors flex items-center"
                      >
                        <ThumbsUp size={14} className="mr-2" />
                        Support/Upvote This Existing Complaint
                      </button>
                      <button
                        type="button"
                        onClick={() => setDuplicateWarning(null)}
                        className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                      >
                        Ignore warning & submit anyway
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Submit New Community Complaint</h3>
                      <p className="text-[11px] text-slate-400">AI automatically processes category routing, predictions, and duplicates on upload.</p>
                    </div>
                    <Sparkles className="text-blue-500 animate-pulse shrink-0" size={18} />
                  </div>

                  <form onSubmit={handleSubmitComplaint} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Complaint Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="e.g. Mass water leaks opposite library"
                          className="mt-1 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Detailed Description <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={4}
                          required
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                          placeholder="Please describe the issue in detail. If this is an electricity risk or garbage overflow, indicate timeline. AI uses this to calculate duplicate similarity indexes."
                          className="mt-1 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        ></textarea>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Assumed Category
                        </label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option>Others</option>
                          <option>Garbage</option>
                          <option>Road Damage</option>
                          <option>Drainage</option>
                          <option>Street Light</option>
                          <option>Water Supply</option>
                          <option>Electricity</option>
                          <option>Noise Pollution</option>
                          <option>Illegal Dumping</option>
                          <option>Public Transport</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Preferred Contact Method
                        </label>
                        <select
                          value={formContact}
                          onChange={(e) => setFormContact(e.target.value as any)}
                          className="mt-1 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="APP">App Notifications Only</option>
                          <option value="EMAIL">Email Dispatch</option>
                          <option value="SMS">SMS Alerts</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          City Sub-Area <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formArea}
                          onChange={(e) => setFormArea(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option>Downtown</option>
                          <option>Greenwood</option>
                          <option>Riverside</option>
                          <option>West End</option>
                          <option>Oakridge</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Street Name & Block <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formStreet}
                          onChange={(e) => setFormStreet(e.target.value)}
                          placeholder="e.g. 120 Broadway Street"
                          className="mt-1 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Landmark (Optional)
                        </label>
                        <input
                          type="text"
                          value={formLandmark}
                          onChange={(e) => setFormLandmark(e.target.value)}
                          placeholder="e.g. Near kids play park entry"
                          className="mt-1 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Pincode <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formPincode}
                          onChange={(e) => setFormPincode(e.target.value)}
                          placeholder="e.g. 10001"
                          className="mt-1 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="md:col-span-2 text-left">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                          Evidence Attachment (Drag & Drop or Browse)
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <div
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files?.[0];
                                if (file && file.type.startsWith('image/')) {
                                  const reader = new FileReader();
                                  reader.onload = () => setFormImage(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/10 dark:hover:bg-blue-950/10 transition-colors rounded-xl p-5 text-center flex flex-col items-center justify-center cursor-pointer relative min-h-[110px]"
                            >
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = () => setFormImage(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                              <PlusCircle className="text-slate-400 mb-2" size={24} />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Click to upload or drag image here</span>
                              <span className="text-[10px] text-slate-400 mt-1">Supports PNG, JPG, WEBP up to 5MB</span>
                            </div>
                          </div>
                          <div className="flex flex-col justify-center items-center p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl relative overflow-hidden min-h-[110px]">
                            {formImage ? (
                              <>
                                <img src={formImage} referrerPolicy="no-referrer" alt="Evidence Preview" className="w-full h-24 object-cover rounded-lg shadow-sm" />
                                <button
                                  type="button"
                                  onClick={() => setFormImage('')}
                                  className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full shadow-md cursor-pointer transition-colors"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <div className="text-center">
                                <span className="text-[10px] text-slate-400 block font-mono font-bold uppercase">No Evidence Loaded</span>
                                <span className="text-[9px] text-slate-400 block mt-1">Image data will feed Gemini analyzer</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Evidence Video URL (Optional)
                        </label>
                        <input
                          type="text"
                          value={formVideo}
                          onChange={(e) => setFormVideo(e.target.value)}
                          placeholder="https://example.com/flowing_leak.mp4"
                          className="mt-1 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        type="submit"
                        id="btn-complaint-submit"
                        disabled={isLoading}
                        className="py-3 px-6 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center disabled:opacity-50"
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        ) : (
                          <Send size={14} className="mr-2" />
                        )}
                        File Complaint via AI Router
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {/* SUB-TAB 3: TRACKING & HISTORIC LOGS */}
            {activeTab === 'history' && !selectedComplaint && (
              <motion.div
                key="tab-citizen-history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Municipal Complaint History Logs</h3>
                      <p className="text-xs text-slate-400">View timeline status, backing metrics, and leave review feedback on active resolutions.</p>
                    </div>
                  </div>

                  {complaints.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertTriangle className="mx-auto text-slate-400 mb-3" size={32} />
                      <p className="text-xs text-slate-500">You haven't submitted any complaints under this account.</p>
                    </div>
                  ) : (
                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            <th className="pb-3 pl-2">ID</th>
                            <th className="pb-3">Title</th>
                            <th className="pb-3">Category</th>
                            <th className="pb-3">Priority</th>
                            <th className="pb-3">Status</th>
                            <th className="pb-3">Backers</th>
                            <th className="pb-3 pr-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                          {complaints.map((comp) => (
                            <tr key={comp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                              <td className="py-3.5 pl-2 font-mono text-[10px] font-bold text-slate-400">{comp.id}</td>
                              <td className="py-3.5 font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{comp.title}</td>
                              <td className="py-3.5 text-slate-500 dark:text-slate-400">{comp.category}</td>
                              <td className="py-3.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${getPriorityColor(comp.priority)}`}>
                                  {comp.priority}
                                </span>
                              </td>
                              <td className="py-3.5">
                                <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${getStatusColor(comp.status)} font-semibold`}>
                                  {comp.status}
                                </span>
                              </td>
                              <td className="py-3.5 text-slate-500 font-mono pl-3">{comp.upvotesCount}</td>
                              <td className="py-3.5 pr-2 text-right">
                                <button
                                  onClick={() => handleSelectComplaint(comp.id)}
                                  className="py-1.5 px-3 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                                >
                                  Open Timeline
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* DETAIL SCREEN WITH INTEGRATED COMPLAINT TIMELINE & RATING FORM */}
            {selectedComplaint && (
              <motion.div
                key="tab-citizen-detail"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                {/* Back Link */}
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="flex items-center text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ArrowRight size={14} className="mr-1 rotate-180" />
                  Back to Logs list
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left block: Detail attributes */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 dark:border-slate-800/80 pb-4">
                        <div>
                          <div className="flex items-center space-x-2.5 mb-1.5">
                            <span className="text-[10px] font-mono text-slate-400 font-bold">{selectedComplaint.id}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(selectedComplaint.status)} font-bold`}>
                              {selectedComplaint.status}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${getPriorityColor(selectedComplaint.priority)}`}>
                              {selectedComplaint.priority}
                            </span>
                          </div>
                          <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">{selectedComplaint.title}</h2>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400 block font-semibold">Registered Date</span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{new Date(selectedComplaint.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="space-y-3 text-xs leading-relaxed">
                        <div>
                          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Incident Description</h4>
                          <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                            {selectedComplaint.description}
                          </p>
                        </div>

                        {selectedComplaint.aiSummary && (
                          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-4 rounded-xl">
                            <h4 className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1.5 flex items-center">
                              <Sparkles size={13} className="mr-1.5" />
                              AI Complaint Shorthand Summary
                            </h4>
                            <p className="text-blue-800 dark:text-blue-300 italic">{selectedComplaint.aiSummary}</p>
                          </div>
                        )}

                        {selectedComplaint.aiEvidenceAnalysis && (
                          <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/40 p-4 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center">
                                <Sparkles size={13} className="mr-1.5 animate-pulse text-indigo-500" />
                                AI Multimodal Evidence Diagnostic
                              </h4>
                              {selectedComplaint.hazardSeverity !== undefined && (
                                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-extrabold font-mono border border-indigo-200/40">
                                  Severity: {selectedComplaint.hazardSeverity.toFixed(1)} / 10
                                </span>
                              )}
                            </div>
                            
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                              "{selectedComplaint.aiEvidenceAnalysis}"
                            </p>

                            {selectedComplaint.materialsDetected && selectedComplaint.materialsDetected.length > 0 && (
                              <div className="pt-2 border-t border-indigo-100/40 dark:border-indigo-900/30">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">Detected Material Traces</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedComplaint.materialsDetected.map((mat, idx) => (
                                    <span key={idx} className="text-[10px] bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium border border-slate-200/40 dark:border-slate-700/40">
                                      {mat}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Location</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center mt-1">
                              <MapPin size={12} className="mr-1 text-slate-400" />
                              {selectedComplaint.street}, {selectedComplaint.landmark ? `near ${selectedComplaint.landmark}, ` : ''}{selectedComplaint.area}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Officer</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 block mt-1">
                              {selectedComplaint.assignedOfficerName || 'Awaiting Routing Dispatch'}
                            </span>
                          </div>
                        </div>

                        {(selectedComplaint.imageUrl || selectedComplaint.videoUrl) && (
                          <div className="pt-2">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Evidence & Attachments</h4>
                            <div className="flex space-x-3">
                              {selectedComplaint.imageUrl && (
                                <a href={selectedComplaint.imageUrl} target="_blank" rel="noreferrer" className="block relative w-24 h-24 rounded-lg overflow-hidden border border-slate-100 hover:opacity-80 transition-opacity">
                                  <img referrerPolicy="no-referrer" src={selectedComplaint.imageUrl} alt="evidence" className="w-full h-full object-cover" />
                                </a>
                              )}
                              {selectedComplaint.videoUrl && (
                                <div className="w-24 h-24 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-semibold text-slate-400 border border-slate-200">
                                  Video Clip attached
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CITIZEN RESOLUTION REVIEW FEEDBACK FORM */}
                    {selectedComplaint.status === ComplaintStatus.RESOLVED && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="text-emerald-500" size={18} />
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Rate our resolution service</h3>
                        </div>

                        {selectedComplaint.citizenRating ? (
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-xl space-y-1">
                            <div className="flex items-center space-x-1">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} size={15} className={`fill-current ${s <= (selectedComplaint.citizenRating || 0) ? 'text-amber-400' : 'text-slate-300'}`} />
                              ))}
                            </div>
                            <span className="text-[11px] text-slate-400 block font-semibold">Your Review:</span>
                            <p className="text-xs text-slate-700 dark:text-slate-300 italic">{selectedComplaint.citizenFeedback || 'No feedback left.'}</p>
                          </div>
                        ) : (
                          <form onSubmit={(e) => handleFeedbackSubmit(e, selectedComplaint.id)} className="space-y-4">
                            <div>
                              <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Satisfied with the fix?</span>
                              <div className="flex items-center space-x-2">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setRating(s)}
                                    className="p-1 cursor-pointer hover:scale-110 transition-transform"
                                  >
                                    <Star size={24} className={`fill-current ${s <= rating ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Comments & Notes</label>
                              <textarea
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                rows={3}
                                placeholder="Write any remarks about cleanup or responsiveness..."
                                className="block w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                              ></textarea>
                            </div>

                            <button
                              type="submit"
                              id="btn-feedback-submit"
                              disabled={submittingFeedback}
                              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                            >
                              Send Review Ratings
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right block: Real Timeline list */}
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-5 flex items-center">
                        <Clock size={14} className="mr-2 text-blue-600" />
                        Complaint Resolution Timeline
                      </h3>

                      <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                        {timeline.map((sh, idx) => (
                          <div key={sh.id} className="relative pl-7 flex items-start space-x-3 text-xs">
                            <div className={`absolute left-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center -translate-x-1/2 ${
                              sh.status === ComplaintStatus.RESOLVED ? 'bg-emerald-500' : 'bg-blue-500'
                            }`}></div>
                            
                            <div className="space-y-1">
                              <span className="block text-[10px] text-slate-400 font-bold">{new Date(sh.timestamp).toLocaleString()}</span>
                              <span className="block font-bold text-slate-800 dark:text-slate-200 leading-tight">
                                {sh.status}
                              </span>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                {sh.remarks}
                              </p>
                              <span className="block text-[9px] text-slate-400">By {sh.updatedByName}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SUB-TAB 4: FAQ SEARCH ENGINE */}
            {activeTab === 'faq' && (
              <motion.div
                key="tab-citizen-faq"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-3xl mx-auto space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white font-sans">Municipal Grounded Help Center</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Search city response times, garbage routes, water leakage standards, and general community code limits.
                  </p>
                  <div className="relative max-w-md mx-auto rounded-xl shadow-sm mt-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Search size={15} />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search FAQ keywords (pothole, collection, leaks)..."
                      className="block w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
                  {filteredFAQs.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-500">No matching help topics. Try asking our floating AI Assistant in the bottom right corner instead!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {filteredFAQs.map((faq) => (
                        <div key={faq.id} className="py-4 space-y-1.5 first:pt-0 last:pb-0">
                          <span className="text-[9px] bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold px-2 py-0.5 rounded uppercase tracking-wider">{faq.category}</span>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{faq.question}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SUB-TAB 5: SETTINGS & PREFERENCES */}
            {activeTab === 'settings' && (
              <motion.div
                key="tab-citizen-settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto"
              >
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">User Settings & Civic Preferences</h3>
                    <p className="text-xs text-slate-400">Configure alerts, phone linkages, and browser theme preferences.</p>
                  </div>

                  <div className="p-6 space-y-6 text-xs text-slate-700 dark:text-slate-300">
                    <div className="space-y-4">
                      <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Interface Display</h4>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block font-bold">Contrast Theme Mode</span>
                          <span className="text-[11px] text-slate-400">Toggles clean light canvas or high-contrast slate dark mode.</span>
                        </div>
                        <button
                          type="button"
                          onClick={toggleDarkMode}
                          className="py-1.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          {darkMode ? 'Light Theme' : 'Dark Slate'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-slate-50 dark:border-slate-800/80 pt-6">
                      <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SMS & Email Dispatch Linkage</h4>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block font-bold">Dynamic SMS Alerts</span>
                          <span className="text-[11px] text-slate-400">Send critical priority changes automatically to {user.phone || 'unlinked phone'}.</span>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded">Enabled</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
