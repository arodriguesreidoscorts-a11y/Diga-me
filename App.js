import React, { useState, useEffect, useRef } from 'react';
import { Send, User, LogOut, MessageSquare, Users, Shield, RefreshCcw, Crown, Camera, X, Reply } from 'lucide-react';

// O endereço da sua caixinha mágica de mensagens
const NPOINT_URL = "https://api.npoint.io/a0455d1bb133e83521f6"; 

export default function App() {
  // Coisas que o site precisa lembrar
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [profilePic, setProfilePic] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [globalTyping, setGlobalTyping] = useState(false);
  
  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Faz a tela descer sempre que tem conversa nova
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Tenta lembrar de você se você já entrou antes
  useEffect(() => {
    const saved = localStorage.getItem('digame_session');
    if (saved) {
      setUser(JSON.parse(saved));
    }
  }, []);

  // Vai buscar as mensagens na internet
  const fetchData = async () => {
    try {
      const response = await fetch(NPOINT_URL);
      const data = await response.json();
      const safeData = data || { messages: [], users: {}, registered: {} };
      
      if (safeData.messages) setMessages(safeData.messages);
      
      if (safeData.users) {
        const now = Date.now();
        const activeUsers = Object.values(safeData.users);
        const online = activeUsers.filter(u => now - u.lastSeen < 15000);
        setOnlineCount(online.length || 1);
        
        // Vê se alguém (que não seja você) está escrevendo
        const someoneTyping = activeUsers.some(u => u.typing && u.name !== user?.nickname && now - u.lastSeen < 5000);
        setGlobalTyping(someoneTyping);
      }

      if (user) updateActivity(safeData);
    } catch (err) {
      console.log("Sincronizando...");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [user]);

  // Avisa o site que você ainda está acordado e se está digitando
  const updateActivity = async (currentData) => {
    if (!user) return;
    try {
      const updatedUsers = { ...(currentData.users || {}) };
      updatedUsers[user.nickname] = { 
        lastSeen: Date.now(), 
        typing: isTyping,
        name: user.nickname,
        avatar: user.avatar 
      };
      
      await fetch(NPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentData, users: updatedUsers })
      });
    } catch (err) {}
  };

  // Coloca sua foto
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePic(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Faz o login ou o registro
  const handleAuth = async (e) => {
    e.preventDefault();
    const nick = nickname.trim();
    const pass = password.trim();

    try {
      const response = await fetch(NPOINT_URL);
      const data = await response.json() || { messages: [], users: {}, registered: {} };
      const registered = data.registered || {};

      if (isRegistering) {
        if (registered[nick]) {
          alert("Este nome já existe! Tente outro.");
          return;
        }
        const newUser = { nickname: nick, password: pass, avatar: profilePic };
        const updatedData = { ...data, registered: { ...registered, [nick]: newUser } };
        
        await fetch(NPOINT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });
        
        setUser(newUser);
        localStorage.setItem('digame_session', JSON.stringify(newUser));
        postSystemMessage(`${nick} é o novo membro da realeza!`, updatedData);
      } else {
        const saved = registered[nick];
        if (!saved || saved.password !== pass) {
          alert("Nome ou senha errados!");
          return;
        }
        setUser(saved);
        localStorage.setItem('digame_session', JSON.stringify(saved));
      }
    } catch (err) {
      alert("Problema na conexão!");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('digame_session');
    setUser(null);
  };

  // Manda aquelas mensagens automáticas do site
  const postSystemMessage = async (text, currentData) => {
    const newMessage = {
      id: "sys-" + Date.now(),
      sender: 'System',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true
    };
    const updated = { ...currentData, messages: [...(currentData.messages || []), newMessage].slice(-50) };
    await fetch(NPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
  };

  // Detecta quando você está escrevendo
  const handleTyping = (e) => {
    setInputText(e.target.value);
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
  };

  // Envia sua mensagem
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const textToSend = inputText;
    const replyData = replyTo;
    setInputText('');
    setReplyTo(null);
    setIsLoading(true);

    try {
      const response = await fetch(NPOINT_URL);
      const data = await response.json() || { messages: [], users: {}, registered: {} };
      
      const newMessage = {
        id: "msg-" + Date.now() + Math.random(),
        sender: user.nickname,
        avatar: user.avatar,
        text: textToSend,
        replyTo: replyData,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: false
      };

      const updatedMessages = [...(data.messages || []), newMessage].slice(-50);
      await fetch(NPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, messages: updatedMessages })
      });
      setMessages(updatedMessages);
    } catch (err) {
      console.log("Erro no envio");
    } finally {
      setIsLoading(false);
    }
  };

  // TELA DE ENTRAR (LOGIN / REGISTRO)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] p-12 border border-gray-100">
          <div className="text-center mb-10">
            <div className="bg-black text-white w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl relative">
              <Crown size={44} className="text-gray-400 opacity-60" />
            </div>
            <h1 className="text-5xl font-black text-black tracking-tighter italic">diga-me</h1>
            <p className="text-gray-300 text-[10px] font-bold uppercase tracking-[0.4em] mt-3 italic">Premium Space</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-5">
            {isRegistering && (
              <div className="flex flex-col items-center mb-6">
                <label className="relative cursor-pointer group">
                  <div className="w-24 h-24 rounded-[2rem] bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden group-hover:border-black transition-all">
                    {profilePic ? (
                      <img src={profilePic} className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="text-gray-300 group-hover:text-black" size={30} />
                    )}
                  </div>
                  <input type="file" className="hidden" onChange={handlePhotoChange} accept="image/*" />
                </label>
                <span className="text-[10px] font-black text-gray-300 mt-3 uppercase tracking-widest">Sua Imagem</span>
              </div>
            )}
            
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-8 py-5 bg-gray-50 border-0 rounded-3xl focus:ring-2 focus:ring-black focus:bg-white focus:outline-none transition-all font-bold text-gray-700"
              placeholder="Apelido único"
              required
            />
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-8 py-5 bg-gray-50 border-0 rounded-3xl focus:ring-2 focus:ring-black focus:bg-white focus:outline-none transition-all font-bold text-gray-700"
              placeholder="Senha secreta"
              required
            />
            
            <button type="submit" className="w-full bg-black text-white font-black py-6 rounded-3xl hover:bg-zinc-800 transition-all shadow-2xl active:scale-95 text-lg">
              {isRegistering ? 'CRIAR MINHA CONTA' : 'ACESSAR AGORA'}
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-[10px] font-black text-gray-400 hover:text-black uppercase tracking-widest underline transition-colors"
            >
              {isRegistering ? 'Já sou da comunidade' : 'Ainda não tenho registro'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // TELA DO CHAT
  return (
    <div className="flex flex-col h-screen bg-white max-w-2xl mx-auto border-x border-gray-50 shadow-2xl overflow-hidden">
      
      {/* Cabeçalho Chique */}
      <header className="bg-white/80 backdrop-blur-2xl border-b border-gray-50 p-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="bg-black text-white p-3 rounded-2xl shadow-xl">
              <Crown size={26} className={`transition-all duration-700 ${globalTyping ? 'text-gray-400 opacity-40 animate-pulse' : 'text-white'}`} />
            </div>
            {globalTyping && (
               <div className="absolute -top-1 -right-1 flex gap-1">
                 <span className="w-2 h-2 bg-black rounded-full animate-bounce"></span>
                 <span className="w-2 h-2 bg-black rounded-full animate-bounce delay-75"></span>
                 <span className="w-2 h-2 bg-black rounded-full animate-bounce delay-150"></span>
               </div>
            )}
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tighter text-black italic">diga-me</h1>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
              <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              {onlineCount} PRESENTES
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gray-100 overflow-hidden border-2 border-white shadow-lg">
            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs font-bold">{user.nickname[0]}</div>}
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-200 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Conversas */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#fafafa]">
        {messages.map((msg, idx) => {
          const isMe = msg.sender === user.nickname;
          return (
            <div key={msg.id || idx} className={`flex ${msg.isSystem ? 'justify-center' : (isMe ? 'justify-end' : 'justify-start')}`}>
              {msg.isSystem ? (
                <div className="bg-white/80 text-gray-300 text-[8px] px-5 py-2 rounded-full font-black uppercase tracking-[0.3em] border border-gray-100">
                  {msg.text}
                </div>
              ) : (
                <div className={`max-w-[85%] flex flex-col group cursor-pointer ${isMe ? 'items-end' : 'items-start'}`} onClick={() => setReplyTo(msg)}>
                  {!isMe && (
                    <div className="flex items-center gap-2 mb-2 ml-2">
                       <div className="w-5 h-5 rounded-lg bg-black overflow-hidden flex items-center justify-center shadow-sm">
                          {msg.avatar ? <img src={msg.avatar} className="w-full h-full object-cover" /> : <span className="text-[8px] text-white font-bold">{msg.sender[0]}</span>}
                       </div>
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{msg.sender}</span>
                    </div>
                  )}
                  
                  {msg.replyTo && (
                    <div className={`text-[11px] px-4 py-2 mb-[-12px] pb-5 rounded-t-3xl opacity-40 border-x border-t ${isMe ? 'bg-zinc-200 border-zinc-300 mr-4' : 'bg-white border-gray-100 ml-4'}`}>
                      <p className="font-black italic truncate max-w-[180px]">↩ {msg.replyTo.sender}: {msg.replyTo.text}</p>
                    </div>
                  )}

                  <div className={`relative px-6 py-4 rounded-[1.8rem] shadow-sm transition-all group-hover:shadow-xl ${
                    isMe ? 'bg-black text-white rounded-tr-none' : 'bg-white text-black rounded-tl-none border border-gray-100'
                  }`}>
                    <p className="text-sm font-semibold leading-relaxed">{msg.text}</p>
                    <div className="flex items-center justify-between gap-6 mt-3">
                       <Reply size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                       <p className="text-[8px] font-black opacity-30 uppercase tracking-widest">{msg.time}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Barra de Escrever */}
      <div className="p-6 bg-white border-t border-gray-50">
        {replyTo && (
          <div className="bg-gray-50 p-3 px-6 rounded-t-3xl border-x border-t border-gray-100 flex justify-between items-center mb-[-1px] animate-in fade-in slide-in-from-bottom-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Respondendo a <span className="text-black">{replyTo.sender}</span></p>
            <button onClick={() => setReplyTo(null)} className="text-gray-300 hover:text-black"><X size={16}/></button>
          </div>
        )}
        <form onSubmit={sendMessage} className={`flex gap-4 bg-gray-50 p-3 border border-gray-100 transition-all ${replyTo ? 'rounded-b-3xl' : 'rounded-[2rem]'} focus-within:bg-white focus-within:border-black/10 focus-within:shadow-2xl`}>
          <input 
            type="text" 
            value={inputText}
            onChange={handleTyping}
            placeholder="Diga algo incrível..."
            className="flex-1 bg-transparent px-5 py-3 text-sm font-bold focus:outline-none placeholder:text-gray-300"
          />
          <button type="submit" disabled={isLoading || !inputText.trim()} className="bg-black text-white p-5 rounded-2xl active:scale-90 transition-all shadow-2xl disabled:opacity-5">
            <Send size={22} />
          </button>
        </form>
      </div>
    </div>
  );
}
