import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function useProfile() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, sponsor_id, store_activated_at, subagent_activated_at")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  return {
    profile: q.data,
    isSubagent: !!q.data?.sponsor_id,
    sponsorId: q.data?.sponsor_id ?? null,
    storeActivatedAt: q.data?.store_activated_at ?? null,
    subagentActivatedAt: q.data?.subagent_activated_at ?? null,
    isLoading: q.isLoading,
  };
}
