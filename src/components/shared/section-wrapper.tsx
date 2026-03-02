import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionWrapperProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
  readonly dark?: boolean;
}

export function SectionWrapper({ children, className, id, dark }: SectionWrapperProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28",
        dark && "bg-[#0a0a0a] text-white",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}
