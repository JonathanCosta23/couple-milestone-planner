DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'validate_asset_member_link'
      AND pg_function_is_visible(oid)
  ) THEN
    CREATE FUNCTION public.validate_asset_member_link()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
    AS $fn$
    DECLARE
      plan_mode text;
      resolved_member_id uuid;
    BEGIN
      SELECT mode
      INTO plan_mode
      FROM public.plans
      WHERE id = NEW.plan_id
        AND user_id = NEW.user_id
      LIMIT 1;

      IF plan_mode IS NULL THEN
        RAISE EXCEPTION 'Asset must belong to a valid plan for this user.';
      END IF;

      IF NEW.member_id IS NULL AND plan_mode = 'individual' THEN
        SELECT pm.id
        INTO NEW.member_id
        FROM public.plan_members pm
        WHERE pm.plan_id = NEW.plan_id
          AND pm.user_id = NEW.user_id
          AND pm.is_active = true
          AND pm.is_primary = true
        ORDER BY pm.created_at ASC
        LIMIT 1;
      END IF;

      SELECT pm.id
      INTO resolved_member_id
      FROM public.plan_members pm
      WHERE pm.id = NEW.member_id
        AND pm.plan_id = NEW.plan_id
        AND pm.user_id = NEW.user_id
        AND pm.is_active = true
      LIMIT 1;

      IF resolved_member_id IS NULL THEN
        RAISE EXCEPTION 'Asset must reference an active participant from the same plan.';
      END IF;

      NEW.member_id := resolved_member_id;
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

INSERT INTO public.plan_members (plan_id, user_id, name, role, is_primary, is_active, age, avatar_color)
SELECT
  p.id,
  p.user_id,
  COALESCE(
    NULLIF(primary_member.name, ''),
    NULLIF(profile.display_name, ''),
    ''
  ) AS name,
  'titular' AS role,
  true AS is_primary,
  true AS is_active,
  NULL::integer AS age,
  profile.avatar_color
FROM public.plans p
LEFT JOIN public.profiles profile
  ON profile.user_id = p.user_id
LEFT JOIN LATERAL (
  SELECT m.name
  FROM public.members m
  WHERE m.plan_id = p.id
    AND m.user_id = p.user_id
    AND m.is_active = true
    AND m.role = 'primary'
  ORDER BY m.created_at ASC
  LIMIT 1
) AS primary_member ON true
LEFT JOIN LATERAL (
  SELECT pm.id
  FROM public.plan_members pm
  WHERE pm.plan_id = p.id
    AND pm.user_id = p.user_id
    AND pm.is_active = true
    AND pm.is_primary = true
  ORDER BY pm.created_at ASC
  LIMIT 1
) existing_primary ON true
WHERE existing_primary.id IS NULL;

WITH legacy_asset_mapping AS (
  SELECT
    a.id AS asset_id,
    COALESCE(
      exact_name_pm.id,
      role_pm.id,
      primary_pm.id
    ) AS resolved_member_id
  FROM public.assets a
  LEFT JOIN public.members legacy_member
    ON legacy_member.id = a.member_id
   AND legacy_member.plan_id = a.plan_id
   AND legacy_member.user_id = a.user_id
  LEFT JOIN LATERAL (
    SELECT pm.id
    FROM public.plan_members pm
    WHERE pm.plan_id = a.plan_id
      AND pm.user_id = a.user_id
      AND pm.is_active = true
      AND legacy_member.id IS NOT NULL
      AND legacy_member.name <> ''
      AND lower(pm.name) = lower(legacy_member.name)
    ORDER BY pm.created_at ASC
    LIMIT 1
  ) exact_name_pm ON true
  LEFT JOIN LATERAL (
    SELECT pm.id
    FROM public.plan_members pm
    WHERE pm.plan_id = a.plan_id
      AND pm.user_id = a.user_id
      AND pm.is_active = true
      AND legacy_member.id IS NOT NULL
      AND (
        (legacy_member.role = 'primary' AND pm.is_primary = true) OR
        (legacy_member.role <> 'primary' AND COALESCE(pm.is_primary, false) = false)
      )
    ORDER BY pm.created_at ASC
    LIMIT 1
  ) role_pm ON true
  LEFT JOIN LATERAL (
    SELECT pm.id
    FROM public.plan_members pm
    WHERE pm.plan_id = a.plan_id
      AND pm.user_id = a.user_id
      AND pm.is_active = true
      AND pm.is_primary = true
    ORDER BY pm.created_at ASC
    LIMIT 1
  ) primary_pm ON true
)
UPDATE public.assets a
SET member_id = lam.resolved_member_id
FROM legacy_asset_mapping lam
WHERE a.id = lam.asset_id
  AND (
    a.member_id IS NULL OR
    NOT EXISTS (
      SELECT 1
      FROM public.plan_members pm
      WHERE pm.id = a.member_id
        AND pm.plan_id = a.plan_id
        AND pm.user_id = a.user_id
        AND pm.is_active = true
    )
  )
  AND lam.resolved_member_id IS NOT NULL;

ALTER TABLE public.assets
DROP CONSTRAINT IF EXISTS assets_member_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.assets a
    WHERE a.member_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.plan_members pm
         WHERE pm.id = a.member_id
           AND pm.plan_id = a.plan_id
           AND pm.user_id = a.user_id
           AND pm.is_active = true
       )
  ) THEN
    RAISE EXCEPTION 'Cannot enforce assets.member_id yet because some assets still do not have a valid active participant in plan_members.';
  END IF;
END $$;

ALTER TABLE public.assets
ALTER COLUMN member_id SET NOT NULL;

ALTER TABLE public.assets
ADD CONSTRAINT assets_member_id_fkey
FOREIGN KEY (member_id)
REFERENCES public.plan_members(id)
ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_assets_member_id ON public.assets(member_id);
CREATE INDEX IF NOT EXISTS idx_assets_plan_member ON public.assets(plan_id, member_id);

DROP TRIGGER IF EXISTS validate_asset_member_link_on_assets ON public.assets;

CREATE TRIGGER validate_asset_member_link_on_assets
BEFORE INSERT OR UPDATE ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.validate_asset_member_link();