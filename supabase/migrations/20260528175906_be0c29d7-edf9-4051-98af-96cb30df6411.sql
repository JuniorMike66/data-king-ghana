-- Revoke execute on internal functions from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
-- has_role is fine to keep callable since it's used in RLS, but lock it down via security definer
-- It's still callable as needed since RLS policies run as definer of policy
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;