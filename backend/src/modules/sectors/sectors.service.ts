import type { AuthContext } from "../../http/middleware/auth.js";
import { assertSectorAccess, assertTenantAccess, hasPermission } from "../../http/middleware/auth.js";
import type { CreateSectorInput, UpdateSectorInput } from "../../http/schemas.js";
import { conflict, notFound } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import { stripUndefined } from "../../shared/utils/objects.js";

type SectorListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

export class SectorsService {
  constructor(private readonly supabase: SupabaseServiceClient) {}

  async list(input: SectorListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("sectors")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("kanbanOrder", { ascending: true })
      .range(from, to);

    if (input.search) {
      query = query.ilike("name", `%${input.search}%`);
    }

    if (!hasPermission(auth, "*") && auth.role !== "ADMIN") {
      if (auth.sectorIds.length === 0) {
        return {
          data: [],
          page: input.page,
          pageSize: input.pageSize,
          total: 0,
        };
      }

      query = query.in("id", auth.sectorIds);
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar setores");

    return {
      data: result.data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async create(input: CreateSectorInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    const now = new Date().toISOString();

    const result = await this.supabase
      .from("sectors")
      .insert({
        id: randomId("sec"),
        tenantId: input.tenantId,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
        status: "OPERATIONAL",
        kanbanOrder: input.kanbanOrder,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar setor");
    return result.data;
  }

  async update(id: string, input: UpdateSectorInput, auth: AuthContext) {
    const current = await this.supabase
      .from("sectors")
      .select("id,tenantId")
      .eq("id", id)
      .maybeSingle<{ id: string; tenantId: string }>();

    assertSupabaseOk(current.error, "buscar setor");
    if (!current.data) throw notFound("Setor nao encontrado.");
    assertTenantAccess(auth, current.data.tenantId);
    assertSectorAccess(auth, current.data.id);

    const result = await this.supabase
      .from("sectors")
      .update(
        stripUndefined({
          ...input,
          updatedAt: new Date().toISOString(),
        }),
      )
      .eq("id", id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar setor");
    return result.data;
  }

  async remove(id: string, auth: AuthContext) {
    const current = await this.supabase
      .from("sectors")
      .select("id,tenantId")
      .eq("id", id)
      .maybeSingle<{ id: string; tenantId: string }>();

    assertSupabaseOk(current.error, "buscar setor");
    if (!current.data) throw notFound("Setor nao encontrado.");
    assertTenantAccess(auth, current.data.tenantId);
    assertSectorAccess(auth, current.data.id);

    const machines = await this.supabase.from("machines").select("id").eq("sectorId", id).limit(1);
    assertSupabaseOk(machines.error, "validar maquinas do setor");
    if ((machines.data ?? []).length > 0) {
      throw conflict("Nao e possivel excluir setor com maquinas vinculadas.");
    }

    const items = await this.supabase.from("order_items").select("id").eq("sectorId", id).limit(1);
    assertSupabaseOk(items.error, "validar pedidos do setor");
    if ((items.data ?? []).length > 0) {
      throw conflict("Nao e possivel excluir setor com pedidos vinculados.");
    }

    const result = await this.supabase.from("sectors").delete().eq("id", id);
    assertSupabaseOk(result.error, "excluir setor");

    return { id, deleted: true };
  }
}
