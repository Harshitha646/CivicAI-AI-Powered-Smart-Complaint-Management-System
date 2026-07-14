/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User as UserIcon, CornerDownLeft, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

interface ChatbotProps {
  user: User;
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  let inList = false;
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    // Check for bullet list
    if (line.trim().startsWith('•') || line.trim().startsWith('*') || line.trim().startsWith('-')) {
      const content = line.replace(/^[•*\-]\s*/, '');
      elements.push(
        <li key={`li-${idx}`} className="ml-4 list-disc pl-1 my-0.5">
          {formatInline(content)}
        </li>
      );
      return;
    }

    // Check for headings
    if (line.startsWith('###')) {
      elements.push(
        <h4 key={`h4-${idx}`} className="text-xs font-bold mt-2 mb-1 text-slate-900 dark:text-white uppercase tracking-wider">
          {formatInline(line.replace(/^###\s*/, ''))}
        </h4>
      );
      return;
    }
    if (line.startsWith('##')) {
      elements.push(
        <h3 key={`h3-${idx}`} className="text-xs font-bold mt-2.5 mb-1 text-slate-900 dark:text-white">
          {formatInline(line.replace(/^##\s*/, ''))}
        </h3>
      );
      return;
    }
    if (line.startsWith('#')) {
      elements.push(
        <h2 key={`h2-${idx}`} className="text-sm font-extrabold mt-3 mb-1.5 text-slate-900 dark:text-white">
          {formatInline(line.replace(/^#\s*/, ''))}
        </h2>
      );
      return;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={`br-${idx}`} className="h-1.5" />);
      return;
    }

    // Default paragraph
    elements.push(
      <p key={`p-${idx}`} className="my-0.5">
        {formatInline(line)}
      </p>
    );
  });

  return elements;
}

function formatInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let currentIndex = 0;

  const regex = /(\*\*|__)(.*?)\1|\[(.*?)\]\((.*?)\)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    
    if (matchIndex > currentIndex) {
      tokens.push(text.slice(currentIndex, matchIndex));
    }

    if (match[1]) {
      tokens.push(<strong key={`b-${matchIndex}`} className="font-bold text-slate-950 dark:text-white">{match[2]}</strong>);
    } else if (match[3]) {
      tokens.push(
        <a 
          key={`a-${matchIndex}`} 
          href={match[4]} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
        >
          {match[3]}
        </a>
      );
    }

    currentIndex = regex.lastIndex;
  }

  if (currentIndex < text.length) {
    tokens.push(text.slice(currentIndex));
  }

  return tokens.length > 0 ? tokens : [text];
}

export default function Chatbot({ user }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'ai',
      text: "Hello! I am CivicAI, your digital community concierge. I can check the status of your complaints, explain garbage collection routines, suggest departments, or answer general civic questions about Metro City. How can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    const userMsg: ChatMessage = {
      id: 'msg-' + Math.random().toString(36).substr(2, 9),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Keep latest 20 messages
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      const historyLimit = 20;
      // Get the last N messages prior to this user message
      const history = messages.slice(-historyLimit).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        text: msg.text
      }));

      const token = localStorage.getItem('civic_token');
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userText, history })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Sorry, the AI service is temporarily unavailable.");
      }

      const aiMsg: ChatMessage = {
        id: 'msg-' + Math.random().toString(36).substr(2, 9),
        sender: 'ai',
        text: data.reply || data.text || "Sorry, the AI service is temporarily unavailable.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'msg-err',
        sender: 'ai',
        text: err.message || "Sorry, the AI service is temporarily unavailable.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Button */}
      <motion.button
        id="btn-chatbot-trigger"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-lg cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <X key="close" size={24} className="text-white animate-fade-in" />
          ) : (
            <div key="chat" className="relative">
              <Bot size={26} />
              <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="panel-chatbot"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-20 right-0 w-96 max-w-[calc(100vw-2rem)] h-[500px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-between justify-center border border-white/20">
                  <Bot size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-tight flex items-center">
                    CivicAI Virtual Agent
                    <Sparkles size={14} className="ml-1.5 text-yellow-300 fill-yellow-300" />
                  </h3>
                  <span className="text-[11px] text-blue-100 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5"></span>
                    Grounded with City Database
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/40">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start max-w-[85%] space-x-2 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      msg.sender === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/20'
                    }`}>
                      {msg.sender === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs shadow-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700/50'
                    }`}>
                      {msg.sender === 'ai' ? (
                        <div className="space-y-0.5">{renderMarkdown(msg.text)}</div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      )}
                      <span className={`block text-[9px] mt-1.5 text-right ${
                        msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-start max-w-[80%] space-x-2">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 shrink-0 border border-slate-300/20">
                      <Bot size={14} />
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700/50 shadow-sm">
                      <div className="flex items-center space-x-2 py-0.5 px-1">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium animate-pulse">Thinking...</span>
                        <div className="flex space-x-1 py-1">
                          <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-75"></div>
                          <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-150"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about your complaint, garbage, lighting..."
                className="flex-1 py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
              <button
                type="submit"
                id="btn-chatbot-send"
                disabled={!inputValue.trim() || isTyping}
                className={`p-2 rounded-xl text-white transition-all cursor-pointer ${
                  inputValue.trim() && !isTyping
                    ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
