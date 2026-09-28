import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
  icon?: LucideIcon;
}

export interface EmptyStateFaq {
  icon?: LucideIcon;
  title: string;
  body: string;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  badge?: string;
  title: string;
  description: ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  faqs?: EmptyStateFaq[];
  variant?: "default" | "welcome";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  badge,
  title,
  description,
  primaryAction,
  secondaryAction,
  faqs,
  variant = "default",
  className,
}: EmptyStateProps) {
  const isWelcome = variant === "welcome";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-card",
        className,
      )}
    >
      <div className="px-6 py-12 lg:py-16 text-center max-w-2xl mx-auto">
        {badge && (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-primary-soft-foreground">
            {badge}
          </div>
        )}
        {Icon && (
          <div
            className={cn(
              "mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl",
              isWelcome ? "bg-primary-soft text-primary-soft-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-7 w-7" />
          </div>
        )}
        <h3 className="mb-2 font-display text-xl font-bold tracking-tight lg:text-2xl">{title}</h3>
        <div className="text-sm lg:text-base text-muted-foreground mb-6">{description}</div>

        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {primaryAction && (
              <Button
                size="lg"
                variant={primaryAction.variant || "default"}
                onClick={primaryAction.onClick}
              >
                {primaryAction.icon && <primaryAction.icon className="h-4 w-4" />}
                {primaryAction.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                size="lg"
                variant={secondaryAction.variant || "outline"}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4" />}
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>

      {faqs && faqs.length > 0 && (
        <div className="border-t border-border bg-muted/50 px-6 py-6">
          <p className="etiqueta mb-4 text-center">
            Lo que necesitas saber
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {faqs.map((faq) => (
              <div
                key={faq.title}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong"
              >
                {faq.icon && (
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
                    <faq.icon className="h-4 w-4" />
                  </div>
                )}
                <h4 className="font-medium text-sm mb-1">{faq.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{faq.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
