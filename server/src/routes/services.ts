import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireKooker } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createServiceSchema, updateServiceSchema } from '../schemas/service.js';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';
import { assertAllowedSpecialties } from '../utils/specialties.js';

const router = Router();

// GET /kooker/:id - Get all services for a kooker profile
router.get('/kooker/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kookerProfileId = parseInt(req.params.id, 10);
    if (isNaN(kookerProfileId)) {
      throw new AppError('ID invalide', 400);
    }

    const services = await prisma.service.findMany({
      where: { kookerProfileId },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        menuItems: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: services,
    });
  } catch (error) {
    next(error);
  }
});

// GET /search - Search services with filters
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      q,
      type,
      specialty,
      city,
      minPrice,
      maxPrice,
      featured,
      date,
      lat,
      lng,
      radius,
      page = '1',
      limit = '12',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
    const skip = (pageNum - 1) * limitNum;

    const kookerFilter: Record<string, unknown> = { active: true };
    if (featured === 'true') kookerFilter.featured = true;
    if (city) kookerFilter.city = { contains: city };

    // Recherche par localisation (#82) : un kooker ressort si le lieu recherché est
    // dans sa zone d'intervention, ou à moins de `radius` km (distance que le client
    // accepte de parcourir, ex : Kours chez le kooker).
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    let distanceByKooker: Map<number, number> | null = null;
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      const clientRadius = Math.min(200, Math.max(0, parseInt(radius) || 0));
      const rows = await prisma.$queryRaw<{ id: number; distance: number }[]>`
        SELECT id, distance FROM (
          SELECT id, service_radius_km,
            6371 * 2 * ASIN(SQRT(
              POWER(SIN(RADIANS(latitude - ${latNum}) / 2), 2) +
              COS(RADIANS(${latNum})) * COS(RADIANS(latitude)) *
              POWER(SIN(RADIANS(longitude - ${lngNum}) / 2), 2)
            )) AS distance
          FROM kooker_profiles
          WHERE active = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL
        ) k
        WHERE distance <= GREATEST(service_radius_km, ${clientRadius})
      `;
      distanceByKooker = new Map(rows.map((r) => [Number(r.id), Number(r.distance)]));
      kookerFilter.id = { in: [...distanceByKooker.keys()] };
    }
    // Spécialité : celle du kooker ou celle de la prestation (listes JSON)
    const specialtyFilter = specialty
      ? [
          { kookerProfile: { specialties: { array_contains: [specialty] } } },
          { specialty: { array_contains: [specialty] } },
        ]
      : null;
    if (date) {
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        kookerFilter.availabilities = { some: { date: dateObj, isAvailable: true } };
      }
    }

    const serviceWhere: Record<string, unknown> = {
      active: true,
      kookerProfile: kookerFilter,
    };
    // AND : la recherche texte (q) utilise déjà OR
    if (specialtyFilter) serviceWhere.AND = [{ OR: specialtyFilter }];
    // `type` est stocké en tableau JSON (["KOOK"], ["COURS"], ["KOOK","COURS"])
    if (type) serviceWhere.type = { array_contains: [type] };
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {};
      if (minPrice) priceFilter.gte = Math.round(parseFloat(minPrice) * 100);
      if (maxPrice) priceFilter.lte = Math.round(parseFloat(maxPrice) * 100);
      serviceWhere.priceInCents = priceFilter;
    }
    if (q) {
      // Spécialités kooker (liste JSON) : recherche partielle, insensible à la casse
      const specialtyMatches = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM kooker_profiles
        WHERE LOWER(CAST(specialties AS CHAR)) LIKE CONCAT('%', LOWER(${q}), '%')
      `;
      serviceWhere.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { kookerProfile: { user: { firstName: { contains: q } } } },
        { kookerProfile: { user: { lastName: { contains: q } } } },
        { kookerProfileId: { in: specialtyMatches.map((r) => Number(r.id)) } },
      ];
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where: serviceWhere as any,
        include: {
          images: {
            take: 2,
            orderBy: { sortOrder: 'asc' },
          },
          kookerProfile: {
            select: {
              id: true,
              city: true,
              rating: true,
              reviewCount: true,
              featured: true,
              verified: true,
              user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
            },
          },
        },
        orderBy: [
          { kookerProfile: { featured: 'desc' } } as any,
          { kookerProfile: { rating: 'desc' } } as any,
        ],
        skip,
        take: limitNum,
      }),
      prisma.service.count({ where: serviceWhere as any }),
    ]);

    res.json({
      success: true,
      data: {
        services: distanceByKooker
          ? services.map((s) => ({ ...s, distanceKm: Math.round((distanceByKooker!.get(s.kookerProfileId) ?? 0) * 10) / 10 }))
          : services,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /:id - Get single service
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('ID invalide', 400);
    }

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        menuItems: { orderBy: { sortOrder: 'asc' } },
        kookerProfile: {
          select: {
            id: true,
            city: true,
            rating: true,
            reviewCount: true,
            bio: true,
            specialties: true,
            experience: true,
            featured: true,
            verified: true,
            user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundError('Service non trouvé');
    }

    res.json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
});

// POST / - Create service
router.post(
  '/',
  authenticate,
  requireKooker,
  validate(createServiceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kookerProfileId = req.user!.kookerProfileId!;
      const {
        title,
        description,
        type,
        priceInCents,
        durationMinutes,
        minGuests,
        maxGuests,
        allergens,
        constraints,
        specialty,
        prepTimeMinutes,
        ingredientsIncluded,
        equipmentProvided,
        ingredientsList,
        ingredientsBaseServings,
        ingredientsPricePerGuestInCents,
        ingredientsDefaultSource,
        equipmentKooker,
        extraGuestPriceInCents,
        koursDifficulty,
        koursLocation,
        menuItems,
      } = req.body;

      await assertAllowedSpecialties(specialty);

      const service = await prisma.service.create({
        data: {
          kookerProfileId,
          title,
          description,
          type,
          priceInCents,
          durationMinutes,
          minGuests: minGuests ?? null,
          maxGuests,
          allergens: allergens || null,
          constraints: constraints || null,
          specialty: specialty || null,
          prepTimeMinutes: prepTimeMinutes ?? null,
          ingredientsIncluded: ingredientsIncluded ?? false,
          equipmentProvided: equipmentProvided ?? false,
          ingredientsList: ingredientsList || null,
          ingredientsBaseServings: ingredientsBaseServings ?? null,
          ingredientsPricePerGuestInCents: ingredientsPricePerGuestInCents ?? null,
          ingredientsDefaultSource: ingredientsDefaultSource ?? 'client',
          equipmentKooker: equipmentKooker || null,
          extraGuestPriceInCents: extraGuestPriceInCents ?? null,
          koursDifficulty: koursDifficulty ?? null,
          koursLocation: koursLocation ?? null,
          menuItems: menuItems
            ? {
                create: menuItems.map(
                  (item: { category: string; name: string; description?: string }, index: number) => ({
                    category: item.category,
                    name: item.name,
                    description: item.description,
                    sortOrder: index,
                  })
                ),
              }
            : undefined,
        },
      });

      // After creating the service, associate images if provided
      const { images } = req.body;
      if (images && Array.isArray(images) && images.length > 0) {
        await prisma.serviceImage.createMany({
          data: images.map((url: string, index: number) => ({
            serviceId: service.id,
            url,
            alt: title || '',
            sortOrder: index,
          })),
        });
      }

      // Re-fetch with images included
      const serviceWithImages = await prisma.service.findUnique({
        where: { id: service.id },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          menuItems: { orderBy: { sortOrder: 'asc' } },
        },
      });

      res.status(201).json({
        success: true,
        data: serviceWithImages,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /card-image/:imageId - Set card image for kooker (clears others)
router.put(
  '/card-image/:imageId',
  authenticate,
  requireKooker,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageId = parseInt(req.params.imageId, 10);
      if (isNaN(imageId)) throw new AppError('ID invalide', 400);

      const kookerProfileId = req.user!.kookerProfileId!;

      // Verify the image belongs to a service owned by this kooker
      const image = await prisma.serviceImage.findUnique({
        where: { id: imageId },
        include: { service: { select: { kookerProfileId: true } } },
      });
      if (!image) throw new NotFoundError('Image non trouvée');
      if (image.service.kookerProfileId !== kookerProfileId) throw new ForbiddenError('Accès refusé');

      // Get all service IDs for this kooker
      const kookerServices = await prisma.service.findMany({
        where: { kookerProfileId },
        select: { id: true },
      });
      const serviceIds = kookerServices.map((s) => s.id);

      // Clear all card images for this kooker's services
      await prisma.serviceImage.updateMany({
        where: { serviceId: { in: serviceIds } },
        data: { isCardImage: false },
      });

      // Set this image as card image
      await prisma.serviceImage.update({
        where: { id: imageId },
        data: { isCardImage: true },
      });

      res.json({ success: true, data: { imageId } });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id - Update service
router.put(
  '/:id',
  authenticate,
  requireKooker,
  validate(updateServiceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('ID invalide', 400);
      }

      const kookerProfileId = req.user!.kookerProfileId!;

      // Verify ownership
      const existing = await prisma.service.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundError('Service non trouvé');
      }
      if (existing.kookerProfileId !== kookerProfileId) {
        throw new ForbiddenError('Vous ne pouvez modifier que vos propres services');
      }

      const {
        title,
        description,
        type,
        priceInCents,
        durationMinutes,
        minGuests,
        maxGuests,
        active,
        allergens,
        constraints,
        specialty,
        prepTimeMinutes,
        ingredientsIncluded,
        equipmentProvided,
        ingredientsList,
        ingredientsBaseServings,
        ingredientsPricePerGuestInCents,
        ingredientsDefaultSource,
        equipmentKooker,
        extraGuestPriceInCents,
        menuItems,
      } = req.body;

      await assertAllowedSpecialties(specialty, existing.specialty);

      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (type !== undefined) data.type = type;
      if (priceInCents !== undefined) data.priceInCents = priceInCents;
      if (durationMinutes !== undefined) data.durationMinutes = durationMinutes;
      if (minGuests !== undefined) data.minGuests = minGuests;
      if (maxGuests !== undefined) data.maxGuests = maxGuests;
      if (active !== undefined) data.active = active;
      if (allergens !== undefined) data.allergens = allergens;
      if (constraints !== undefined) data.constraints = constraints;
      if (specialty !== undefined) data.specialty = specialty;
      if (prepTimeMinutes !== undefined) data.prepTimeMinutes = prepTimeMinutes;
      if (ingredientsIncluded !== undefined) data.ingredientsIncluded = ingredientsIncluded;
      if (equipmentProvided !== undefined) data.equipmentProvided = equipmentProvided;
      if (ingredientsList !== undefined) data.ingredientsList = ingredientsList;
      if (ingredientsBaseServings !== undefined) data.ingredientsBaseServings = ingredientsBaseServings;
      if (ingredientsPricePerGuestInCents !== undefined) data.ingredientsPricePerGuestInCents = ingredientsPricePerGuestInCents;
      if (ingredientsDefaultSource !== undefined) data.ingredientsDefaultSource = ingredientsDefaultSource;
      if (equipmentKooker !== undefined) data.equipmentKooker = equipmentKooker;
      if (extraGuestPriceInCents !== undefined) data.extraGuestPriceInCents = extraGuestPriceInCents;

      // If menuItems provided, replace all
      if (menuItems !== undefined) {
        await prisma.menuItem.deleteMany({ where: { serviceId: id } });
        if (menuItems.length > 0) {
          await prisma.menuItem.createMany({
            data: menuItems.map(
              (item: { category: string; name: string; description?: string }, index: number) => ({
                serviceId: id,
                category: item.category,
                name: item.name,
                description: item.description,
                sortOrder: index,
              })
            ),
          });
        }
      }

      // If images provided, replace all (preserving isCardImage by URL match)
      const { images } = req.body;
      if (images !== undefined) {
        const prevCardImage = await prisma.serviceImage.findFirst({
          where: { serviceId: id, isCardImage: true },
          select: { url: true },
        });
        await prisma.serviceImage.deleteMany({ where: { serviceId: id } });
        if (Array.isArray(images) && images.length > 0) {
          await prisma.serviceImage.createMany({
            data: images.map((url: string, index: number) => ({
              serviceId: id,
              url,
              alt: data.title as string || existing.title || '',
              sortOrder: index,
              isCardImage: prevCardImage ? url === prevCardImage.url : false,
            })),
          });
        }
      }

      const updated = await prisma.service.update({
        where: { id },
        data,
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          menuItems: { orderBy: { sortOrder: 'asc' } },
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:id - Delete service
router.delete(
  '/:id',
  authenticate,
  requireKooker,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('ID invalide', 400);
      }

      const kookerProfileId = req.user!.kookerProfileId!;

      // Verify ownership
      const existing = await prisma.service.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundError('Service non trouvé');
      }
      if (existing.kookerProfileId !== kookerProfileId) {
        throw new ForbiddenError('Vous ne pouvez supprimer que vos propres services');
      }

      await prisma.service.delete({ where: { id } });

      res.json({
        success: true,
        data: { message: 'Service supprimé avec succès' },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
