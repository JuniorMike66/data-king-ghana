import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { CheckCircle2, Smartphone, ShieldCheck } from "lucide-react";
import { DataKingLoader } from "@/components/dataking-loader";
import { detectMomoProvider, providerLabel, MOMO_PROVIDERS, type MomoProvider } from "@/lib/paystack-networks";

type ChargePayload =
  | { kind: "wallet_topup"; amount: number; user_id: string; email: string }
  | {
      kind: "store_order";
      store_slug: string;
      package_id: string;
      recipient_phone: string;
      customer_email: string;
    }
  | { kind: "activation"; activation_kind: "store" | "subagent"; user_id: string; email: string };

export interface PaystackMomoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display amount inclusive of Paystack fee, optional for UX only. */
  totalDisplay?: { net: number; fee: number; gross: number } | null;
  /** Builds the charge payload at submit time. Return null to abort. */
  buildPayload: () => ChargePayload | null;
  /** Called after Paystack confirms success and the backend processed it. */
  onSuccess: (info: { reference: string; kind: string }) => void;
  /**
   * Default phone & email to pre-fill (customer entered them already on the page).
   * For wallet topup, leave empty to ask user.
   */
  defaults?: { phone?: string; email?: string };
  /** Custom title for the dialog header. */
  title?: string;
}

type Step = "collect" | "charging" | "otp" | "waiting" | "success";

