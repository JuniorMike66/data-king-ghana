import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WA = "233560042269";
export const Route = createFileRoute("/_authenticated/dashboard/report")({ component: Report });

function Report() {
  const open = (msg: string) =>
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, "_blank");
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-8 h-8 text-primary" />
        <div><h1 className="text-3xl font-bold">Report an Issue</h1>
          <p className="text-muted-foreground">Reach support on WhatsApp.</p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-bold">DataKing Ghana Support</h2>
        <p className="text-sm text-muted-foreground">Chat directly with our team. Average response time under 30 minutes during work hours.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => open("Hello DataKing, I need help with my account.")} className="gap-2 bg-[#25D366] hover:bg-[#1faa56] text-white"><MessageCircle className="w-4 h-4" /> Open WhatsApp chat</Button>
          <Button variant="outline" onClick={() => open("Hi, my data order has not been delivered. Reference: ")}>Report failed order</Button>
          <Button variant="outline" onClick={() => open("Hi, I need help with a wallet top-up.")}>Wallet issue</Button>
        </div>
        <div className="text-xs text-muted-foreground pt-2 border-t border-border">Direct number: +{WA}</div>
      </div>
    </div>
  );
}
