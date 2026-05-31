import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { claimFreeToken } from "@/lib/campaigns.functions";

export function FloatingClaimButton() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const claim = useServerFn(claimFreeToken);

  const mut = useMutation({
    mutationFn: () => claim({ data: { code, phone } }),
    onSuccess: () => {
      toast.success("🎉 Free data is being sent to " + phone);
      setOpen(false); setCode(""); setPhone("");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not claim token"),
  });

  const blockPaste = (e: React.ClipboardEvent | React.DragEvent) => {
    e.preventDefault();
    toast.error("Please type the token by hand — pasting is not allowed.");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Claim free data"
        className="fixed bottom-40 right-4 sm:right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-amber-700 text-primary-foreground shadow-lg hover:scale-105 transition flex items-center justify-center"
      >
        <Gift className="w-6 h-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Claim free data</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the 8-character token and the phone number to receive the data.
              Each phone can claim only once per campaign.
            </p>
            <div>
              <Label>Token</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                onPaste={blockPaste}
                onDrop={blockPaste}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={8}
                placeholder="ABCD1234"
                className="font-mono tracking-widest text-lg uppercase"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Tokens cannot be pasted — type them in.</p>
            </div>
            <div>
              <Label>Recipient phone</Label>
              <Input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="0244123456"
                maxLength={10}
              />
            </div>
            <Button
              className="w-full"
              disabled={mut.isPending || code.length !== 8 || phone.length !== 10}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? "Claiming..." : "Claim free data"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
