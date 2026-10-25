-- Dino Realms: a save never moves back to an older schema.
-- Save v6 reset the game for everyone; a browser still running an older build (from cache) must not overwrite a
-- v6 row with its v5 save. Run once in Supabase → SQL Editor (or `supabase db push`), after 0001 and 0002.

create or replace function public.saves_schema_floor() returns trigger
language plpgsql as $$
begin
  -- The column must tell the truth about the save it describes.
  if (new.data->>'schemaVersion')::integer is distinct from new.schema_version then
    raise exception 'schema_version % does not match the save (%)', new.schema_version, new.data->>'schemaVersion'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.schema_version < old.schema_version then
    raise exception 'save schema % is older than the stored schema %', new.schema_version, old.schema_version
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists saves_schema_floor on public.saves;
create trigger saves_schema_floor before insert or update on public.saves
  for each row execute function public.saves_schema_floor();
