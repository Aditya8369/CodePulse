"use client";

import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { motion, AnimatePresence } from "motion/react";
import { X, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  clearable?: boolean;
  onClear?: () => void;
  startIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      value,
      defaultValue,
      onChange,
      onClear,
      clearable,
      startIcon,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState<string>(
      (defaultValue as string) || "",
    );
    const currentValue = isControlled ? String(value ?? "") : internalValue;

    const inputRef = React.useRef<HTMLInputElement | null>(null);

    // Merge forwarded ref and internal ref
    const setRefs = React.useCallback(
      (element: HTMLInputElement | null) => {
        inputRef.current = element;
        if (typeof ref === "function") {
          ref(element);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLInputElement | null>).current =
            element;
        }
      },
      [ref],
    );

    const isClearable =
      clearable ?? (type === "search" || onClear !== undefined);

    const showClearButton =
      isClearable && !disabled && currentValue.length > 0;

    const handleClear = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isControlled) {
          setInternalValue("");
        }

        if (inputRef.current) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          )?.set;
          nativeInputValueSetter?.call(inputRef.current, "");

          const syntheticEvent = new Event("input", { bubbles: true });
          inputRef.current.dispatchEvent(syntheticEvent);

          inputRef.current.focus();
        }

        onClear?.();
      },
      [isControlled, onClear],
    );

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isControlled) {
          setInternalValue(e.target.value);
        }
        onChange?.(e);
      },
      [isControlled, onChange],
    );

    if (!isClearable && !startIcon) {
      return (
        <InputPrimitive
          ref={ref}
          type={type}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          disabled={disabled}
          data-slot="input"
          className={cn(
            "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            className,
          )}
          {...props}
        />
      );
    }

    return (
      <div className="relative flex w-full items-center">
        {startIcon && (
          <div className="absolute left-2.5 flex items-center pointer-events-none text-muted-foreground">
            {startIcon}
          </div>
        )}
        <InputPrimitive
          ref={setRefs}
          type={type}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          disabled={disabled}
          data-slot="input"
          className={cn(
            "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            startIcon && "pl-8",
            isClearable && "pr-8",
            className,
          )}
          {...props}
        />
        <AnimatePresence>
          {showClearButton && (
            <motion.button
              type="button"
              tabIndex={-1}
              aria-label="Clear input"
              data-testid="input-clear-button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={handleClear}
              className="absolute right-2 flex items-center justify-center p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

Input.displayName = "Input";

export interface SearchInputProps extends Omit<InputProps, "type"> {}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (props, ref) => {
    return (
      <Input
        ref={ref}
        type="search"
        clearable
        startIcon={<Search className="w-3.5 h-3.5" />}
        {...props}
      />
    );
  },
);

SearchInput.displayName = "SearchInput";

export { Input, SearchInput };
export default Input;
