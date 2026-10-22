import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.message.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.serviceImage.deleteMany();
  await prisma.service.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.kookerSpecialty.deleteMany();
  await prisma.kookerProfile.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 12);

  // Create test user
  const testUser = await prisma.user.create({
    data: {
      email: 'user@weekook.fr',
      password: hashedPassword,
      firstName: 'Marie',
      lastName: 'Dubois',
      phone: '06 12 34 56 78',
      role: 'user',
    },
  });

  // Create kooker users
  const kooker1User = await prisma.user.create({
    data: {
      email: 'jean@weekook.fr',
      password: hashedPassword,
      firstName: 'Jean',
      lastName: 'Nerianafout',
      phone: '06 11 22 33 44',
      role: 'kooker',
    },
  });

  const kooker2User = await prisma.user.create({
    data: {
      email: 'nadine@weekook.fr',
      password: hashedPassword,
      firstName: 'Nadine',
      lastName: 'Houmouque',
      phone: '06 22 33 44 55',
      role: 'kooker',
    },
  });

  const kooker3User = await prisma.user.create({
    data: {
      email: 'andy@weekook.fr',
      password: hashedPassword,
      firstName: 'Andy',
      lastName: 'Vojambon',
      phone: '06 33 44 55 66',
      role: 'kooker',
    },
  });

  const kooker4User = await prisma.user.create({
    data: {
      email: 'jessica@weekook.fr',
      password: hashedPassword,
      firstName: 'Jessica',
      lastName: 'Naite-Danlefrigo',
      phone: '06 44 55 66 77',
      role: 'kooker',
    },
  });

  // Create kooker profiles
  const kooker1 = await prisma.kookerProfile.create({
    data: {
      userId: kooker1User.id,
      bio: 'Passionné de cuisine méditerranéenne depuis 15 ans. Spécialiste des plats traditionnels du sud de la France, je mets un point d\'honneur à utiliser des produits frais et locaux.',
      specialties: ['Méditerranéenne', 'Française'],
      type: ['KOOK', 'COURS'],
      city: 'Marseille',
      experience: '15 ans',
      rating: 4.8,
      reviewCount: 24,
      featured: true,
      active: true,
    },
  });

  const kooker2 = await prisma.kookerProfile.create({
    data: {
      userId: kooker2User.id,
      bio: 'Chef à domicile spécialisée dans la cuisine orientale et les saveurs du Maghreb. Mes plats sont un voyage gustatif entre tradition et modernité.',
      specialties: ['Orientale', 'Maghreb'],
      type: ['KOOK'],
      city: 'Lyon',
      experience: '10 ans',
      rating: 4.9,
      reviewCount: 18,
      featured: true,
      active: true,
    },
  });

  const kooker3 = await prisma.kookerProfile.create({
    data: {
      userId: kooker3User.id,
      bio: 'Cuisinier autodidacte passionné par la cuisine asiatique. Je propose des cours interactifs pour apprendre les bases de la cuisine thaï, vietnamienne et japonaise.',
      specialties: ['Asiatique', 'Thaï'],
      type: ['COURS'],
      city: 'Paris',
      experience: '8 ans',
      rating: 4.7,
      reviewCount: 31,
      featured: true,
      active: true,
    },
  });

  const kooker4 = await prisma.kookerProfile.create({
    data: {
      userId: kooker4User.id,
      bio: 'Pâtissière de formation, je partage ma passion pour les desserts et la cuisine sucrée. Cours de pâtisserie et repas complets avec desserts d\'exception.',
      specialties: ['Pâtisserie', 'Française'],
      type: ['KOOK', 'COURS'],
      city: 'Marseille',
      experience: '12 ans',
      rating: 4.6,
      reviewCount: 15,
      featured: true,
      active: true,
    },
  });

  // Create specialties
  const specialties = ['Méditerranéenne', 'Française', 'Orientale', 'Maghreb', 'Asiatique', 'Thaï', 'Italienne', 'Pâtisserie', 'Végétarienne', 'Mexicaine'];
  for (const name of specialties) {
    await prisma.kookerSpecialty.create({ data: { name } });
  }

  // Create services for kooker1
  const service1 = await prisma.service.create({
    data: {
      kookerProfileId: kooker1.id,
      title: 'Bouillabaisse Marseillaise Traditionnelle',
      description: 'Découvrez la vraie bouillabaisse marseillaise, préparée avec des poissons frais du Vieux-Port. Un repas complet pour 6 à 10 personnes.',
      type: ['KOOK'],
      priceInCents: 4500,
      durationMinutes: 180,
      maxGuests: 10,
      allergens: ['Poisson', 'Crustacés'],
      active: true,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      { serviceId: service1.id, category: 'Entrée', name: 'Soupe de poissons maison', description: 'Avec rouille et croûtons', sortOrder: 1 },
      { serviceId: service1.id, category: 'Plat', name: 'Bouillabaisse traditionnelle', description: 'Poissons de roche, pommes de terre, safran', sortOrder: 2 },
      { serviceId: service1.id, category: 'Dessert', name: 'Navette marseillaise', description: 'Biscuit traditionnel à la fleur d\'oranger', sortOrder: 3 },
    ],
  });

  const service2 = await prisma.service.create({
    data: {
      kookerProfileId: kooker1.id,
      title: 'Cours de cuisine provençale',
      description: 'Apprenez les secrets de la cuisine provençale : ratatouille, tapenade, aïoli... 3h de cours pratique avec dégustation.',
      type: ['COURS'],
      priceInCents: 5500,
      durationMinutes: 180,
      maxGuests: 6,
      allergens: [],
      active: true,
    },
  });

  // Services for kooker2
  await prisma.service.create({
    data: {
      kookerProfileId: kooker2.id,
      title: 'Couscous Royal fait maison',
      description: 'Un couscous royal généreux avec agneau, merguez et poulet. Semoule roulée à la main.',
      type: ['KOOK'],
      priceInCents: 3500,
      durationMinutes: 150,
      maxGuests: 12,
      allergens: ['Gluten'],
      active: true,
    },
  });

  // Services for kooker3
  await prisma.service.create({
    data: {
      kookerProfileId: kooker3.id,
      title: 'Initiation à la cuisine thaï',
      description: 'Pad Thaï, curry vert, tom yum... Apprenez les bases de la cuisine thaïlandaise avec des produits authentiques.',
      type: ['COURS'],
      priceInCents: 6000,
      durationMinutes: 180,
      maxGuests: 8,
      allergens: ['Crustacés', 'Arachides'],
      active: true,
    },
  });

  // Services for kooker4
  await prisma.service.create({
    data: {
      kookerProfileId: kooker4.id,
      title: 'Atelier macarons parisiens',
      description: 'Maîtrisez l\'art du macaron : coques parfaites, ganaches variées. Repartez avec votre production !',
      type: ['COURS'],
      priceInCents: 4500,
      durationMinutes: 150,
      maxGuests: 6,
      allergens: ['Gluten', 'Oeufs', 'Fruits à coque'],
      active: true,
    },
  });

  // Create availabilities for the next 2 weeks
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    // Skip some days randomly for variety
    if (i % 3 === 0) continue;

    for (const kooker of [kooker1, kooker2, kooker3, kooker4]) {
      await prisma.availability.create({
        data: {
          kookerProfileId: kooker.id,
          date,
          startTime: '10:00',
          endTime: '14:00',
          isAvailable: true,
        },
      });

      if (i % 2 === 0) {
        await prisma.availability.create({
          data: {
            kookerProfileId: kooker.id,
            date,
            startTime: '18:00',
            endTime: '22:00',
            isAvailable: true,
          },
        });
      }
    }
  }

  // Create testimonials
  await prisma.testimonial.createMany({
    data: [
      {
        kookerProfileId: kooker1.id,
        authorName: 'Marie Dubois',
        authorRole: 'Cliente',
        content: 'Une expérience culinaire incroyable ! Le kooker a su s\'adapter à mes goûts et créer un menu délicieux. Je recommande vivement Weekook pour découvrir de nouvelles saveurs.',
        rating: 5,
        featured: true,
      },
      {
        kookerProfileId: kooker3.id,
        authorName: 'Thomas Bernard',
        authorRole: 'Client',
        content: 'J\'ai découvert la cuisine italienne authentique grâce à un kooker passionné. Les cours sont conviviaux et on repart avec de vraies compétences. Merci Weekook !',
        rating: 5,
        featured: true,
      },
      {
        kookerProfileId: kooker2.id,
        authorName: 'Sophie Laurent',
        authorRole: 'Cliente',
        content: 'Parfait pour les soirées entre amis ! Le kooker vient chez vous et prépare un repas exquis. Une expérience unique que je recommande à tous les gourmets.',
        rating: 5,
        featured: true,
      },
      {
        kookerProfileId: kooker4.id,
        authorName: 'Julie Petit',
        authorRole: 'Cliente',
        content: 'Les kours de pâtisserie sont géniaux ! J\'ai appris à faire des macarons parfaits. Le kooker était patient et pédagogue. Une belle découverte.',
        rating: 5,
        featured: true,
      },
      {
        kookerProfileId: kooker1.id,
        authorName: 'Alexandre Moreau',
        authorRole: 'Client',
        content: 'Service impeccable ! Le repas préparé était délicieux et la présentation soignée. Weekook a transformé notre anniversaire en moment mémorable.',
        rating: 5,
        featured: true,
      },
    ],
  });

  // Create reviews
  await prisma.review.createMany({
    data: [
      { userId: testUser.id, kookerProfileId: kooker1.id, rating: 5, comment: 'Excellent repas, la bouillabaisse était exceptionnelle !' },
      { userId: testUser.id, kookerProfileId: kooker2.id, rating: 5, comment: 'Le couscous était délicieux, comme au bled !' },
      { userId: testUser.id, kookerProfileId: kooker3.id, rating: 4, comment: 'Très bon cours, j\'ai appris plein de choses.' },
    ],
  });

  // Create a sample booking
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);

  await prisma.booking.create({
    data: {
      userId: testUser.id,
      kookerProfileId: kooker1.id,
      serviceId: service1.id,
      date: futureDate,
      startTime: '19:00',
      endTime: '22:00',
      guests: 6,
      totalPriceInCents: 27000,
      status: 'confirmed',
      notes: 'Anniversaire de mariage',
    },
  });

  console.log('Seed completed successfully!');
  console.log(`Created ${5} users, ${4} kooker profiles, ${5} services, ${5} testimonials`);
  console.log('\nTest accounts:');
  console.log('  User: user@weekook.fr / password123');
  console.log('  Kooker: jean@weekook.fr / password123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
