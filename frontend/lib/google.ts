/**
 * Google Identity Services (GIS) helper for ID-token sign-in.
 */

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

const GIS_SCRIPT = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            isDismissedMoment: () => boolean;
            getNotDisplayedReason: () => string;
          }) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              logo_alignment?: "left" | "center";
            }
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function isGoogleConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID);
}

export function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")));
      if (window.google?.accounts?.id) resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Google script"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Request a Google ID token via account chooser.
 * Uses a temporary official GIS button click (reliable popup) as primary path.
 */
export async function requestGoogleIdToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google sign-in is not configured");
  }

  await loadGoogleScript();

  if (!window.google?.accounts?.id) {
    throw new Error("Google Identity Services unavailable");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      container.remove();
      overlay.remove();
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55)";

    const container = document.createElement("div");
    container.style.cssText =
      "background:#111;padding:24px;border-radius:12px;border:1px solid rgba(255,255,255,0.1)";

    const label = document.createElement("p");
    label.textContent = "Continue with Google";
    label.style.cssText = "color:#fff;font:500 14px/1.4 system-ui;margin:0 0 12px;text-align:center";
    container.appendChild(label);

    const btnHost = document.createElement("div");
    container.appendChild(btnHost);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText =
      "display:block;width:100%;margin-top:12px;padding:8px;border:0;border-radius:8px;background:transparent;color:#a1a1aa;cursor:pointer;font:500 13px system-ui";
    cancelBtn.onclick = () => finish(() => reject(new Error("Google sign-in cancelled")));
    container.appendChild(cancelBtn);

    overlay.onclick = (e) => {
      if (e.target === overlay) finish(() => reject(new Error("Google sign-in cancelled")));
    };

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    window.google!.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (response.credential) {
          finish(() => resolve(response.credential));
        } else {
          finish(() => reject(new Error("No credential returned from Google")));
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google!.accounts.id.renderButton(btnHost, {
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 280,
      logo_alignment: "left",
    });
  });
}
