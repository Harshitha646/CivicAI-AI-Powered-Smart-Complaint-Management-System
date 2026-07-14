/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Login from './components/Login';
import Signup from './components/Signup';
import CitizenDashboard from './components/CitizenDashboard';
import AdminDashboard from './components/AdminDashboard';
import OfficerDashboard from './components/OfficerDashboard';
import Chatbot from './components/Chatbot';
import { User, Role } from './types';
import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'login' | 'signup' | 'dashboard'>('login');
  const [darkMode, setDarkMode] = useState(false);

  // Theme control
  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLoginSuccess = (loggedInUser: User, token: string) => {
    localStorage.setItem('civic_token', token);
    setUser(loggedInUser);
    setView('dashboard');
  };

  const handleSignupSuccess = () => {
    setView('login');
  };

  const handleLogout = () => {
    localStorage.removeItem('civic_token');
    setUser(null);
    setView('login');
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'} transition-colors duration-200 relative`}>
      
      {/* ROUTE RESOLVER */}
      {view === 'login' && (
        <Login 
          onLoginSuccess={handleLoginSuccess} 
          onNavigateToSignup={() => setView('signup')} 
        />
      )}

      {view === 'signup' && (
        <Signup 
          onSignupSuccess={handleSignupSuccess} 
          onNavigateToLogin={() => setView('login')} 
        />
      )}

      {view === 'dashboard' && user && (
        <>
          {user.role === Role.CITIZEN && (
            <CitizenDashboard 
              user={user} 
              onLogout={handleLogout} 
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            />
          )}

          {user.role === Role.ADMIN && (
            <AdminDashboard 
              user={user} 
              onLogout={handleLogout} 
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            />
          )}

          {user.role === Role.OFFICER && (
            <OfficerDashboard 
              user={user} 
              onLogout={handleLogout} 
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            />
          )}

          {/* GLOBAL INTEGRATED FLOATING CHATBOT */}
          <Chatbot user={user} />
        </>
      )}

      {/* FOOTER / TOAST CREDITS AT PAGE BOUNDARIES */}
      {view !== 'dashboard' && (
        <footer className="absolute bottom-4 left-4 right-4 text-center text-[10px] text-slate-400 font-mono select-none pointer-events-none">
          CivicAI Terminal Node | Harshitha Database Core | Secure SSL Session
        </footer>
      )}

    </div>
  );
}
