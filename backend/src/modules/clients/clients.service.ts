import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type { CreateClientInput, UpdateClientInput } from "../../http/schemas.js";
import { notFound } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import { stripUndefined } from "../../shared/utils/objects.js";

type ClientListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function toSafeSearchTerm(value: string): string {
  return value.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ");
}

function toInsert(input: CreateClientInput) {
  const now = new Date().toISOString();

  return {
    id: randomId("cli"),
    tenantId: input.tenantId,
    personType: input.personType,
    documentType: input.documentType,
    document: onlyDigits(input.document),
    name: input.name,
    companyName: input.companyName ?? null,
    email: input.email,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    avatarUrl: input.avatarUrl || null,
    addressZip: input.addressZip ?? null,
    addressStreet: input.addressStreet ?? null,
    addressNumber: input.addressNumber ?? null,
    addressComplement: input.addressComplement ?? null,
    addressDistrict: input.addressDistrict ?? null,
    addressCity: input.addressCity ?? null,
    addressState: input.addressState || null,
    addressCountry: input.addressCountry,
    notes: input.notes ?? null,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
}

function toUpdate(input: UpdateClientInput) {
  return stripUndefined({
    personType: input.personType,
    documentType: input.documentType,
    document: input.document ? onlyDigits(input.document) : undefined,
    name: input.name,
    companyName: input.companyName,
    email: input.email,
    phone: input.phone,
    whatsapp: input.whatsapp,
    avatarUrl: input.avatarUrl,
    addressZip: input.addressZip,
    addressStreet: input.addressStreet,
    addressNumber: input.addressNumber,
    addressComplement: input.addressComplement,
    addressDistrict: input.addressDistrict,
    addressCity: input.addressCity,
    addressState: input.addressState,
    addressCountry: input.addressCountry,
    notes: input.notes,
    updatedAt: new Date().toISOString(),
  });
}

export class ClientsService {
  constructor(private readonly supabase: SupabaseServiceClient) {}

  async list(input: ClientListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("customers")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (input.search) {
      const term = toSafeSearchTerm(input.search);
      const document = onlyDigits(input.search);
      const filters = [`name.ilike.%${term}%`, `companyName.ilike.%${term}%`];

      if (document) filters.push(`document.ilike.%${document}%`);

      query = query.or(filters.join(","));
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar clientes");

    return {
      data: result.data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async create(input: CreateClientInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const result = await this.supabase
      .from("customers")
      .insert(toInsert(input))
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar cliente");
    return result.data;
  }

  async update(id: string, input: UpdateClientInput, auth: AuthContext) {
    const current = await this.getTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const result = await this.supabase
      .from("customers")
      .update(toUpdate(input))
      .eq("id", id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar cliente");
    return result.data;
  }

  async remove(id: string, auth: AuthContext) {
    const current = await this.getTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const result = await this.supabase
      .from("customers")
      .update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "INACTIVE" })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    assertSupabaseOk(result.error, "remover cliente");
    if (!result.data) throw notFound("Cliente nao encontrado.");

    return { id, deleted: true };
  }

  private async getTenant(id: string): Promise<{ id: string; tenantId: string }> {
    const result = await this.supabase
      .from("customers")
      .select("id,tenantId")
      .eq("id", id)
      .is("deletedAt", null)
      .maybeSingle<{ id: string; tenantId: string }>();

    assertSupabaseOk(result.error, "buscar cliente");
    if (!result.data) throw notFound("Cliente nao encontrado.");
    return result.data;
  }
}
