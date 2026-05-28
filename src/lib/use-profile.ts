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
        .select("id, email, full_name, phone, sponsor_id")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  return {
    profile: q.data,
    isSubagent: !!q.data?.sponsor_id,
    sponsorId: q.data?.sponsor_id ?? null,
    isLoading: q.isLoading,
  };
}
