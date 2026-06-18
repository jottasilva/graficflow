import type { AuthContext } from "../../http/middleware/auth.js";
import { assertSectorAccess, assertTenantAccess, hasPermission } from "../../http/middleware/auth.js";
import type {
  CreateMachineInput,
  CreateMaintenanceTicketInput,
  UpdateMachineInput,
  UpdateMaintenanceTicketInput,
} from "../../http/schemas.js";
import { conflict, notFound } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import { stripUndefined } from "../../shared/utils/objects.js";

type MachineListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

type MachineRow = {
  id: string;
  tenantId: string;
  sectorId?: string | null;
  totalUsageMinutes?: number | null;
};

type UsageLogRow = {
  machineId: string;
  duration: number | null;
  startTime: string;
  endTime: string | null;
};

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function durationMinutes(log: UsageLogRow): number {
  if (typeof log.duration === "number") return log.duration;
  if (!log.endTime) return 0;
  return Math.max(0, Math.round((Date.parse(log.endTime) - Date.parse(log.startTime)) / 60000));
}

export class MachinesService {
  constructor(private readonly supabase: SupabaseServiceClient) {}

  async list(input: MachineListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("machines")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("name", { ascending: true })
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

    const machines = await query;
    assertSupabaseOk(machines.error, "listar maquinas");

    const usage = await this.supabase
      .from("machine_usage_logs")
      .select("machineId,duration,startTime,endTime")
      .eq("tenantId", input.tenantId)
      .gte("startTime", monthStartIso());

    assertSupabaseOk(usage.error, "calcular horas das maquinas");

    const monthlyMinutes = new Map<string, number>();
    for (const log of (usage.data ?? []) as UsageLogRow[]) {
      monthlyMinutes.set(log.machineId, (monthlyMinutes.get(log.machineId) ?? 0) + durationMinutes(log));
    }

    return {
      data: (machines.data ?? []).map((machine: MachineRow) => ({
        ...machine,
        monthlyUsageMinutes: monthlyMinutes.get(machine.id) ?? 0,
        monthlyUsageHours: Math.round(((monthlyMinutes.get(machine.id) ?? 0) / 60) * 10) / 10,
      })),
      page: input.page,
      pageSize: input.pageSize,
      total: machines.count ?? 0,
    };
  }

