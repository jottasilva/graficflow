create or replace function public.auto_create_user_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id text;
  v_company_name text;
  v_slug text;
  v_user_name text;
  v_role text;
  v_user_type text;
  v_permissions text[];
begin
  v_company_name := nullif(
    coalesce(new.raw_user_meta_data->>'companyName', new.raw_user_meta_data->>'company_name'),
    ''
  );
  v_tenant_id := nullif(
    coalesce(
      new.raw_app_meta_data->>'tenantId',
      new.raw_app_meta_data->>'tenant_id',
      new.raw_user_meta_data->>'tenantId',
      new.raw_user_meta_data->>'tenant_id'
    ),
    ''
  );

  if v_tenant_id is null then
    v_slug := lower(regexp_replace(coalesce(v_company_name, 'graphflow-main'), '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    v_tenant_id := coalesce(nullif(v_slug, ''), 'graphflow-main');
  end if;

  v_company_name := coalesce(v_company_name, v_tenant_id, 'GraficFlow');
  v_user_name := coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1), 'Usuario');
  v_role := upper(coalesce(nullif(new.raw_app_meta_data->>'role', ''), 'ADMIN'));

  if v_role not in ('ADMIN', 'MANAGER', 'OPERATOR', 'FINANCE', 'CLIENT', 'VIEWER') then
    v_role := 'ADMIN';
  end if;

  v_user_type := case
    when v_role = 'CLIENT' then 'CLIENT'
    when v_role = 'ADMIN' then 'ADMIN'
    else 'OPERATOR'
  end;
  v_permissions := case when v_role = 'ADMIN' then array['*']::text[] else array[]::text[] end;

  insert into public.tenants (
    id,
    name,
    slug,
    status,
    metadata,
    "createdAt",
    "updatedAt"
  ) values (
    v_tenant_id,
    v_company_name,
    v_tenant_id,
    'ACTIVE',
    jsonb_build_object('authProvider', 'supabase'),
    now(),
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    status = 'ACTIVE',
    "updatedAt" = now();

  insert into public.users (
    id,
    "tenantId",
    type,
    name,
    email,
    role,
    permissions,
    status,
    metadata,
    "createdAt",
    "updatedAt",
    "deletedAt"
  ) values (
    new.id::text,
    v_tenant_id,
    v_user_type,
    v_user_name,
    new.email,
    v_role,
    v_permissions,
    'ACTIVE',
    jsonb_build_object('authProvider', 'supabase', 'authUserId', new.id::text),
    now(),
    now(),
    null
  )
  on conflict (email) do update set
    "tenantId" = excluded."tenantId",
    type = excluded.type,
    name = excluded.name,
    role = excluded.role,
    permissions = excluded.permissions,
    status = 'ACTIVE',
    metadata = coalesce(public.users.metadata, '{}'::jsonb) || excluded.metadata,
    "updatedAt" = now(),
    "deletedAt" = null;

  return new;
end;
$function$;
