"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

export type ProductDTO = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
};

function toDTO(p: {
  id: string;
  name: string;
  description: string | null;
  price: { toNumber(): number };
  isActive: boolean;
}): ProductDTO {
  return { ...p, price: p.price.toNumber() };
}

export async function getProducts(input?: { status?: "all" | "active" | "inactive" }): Promise<ProductDTO[]> {
  const { tenantId } = await getTenantContext();
  const status = input?.status ?? "active";

  const products = await prisma.product.findMany({
    where: {
      tenantId,
      ...(status === "active" && { isActive: true }),
      ...(status === "inactive" && { isActive: false }),
    },
    orderBy: { name: "asc" },
  });

  return products.map(toDTO);
}

export type ProductActionResult =
  | { success: true; product: ProductDTO }
  | { success: false; error: string };

export async function createProduct(values: {
  name: string;
  description?: string;
  price: number;
}): Promise<ProductActionResult> {
  const { tenantId } = await getTenantContext();

  if (!values.name.trim() || values.price <= 0) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const product = await prisma.product.create({
    data: {
      tenantId,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      price: values.price,
    },
  });

  return { success: true, product: toDTO(product) };
}

export async function updateProduct(
  id: string,
  values: { name: string; description?: string; price: number }
): Promise<ProductActionResult> {
  const { tenantId } = await getTenantContext();

  const result = await prisma.product.updateMany({
    where: { id, tenantId },
    data: {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      price: values.price,
    },
  });

  if (result.count === 0) return { success: false, error: "Prodotto non trovato." };

  const product = await prisma.product.findFirstOrThrow({ where: { id, tenantId } });
  return { success: true, product: toDTO(product) };
}

export async function toggleProductStatus(id: string, isActive: boolean): Promise<ProductActionResult> {
  const { tenantId } = await getTenantContext();

  const result = await prisma.product.updateMany({ where: { id, tenantId }, data: { isActive } });
  if (result.count === 0) return { success: false, error: "Prodotto non trovato." };

  const product = await prisma.product.findFirstOrThrow({ where: { id, tenantId } });
  return { success: true, product: toDTO(product) };
}
