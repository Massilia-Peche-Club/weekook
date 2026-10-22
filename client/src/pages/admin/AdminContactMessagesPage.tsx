import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Mail, Trash2 } from 'lucide-react';

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'Admin — Messages contact | Weekook'; }, []);

  const fetchAll = async () => {
    setLoading(true);
    const res = await api.get<ContactMessage[]>('/admin/contact-messages');
    if (res.success && res.data) setMessages(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleRead = async (id: number, current: boolean) => {
    const res = await api.put(`/admin/contact-messages/${id}`, { read: !current });
    if (res.success) fetchAll();
  };

  const deleteMessage = async (id: number) => {
    if (!confirm('Supprimer ce message ?')) return;
    const res = await api.delete(`/admin/contact-messages/${id}`);
    if (res.success) fetchAll();
  };

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111125]">Messages contact</h1>
        {unreadCount > 0 && (
          <span className="text-xs bg-[#c1a0fd]/10 text-[#c1a0fd] px-3 py-1 rounded-full font-medium">
            {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Chargement...</div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className={`bg-white rounded-[20px] p-5 flex gap-4 items-start border-2 transition-colors ${m.read ? 'border-transparent' : 'border-[#c1a0fd]/30'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {!m.read && <span className="w-2 h-2 rounded-full bg-[#c1a0fd]" />}
                  <span className="font-medium text-[#111125]">{m.name}</span>
                  <a href={`mailto:${m.email}`} className="text-xs text-[#c1a0fd] hover:underline flex items-center gap-1">
                    <Mail size={12} /> {m.email}
                  </a>
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(m.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                {m.subject && <p className="text-sm font-semibold text-[#303044] mb-1">{m.subject}</p>}
                <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{m.message}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => toggleRead(m.id, m.read)}
                  className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
                    m.read
                      ? 'bg-gray-100 text-gray-600 hover:bg-[#c1a0fd]/10 hover:text-[#c1a0fd]'
                      : 'bg-[#c1a0fd] text-white'
                  }`}
                >
                  {m.read ? 'Marquer non lu' : 'Marquer lu'}
                </button>
                <button
                  onClick={() => deleteMessage(m.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="bg-white rounded-[20px] p-8 text-center text-gray-400 text-sm">
              Aucun message
            </div>
          )}
        </div>
      )}
    </div>
  );
}
