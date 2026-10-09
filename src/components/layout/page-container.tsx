import { cn } from "@/lib/utils";

/** Zone de contenu : 1 200 px max, marges 32 px (16 px sous 768 px), comme la maquette. */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <main
      className={cn("mx-auto w-full max-w-content px-4 py-6 md:px-8 md:py-8", className)}
      {...props}
    />
  );
}
