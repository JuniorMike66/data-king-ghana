import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function FloatingWhatsApp() {
  const { data } = useQuery({
    queryKey: ["site-settings-public"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("whatsapp_enabled,whatsapp_url").eq("id", 1).maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  if (!data?.whatsapp_enabled || !data.whatsapp_url) return null;

  return (
    <a
      href={data.whatsapp_url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] text-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
    >
      <MessageCircle className="w-7 h-7" fill="white" />
    </a>
  );
}
