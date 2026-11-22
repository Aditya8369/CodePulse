"use client";

import * as React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, AnimatePresence } from "motion/react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export interface CopyButtonProps extends React.ComponentProps<typeof Button> {
  value: string;
  timeout?: number;
  onCopySuccess?: () => void;
  onCopyError?: (error: unknown) => void;
  showTooltip?: boolean;
  tooltipText?: string;
  copiedTooltipText?: string;
}

function CopyButton({
  value,
  timeout = 2000,
  onCopySuccess,
  onCopyError,
  showTooltip = true,
  tooltipText = "Copy to clipboard",
  copiedTooltipText = "Copied!",
  className,
  variant = "outline",
  size = "icon-sm",
  children,
  onClick,
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false);

  const handleCopy = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;

      try {
        await navigator.clipboard.writeText(value);
        setHasCopied(true);
        toast.success("Copied to clipboard!");
        onCopySuccess?.();
      } catch (err) {
        toast.error("Failed to copy to clipboard");
        onCopyError?.(err);
      }
    },
    [value, onClick, onCopySuccess, onCopyError],
  );

  React.useEffect(() => {
    if (!hasCopied) return;
    const timer = setTimeout(() => {
      setHasCopied(false);
    }, timeout);
    return () => clearTimeout(timer);
  }, [hasCopied, timeout]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleCopy}
      aria-label={hasCopied ? copiedTooltipText : tooltipText}
      title={
        showTooltip ? (hasCopied ? copiedTooltipText : tooltipText) : undefined
      }
      className={cn("relative transition-all overflow-hidden", className)}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        {hasCopied ? (
          <motion.span
            key="copied"
            data-testid="copy-icon-check"
            initial={{ scale: 0.6, opacity: 0, rotate: -45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0, rotate: 45 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center justify-center text-emerald-400"
          >
            <Check className="size-3.5 text-emerald-400" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            data-testid="copy-icon-clipboard"
            initial={{ scale: 0.6, opacity: 0, rotate: 45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0, rotate: -45 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center justify-center text-muted-foreground group-hover/button:text-foreground"
          >
            <Copy className="size-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
      {children}
    </Button>
  );
}

export { Button, buttonVariants, CopyButton };
