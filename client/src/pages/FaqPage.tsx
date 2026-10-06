import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

// ─── Data ────────────────────────────────────────────────────────────────────

const FAQ_CATEGORIES = [
  { id: 'all', label: 'Toutes' },
  { id: 'general', label: 'Comment ça marche' },
  { id: 'client', label: 'Pour les clients' },
  { id: 'kooker', label: 'Pour les Kookers' },
  { id: 'payment', label: 'Paiement & Tarifs' },
  { id: 'trust', label: 'Sécurité & Confiance' },
];

const FAQ_ITEMS = [
  {
    category: 'general',
    question: 'Comment fonctionne Weekook ?',
    answer:
      "Weekook met en relation des passionnés de cuisine (les Kookers) avec des particuliers et des entreprises. Parcourez les profils de nos Kookers, découvrez leurs spécialités et leurs offres, puis réservez directement en ligne. Le Kooker se déplace chez vous ou dans le lieu de votre choix pour préparer un repas sur mesure. C'est simple, convivial et délicieux !",
  },
  {
    category: 'general',
    question: "Quels types d'offres sont disponibles sur la plateforme ?",
    answer:
      "Nos Kookers proposent une grande variété d'offres : des repas à domicile pour des événements (anniversaires, mariages, team building), des cours de cuisine personnalisés (Kours), des préparations de batch cooking pour la semaine, et même des ateliers thématiques. Chaque Kooker définit ses propres offres avec ses tarifs et ses spécialités.",
  },
  {
    category: 'general',
    question: 'Dans quelles villes Weekook est-il disponible ?',
    answer:
      "Weekook est actuellement disponible dans la région PACA : Marseille, Aix-en-Provence, Cassis, Aubagne, La Ciotat et les communes environnantes. Nous développons progressivement notre couverture géographique. Si votre ville n'est pas encore couverte, inscrivez-vous et nous vous tiendrons informé du lancement dans votre région.",
  },
  {
    category: 'client',
    question: 'Comment réserver un Kooker ?',
    answer:
      "C'est très simple ! Créez un compte, parcourez les profils des Kookers disponibles près de chez vous, choisissez l'offre qui vous correspond, sélectionnez une date et un horaire, puis confirmez votre réservation. Vous recevrez une confirmation par email et le Kooker sera notifié automatiquement.",
  },
  {
    category: 'client',
    question: 'Puis-je annuler ou modifier ma réservation ?',
    answer:
      "Oui, vous pouvez annuler votre réservation directement depuis votre tableau de bord. Les conditions d'annulation dépendent du délai avant la prestation. Nous vous recommandons de prévenir le Kooker le plus tôt possible. En cas de force majeure, notre service client est disponible pour vous accompagner.",
  },
  {
    category: 'client',
    question: 'Combien de personnes peut accueillir un Kooker ?',
    answer:
      "Chaque offre précise le nombre maximum d'invités (indiqué sur la fiche du service). Certains Kookers sont spécialisés dans les petits comités (2 à 8 personnes), d'autres peuvent gérer des événements jusqu'à 50 personnes. Le prix est généralement calculé par personne.",
  },
  {
    category: 'client',
    question: 'Que se passe-t-il si je ne suis pas satisfait ?',
    answer:
      "Votre satisfaction est notre priorité. Si la prestation ne correspond pas à vos attentes, contactez notre service client dans les 24h. Vous pouvez également laisser un avis sur le profil du Kooker. Nous examinons chaque réclamation et intervenons rapidement pour trouver une solution adaptée.",
  },
  {
    category: 'kooker',
    question: 'Comment devenir Kooker sur Weekook ?',
    answer:
      "Devenir Kooker est simple et gratuit ! Créez votre compte, puis cliquez sur \"Devenir Kooker\" pour remplir votre profil : spécialités, expérience, ville et biographie. Une fois votre profil complété, vous pouvez créer vos offres et commencer à recevoir des réservations. Aucun diplôme de cuisine n'est requis, seule la passion compte !",
  },
  {
    category: 'kooker',
    question: 'Comment fixer mes tarifs en tant que Kooker ?',
    answer:
      "Vous êtes entièrement libre de fixer vos tarifs ! Le prix est défini par prestation ou par personne selon votre offre. Nous vous recommandons de tenir compte de votre niveau d'expérience, du type de cuisine, des ingrédients nécessaires et du temps de préparation. Vous pouvez modifier vos tarifs à tout moment depuis votre tableau de bord.",
  },
  {
    category: 'kooker',
    question: 'Comment gérer mes disponibilités ?',
    answer:
      "Depuis votre tableau de bord Kooker, accédez à l'onglet \"Disponibilités\" pour définir vos jours et horaires de disponibilité. Vous pouvez bloquer des dates, définir des créneaux récurrents et gérer vos réservations entrantes. Les clients ne peuvent réserver que sur les créneaux que vous avez marqués comme disponibles.",
  },
  {
    category: 'kooker',
    question: 'Puis-je refuser une réservation ?',
    answer:
      "Oui, vous avez la possibilité d'accepter ou de refuser chaque demande de réservation depuis votre tableau de bord. Nous vous encourageons à répondre rapidement (idéalement sous 24h) pour offrir une bonne expérience aux clients. Les réservations en attente expirées automatiquement sont comptabilisées dans vos statistiques.",
  },
  {
    category: 'payment',
    question: 'Quels sont les tarifs et comment se passent les paiements ?',
    answer:
      "Les tarifs sont fixés librement par chaque Kooker. Le paiement s'effectue en ligne de manière sécurisée lors de la réservation. Le montant est bloqué jusqu'à la réalisation de la prestation, puis reversé au Kooker. Weekook prélève une commission de service transparente. Aucun frais caché !",
  },
  {
    category: 'payment',
    question: 'Quand le Kooker est-il payé ?',
    answer:
      "Le Kooker reçoit son paiement après la réalisation de la prestation, une fois que le client a confirmé son bon déroulement (ou après un délai automatique de 48h). Les virements sont effectués sur le compte bancaire renseigné dans le tableau de bord Kooker.",
  },
  {
    category: 'payment',
    question: 'Les prix affichés incluent-ils tous les frais ?',
    answer:
      "Le prix affiché sur chaque offre est le prix par personne, hors frais de service Weekook. Le total final (incluant la commission) vous est présenté clairement avant la confirmation de votre réservation. Aucune surprise à la caisse !",
  },
  {
    category: 'trust',
    question: 'Comment sont garantis la qualité et la sécurité ?',
    answer:
      "La sécurité et la qualité sont au cœur de notre plateforme. Chaque Kooker est vérifié lors de son inscription. Les avis et notes des clients sont publiés en toute transparence. Nous proposons également une assurance responsabilité civile pour chaque prestation. En cas de problème, notre service client est disponible 7j/7.",
  },
  {
    category: 'trust',
    question: 'Les avis sont-ils vérifiés ?',
    answer:
      "Oui ! Seuls les clients ayant effectivement réalisé une réservation avec le Kooker peuvent laisser un avis. Chaque avis est lié à une réservation confirmée, ce qui garantit l'authenticité de tous les commentaires affichés sur notre plateforme.",
  },
  {
    category: 'trust',
    question: 'Mes données personnelles sont-elles protégées ?',
    answer:
      "Absolument. Weekook respecte scrupuleusement le RGPD. Vos données personnelles ne sont jamais revendues à des tiers. Les paiements sont traités par des prestataires certifiés PCI-DSS. Vous pouvez demander la suppression de votre compte et de vos données à tout moment depuis vos paramètres.",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function FaqPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('all');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [faqItems, setFaqItems] = useState(FAQ_ITEMS);

  useEffect(() => {
    document.title = 'FAQ | Weekook';
    api.get<{ faqs?: typeof FAQ_ITEMS }>('/admin/config/public').then((res) => {
      if (res.success && res.data?.faqs && Array.isArray(res.data.faqs) && res.data.faqs.length > 0) {
        setFaqItems(res.data.faqs);
      }
    }).catch(() => {});
  }, []);

  const filtered = activeCategory === 'all'
    ? faqItems
    : faqItems.filter((item) => item.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#f2f4fc]" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="px-4 md:px-8 lg:px-[96px] pt-[48px] md:pt-[64px] pb-[40px] md:pb-[56px]">
        <div className="text-center max-w-[640px] mx-auto">
          <p className="text-[#cdb3fd] text-[14px] md:text-[16px] tracking-[2.56px] uppercase font-semibold mb-3">
            AIDE
          </p>
          <h1 className="text-[#111125] text-[32px] md:text-[40px] lg:text-[48px] font-semibold leading-tight tracking-[-0.96px] mb-4">
            Questions fréquentes
          </h1>
          <p className="text-[#5c5c6f] text-[15px] md:text-[17px] leading-relaxed">
            Vous avez une question ? Trouvez rapidement la réponse parmi nos rubriques ou contactez-nous directement.
          </p>
        </div>
      </section>

      {/* ── Category Tabs ─────────────────────────────────────────────── */}
      <section className="px-4 md:px-8 lg:px-[96px] mb-8">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setOpenIndex(null); }}
              className={`px-4 md:px-5 py-2 rounded-[12px] text-[14px] font-medium transition-all duration-200 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#c1a0fd] text-white shadow-sm'
                  : 'bg-white text-[#5c5c6f] border border-[#e0e0e6] hover:border-[#c1a0fd] hover:text-[#c1a0fd]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── FAQ Accordion ─────────────────────────────────────────────── */}
      <section className="px-4 md:px-8 lg:px-[96px] pb-[64px] md:pb-[80px]">
        <div className="max-w-[800px] mx-auto flex flex-col gap-3">
          {filtered.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={`rounded-[16px] border-2 transition-all duration-300 ${
                  isOpen
                    ? 'bg-white border-[#c1a0fd]'
                    : 'bg-white border-[#e6d9fe] hover:border-[#c1a0fd]/50'
                }`}
              >
                {/* Question */}
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-5 md:p-6 cursor-pointer text-left"
                >
                  <span
                    className={`font-semibold text-[15px] md:text-[16px] pr-4 transition-colors ${
                      isOpen ? 'text-[#c1a0fd]' : 'text-[#111125]'
                    }`}
                  >
                    {item.question}
                  </span>
                  <div
                    className={`flex-shrink-0 w-[32px] h-[32px] md:w-[36px] md:h-[36px] rounded-full flex items-center justify-center transition-colors ${
                      isOpen ? 'bg-[#c1a0fd]' : 'bg-[#f3ecff]'
                    }`}
                  >
                    {isOpen ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M12 4L4 12M4 4L12 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 3V13M3 8H13" stroke="#c1a0fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>

                {/* Answer */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-5 md:px-6 pb-5 md:pb-6">
                    <p className="text-[#5c5c6f] text-[14px] md:text-[15px] leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA Contact ───────────────────────────────────────────────── */}
      <section className="px-4 md:px-8 lg:px-[96px] pb-[64px] md:pb-[80px]">
        <div className="max-w-[800px] mx-auto bg-gradient-to-r from-[#c1a0fd] to-[#9b7dd4] rounded-[20px] p-8 md:p-12 text-center">
          <h2 className="text-white text-[24px] md:text-[28px] font-semibold mb-3">
            Vous n'avez pas trouvé votre réponse ?
          </h2>
          <p className="text-white/80 text-[15px] md:text-[16px] mb-8 max-w-[480px] mx-auto">
            Notre équipe est disponible pour vous aider. Contactez-nous directement ou rejoignez la communauté Weekook.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => navigate('/contact')}
              className="h-[52px] px-8 rounded-[12px] bg-white text-[#c1a0fd] font-semibold text-[15px] hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Nous contacter
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
