import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth);

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().optional().nullable(),
  unitPrice: z.number().nonnegative(),
  minStockAlert: z.number().int().nonnegative().default(0),
  location: z.string().optional().nullable(),
});

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
    const search = (req.query.search as string) || "";

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { sku: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id as string },
      include: { stockMovements: { orderBy: { createdAt: "desc" }, take: 50 } },
    });
    if (!product) throw new ApiError(404, "Product not found");
    res.json(product);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("ADMIN", "WAREHOUSE"), async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existing) throw new ApiError(409, "SKU already exists");

    const product = await prisma.product.create({ data: { ...data, currentStock: 0 } });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("ADMIN", "WAREHOUSE"), async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id as string }, data });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

const stockMovementSchema = z.object({
  quantity: z.number().int().positive(),
  type: z.enum(["IN", "OUT"]),
  reason: z.string().min(1),
});

// Records a manual stock movement (e.g. purchase receipt, damage write-off,
// stock correction) — separate from the automatic OUT movements that happen
// when a sales challan is confirmed (see challans.ts).
router.post("/:id/stock-movements", requireRole("ADMIN", "WAREHOUSE"), async (req, res, next) => {
  try {
    const data = stockMovementSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: req.params.id as string } });
      if (!product) throw new ApiError(404, "Product not found");

      const delta = data.type === "IN" ? data.quantity : -data.quantity;
      const newStock = product.currentStock + delta;
      if (newStock < 0) throw new ApiError(400, "Stock cannot go negative");

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: data.quantity,
          type: data.type,
          reason: data.reason,
          createdById: req.user!.userId,
        },
      });

      await tx.product.update({ where: { id: product.id }, data: { currentStock: newStock } });

      return movement;
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
