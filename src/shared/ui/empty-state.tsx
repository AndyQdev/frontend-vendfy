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
        "rounded-xl border border-border bg-card overflow-hidden",
        isWelcome && "bg-gradient-to-br from-emerald-50 via-card to-card dark:from-emerald-950/30 dark:via-card dark:to-card",
        className,
      )}
    >
      <div className="px-6 py-12 lg:py-16 text-center max-w-2xl mx-auto">
        {badge && (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50 px-3 py-1 rounded-full mb-4">
            {badge}
          </div>
        )}
        {Icon && (
          <div
            className={cn(
              "h-14 w-14 rounded-2xl mx-auto mb-5 flex items-center justify-center",
              isWelcome
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-7 w-7" />
          </div>
        )}
        <h3 className="text-xl lg:text-2xl font-semibold tracking-tight mb-2">{title}</h3>
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
        <div className="border-t border-border bg-muted/30 px-6 py-6">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground text-center mb-4">
            Lo que necesitas saber
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {faqs.map((faq) => (
              <div
                key={faq.title}
                className="bg-card border border-border rounded-lg p-4 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
              >
                {faq.icon && (
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-2">
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
