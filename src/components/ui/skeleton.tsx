import { cn } from "@/lib/utils";

/** Shimmering placeholder for loading states (reuses the `shimmer` keyframe). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md animate-shimmer bg-[length:200%_100%]", className)}
      style={{
        backgroundImage:
          "linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted-foreground)/0.12) 37%, hsl(var(--muted)) 63%)",
      }}
      {...props}
    />
  );
}

export { Skeleton };
