import { Crown } from "lucide-react";

export function DataKingLoader({ label, size = 48, className = "" }: { label?: string; size?: number; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin"
          style={{ animationDuration: "1.1s" }}
        />
        <div className="absolute inset-1 rounded-full bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center shadow-lg">
          <Crown className="text-primary-foreground" style={{ width: size * 0.45, height: size * 0.45 }} />
        </div>
      </div>
      <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        {label ?? "DataKing"}
      </div>
    </div>
  );
}

export function DataKingFullPageLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background adinkra-bg">
      <DataKingLoader label={label} size={64} />
    </div>
  );
}
