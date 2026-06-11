import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type { CreateSupplierInput, UpdateSupplierInput } from "../../http/schemas.js";
import { notFound } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import { stripUndefined } from "../../shared/utils/objects.js";
import type { AuditService } from "../audit/audit.service.js";

type SupplierListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

function onlyDigitsOrText(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits || value.trim();
}

function toInsert(input: CreateSupplierInput) {
  const now = new Date().toISOString();

  return {
    id: randomId("sup"),
    tenantId: input.tenantId,
    documentType: input.documentType,
    document: onlyDigitsOrText(input.document),
    name: input.name,
    companyName: input.companyName ?? null,
    email: input.email || null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    contactName: input.contactName ?? null,
    categories: input.categories,
    addressZip: input.addressZip ?? null,
    addressStreet: input.addressStreet ?? null,
    addressNumber: input.addressNumber ?? null,
    addressComplement: input.addressComplement ?? null,
    addressDistrict: input.addressDistrict ?? null,
    addressCity: input.addressCity ?? null,
    addressState: input.addressState || null,
    addressCountry: input.addressCountry,
    paymentTerms: input.paymentTerms ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  };
}

function toUpdate(input: UpdateSupplierInput) {
  return stripUndefined({
    documentType: input.documentType,
    document: input.document ? onlyDigitsOrText(input.document) : undefined,
    name: input.name,
    companyName: input.companyName,
    email: input.email,
    phone: input.phone,
    whatsapp: input.whatsapp,
    contactName: input.contactName,
    categories: input.categories,
    status: input.status,
    addressZip: input.addressZip,
    addressStreet: input.addressStreet,
    addressNumber: input.addressNumber,
    addressComplement: input.addressComplement,
    addressDistrict: input.addressDistrict,
    addressCity: input.addressCity,
    addressState: input.addressState,
    addressCountry: input.addressCountry,
    paymentTerms: input.paymentTerms,
    notes: input.notes,
    metadata: input.metadata,
    updatedAt: new Date().toISOString(),
  });
}

export class SuppliersService {
  constructor(
    private readonly supabase: SupabaseServiceClient,
    private readonly audit: AuditService,
  ) {}

  async list(input: SupplierListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("suppliers")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (input.search) {
      const term = input.search.trim();
      const document = term.replace(/\D/g, "");
      const filters = [`name.ilike.%${term}%`, `companyName.ilike.%${term}%`];
      if (document) filters.push(`document.ilike.%${document}%`);
      query = query.or(filters.join(","));
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar fornecedores");

    return {
      data: result.data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async create(input: CreateSupplierInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const result = await this.supabase.from("suppliers").insert(toInsert(input)).select("*").single();
    assertSupabaseOk(result.error, "criar fornecedor");

    await this.audit.record({
      tenantId: input.tenantId,
      userId: auth.userId,
      action: "supplier.create",
      entityType: "supplier",
      entityId: result.data.id,
      after: result.data,
    });

    return result.data;
  }

  async update(id: string, input: UpdateSupplierInput, auth: AuthContext) {
    const current = await this.getTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const result = await this.supabase.from("suppliers").update(toUpdate(input)).eq("id", id).select("*").single();
    assertSupabaseOk(result.error, "atualizar fornecedor");

    await this.audit.record({
      tenantId: current.tenantId,
      userId: auth.userId,
      action: "supplier.update",
      entityType: "supplier",
      entityId: id,
      before: current,
      after: result.data,
    });

    return result.data;
  }

  async remove(id: string, auth: AuthContext) {
    const current = await this.getTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const result = await this.supabase
      .from("suppliers")
      .update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "INACTIVE" })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    assertSupabaseOk(result.error, "remover fornecedor");
    if (!result.data) throw notFound("Fornecedor nao encontrado.");

    await this.audit.record({
      tenantId: current.tenantId,
      userId: auth.userId,
      action: "supplier.delete",
      entityType: "supplier",
      entityId: id,
      before: current,
    });

    return { id, deleted: true };
  }

  private async getTenant(id: string): Promise<Record<string, unknown> & { id: string; tenantId: string }> {
    const result = await this.supabase.from("suppliers").select("*").eq("id", id).is("deletedAt", null).maybeSingle();
    assertSupabaseOk(result.error, "buscar fornecedor");
    if (!result.data) throw notFound("Fornecedor nao encontrado.");
    return result.data as Record<string, unknown> & { id: string; tenantId: string };
  }
}
