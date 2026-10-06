import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronDown, ChevronUp, Save } from 'lucide-react';

const CATEGORIES = [
  { id: 'general', label: 'Comment ça marche' },
  { id: 'client', label: 'Pour les clients' },
  { id: 'kooker', label: 'Pour les Kookers' },
  { id: 'payment', label: 'Paiement & Tarifs' },
  { id: 'trust', label: 'Sécurité & Confiance' },
];

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const DEFAULT_FAQS: FaqItem[] = [
  { id: '1', category: 'general', question: 'Comment fonctionne Weekook ?', answer: "Weekook met en relation des passionnés de cuisine (les Kookers) avec des particuliers et des entreprises. Parcourez les profils de nos Kookers, découvrez leurs spécialités et leurs offres, puis réservez directement en ligne. Le Kooker se déplace chez vous ou dans le lieu de votre choix pour préparer un repas sur mesure. C'est simple, convivial et délicieux !" },
  { id: '2', category: 'general', question: "Quels types d'offres sont disponibles ?", answer: "Nos Kookers proposent des KOOK (repas à domicile) et des KOURS (cours de cuisine). Chaque Kooker définit ses propres offres avec ses tarifs et ses spécialités." },
  { id: '3', category: 'client', question: 'Comment réserver un Kooker ?', answer: "Créez un compte, parcourez les profils des Kookers disponibles, choisissez l'offre qui vous correspond, sélectionnez une date et confirmez votre réservation." },
  { id: '4', category: 'kooker', question: 'Comment devenir Kooker sur Weekook ?', answer: "Créez votre compte, cliquez sur \"Devenir Kooker\", remplissez votre profil et créez vos offres. Aucun diplôme de cuisine n'est requis !" },
  { id: '5', category: 'payment', question: 'Quand le Kooker est-il payé ?', answer: "Le Kooker reçoit son paiement après la réalisation de la prestation, une fois le bon déroulement confirmé." },
  { id: '6', category: 'trust', question: 'Les avis sont-ils vérifiés ?', answer: "Oui ! Seuls les clients ayant effectivement réalisé une réservation peuvent laisser un avis. Chaque avis est lié à une réservation confirmée." },
];

export default function AdminFaqPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New item form
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('general');

  useEffect(() => {
    document.title = 'Admin — FAQ | Weekook';
    loadFaqs();
  }, []);

  const loadFaqs = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ faqs?: FaqItem[] }>('/admin/config/public');
      if (res.success && res.data?.faqs && Array.isArray(res.data.faqs) && res.data.faqs.length > 0) {
        setFaqs(res.data.faqs);
      } else {
        setFaqs(DEFAULT_FAQS);
      }
    } catch {
      setFaqs(DEFAULT_FAQS);
    } finally {
      setLoading(false);
    }
  };

  const saveFaqs = async (updatedFaqs: FaqItem[]) => {
    setSaving(true);
    try {
      await api.put('/admin/config/faqs', { value: updatedFaqs });
      toast.success('FAQ sauvegardée');
      setFaqs(updatedFaqs);
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    const newItem: FaqItem = {
      id: Date.now().toString(),
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      category: newCategory,
    };
    const updated = [...faqs, newItem];
    saveFaqs(updated);
    setNewQuestion('');
    setNewAnswer('');
  };

  const deleteItem = (id: string) => {
    if (!confirm('Supprimer cette question ?')) return;
    saveFaqs(faqs.filter((f) => f.id !== id));
  };

  const updateItem = (id: string, field: keyof FaqItem, value: string) => {
    setFaqs((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const inputClass = 'w-full px-3 py-2 border border-[#e0e2ef] rounded-[8px] text-[13px] text-[#111125] bg-white focus:outline-none focus:border-[#c1a0fd] focus:ring-1 focus:ring-[#c1a0fd]/30 transition-all';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#c1a0fd] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#111125]">Gestion de la FAQ</h1>
          <p className="text-[13px] text-[#828294] mt-1">{faqs.length} question{faqs.length > 1 ? 's' : ''} · Les modifications sont sauvegardées immédiatement</p>
        </div>
        <button
          onClick={() => saveFaqs(faqs)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[13px] font-semibold rounded-[10px] transition-all disabled:opacity-50 cursor-pointer"
        >
          <Save size={14} />
          {saving ? 'Sauvegarde...' : 'Tout sauvegarder'}
        </button>
      </div>

      {/* FAQ List */}
      <div className="space-y-3 mb-8">
        {faqs.map((item) => (
          <div key={item.id} className="bg-white rounded-[16px] border border-[#e0e2ef] overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="flex-1 flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 bg-[#f3ecff] text-[#c1a0fd] text-[11px] font-semibold rounded-full mr-2">
                    {CATEGORIES.find((c) => c.id === item.category)?.label || item.category}
                  </span>
                  <span className="text-[14px] font-semibold text-[#111125]">{item.question}</span>
                </div>
                {expandedId === item.id ? <ChevronUp size={16} className="text-[#828294] shrink-0" /> : <ChevronDown size={16} className="text-[#828294] shrink-0" />}
              </button>
              <button
                onClick={() => deleteItem(item.id)}
                className="w-8 h-8 flex items-center justify-center text-[#828294] hover:text-red-500 hover:bg-red-50 rounded-[8px] transition-all cursor-pointer shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {expandedId === item.id && (
              <div className="border-t border-[#f0f0f5] p-4 space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#303044] mb-1">Catégorie</label>
                  <select
                    value={item.category}
                    onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                    className={inputClass + ' appearance-none'}
                  >
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#303044] mb-1">Question</label>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => updateItem(item.id, 'question', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#303044] mb-1">Réponse</label>
                  <textarea
                    value={item.answer}
                    onChange={(e) => updateItem(item.id, 'answer', e.target.value)}
                    rows={4}
                    className={inputClass + ' resize-none'}
                  />
                </div>
                <button
                  onClick={() => saveFaqs(faqs)}
                  disabled={saving}
                  className="h-[36px] px-4 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[13px] font-semibold rounded-[8px] transition-all disabled:opacity-50 cursor-pointer"
                >
                  Sauvegarder
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="bg-white rounded-[20px] border-2 border-dashed border-[#e0e2ef] p-6">
        <h2 className="text-[15px] font-bold text-[#111125] mb-4 flex items-center gap-2">
          <Plus size={16} className="text-[#c1a0fd]" />
          Ajouter une question
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-semibold text-[#303044] mb-1">Catégorie</label>
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className={inputClass + ' appearance-none'}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#303044] mb-1">Question</label>
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Ex: Comment fonctionne le paiement ?"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#303044] mb-1">Réponse</label>
            <textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Rédigez la réponse..."
              rows={3}
              className={inputClass + ' resize-none'}
            />
          </div>
          <button
            onClick={addItem}
            disabled={!newQuestion.trim() || !newAnswer.trim() || saving}
            className="h-[40px] px-5 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[13px] font-semibold rounded-[10px] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            <Plus size={14} />
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
