"use client";

import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";
import {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useState,
} from "react";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted transition-[border-color,box-shadow,background-color] duration-fast hover:border-[var(--color-border-strong,var(--color-border))] focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-55 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/20 motion-reduce:transition-none";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldClass, className)} {...props} />;
}

export function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={clsx(fieldClass, "pr-10", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition hover:text-foreground disabled:opacity-40"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(fieldClass, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(fieldClass, className)} {...props} />;
}

export function Label({
  children,
  className,
  required,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={clsx("mb-1.5 block text-xs font-medium text-muted", className)} {...props}>
      {children}
      {required ? (
        <span className="ml-0.5 text-destructive" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-destructive">
      {children}
    </p>
  );
}
