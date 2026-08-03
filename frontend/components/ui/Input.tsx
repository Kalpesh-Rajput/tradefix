import clsx from "clsx";
import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-white focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold",
        className
      )}
      {...props}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-gray-400">{children}</label>;
}
