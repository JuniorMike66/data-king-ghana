import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
const WHATSAPP = "233560042269";
function Page() {
  const link = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hi DataKing, I need help with: ")}`;
  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-3xl font-bold">Report an Issue</h1>
      <p className="text-muted-foreground">Send us a message on WhatsApp and our team will help you.</p>
      <a href={link} target="_blank" rel="noreferrer"><Button className="h-12 bg-success text-success-foreground">Chat with Support on WhatsApp</Button></a>
    </div>
  );
}
export const Route = createFileRoute("/_authenticated/dashboard/report")({ component: Page });
