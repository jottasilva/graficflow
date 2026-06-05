import type { AuthContext } from "../../http/middleware/auth.js";
import { assertSectorAccess, assertTenantAccess, hasPermission } from "../../http/middleware/auth.js";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "../../http/schemas.js";
import { forbidden, notFound } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import { stripUndefined } from "../../shared/utils/objects.js";

type ProductListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

function toProductInsert(input: CreateProductInput) {
  const now = new Date().toISOString();

  return {
    id: randomId("prd"),
    tenantId: input.tenantId,
    sectorId: input.sectorId ?? null,
    sectorName: input.sectorName ?? null,
    sku: input.sku,
    name: input.name,
    category: input.category,
    description: input.description ?? null,
    thumbnailUrl: input.thumbnailUrl || null,
    priceCost: input.priceCost ?? null,
    priceSale: input.priceSale,
    unitType: input.unitType,
    stockQty: input.stockQty,
    stockMin: input.stockMin,
    stockMax: input.stockMax ?? null,
    trackStock: input.trackStock,
    allowFractional: input.allowFractional,
    minOrderQty: input.minOrderQty,
    minFractionQty: input.minFractionQty,
    tags: input.tags,
    attributes: input.attributes,
    isActive: input.isActive,
    isFeatured: input.isFeatured,
    createdAt: now,
    updatedAt: now,
  };
}

function toProductUpdate(input: UpdateProductInput) {
  return stripUndefined({
    sectorId: input.sectorId,
    sectorName: input.sectorName,
    sku: input.sku,
    name: input.name,
    category: input.category,
    description: input.description,
    thumbnailUrl: input.thumbnailUrl,
    priceCost: input.priceCost,
    priceSale: input.priceSale,
    unitType: input.unitType,
    stockQty: input.stockQty,
    stockMin: input.stockMin,
    stockMax: input.stockMax,
    trackStock: input.trackStock,
    allowFractional: input.allowFractional,
    minOrderQty: input.minOrderQty,
    minFractionQty: input.minFractionQty,
    tags: input.tags,
    attributes: input.attributes,
    isActive: input.isActive,
    isFeatured: input.isFeatured,
    updatedAt: new Date().toISOString(),
  });
}

export class ProductsService {
  constructor(private readonly supabase: SupabaseServiceClient) {}

  async list(input: ProductListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("products")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (input.search) {
      query = query.ilike("name", `%${input.search}%`);
    }

    if (!hasPermission(auth, "*")) {
      if (auth.sectorIds.length === 0) {
        return {
          data: [],
          page: input.page,
          pageSize: input.pageSize,
          total: 0,
        };
      }

      query = query.in("sectorId", auth.sectorIds);
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar produtos");

    return {
      data: result.data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async create(input: CreateProductInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    if (!hasPermission(auth, "*") && !input.sectorId) {
      throw forbidden("Produto precisa estar vinculado a um setor permitido.");
    }
    assertSectorAccess(auth, input.sectorId);

    const result = await this.supabase
      .from("products")
      .insert(toProductInsert(input))
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar produto");
    return result.data;
  }

  async update(id: string, input: UpdateProductInput, auth: AuthContext) {
    const current = await this.getProductTenant(id);
    assertTenantAccess(auth, current.tenantId);
    assertSectorAccess(auth, current.sectorId);
    assertSectorAccess(auth, input.sectorId);

    const result = await this.supabase
      .from("products")
      .update(toProductUpdate(input))
      .eq("id", id)
      .select("*")
      .maybeSingle();

    assertSupabaseOk(result.error, "atualizar produto");
    if (!result.data) throw notFound("Produto nao encontrado.");
    return result.data;
  }

  async remove(id: string, auth: AuthContext) {
    const current = await this.getProductTenant(id);
    assertTenantAccess(auth, current.tenantId);
    assertSectorAccess(auth, current.sectorId);

    const result = await this.supabase
      .from("products")
      .update({ isActive: false, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    assertSupabaseOk(result.error, "desativar produto");
    if (!result.data) throw notFound("Produto nao encontrado.");

    return { id, deleted: true };
  }

  private async getProductTenant(id: string): Promise<{ id: string; tenantId: string; sectorId: string | null }> {
    const result = await this.supabase
      .from("products")
      .select("id,tenantId,sectorId")
      .eq("id", id)
      .is("deletedAt", null)
      .maybeSingle<{ id: string; tenantId: string; sectorId: string | null }>();

    assertSupabaseOk(result.error, "buscar produto");
    if (!result.data) throw notFound("Produto nao encontrado.");
    return result.data;
  }
}
