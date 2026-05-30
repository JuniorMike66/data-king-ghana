import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Schema = z.object({
  reference: z.string().min(4).max(80),
  otp: z.string().regex(/^\d{4,8}$/, "OTP must be 4–8 digits"),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/public/v1/pay/submit-otp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.issues }, 400);

        const res = await fetch("https://api.paystack.co/charge/submit_otp", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ otp: parsed.data.otp, reference: parsed.data.reference }),
        });
        const j: any = await res.json();
        if (!res.ok || !j.status) return json({ error: j.message ?? "OTP submission failed" }, 502);

        return json({
          reference: parsed.data.reference,
          status: j.data?.status,
          display_text: j.data?.display_text ?? null,
        });
      },
    },
  },
});