  async create(input: CreateMachineInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    assertSectorAccess(auth, input.sectorId);
    const now = new Date().toISOString();

    const result = await this.supabase
      .from("machines")
      .insert({
        id: randomId("maq"),
        tenantId: input.tenantId,
        sectorId: input.sectorId,
        name: input.name,
        model: input.model ?? null,
        serialNumber: input.serialNumber ?? null,
        status: "OPERATIONAL",
        capacityPerHour: input.capacityPerHour,
        costMonth: input.costMonth,
        nextMaintenanceAt: input.nextMaintenanceAt ?? null,
        description: input.description ?? null,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar maquina");
    return result.data;
  }

  async update(id: string, input: UpdateMachineInput, auth: AuthContext) {
    const current = await this.getMachineTenant(id);
    assertTenantAccess(auth, current.tenantId);
    assertSectorAccess(auth, current.sectorId);
    assertSectorAccess(auth, input.sectorId);

    const result = await this.supabase
      .from("machines")
      .update(
        stripUndefined({
          ...input,
          updatedAt: new Date().toISOString(),
        }),
      )
      .eq("id", id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar maquina");
    return result.data;
  }

  async remove(id: string, auth: AuthContext) {
    const current = await this.getMachineTenant(id);
    assertTenantAccess(auth, current.tenantId);
    assertSectorAccess(auth, current.sectorId);

    const activeItems = await this.supabase.from("order_items").select("id").eq("machineId", id).limit(1);
    assertSupabaseOk(activeItems.error, "validar pedidos da maquina");
    if ((activeItems.data ?? []).length > 0) {
      throw conflict("Nao e possivel excluir maquina vinculada a pedidos.");
    }

    const result = await this.supabase.from("machines").delete().eq("id", id);
    assertSupabaseOk(result.error, "excluir maquina");
    return { id, deleted: true };
  }

  async listMaintenanceTickets(tenantId: string, auth: AuthContext) {
    assertTenantAccess(auth, tenantId);
    const result = await this.supabase
      .from("maintenance_tickets")
      .select("*")
      .eq("tenantId", tenantId)
      .order("openedAt", { ascending: false });

    assertSupabaseOk(result.error, "listar chamados de manutencao");
    return result.data ?? [];
  }

  async createMaintenanceTicket(input: CreateMaintenanceTicketInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    const machine = await this.getMachineTenant(input.machineId);
    assertTenantAccess(auth, machine.tenantId);
    assertSectorAccess(auth, machine.sectorId);

    const now = new Date().toISOString();
    const result = await this.supabase
      .from("maintenance_tickets")
      .insert({
        id: randomId("mnt"),
        tenantId: input.tenantId,
        machineId: input.machineId,
        openedByUserId: auth.userId,
        assignedUserId: input.assignedUserId ?? null,
        priority: input.priority,
        status: "OPEN",
        title: input.title,
        description: input.description,
        metadata: input.observations ? { observations: input.observations } : {},
        openedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(result.error, "abrir chamado de manutencao");

    await this.supabase
      .from("machines")
      .update({ status: "MAINTENANCE", updatedAt: now })
      .eq("id", input.machineId);

    return result.data;
  }

  async updateMaintenanceTicket(id: string, input: UpdateMaintenanceTicketInput, auth: AuthContext) {
    const current = await this.supabase
      .from("maintenance_tickets")
      .select("id,tenantId,machineId,status")
      .eq("id", id)
      .maybeSingle<{ id: string; tenantId: string; machineId: string; status: string }>();

    assertSupabaseOk(current.error, "buscar chamado");
    if (!current.data) throw notFound("Chamado de manutencao nao encontrado.");
    assertTenantAccess(auth, current.data.tenantId);
    const machine = await this.getMachineTenant(current.data.machineId);
    assertSectorAccess(auth, machine.sectorId);

    const now = new Date().toISOString();
    const closedAt = input.status === "RESOLVED" || input.status === "CANCELED" ? now : undefined;

    const result = await this.supabase
      .from("maintenance_tickets")
      .update(
        stripUndefined({
          ...input,
          closedAt,
          updatedAt: now,
        }),
      )
      .eq("id", id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar chamado");

    if (closedAt) {
      await this.supabase
        .from("machines")
        .update({ status: "OPERATIONAL", lastMaintenanceAt: now, updatedAt: now })
        .eq("id", current.data.machineId);
    }

    return result.data;
  }

  async removeMaintenanceTicket(id: string, auth: AuthContext) {
    const current = await this.supabase
      .from("maintenance_tickets")
      .select("id,tenantId,machineId")
      .eq("id", id)
      .maybeSingle<{ id: string; tenantId: string; machineId: string }>();

    assertSupabaseOk(current.error, "buscar chamado");
    if (!current.data) throw notFound("Chamado de manutencao nao encontrado.");
    assertTenantAccess(auth, current.data.tenantId);
    const machine = await this.getMachineTenant(current.data.machineId);
    assertSectorAccess(auth, machine.sectorId);

    const result = await this.supabase.from("maintenance_tickets").delete().eq("id", id);
    assertSupabaseOk(result.error, "excluir chamado");
    return { id, deleted: true };
  }

  private async getMachineTenant(id: string): Promise<MachineRow> {
    const result = await this.supabase
      .from("machines")
      .select("id,tenantId,sectorId,totalUsageMinutes")
      .eq("id", id)
      .maybeSingle<MachineRow>();

    assertSupabaseOk(result.error, "buscar maquina");
    if (!result.data) throw notFound("Maquina nao encontrada.");
    return result.data;
  }
}
