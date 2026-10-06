import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { usePageTiming } from '@/hooks/usePageTiming';

export default function ContactPage() {
  usePageTiming('Contact', true);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSending(true);
    try {
      // Envoi simulé — à connecter à un endpoint /contact ou service email
      await new Promise((r) => setTimeout(r, 800));
      setSent(true);
      toast.success('Message envoyé ! Nous vous répondrons dans les plus brefs délais.');
    } catch {
      toast.error('Erreur lors de l\'envoi. Réessayez.');
    } finally {
      setSending(false);
    }
  };

  const inputClass =
    'w-full h-[48px] px-4 bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus:outline-none focus:border-[#c1a0fd] focus:ring-2 focus:ring-[#c1a0fd]/20 transition-all';
  const labelClass = 'block text-[14px] font-semibold text-[#303044] mb-1.5';

  return (
    <div className="min-h-screen bg-[#f2f4fc]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-[640px] mx-auto px-4 md:px-8 py-12 md:py-16">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#828294] hover:text-[#303044] text-[13px] mb-8 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>

        <h1 className="text-[32px] md:text-[40px] font-bold text-[#111125] tracking-[-0.8px] mb-3">
          Nous contacter
        </h1>
        <p className="text-[16px] text-[#5c5c6f] mb-10">
          Notre équipe répond généralement sous 24h. Pour les urgences, précisez-le dans votre message.
        </p>

        {sent ? (
          <div className="bg-white rounded-[20px] p-8 shadow-sm text-center">
            <div className="w-[64px] h-[64px] rounded-full bg-[#f3ecff] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M5 14L11 20L23 8" stroke="#c1a0fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-[22px] font-bold text-[#111125] mb-2">Message envoyé !</h2>
            <p className="text-[15px] text-[#5c5c6f] mb-6">Nous vous répondrons dans les plus brefs délais à l'adresse indiquée.</p>
            <button
              onClick={() => navigate('/')}
              className="h-[48px] px-8 bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[14px] rounded-[12px] transition-all cursor-pointer"
            >
              Retour à l'accueil
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-[20px] p-6 md:p-8 shadow-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Votre nom <span className="text-[#c1a0fd]">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jean Dupont"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Email <span className="text-[#c1a0fd]">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean@exemple.fr"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Sujet</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Question sur une réservation, demande d'information..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Message <span className="text-[#c1a0fd]">*</span></label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décrivez votre demande..."
                rows={6}
                required
                className="w-full px-4 py-3 bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus:outline-none focus:border-[#c1a0fd] focus:ring-2 focus:ring-[#c1a0fd]/20 transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!name.trim() || !email.trim() || !message.trim() || sending}
              className="w-full h-[52px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[15px] rounded-[12px] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {sending ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Envoi en cours...</>
              ) : (
                'Envoyer le message'
              )}
            </button>
          </form>
        )}

        {/* Contact info */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-[16px] p-5 shadow-sm">
            <p className="text-[13px] font-semibold text-[#303044] mb-1">Par email</p>
            <p className="text-[13px] text-[#828294]">contact@weekook.com</p>
          </div>
          <div className="bg-white rounded-[16px] p-5 shadow-sm">
            <p className="text-[13px] font-semibold text-[#303044] mb-1">Réponse sous</p>
            <p className="text-[13px] text-[#828294]">24h en semaine</p>
          </div>
        </div>
      </div>
    </div>
  );
}