export function PaystackMomoDialog({
  open, onOpenChange, totalDisplay, buildPayload, onSuccess, defaults, title = "Pay with Mobile Money",
}: PaystackMomoDialogProps) {
  const [step, setStep] = useState<Step>("collect");
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [provider, setProvider] = useState<MomoProvider | "">("");
  const [otp, setOtp] = useState("");
  const [reference, setReference] = useState("");
  const [displayText, setDisplayText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setStep("collect"); setPhone(defaults?.phone ?? ""); setEmail(defaults?.email ?? "");
      setProvider(""); setOtp(""); setReference(""); setDisplayText(null); setSubmitting(false);
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
      pollCount.current = 0;
    }
  }, [open, defaults?.phone, defaults?.email]);

  // Auto-detect provider from phone prefix
  const detected = useMemo(() => detectMomoProvider(phone), [phone]);
  useEffect(() => { if (detected && !provider) setProvider(detected); }, [detected, provider]);

  const stopPolling = () => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  };

  const startPolling = (ref: string) => {
    stopPolling();
    pollCount.current = 0;
    pollTimer.current = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > 60) { // ~3 minutes
        stopPolling();
        toast.error("Payment is taking longer than expected. Check your phone and try again.");
        setStep("collect"); setSubmitting(false);
        return;
      }
      try {
        const r = await fetch("/api/public/v1/pay/check", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: ref }),
        });
        const j = await r.json();
        if (j.status === "success") {
          stopPolling();
          setStep("success");
          // Customer-facing: always success (real status only in admin)
          onSuccess({ reference: ref, kind: j.kind ?? "unknown" });
          setTimeout(() => onOpenChange(false), 1400);
        } else if (j.status === "failed" || j.status === "abandoned") {
          stopPolling();
          toast.error("Payment was not completed. Please try again.");
          setStep("collect"); setSubmitting(false);
        }
      } catch {
        // ignore single poll failures
      }
    }, 3000);
  };

  const submitCharge = async () => {
    if (!/^0\d{9}$/.test(phone)) return toast.error("Enter a valid 10-digit MoMo number");
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email");
    if (!provider) return toast.error("Select your MoMo network");
    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true); setStep("charging");
    try {
      const r = await fetch("/api/public/v1/pay/charge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, momo: { phone, provider }, email: (payload as any).email ?? email, customer_email: (payload as any).customer_email ?? email }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error ?? "Payment could not be started");
        setStep("collect"); setSubmitting(false); return;
      }
      setReference(j.reference);
      setDisplayText(j.display_text ?? null);
      handlePaystackStatus(j.status, j.reference);
    } catch (e: any) {
      toast.error(e.message ?? "Network error");
      setStep("collect"); setSubmitting(false);
    }
  };

  const handlePaystackStatus = (status: string, ref: string) => {
    if (status === "send_otp") { setStep("otp"); setSubmitting(false); return; }
    if (status === "pay_offline" || status === "pending" || status === "open_url") {
      setStep("waiting"); setSubmitting(false); startPolling(ref); return;
    }
    if (status === "success") {
      setStep("success"); stopPolling();
      onSuccess({ reference: ref, kind: "unknown" });
      setTimeout(() => onOpenChange(false), 1400);
      return;
    }
    if (status === "failed") {
      toast.error("Payment failed. Please try again.");
      setStep("collect"); setSubmitting(false); return;
    }
    // Unknown — fall back to polling.
    setStep("waiting"); setSubmitting(false); startPolling(ref);
  };

  const submitOtp = async () => {
    if (!/^\d{4,8}$/.test(otp)) return toast.error("Enter the OTP sent to your phone");
    setSubmitting(true);
    try {
      const r = await fetch("/api/public/v1/pay/submit-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, otp }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error ?? "OTP rejected");
        setSubmitting(false); return;
      }
      setDisplayText(j.display_text ?? null);
      handlePaystackStatus(j.status, reference);
    } catch (e: any) {
      toast.error(e.message ?? "Network error");
      setSubmitting(false);
    }
  };

  const iCompleted = async () => {
    setSubmitting(true);
    try {
      const r = await fetch("/api/public/v1/pay/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const j = await r.json();
      if (j.status === "success") {
        stopPolling(); setStep("success");
        onSuccess({ reference, kind: j.kind ?? "unknown" });
        setTimeout(() => onOpenChange(false), 1400);
      } else {
        toast.info("Still waiting for Paystack to confirm. Hang on…");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't check status");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting || step === "waiting" || step === "otp") onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        {step === "collect" && (
          <div className="space-y-3">
            {totalDisplay && (
              <div className="rounded-lg p-3 bg-muted text-sm space-y-1">
                <div className="flex justify-between"><span>Amount</span><span>GH₵{totalDisplay.net.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>Paystack fee</span><span>GH₵{totalDisplay.fee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t border-border pt-1"><span>Total</span><span>GH₵{totalDisplay.gross.toFixed(2)}</span></div>
              </div>
            )}
            <div>
              <Label>MoMo number</Label>
              <Input placeholder="0241234567" value={phone} maxLength={10} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
              {detected && <div className="text-[11px] text-muted-foreground mt-1">Detected: {providerLabel(detected)}</div>}
            </div>
            <div>
              <Label>Network</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {MOMO_PROVIDERS.map((p) => (
                  <button key={p.value} type="button" onClick={() => setProvider(p.value)}
                    className={`px-3 py-2 rounded-md border text-xs font-semibold ${provider === p.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {!defaults?.email && (
              <div>
                <Label>Email (for receipt)</Label>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            )}
            <Button className="w-full h-11" disabled={submitting} onClick={submitCharge}>Pay now</Button>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Secure mobile money via Paystack</p>
          </div>
        )}

        {step === "charging" && (
          <div className="py-8"><DataKingLoader label="Starting your payment…" /></div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <Smartphone className="w-8 h-8 mx-auto text-primary" />
              <div className="font-semibold">Enter the OTP from your phone</div>
              <div className="text-xs text-muted-foreground">{displayText ?? "Paystack just texted you a 6-digit code"}</div>
            </div>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} className="h-12 w-10" />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button className="w-full h-11" disabled={submitting || otp.length < 4} onClick={submitOtp}>
              {submitting ? "Submitting…" : "Submit OTP"}
            </Button>
          </div>
        )}

        {step === "waiting" && (
          <div className="space-y-4 text-center">
            <Smartphone className="w-10 h-10 mx-auto text-primary animate-pulse" />
            <div>
              <div className="font-semibold">Approve the prompt on your phone</div>
              <div className="text-xs text-muted-foreground mt-1">
                {displayText ?? "A MoMo prompt has been sent. Enter your PIN to approve."}
              </div>
            </div>
            <DataKingLoader label="Waiting for payment…" size={36} />
            <Button variant="outline" className="w-full" onClick={iCompleted} disabled={submitting}>
              {submitting ? "Checking…" : "I've completed payment"}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { stopPolling(); onOpenChange(false); }}>
              Cancel
            </Button>
          </div>
        )}

        {step === "success" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
            <div className="font-semibold text-lg">Payment confirmed</div>
            <div className="text-sm text-muted-foreground">Processing your request…</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
