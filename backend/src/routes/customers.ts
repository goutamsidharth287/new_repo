import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth);

const customerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(6),
  email: z.string().email().optional().nullable(),
  businessName: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  customerType: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]),
  address: z.string().optional().nullable(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).optional(),
  followUpDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /customers?search=&status=&page=&pageSize=
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
    const search = (req.query.search as string) || "";
    const status = req.query.status as string | undefined;

    const where: any = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { mobile: { contains: search } },
                { businessName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
        status ? { status } : {},
      ],
    };

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id as string },
      include: { followUps: { orderBy: { createdAt: "desc" } } },
    });
    if (!customer) throw new ApiError(404, "Customer not found");
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("ADMIN", "SALES"), async (req, res, next) => {
  try {
    const data = customerSchema.parse(req.body);
    const customer = await prisma.customer.create({ data });
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("ADMIN", "SALES"), async (req, res, next) => {
  try {
    const data = customerSchema.partial().parse(req.body);
    const customer = await prisma.customer.update({
      where: { id: req.params.id as string },
      data,
    });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

const followUpSchema = z.object({ note: z.string().min(1) });

router.post("/:id/followups", requireRole("ADMIN", "SALES"), async (req, res, next) => {
  try {
    const { note } = followUpSchema.parse(req.body);
    const followUp = await prisma.followUp.create({
      data: {
        note,
        customerId: req.params.id as string,
        createdById: req.user!.userId,
      },
    });
    res.status(201).json(followUp);
  } catch (err) {
    next(err);
  }
});

export default router;
