import { createFileRoute } from "@tanstack/react-router";
import { Phone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const TEL = "0500579993";
export const Route = createFileRoute("/_authenticated/dashboard/report")({ component: Report });

function Report() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Report an Issue</h1>
          <p className="text-muted-foreground">Call our support line for help.</p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-bold">DataKing Ghana Support</h2>
        <p className="text-sm text-muted-foreground">
          Calls only — please do not send SMS or WhatsApp messages to this number.
          Lines are open during business hours.
        </p>
        <a href={`tel:${TEL}`}>
          <Button className="gap-2"><Phone className="w-4 h-4" /> Call {TEL}</Button>
        </a>
        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
          Direct number: {TEL} (calls only)
        </div>
      </div>
    </div>
  );
}
