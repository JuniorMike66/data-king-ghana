import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const map: Record<string, { network: "mtn" | "airteltigo_ishare" | "airteltigo_bigtime" | "telecel"; label: string; color: string }> = {
  mtn: { network: "mtn", label: "MTN", color: "bg-mtn text-mtn-foreground" },
  "at-ishare": { network: "airteltigo_ishare", label: "AirtelTigo iShare", color: "bg-airteltigo text-airteltigo-foreground" },
  "at-bigtime": { network: "airteltigo_bigtime", label: "AirtelTigo BigTime", color: "bg-airteltigo text-airteltigo-foreground" },
  telecel: { network: "telecel", label: "Telecel", color: "bg-telecel text-telecel-foreground" },
};

export const Route = createFileRoute("/_authenticated/dashboard/buy-data/$network")({ component: Page });

function Page() {
  const { network } = useParams({ from: "/_authenticated/dashboard/buy-data/$network" });
  const cfg = map[network];
  const { data: pkgs } = useQuery({
    queryKey: ["packages", cfg?.network],
    enabled: !!cfg,
    queryFn: async () => {
      const { data } = await supabase
        .from("data_packages").select("*").eq("network", cfg.network).eq("active", true).order("sort_order");
      return data ?? [];
    },
  });
  if (!cfg) return <div>Unknown network</div>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Buy {cfg.label} Data</h1>
        <p className="text-muted-foreground">All bundles have no expiry. Tap a package to purchase.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {pkgs?.map((p) => (
          <button key={p.id} className={`${cfg.color} rounded-xl p-5 text-left shadow-lg hover:scale-[1.02] transition-transform`}>
            <div className="text-xs font-semibold opacity-80">{cfg.label.toUpperCase()}</div>
            <div className="text-3xl font-extrabold mt-1">{p.size_label}</div>
            <div className="flex items-end justify-between mt-4">
              <div className="text-2xl font-bold">₵{Number(p.price).toFixed(2)}</div>
              <div className="text-[10px] font-semibold opacity-80">NO EXPIRY</div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Purchase flow + Paystack wallet integration coming next phase.</p>
    </div>
  );
}
