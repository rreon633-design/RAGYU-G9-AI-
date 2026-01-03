
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Send, 
  Terminal, 
  Settings, 
  Trash2, 
  Cpu, 
  MoreVertical,
  MoreHorizontal,
  Code,
  Sparkles,
  User,
  Copy,
  Check,
  Plus,
  History,
  Bold,
  Italic,
  Type,
  Link,
  List,
  RefreshCw,
  Maximize2,
  Minimize2,
  Pencil,
  Square,
  X,
  MessageSquare,
  Calendar,
  Scissors,
  ChevronRight
} from './components/Icons';
import { Message, ChatSession } from './types';
import { generateAIResponseStream } from './services/geminiService';

const CodeBlock = ({ children, className }: { children?: React.ReactNode, className?: string }) => {
  const [copied, setCopied] = useState(false);
  const codeString = String(children).replace(/\n$/, '');
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : 'code';

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 border border-[#D4AF37]/30 rounded-none overflow-hidden group/code shadow-2xl transition-all duration-300 hover:shadow-[#D4AF37]/5">
      <div className="bg-[#0D0D0D] px-3 py-1.5 border-b border-[#D4AF37]/20 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 mr-2">
            <div className="w-1.5 h-1.5 bg-[#D4AF37]/40"></div>
            <div className="w-1.5 h-1.5 bg-[#D4AF37]/20"></div>
          </div>
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#D4AF37] font-mono font-bold">
            {lang}
          </span>
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#D4AF37]/10 rounded-none transition-all text-[#D4AF37]/60 hover:text-[#D4AF37] border border-transparent hover:border-[#D4AF37]/20"
        >
          {copied ? (
            <span className="text-[8px] flex items-center gap-1 uppercase font-bold tracking-widest">
              <Check className="w-2.5 h-2.5" /> COPIED
            </span>
          ) : (
            <span className="text-[8px] flex items-center gap-1 uppercase font-bold tracking-widest">
              <Copy className="w-2.5 h-2.5" /> COPY
            </span>
          )}
        </button>
      </div>
      <div className="bg-[#050505] p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-[#333] relative">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#D4AF37]/20"></div>
        <code className="text-[12px] font-mono leading-relaxed text-[#f4e4bc] whitespace-pre">
          {children}
        </code>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('g9_sessions');
    return saved ? JSON.parse(saved).map((s: any) => ({ ...s, updatedAt: new Date(s.updatedAt) })) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Greetings. I am G9 AI. How may I assist your development today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem('g9_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Automatic scroll to bottom logic
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom(isLoading ? 'auto' : 'smooth');
  }, [messages, isLoading]);

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = input;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    const newText = before + prefix + selected + suffix + after;
    setInput(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const saveCurrentToSession = (updatedMessages: Message[]) => {
    if (updatedMessages.length <= 1 && !currentSessionId) return;

    setSessions(prev => {
      const firstUserMsg = updatedMessages.find(m => m.role === 'user')?.content || 'Untitled Session';
      const title = firstUserMsg.substring(0, 30) + (firstUserMsg.length > 30 ? '...' : '');
      const id = currentSessionId || Date.now().toString();
      
      const sessionIndex = prev.findIndex(s => s.id === id);
      const updatedSession: ChatSession = {
        id,
        title,
        messages: updatedMessages,
        updatedAt: new Date()
      };

      if (!currentSessionId) setCurrentSessionId(id);

      if (sessionIndex > -1) {
        const newSessions = [...prev];
        newSessions[sessionIndex] = updatedSession;
        return newSessions;
      } else {
        return [updatedSession, ...prev];
      }
    });
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = customPrompt || input;
    if (!promptToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptToSend,
      timestamp: new Date()
    };

    const assistantMessageId = (Date.now() + 1).toString();
    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage, initialAssistantMessage];
    setMessages(newMessages);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let accumulatedResponse = "";
      const stream = generateAIResponseStream([...messages, userMessage], controller.signal);
      
      for await (const chunk of stream) {
        if (controller.signal.aborted) break;
        accumulatedResponse += chunk;
        setMessages(prev => {
          return prev.map(msg => msg.id === assistantMessageId ? { ...msg, content: accumulatedResponse } : msg);
        });
      }
      setMessages(current => {
        saveCurrentToSession(current);
        return current;
      });
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, content: msg.content + "\n\n_System Error._" } : msg));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([{
      id: '1',
      role: 'assistant',
      content: 'Greetings. I am G9 AI. How may I assist your development today?',
      timestamp: new Date()
    }]);
    setIsHistoryOpen(false);
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setIsHistoryOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) startNewChat();
    setActiveMenuId(null);
  };

  const renameSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTitle = prompt('Rename archive:');
    if (newTitle) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    }
    setActiveMenuId(null);
  };

  const handleCopyMessage = (msg: Message) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = (msgIndex: number) => {
    const historyBefore = messages.slice(0, msgIndex);
    const lastUserMsg = [...historyBefore].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      setMessages(messages.slice(0, msgIndex));
      handleSendMessage(lastUserMsg.content);
    }
  };

  const handleRefine = (instruction: string) => {
    if (isLoading) return;
    handleSendMessage(instruction);
  };

  const handleEditUserPrompt = (content: string) => {
    setInput(content);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#000000] text-white overflow-hidden border border-[#D4AF37]/20 select-none">
      
      {/* HISTORY DIALOG */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsHistoryOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-[#080808] border border-[#D4AF37]/40 shadow-[0_0_50px_rgba(212,175,55,0.15)] flex flex-col max-h-[75vh] overflow-hidden">
            <header className="flex items-center justify-between p-4 border-b border-[#D4AF37]/20 bg-[#0A0A0A]">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-[#D4AF37]" />
                <h2 className="text-[10px] font-black tracking-[0.3em] text-[#D4AF37] uppercase">Command Archive</h2>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="p-1.5 hover:bg-[#D4AF37]/10 text-[#D4AF37] transition-all">
                <X className="w-5 h-5" />
              </button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {sessions.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-[#D4AF37]/20 font-mono text-[9px] tracking-widest">
                  EMPTY
                </div>
              ) : (
                sessions.map(session => (
                  <div 
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className={`group relative flex items-center justify-between p-3 border transition-all cursor-pointer ${
                      currentSessionId === session.id 
                        ? 'bg-[#D4AF37]/10 border-[#D4AF37]/50' 
                        : 'bg-[#0A0A0A] border-[#D4AF37]/5 hover:border-[#D4AF37]/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <MessageSquare className={`w-4 h-4 ${currentSessionId === session.id ? 'text-[#D4AF37]' : 'text-[#D4AF37]/30'}`} />
                      <h3 className={`text-[11px] font-bold truncate max-w-[200px] ${currentSessionId === session.id ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
                        {session.title}
                      </h3>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === session.id ? null : session.id); }}
                      className="p-1.5 text-[#D4AF37]/40 hover:text-[#D4AF37]"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {activeMenuId === session.id && (
                      <div className="absolute right-0 top-10 w-32 bg-[#0A0A0A] border border-[#D4AF37]/30 shadow-2xl z-[110] py-1">
                        <button onClick={(e) => renameSession(e, session.id)} className="w-full text-left px-3 py-1.5 text-[9px] uppercase tracking-widest hover:bg-[#D4AF37]/10 text-gray-400 hover:text-[#D4AF37] flex items-center gap-2">
                          <Pencil className="w-3 h-3" /> Rename
                        </button>
                        <button onClick={(e) => deleteSession(e, session.id)} className="w-full text-left px-3 py-1.5 text-[9px] uppercase tracking-widest hover:bg-red-950/40 text-red-500/80 hover:text-red-500 flex items-center gap-2">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <footer className="p-4 border-t border-[#D4AF37]/10 bg-[#050505] flex justify-center">
               <button onClick={startNewChat} className="px-6 py-2 bg-[#D4AF37] text-black text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#FFD700] transition-all">
                 <Plus className="w-4 h-4 inline mr-2" /> New Session
               </button>
            </footer>
          </div>
        </div>
      )}

      {/* MINIMAL TOP NAVBAR */}
      <header className="h-11 flex items-center justify-between px-4 bg-[#0A0A0A] border-b border-[#D4AF37]/30 shadow-md z-20">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-[#D4AF37]" />
          <h1 className="text-[11px] font-black tracking-[0.4em] text-[#D4AF37] uppercase">G9 AI</h1>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={startNewChat} className="p-2 hover:bg-[#D4AF37]/10 text-[#D4AF37]/60 hover:text-[#D4AF37] transition-all" title="New Session">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => setIsHistoryOpen(true)} className="p-2 hover:bg-[#D4AF37]/10 text-[#D4AF37]/60 hover:text-[#D4AF37] transition-all" title="History">
            <History className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-[#D4AF37]/10 mx-1"></div>
          <button className="p-2 hover:bg-[#D4AF37]/10 text-[#D4AF37]/60 hover:text-[#D4AF37] transition-all">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CHAT AREA - REDUCED PADDING */}
      <main className="flex-1 overflow-hidden flex flex-col relative bg-[#050505]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={msg.id} className={`flex gap-4 group ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-9 h-9 flex items-center justify-center border transition-all ${
                msg.role === 'user' ? 'bg-[#151515] border-[#D4AF37]/30' : 'bg-black border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.05)]'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5 text-gray-500" /> : <Sparkles className="w-5 h-5 text-[#D4AF37]" />}
              </div>

              <div className={`max-w-[85%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Horizontal wrapper */}
                <div className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`px-4 py-3 relative group/msg shadow-lg ${
                    msg.role === 'user' ? 'bg-[#0F0F0F] border-r-4 border-[#D4AF37] text-gray-200' : 'bg-[#080808] border-l-4 border-[#D4AF37] text-gray-100'
                  }`}>
                    <div className="prose prose-invert prose-xs max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-strong:text-[#D4AF37]">
                      <ReactMarkdown
                        components={{
                          code(props) {
                            const {children, className, ...rest} = props as any;
                            const isInline = !className;
                            return isInline ? (
                              <code {...rest} className="font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 border border-[#D4AF37]/20">
                                {children}
                              </code>
                            ) : (
                              <CodeBlock className={className} children={children} />
                            );
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {msg.role === 'assistant' && msg.content === '' && isLoading && (
                        <span className="inline-block w-1.5 h-4 bg-[#D4AF37] animate-pulse"></span>
                      )}
                    </div>

                    {/* ACTION BUTTONS FOR ASSISTANT RESPONSE */}
                    {msg.role === 'assistant' && msg.content !== '' && (
                      <div className="mt-4 pt-4 border-t border-[#D4AF37]/10 flex flex-wrap gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleCopyMessage(msg)}
                          className="flex items-center gap-1 px-2 py-1 bg-[#0D0D0D] border border-[#D4AF37]/20 text-[#D4AF37]/60 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all"
                        >
                          <span className="text-[7px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5">
                            {copiedId === msg.id ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                            {copiedId === msg.id ? 'COPIED' : 'COPY'}
                          </span>
                        </button>
                        
                        {!isLoading && idx === messages.length - 1 && (
                          <>
                            <button 
                              onClick={() => handleRegenerate(idx)}
                              className="flex items-center gap-1 px-2 py-1 bg-[#0D0D0D] border border-[#D4AF37]/20 text-[#D4AF37]/60 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all"
                            >
                              <span className="text-[7px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5">
                                <RefreshCw className="w-2.5 h-2.5" /> REGENERATE
                              </span>
                            </button>
                            <button 
                              onClick={() => handleRefine("Make the previous response significantly shorter and more concise.")}
                              className="flex items-center gap-1 px-2 py-1 bg-[#0D0D0D] border border-[#D4AF37]/20 text-[#D4AF37]/60 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all"
                            >
                              <span className="text-[7px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5">
                                <Scissors className="w-2.5 h-2.5" /> MAKE SHORTER
                              </span>
                            </button>
                            <button 
                              onClick={() => handleRefine("Provide a much more detailed and comprehensive explanation for the previous response.")}
                              className="flex items-center gap-1 px-2 py-1 bg-[#0D0D0D] border border-[#D4AF37]/20 text-[#D4AF37]/60 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all"
                            >
                              <span className="text-[7px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5">
                                <Maximize2 className="w-2.5 h-2.5" /> MAKE LONGER
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* ACTION BUTTONS FOR USER PROMPT */}
                    {msg.role === 'user' && (
                      <div className="mt-3 pt-3 border-t border-[#D4AF37]/10 flex flex-wrap gap-2 justify-end opacity-0 group-hover/msg:opacity-100 transition-opacity">
                         <button 
                          onClick={() => handleEditUserPrompt(msg.content)}
                          className="flex items-center gap-1 px-2 py-1 bg-[#0D0D0D] border border-[#D4AF37]/20 text-[#D4AF37]/60 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all"
                        >
                          <span className="text-[7px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5">
                            <Pencil className="w-2.5 h-2.5" /> EDIT
                          </span>
                        </button>
                        <button 
                          onClick={() => handleCopyMessage(msg)}
                          className="flex items-center gap-1 px-2 py-1 bg-[#0D0D0D] border border-[#D4AF37]/20 text-[#D4AF37]/60 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all"
                        >
                          <span className="text-[7px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5">
                            {copiedId === msg.id ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                            {copiedId === msg.id ? 'COPIED' : 'COPY'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`mt-1 text-[8px] uppercase tracking-widest text-[#D4AF37]/20 font-mono ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-4 animate-pulse">
              <div className="w-9 h-9 bg-[#1A1A1A] border border-[#D4AF37]/20" />
              <div className="h-12 w-64 bg-[#080808] border-l-4 border-[#D4AF37]/10" />
            </div>
          )}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} className="h-2" />
        </div>

        {/* MINIMAL INPUT SECTION */}
        <div className="p-4 bg-transparent border-t border-[#D4AF37]/10 backdrop-blur-md">
          <div className="max-w-4xl mx-auto space-y-2">
            
            <div className={`flex items-center gap-1 transition-all overflow-hidden ${input.length > 0 ? 'h-7 opacity-100' : 'h-0 opacity-0'}`}>
              <button onClick={() => insertMarkdown('**', '**')} className="p-1.5 hover:bg-[#D4AF37]/10 text-[#D4AF37]/40 hover:text-[#D4AF37]"><Bold className="w-3.5 h-3.5" /></button>
              <button onClick={() => insertMarkdown('`', '`')} className="p-1.5 hover:bg-[#D4AF37]/10 text-[#D4AF37]/40 hover:text-[#D4AF37]"><Code className="w-3.5 h-3.5" /></button>
              <button onClick={() => insertMarkdown('```\n', '\n```')} className="p-1.5 hover:bg-[#D4AF37]/10 text-[#D4AF37]/40 hover:text-[#D4AF37]"><Type className="w-3.5 h-3.5" /></button>
            </div>

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-[#D4AF37] opacity-10 group-focus-within:opacity-30 transition duration-500"></div>
              <div className="relative flex bg-[#0A0A0A] border border-[#D4AF37]/30 overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isLoading) handleSendMessage();
                    }
                  }}
                  placeholder="Ask G9 AI..."
                  className="w-full bg-transparent text-white p-4 focus:outline-none resize-none min-h-[60px] font-mono text-[13px] placeholder-[#D4AF37]/10 transition-all duration-300 focus:bg-black/20"
                />
                
                <div className="flex flex-col justify-end p-2 bg-[#0D0D0D] border-l border-[#D4AF37]/20">
                  {isLoading ? (
                    <button 
                      onClick={handleStopGeneration}
                      className="group relative h-11 w-11 flex items-center justify-center overflow-hidden transition-all active:scale-90"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[#FF4D4D] to-[#800000]"></div>
                      <Square className="relative w-5 h-5 text-white fill-white" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleSendMessage()}
                      disabled={!input.trim()}
                      className="group relative h-11 w-11 flex items-center justify-center overflow-hidden transition-all active:scale-95 disabled:opacity-5 disabled:grayscale shadow-sm"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700] via-[#D4AF37] to-[#8B7355]"></div>
                      <Send className="relative w-5 h-5 text-black transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-[8px] text-[#D4AF37]/10 mt-3 tracking-[0.4em] uppercase font-mono font-bold">
            PREMIUM COMPUTATION INTERFACE
          </p>
        </div>
      </main>

      {/* MINIMAL FOOTER */}
      <footer className="h-8 flex items-center justify-between px-3 bg-[#D4AF37] text-black text-[10px] font-black tracking-widest overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2">
            <Cpu className="w-3.5 h-3.5" />
            <span className="uppercase">G9_CORE_ACTIVE</span>
          </div>
          <div className="h-3 w-px bg-black/20"></div>
          <div className="flex items-center gap-1.5 px-2">
            <div className="w-1.5 h-1.5 bg-black animate-pulse"></div>
            <span className="uppercase">SYNC_STABLE</span>
          </div>
        </div>
        <div className="flex items-center h-full">
          <div className="p-2 border-l border-black/10">
            <Settings className="w-3.5 h-3.5" />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
