import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, query } from 'firebase/firestore';
import { Calendar, Clock, User, Mail, ChevronRight, BarChart3, ArrowLeft, Heart, ShieldCheck, Sparkles, CheckCircle2, Leaf } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mindcare-app';

const AVAILABLE_SLOTS = [
  { id: '09:00', label: '09:00 - 10:00' },
  { id: '10:00', label: '10:00 - 11:00' },
  { id: '13:30', label: '13:30 - 14:30' },
  { id: '14:30', label: '14:30 - 15:30' },
];

const ADMIN_PIN = '8987';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const getNextFriday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = (day <= 5) ? (5 - day) : (12 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

// --- Komponen UI Estetik ---

const BackgroundBlobs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-[#E3EBE6] mix-blend-multiply filter blur-[80px] opacity-70 animate-float"></div>
    <div className="absolute top-[20%] right-[-5%] w-[35vw] h-[35vw] rounded-full bg-[#EAE5DF] mix-blend-multiply filter blur-[80px] opacity-70 animate-float-delayed"></div>
    <div className="absolute bottom-[-20%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-[#E8F0EC] mix-blend-multiply filter blur-[100px] opacity-60 animate-float"></div>
  </div>
);

const Navbar = ({ setView, view }) => (
  <nav className="fixed w-full top-0 z-50 bg-[#FAF9F6]/80 backdrop-blur-xl border-b border-[#E1E5E3]/50 transition-all duration-300">
    <div className="max-w-6xl mx-auto px-6 lg:px-8">
      <div className="flex justify-between h-20 items-center">
        <div 
          className="flex items-center cursor-pointer group" 
          onClick={() => setView('home')}
        >
          <Leaf className="h-6 w-6 text-[#5A7367] mr-3 group-hover:rotate-12 transition-transform duration-500" strokeWidth={1.5} />
          <span className="font-serif text-2xl text-[#2C3631] tracking-wide">MindCare.</span>
        </div>
        <div className="flex items-center space-x-6">
          <button 
            onClick={() => setView('booking')}
            className={`text-sm font-medium tracking-wide transition-colors ${view === 'booking' ? 'text-[#4A5D54]' : 'text-[#82968C] hover:text-[#4A5D54]'}`}
          >
            Reservasi
          </button>
          <button 
            onClick={() => setView('admin_auth')}
            className="text-[#A9B8B0] hover:text-[#4A5D54] transition-colors p-2"
          >
            <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  </nav>
);

const HomeView = ({ setView }) => (
  <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 min-h-screen text-center">
    <div className="max-w-3xl space-y-10 animate-slide-up">
      <div className="inline-flex items-center px-4 py-2 rounded-full border border-[#D5DDD9] bg-white/50 backdrop-blur-sm text-[#6B7974] text-xs font-medium tracking-widest uppercase mb-4">
        <Sparkles className="w-3 h-3 mr-2 text-[#8BA398]" />
        Layanan Konseling Eksklusif
      </div>
      <h1 className="font-serif text-5xl md:text-7xl text-[#2C3631] leading-[1.1] tracking-tight">
        Temukan ruang aman <br className="hidden md:block" />
        <span className="italic text-[#5A7367]">untuk pikiranmu.</span>
      </h1>
      <p className="text-lg md:text-xl text-[#6B7974] max-w-2xl mx-auto leading-relaxed font-light">
        Kami hadir di setiap hari Jumat untuk mendengarkan. Pesan sesi eksklusif Anda, temukan ketenangan dalam kerahasiaan penuh.
      </p>
      <div className="pt-8">
        <button 
          onClick={() => setView('booking')}
          className="btn-primary group relative inline-flex items-center justify-center px-10 py-4 font-medium tracking-wide rounded-full text-sm md:text-base"
        >
          Jadwalkan Sesi
          <ChevronRight className="w-4 h-4 ml-3 group-hover:translate-x-1.5 transition-transform duration-300" />
        </button>
      </div>
    </div>
  </div>
);

const BookingView = ({ setView, appointments, user }) => {
  const [selectedDate, setSelectedDate] = useState(getNextFriday());
  const [selectedSlot, setSelectedSlot] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const takenSlots = useMemo(() => {
    return appointments
      .filter(app => app.date === selectedDate)
      .map(app => app.timeSlot);
  }, [appointments, selectedDate]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    const day = new Date(newDate).getDay();
    if (day !== 5) {
      setErrorMsg('Layanan eksklusif ini hanya tersedia pada hari Jumat.');
      setSelectedDate('');
      setSelectedSlot('');
    } else {
      setErrorMsg('');
      setSelectedDate(newDate);
      setSelectedSlot('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return setErrorMsg('Koneksi terputus. Silakan muat ulang halaman.');
    if (!selectedDate || !selectedSlot || !formData.name || !formData.email) return setErrorMsg('Mohon lengkapi detail reservasi Anda.');
    if (takenSlots.includes(selectedSlot)) return setErrorMsg('Maaf, jadwal ini baru saja dipilih oleh orang lain.');

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const publicRef = collection(db, 'artifacts', appId, 'public', 'data', 'mindcare_appointments');
      await addDoc(publicRef, {
        date: selectedDate, timeSlot: selectedSlot,
        userName: formData.name, userEmail: formData.email,
        createdAt: serverTimestamp(), status: 'booked'
      });
      setSuccessMsg(`Sesi Anda pada ${formatDate(selectedDate)} pukul ${selectedSlot} berhasil dijadwalkan.`);
      setFormData({ name: '', email: '' }); setSelectedSlot('');
    } catch (err) {
      setErrorMsg('Terjadi kesalahan. Silakan coba beberapa saat lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successMsg) {
    return (
      <div className="relative z-10 flex-1 flex items-center justify-center p-6 min-h-screen">
        <div className="glass-card p-12 rounded-[2.5rem] max-w-md w-full text-center animate-slide-up flex flex-col items-center">
          <div className="w-20 h-20 bg-[#E8F0EC] rounded-full flex items-center justify-center mb-8">
            <CheckCircle2 className="w-10 h-10 text-[#5A7367]" strokeWidth={1.5} />
          </div>
          <h2 className="font-serif text-3xl text-[#2C3631] mb-4">Reservasi Berhasil</h2>
          <p className="text-[#6B7974] mb-10 leading-relaxed font-light">{successMsg}</p>
          <button onClick={() => { setSuccessMsg(''); setView('home'); }} className="btn-primary w-full py-4 rounded-full text-sm font-medium tracking-wide">
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-12 min-h-screen pt-28">
      <div className="w-full max-w-3xl glass-card rounded-[2.5rem] p-8 md:p-12 animate-slide-up">
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl text-[#2C3631] mb-4">Mulai Perjalananmu</h2>
          <p className="text-[#6B7974] font-light max-w-lg mx-auto">
            Berikan dirimu ruang untuk bernapas. Pilih jadwal luang di hari Jumat untuk sesi personal yang mendalam.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 max-w-xl mx-auto">
          {errorMsg && (
            <div className="bg-[#FFF8F8] text-[#A65B5B] p-4 rounded-2xl text-sm border border-[#F2E6E6] flex items-center animate-fade-in">
               <span className="mr-3">✦</span> {errorMsg}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-xs font-medium text-[#82968C] uppercase tracking-wider flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-2" /> Tanggal (Jumat)
            </label>
            <input 
              type="date" value={selectedDate} onChange={handleDateChange}
              min={new Date().toISOString().split('T')[0]}
              className="input-calm w-full p-4 rounded-2xl text-[#2C3631]" required
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-medium text-[#82968C] uppercase tracking-wider flex items-center">
              <Clock className="w-3.5 h-3.5 mr-2" /> Waktu Sesi (1 Jam)
            </label>
            <div className="grid grid-cols-2 gap-4">
              {AVAILABLE_SLOTS.map((slot) => {
                const isTaken = takenSlots.includes(slot.id);
                return (
                  <button
                    key={slot.id} type="button" disabled={isTaken || !selectedDate}
                    onClick={() => setSelectedSlot(slot.id)}
                    data-selected={selectedSlot === slot.id}
                    className={`slot-btn relative p-4 rounded-2xl border text-left overflow-hidden ${
                      isTaken 
                        ? 'bg-[#F4F5F4]/50 border-transparent text-[#B5C2BC] cursor-not-allowed' 
                        : 'bg-white border-[#E1E5E3] text-[#4A5D54]'
                    }`}
                  >
                    <div className="font-medium text-lg mb-1">{slot.id}</div>
                    <div className="text-xs opacity-70 font-light">{isTaken ? 'Telah direservasi' : 'Tersedia'}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#8BA398] font-light mt-2 italic">* Terdapat jeda istirahat pada pukul 11:00 - 13:30 WIB.</p>
          </div>

          <div className="pt-6 space-y-5 border-t border-[#E1E5E3]/50">
            <div>
              <label className="text-xs font-medium text-[#82968C] uppercase tracking-wider flex items-center mb-3">
                <User className="w-3.5 h-3.5 mr-2" /> Nama
              </label>
              <input 
                type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="input-calm w-full p-4 rounded-2xl text-[#2C3631]" placeholder="Nama panggilan yang membuatmu nyaman" required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#82968C] uppercase tracking-wider flex items-center mb-3">
                <Mail className="w-3.5 h-3.5 mr-2" /> Email
              </label>
              <input 
                type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="input-calm w-full p-4 rounded-2xl text-[#2C3631]" placeholder="Untuk konfirmasi jadwal" required
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" disabled={isSubmitting || !selectedSlot}
              className={`w-full py-4.5 rounded-2xl text-sm tracking-wide font-medium transition-all duration-500 ${
                isSubmitting || !selectedSlot
                  ? 'bg-[#E1E5E3] text-[#A9B8B0] cursor-not-allowed'
                  : 'btn-primary py-4'
              }`}
            >
              {isSubmitting ? 'Memproses...' : 'Konfirmasi Reservasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminAuth = ({ onLogin, setView }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) onLogin();
    else { setError(true); setPin(''); }
  };

  return (
    <div className="relative z-10 flex-1 flex items-center justify-center p-6 min-h-screen">
      <div className="glass-card p-10 rounded-[2.5rem] max-w-sm w-full animate-slide-up">
        <div className="flex justify-center mb-8">
          <ShieldCheck className="w-10 h-10 text-[#8BA398]" strokeWidth={1} />
        </div>
        <h2 className="font-serif text-2xl text-center text-[#2C3631] mb-2">Akses Pengelola</h2>
        <p className="text-center text-sm text-[#8BA398] mb-8 font-light">Masukkan sandi</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input 
              type="password" value={pin} onChange={(e) => { setPin(e.target.value); setError(false); }}
              className={`w-full text-center p-4 text-3xl tracking-[0.7em] bg-transparent border-b-2 outline-none transition-colors rounded-none ${error ? 'border-[#A65B5B] text-[#A65B5B]' : 'border-[#D5DDD9] text-[#2C3631] focus:border-[#4A5D54]'}`}
              placeholder="••••" maxLength="4" autoFocus
            />
          </div>
          <button type="submit" className="btn-primary w-full py-4 rounded-full text-sm font-medium tracking-wide">
            Masuk
          </button>
        </form>
        <button onClick={() => setView('home')} className="w-full mt-6 text-[#8BA398] text-sm hover:text-[#4A5D54] flex items-center justify-center transition-colors">
          <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Kembali
        </button>
      </div>
    </div>
  );
};

const AdminDashboard = ({ appointments, setView }) => {
  const monthlyData = useMemo(() => {
    const counts = Array(12).fill(0);
    appointments.forEach(app => {
      if (app.date) {
        const monthIndex = new Date(app.date).getMonth();
        counts[monthIndex]++;
      }
    });
    return MONTHS.map((month, index) => ({ name: month, Sesi: counts[index] }))
                 .filter((_, index) => index <= new Date().getMonth() + 1);
  }, [appointments]);

  return (
    <div className="relative z-10 flex-1 p-6 md:p-12 min-h-screen pt-28">
      <div className="max-w-5xl mx-auto space-y-8 animate-slide-up">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center glass-card p-6 rounded-3xl">
          <div>
            <h1 className="font-serif text-2xl text-[#2C3631] mb-1">Tinjauan Praktik</h1>
            <p className="text-[#6B7974] text-sm font-light">Pantau jadwal dan statistik konseling secara real-time.</p>
          </div>
          <button 
            onClick={() => setView('home')}
            className="mt-4 md:mt-0 px-6 py-2.5 rounded-full border border-[#D5DDD9] text-[#4A5D54] text-sm font-medium hover:bg-[#F4F5F4] transition-colors"
          >
            Tutup Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 glass-card p-8 rounded-3xl">
            <h3 className="text-sm font-medium text-[#82968C] uppercase tracking-wider mb-8">Tren Sesi Konseling</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E1E5E3" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#8BA398', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#8BA398', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: 'rgba(244, 245, 244, 0.5)'}}
                    contentStyle={{borderRadius: '16px', border: '1px solid #E1E5E3', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'}}
                  />
                  <Bar dataKey="Sesi" fill="#6B7974" radius={[6, 6, 6, 6]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-[#4A5D54] p-8 rounded-3xl text-white shadow-xl shadow-[#4A5D54]/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10"><Leaf className="w-24 h-24" /></div>
              <h3 className="text-[#A9B8B0] text-sm font-medium uppercase tracking-wider mb-2 relative z-10">Total Sesi</h3>
              <p className="font-serif text-6xl relative z-10">{appointments.length}</p>
            </div>
            
            <div className="glass-card p-8 rounded-3xl">
              <h3 className="text-sm font-medium text-[#82968C] uppercase tracking-wider mb-6">Waktu Operasional</h3>
              <ul className="space-y-4 text-sm text-[#6B7974]">
                <li className="flex justify-between border-b border-[#E1E5E3]/50 pb-3"><span>Hari</span> <span className="text-[#2C3631]">Jumat</span></li>
                <li className="flex justify-between border-b border-[#E1E5E3]/50 pb-3"><span>Jam Operasional</span> <span className="text-[#2C3631]">09:00 - 15:30</span></li>
                <li className="flex justify-between border-b border-[#E1E5E3]/50 pb-3"><span>Jeda Istirahat</span> <span className="text-[#2C3631]">11:00 - 13:30</span></li>
                <li className="flex justify-between"><span>Durasi / Sesi</span> <span className="text-[#2C3631]">60 Menit</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="p-8 border-b border-[#E1E5E3]/50">
            <h3 className="text-sm font-medium text-[#82968C] uppercase tracking-wider">Daftar Jadwal Mendatang</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F4F5F4]/50 text-[#8BA398] font-medium border-b border-[#E1E5E3]/50">
                <tr>
                  <th className="px-8 py-5 font-medium">Klien</th>
                  <th className="px-8 py-5 font-medium">Tanggal</th>
                  <th className="px-8 py-5 font-medium">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E5E3]/50">
                {appointments.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-12 text-[#8BA398] font-light">Belum ada jadwal yang direservasi.</td></tr>
                ) : (
                  appointments.sort((a, b) => new Date(b.date) - new Date(a.date)).map((app) => (
                    <tr key={app.id} className="hover:bg-white/50 transition-colors">
                      <td className="px-8 py-5 text-[#2C3631]">
                        <div className="font-medium mb-0.5">{app.userName}</div>
                        <div className="text-xs text-[#8BA398]">{app.userEmail}</div>
                      </td>
                      <td className="px-8 py-5 text-[#6B7974]">{formatDate(app.date)}</td>
                      <td className="px-8 py-5">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#E8F0EC] text-[#4A5D54]">
                          <Clock className="w-3 h-3 mr-1.5" /> {app.timeSlot}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [view, setView] = useState('home');
  const [isAdminAuth, setIsAdminAuth] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const publicRef = collection(db, 'artifacts', appId, 'public', 'data', 'mindcare_appointments');
    const q = query(publicRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Inject Custom Styles, Fonts, and Animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
      
      body { 
        font-family: 'Plus Jakarta Sans', sans-serif; 
        background-color: #FAF9F6; 
        color: #2D3A35; 
      }
      .font-serif { font-family: 'Playfair Display', serif; }
      
      .glass-card { 
        background: rgba(255, 255, 255, 0.6); 
        backdrop-filter: blur(24px); 
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.8); 
        box-shadow: 0 30px 60px rgba(0,0,0,0.02); 
      }
      
      .input-calm { 
        background: #F4F5F4; border: 1px solid transparent; transition: all 0.3s ease; 
      }
      .input-calm:focus { 
        background: #FFFFFF; border-color: #A9B8B0; outline: none; box-shadow: 0 0 0 4px rgba(169, 184, 176, 0.15); 
      }
      
      .btn-primary { 
        background: #4A5D54; color: white; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); 
      }
      .btn-primary:hover { 
        background: #3C4B44; transform: translateY(-2px); box-shadow: 0 10px 25px -5px rgba(74, 93, 84, 0.3); 
      }
      .btn-primary:active { transform: translateY(0); }
      
      .slot-btn { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      .slot-btn[data-selected="true"] { background: #4A5D54; color: white; border-color: #4A5D54; transform: scale(0.98); }
      .slot-btn[data-selected="false"]:hover { border-color: #A9B8B0; background: white; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
      
      @keyframes float { 
        0% { transform: translate(0, 0) rotate(0deg) scale(1); } 
        33% { transform: translate(30px, -50px) rotate(10deg) scale(1.05); } 
        66% { transform: translate(-20px, 20px) rotate(-5deg) scale(0.95); } 
        100% { transform: translate(0, 0) rotate(0deg) scale(1); } 
      }
      .animate-float { animation: float 25s infinite ease-in-out; }
      .animate-float-delayed { animation: float 30s infinite ease-in-out reverse; }
      
      @keyframes slideUpFade { 
        from { opacity: 0; transform: translateY(40px); filter: blur(4px); } 
        to { opacity: 1; transform: translateY(0); filter: blur(0); } 
      }
      .animate-slide-up { animation: slideUpFade 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      .animate-fade-in { animation: fadeIn 0.5s ease forwards; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const renderView = () => {
    switch (view) {
      case 'home': return <HomeView setView={setView} />;
      case 'booking': return <BookingView setView={setView} appointments={appointments} user={user} />;
      case 'admin_auth': return isAdminAuth ? <AdminDashboard appointments={appointments} setView={setView} /> : <AdminAuth onLogin={() => { setIsAdminAuth(true); setView('admin_dashboard'); }} setView={setView} />;
      case 'admin_dashboard': return isAdminAuth ? <AdminDashboard appointments={appointments} setView={setView} /> : <HomeView setView={setView} />;
      default: return <HomeView setView={setView} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] selection:bg-[#E8F0EC] selection:text-[#2C3631] relative overflow-hidden">
      <BackgroundBlobs />
      <Navbar setView={setView} view={view} />
      <main className="flex-1 flex flex-col">
        {renderView()}
      </main>
    </div>
  );
}