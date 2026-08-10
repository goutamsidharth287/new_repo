import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth);

const challanItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const createChallanSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(challanItemSchema).min(1),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
});

async function generateChallanNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.challan.count();
  return `CH-${year}-${String(count + 1).padStart(5, "0")}`;
}

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
    const status = req.query.status as string | undefined;

    const where = status ? { status: status as any } : {};

    const [items, total] = await Promise.all([
      prisma.challan.findMany({
        where,
        include: { customer: true, items: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.challan.count({ where }),
    ]);

    res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const challan = await prisma.challan.findUnique({
      where: { id: req.params.id as string },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!challan) throw new ApiError(404, "Challan not found");
    res.json(challan);
  } catch (err) {
    next(err);
  }
});

// Creates a challan. If status is CONFIRMED at creation time, stock is
// reduced immediately within the same transaction. If DRAFT, no stock
// impact happens until it's confirmed via PATCH /:id/confirm.
router.post("/", requireRole("ADMIN", "SALES"), async (req, res, next) => {
  try {
    const data = createChallanSchema.parse(req.body);

    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new ApiError(404, "Customer not found");

    const products = await prisma.product.findMany({
      where: { id: { in: data.items.map((i) => i.productId) } },
    });
    if (products.length !== data.items.length) {
      throw new ApiError(400, "One or more products not found");
    }

    const challanNumber = await generateChallanNumber();
    const totalQuantity = data.items.reduce((sum, i) => sum + i.quantity, 0);

    const challan = await prisma.$transaction(async (tx) => {
      if (data.status === "CONFIRMED") {
        // Validate stock availability for every line before touching anything.
        for (const item of data.items) {
          const product = products.find((p) => p.id === item.productId)!;
          if (product.currentStock < item.quantity) {
            throw new ApiError(
              400,
              `Insufficient stock for ${product.name} (available: ${product.currentStock}, requested: ${item.quantity})`
            );
          }
        }
      }

      const created = await tx.challan.create({
        data: {
          challanNumber,
          customerId: data.customerId,
          totalQuantity,
          status: data.status,
          createdById: req.user!.userId,
          items: {
            create: data.items.map((item) => {
              const product = products.find((p) => p.id === item.productId)!;
              return {
                productId: product.id,
                productNameSnap: product.name,
                productSkuSnap: product.sku,
                unitPriceSnap: product.unitPrice,
                quantity: item.quantity,
              };
            }),
          },
        },
        include: { items: true },
      });

      if (data.status === "CONFIRMED") {
        for (const item of data.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: "OUT",
              reason: `Sales challan ${challanNumber}`,
              createdById: req.user!.userId,
            },
          });
        }
      }

      return created;
    });

    res.status(201).json(challan);
  } catch (err) {
    next(err);
  }
});

// Confirms a draft challan: re-validates stock and reduces it atomically.
router.patch("/:id/confirm", requireRole("ADMIN", "SALES"), async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const challan = await tx.challan.findUnique({
        where: { id: req.params.id as string },
        include: { items: true },
      });
      if (!challan) throw new ApiError(404, "Challan not found");
      if (challan.status !== "DRAFT") {
        throw new ApiError(400, `Cannot confirm a challan with status ${challan.status}`);
      }

      for (const item of challan.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new ApiError(404, "Product not found");
        if (product.currentStock < item.quantity) {
          throw new ApiError(
            400,
            `Insufficient stock for ${product.name} (available: ${product.currentStock}, requested: ${item.quantity})`
          );
        }
      }

      for (const item of challan.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            type: "OUT",
            reason: `Sales challan ${challan.challanNumber}`,
            createdById: req.user!.userId,
          },
        });
      }

      return tx.challan.update({
        where: { id: challan.id },
        data: { status: "CONFIRMED" },
        include: { items: true, customer: true },
      });
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/cancel", requireRole("ADMIN", "SALES"), async (req, res, next) => {
  try {
    const challan = await prisma.challan.findUnique({ where: { id: req.params.id as string } });
    if (!challan) throw new ApiError(404, "Challan not found");
    if (challan.status === "CANCELLED") throw new ApiError(400, "Challan is already cancelled");

    // If it was already confirmed (stock deducted), cancelling restores stock.
    const updated = await prisma.$transaction(async (tx) => {
      if (challan.status === "CONFIRMED") {
        const items = await tx.challanItem.findMany({ where: { challanId: challan.id } });
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: "IN",
              reason: `Cancellation of challan ${challan.challanNumber}`,
              createdById: req.user!.userId,
            },
          });
        }
      }
      return tx.challan.update({ where: { id: challan.id }, data: { status: "CANCELLED" } });
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
