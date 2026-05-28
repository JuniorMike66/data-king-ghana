import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Zap, Shield, Wallet, ArrowRight, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-background adinkra-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold leading-tight tracking-wide">DATAKING GHANA</div>
              <div className="text-[10px] text-muted-foreground">Powering Ghana's Digital Economy</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#buy" className="hover:text-primary transition">Buy Data</a>
            <a href="#agent" className="hover:text-primary transition">Become an Agent</a>
            <Link to="/login" className="hover:text-primary transition">Login</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="md:hidden text-sm text-muted-foreground">Login</Link>
            <Link to="/signup">
              <Button size="sm" className="bg-gradient-to-r from-primary to-amber-600 text-primary-foreground">Sign up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
            <Zap className="w-3 h-3 text-primary" /> Instant data delivery · No expiry
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
            Ghana's Smartest <span className="bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent">Data Marketplace</span>
          </h1>
          <p className="text-muted-foreground mt-5 max-w-2xl mx-auto text-base sm:text-lg">
            Buy MTN, AirtelTigo and Telecel bundles at the best prices. Become an agent and run your own data reselling business with your custom storefront.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="bg-gradient-to-r from-primary to-amber-600 text-primary-foreground gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">I already have an account</Button>
            </Link>
          </div>
        </div>

        {/* Buy Data */}
        <section id="buy" className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Smartphone, title: "Buy Data", desc: "Top up any Ghanaian SIM with the cheapest bundles. No expiry. Instant delivery.", cta: "Login to buy", to: "/login" as const },
              { icon: Wallet, title: "Become an Agent", desc: "Get wholesale pricing, your own storefront, and earn on every sale.", cta: "Sign up as agent", to: "/signup" as const },
              { icon: Shield, title: "Trusted & Secure", desc: "Encrypted payments via Paystack. Mobile Money & Card supported.", cta: "Learn more", to: "/signup" as const },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
                <Link to={f.to} className="text-sm text-primary mt-4 inline-flex items-center gap-1">{f.cta} <ArrowRight className="w-3 h-3" /></Link>
              </div>
            ))}
          </div>
        </section>

        {/* Become an Agent */}
        <section id="agent" className="bg-gradient-to-br from-primary/10 to-amber-700/5 border-y border-border">
          <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold">Run Your Own Data Business</h2>
              <p className="text-muted-foreground mt-3">
                Sign up as an agent to unlock wholesale pricing and a free storefront under <span className="font-mono">/s/your-name</span>.
                Set your own selling prices, share the link, and let customers pay directly with mobile money or card.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <li>✓ Custom storefront URL</li>
                <li>✓ Set your own bundle prices</li>
                <li>✓ Built-in payments (Mobile Money / Card)</li>
                <li>✓ Optional WhatsApp channel for your customers</li>
              </ul>
              <div className="mt-6 flex gap-3">
                <Link to="/signup">
                  <Button className="bg-gradient-to-r from-primary to-amber-600 text-primary-foreground">Become an Agent</Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline">Agent Login</Button>
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
              <div className="text-xs text-muted-foreground">YOUR STOREFRONT</div>
              <div className="font-mono text-sm mt-1">datakinggh.com/s/your-name</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {["1GB ₵5", "2GB ₵9", "5GB ₵20", "10GB ₵38"].map((s) => (
                  <div key={s} className="rounded-lg bg-muted p-3 text-center font-semibold text-sm">{s}</div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 text-center">Sample bundles · Set your own prices</p>
            </div>
          </div>
        </section>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DataKing Ghana · All rights reserved
      </footer>
    </div>
  );
}
