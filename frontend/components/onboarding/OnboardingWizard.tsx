"use client";

import Image from "next/image";
import {
  BarChart3,
  Bitcoin,
  BookOpen,
  Building2,
  ChartCandlestick,
  CircleDashed,
  Clock3,
  Ellipsis,
  GraduationCap,
  LineChart,
  Sparkles,
  Users,
  UserRound,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { ContinueButton, KineticTitle, OnboardingShell, OptionCard } from "@/components/onboarding/OnboardingShell";
import { Logo } from "@/components/ui/Logo";
import { BrokerIcon } from "@/components/ui/BrokerIcon";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useAuth } from "@/components/providers/AuthProvider";
import { ApiError } from "@/lib/api";
import { BROKER_OPTIONS, isKnownBroker } from "@/lib/brokers";
import {
  CAPITAL_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  isReferralStepValid,
  MARKET_OPTIONS,
  needsReferralDetail,
  REFERRAL_DETAILS,
  REFERRAL_OPTIONS,
} from "@/lib/onboarding";

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 37.3 44 32 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

const CAPITAL_ICONS: Record<string, ReactNode> = {
  personal: <Wallet className="h-5 w-5 text-emerald-400" />,
  prop: <Building2 className="h-5 w-5 text-sky-400" />,
  not_started: <CircleDashed className="h-5 w-5 text-muted" />,
};

const MARKET_ICONS: Record<string, ReactNode> = {
  stocks: <LineChart className="h-4 w-4 text-emerald-400" />,
  options: <BookOpen className="h-4 w-4 text-pink-400" />,
  forex: <ChartCandlestick className="h-4 w-4 text-sky-400" />,
  crypto: <Bitcoin className="h-4 w-4 text-orange-400" />,
  futures: <Clock3 className="h-4 w-4 text-violet-400" />,
  cfd: <BarChart3 className="h-4 w-4 text-red-400" />,
  other: <Ellipsis className="h-4 w-4 text-muted" />,
};

const GOAL_ICONS: Record<string, ReactNode> = {
  journal: <BookOpen className="h-5 w-5 text-sky-400" />,
  analyze: <BarChart3 className="h-5 w-5 text-primary" />,
  backtest: <Clock3 className="h-5 w-5 text-violet-400" />,
  learn: <GraduationCap className="h-5 w-5 text-amber-400" />,
};

const REFERRAL_ICONS: Record<string, ReactNode> = {
  google: <GoogleG />,
  ai: <Sparkles className="h-4 w-4 text-primary" />,
  x: <span className="text-sm font-bold text-foreground">𝕏</span>,
  instagram: <span className="text-sm font-semibold text-pink-400">IG</span>,
  tiktok: <span className="text-sm font-semibold text-foreground">TT</span>,
  youtube: <span className="text-sm font-semibold text-red-500">YT</span>,
  reddit: <span className="text-sm font-semibold text-orange-400">r/</span>,
  community: <Users className="h-4 w-4 text-emerald-400" />,
  friend: <UserRound className="h-4 w-4 text-amber-400" />,
  other: <Ellipsis className="h-4 w-4 text-muted" />,
};

export function OnboardingWizard() {
  const { user, updateOnboarding, completeOnboarding } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [experience, setExperience] = useState<string | null>(null);
  const [capital, setCapital] = useState<string[]>([]);
  const [broker, setBroker] = useState("");
  const [brokerOther, setBrokerOther] = useState("");
  const [markets, setMarkets] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [referral, setReferral] = useState<string | null>(null);
  const [referralDetail, setReferralDetail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!user || hydrated) return;
    setStep(Math.min(6, Math.max(0, user.onboarding_step ?? 0)));
    setExperience(user.trading_experience ?? null);
    setCapital(user.capital_sources ?? []);
    const savedBroker = user.primary_broker ?? "";
    if (savedBroker && !isKnownBroker(savedBroker)) {
      setBroker("Other");
      setBrokerOther(savedBroker);
    } else {
      setBroker(savedBroker);
    }
    setMarkets(user.markets_traded ?? []);
    setGoals(user.onboarding_goals ?? []);
    setReferral(user.referral_source ?? null);
    setReferralDetail(user.referral_detail ?? null);
    setHydrated(true);
  }, [user, hydrated]);

  const brokerValue = broker === "Other" ? brokerOther.trim() : broker;

  const brokerSelectOptions = useMemo(
    () =>
      BROKER_OPTIONS.map((b) => ({
        value: b,
        label: b,
        icon: <BrokerIcon name={b} size={18} />,
      })),
    []
  );

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return Boolean(experience);
      case 2:
        return capital.length > 0;
      case 3:
        return Boolean(brokerValue);
      case 4:
        return markets.length > 0;
      case 5:
        return goals.length > 0;
      case 6:
        return isReferralStepValid(referral, referralDetail);
      default:
        return false;
    }
  }, [step, experience, capital, brokerValue, markets, goals, referral, referralDetail]);

  function toggleList(list: string[], id: string, exclusiveWith?: string) {
    if (exclusiveWith && id === exclusiveWith) {
      return list.includes(id) ? [] : [id];
    }
    let next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    if (exclusiveWith) next = next.filter((x) => x !== exclusiveWith);
    return next;
  }

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  async function persistAndNext() {
    setError(null);
    setSaving(true);
    try {
      if (step === 0) {
        await updateOnboarding({ onboarding_step: 1 });
        goTo(1);
        return;
      }
      if (step === 1) {
        await updateOnboarding({ onboarding_step: 2, trading_experience: experience });
        goTo(2);
        return;
      }
      if (step === 2) {
        await updateOnboarding({ onboarding_step: 3, capital_sources: capital });
        goTo(3);
        return;
      }
      if (step === 3) {
        await updateOnboarding({ onboarding_step: 4, primary_broker: brokerValue });
        goTo(4);
        return;
      }
      if (step === 4) {
        await updateOnboarding({ onboarding_step: 5, markets_traded: markets });
        goTo(5);
        return;
      }
      if (step === 5) {
        await updateOnboarding({ onboarding_step: 6, onboarding_goals: goals });
        goTo(6);
        return;
      }

      await updateOnboarding({
        onboarding_step: 6,
        referral_source: referral,
        referral_detail: referralDetail,
      });
      await completeOnboarding();
      router.push("/today");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function onBack() {
    setError(null);
    if (step > 0) goTo(step - 1);
  }

  function onSelectReferral(id: string) {
    setReferral(id);
    setReferralDetail(null);
  }

  const variants = {
    enter: (dir: number) => ({
      opacity: 0,
      rotateY: dir > 0 ? 28 : -28,
      z: -80,
      filter: "blur(8px)",
      scale: 0.94,
    }),
    center: {
      opacity: 1,
      rotateY: 0,
      z: 0,
      filter: "blur(0px)",
      scale: 1,
    },
    exit: (dir: number) => ({
      opacity: 0,
      rotateY: dir > 0 ? -22 : 22,
      z: -60,
      filter: "blur(8px)",
      scale: 0.96,
    }),
  };

  return (
    <OnboardingShell step={step} onBack={step > 0 ? onBack : undefined}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden [transform-style:preserve-3d]"
        >
          {step === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="relative mb-5 flex h-28 w-28 items-center justify-center">
                {[0, 1, 2].map((ring) => (
                  <motion.span
                    key={ring}
                    aria-hidden
                    className="absolute inset-0 rounded-full border border-primary/25"
                    style={{ inset: ring * 8 }}
                    animate={{ rotate: ring % 2 === 0 ? 360 : -360 }}
                    transition={{ duration: 10 + ring * 4, repeat: Infinity, ease: "linear" }}
                  />
                ))}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <motion.span
                    key={`dot-${i}`}
                    aria-hidden
                    className="absolute h-1.5 w-1.5 rounded-full bg-primary"
                    style={{ left: "50%", top: "50%" }}
                    animate={{
                      x: [0, Math.cos((i / 6) * Math.PI * 2) * 46, 0],
                      y: [0, Math.sin((i / 6) * Math.PI * 2) * 46, 0],
                      opacity: [0.3, 1, 0.3],
                      scale: [0.8, 1.25, 0.8],
                    }}
                    transition={{ duration: 3.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                  />
                ))}
                <motion.div
                  className="relative z-10"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  whileHover={{ scale: 1.04 }}
                >
                  <Logo size={112} />
                </motion.div>
              </div>
              <KineticTitle text="Welcome to TradeFix" className="sm:text-3xl" />
              <motion.p
                className="mt-2 max-w-md text-sm text-muted"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                The only tool you need to become a profitable trader.
              </motion.p>
              <motion.div
                className="mt-5 w-full max-w-xs"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48 }}
              >
                <ContinueButton onClick={persistAndNext} loading={saving} />
              </motion.div>
            </div>
          )}

          {step === 1 && (
            <StepFrame title="How long have you been trading?">
              <div className="space-y-2">
                {EXPERIENCE_OPTIONS.map((opt, i) => (
                  <OptionCard
                    key={opt.id}
                    index={i}
                    selected={experience === opt.id}
                    onClick={() => setExperience(opt.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={opt.icon}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                        <p className="text-xs text-muted">{opt.hint}</p>
                      </div>
                    </div>
                  </OptionCard>
                ))}
              </div>
              <ContinueButton disabled={!canContinue} loading={saving} onClick={persistAndNext} />
            </StepFrame>
          )}

          {step === 2 && (
            <StepFrame title="What do you use to Trade:" subtitle="Select all that apply">
              <div className="space-y-2">
                {CAPITAL_OPTIONS.map((opt, i) => (
                  <OptionCard
                    key={opt.id}
                    index={i}
                    selected={capital.includes(opt.id)}
                    onClick={() => setCapital(toggleList(capital, opt.id, "not_started"))}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/5 ring-1 ring-white/10">
                        {CAPITAL_ICONS[opt.id]}
                      </span>
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    </div>
                  </OptionCard>
                ))}
              </div>
              <ContinueButton disabled={!canContinue} loading={saving} onClick={persistAndNext} />
            </StepFrame>
          )}

          {step === 3 && (
            <StepFrame
              title="Who is your primary broker?"
              subtitle="Select only one"
              heroSrc="/onboarding/broker-hero.png"
            >
              <SearchableSelect
                value={broker}
                onChange={(next) => {
                  setBroker(next);
                  if (next !== "Other") setBrokerOther("");
                }}
                options={brokerSelectOptions}
                placeholder="Select broker"
                searchPlaceholder="Search brokers…"
                aria-label="Primary broker"
                triggerClassName="rounded-xl border-border bg-surface-2 px-4 py-3"
              />
              <AnimatePresence>
                {broker === "Other" && (
                  <motion.div
                    key="broker-other"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mt-3"
                  >
                    <input
                      value={brokerOther}
                      onChange={(e) => setBrokerOther(e.target.value)}
                      placeholder="Please specify"
                      className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <ContinueButton disabled={!canContinue} loading={saving} onClick={persistAndNext} />
            </StepFrame>
          )}

          {step === 4 && (
            <StepFrame title="What are you currently trading?" subtitle="Select all that apply">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MARKET_OPTIONS.map((opt, i) => (
                  <OptionCard
                    key={opt.id}
                    index={i}
                    selected={markets.includes(opt.id)}
                    onClick={() => setMarkets(toggleList(markets, opt.id))}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5">
                        {MARKET_ICONS[opt.id]}
                      </span>
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    </div>
                  </OptionCard>
                ))}
              </div>
              <ContinueButton disabled={!canContinue} loading={saving} onClick={persistAndNext} />
            </StepFrame>
          )}

          {step === 5 && (
            <StepFrame title="What are you looking to do with TradeFix?" subtitle="Select all that apply">
              <div className="space-y-2">
                {GOAL_OPTIONS.map((opt, i) => (
                  <OptionCard
                    key={opt.id}
                    index={i}
                    selected={goals.includes(opt.id)}
                    onClick={() => setGoals(toggleList(goals, opt.id))}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5 ring-1 ring-white/10">
                        {GOAL_ICONS[opt.id]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{opt.label}</p>
                        <p className="text-xs text-muted">{opt.description}</p>
                      </div>
                    </div>
                  </OptionCard>
                ))}
              </div>
              <ContinueButton disabled={!canContinue} loading={saving} onClick={persistAndNext} />
            </StepFrame>
          )}

          {step === 6 && (
            <StepFrame title="How did you hear about us?">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {REFERRAL_OPTIONS.map((opt, i) => (
                  <OptionCard
                    key={opt.id}
                    index={i}
                    selected={referral === opt.id}
                    onClick={() => onSelectReferral(opt.id)}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/5">
                        {REFERRAL_ICONS[opt.id]}
                      </span>
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    </div>
                  </OptionCard>
                ))}
              </div>

              <AnimatePresence
                onExitComplete={() => undefined}
              >
                {referral && needsReferralDetail(referral) && (
                  <motion.div
                    key={referral}
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    onAnimationComplete={() => {
                      // Keep Finish visible when the detail panel expands
                      document
                        .getElementById("onboarding-continue")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                    className="mt-5 overflow-hidden rounded-xl border border-border bg-surface-2 p-4"
                  >
                    <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted">
                      Please specify
                    </p>
                    {referral === "other" ? (
                      <input
                        value={referralDetail ?? ""}
                        onChange={(e) => setReferralDetail(e.target.value)}
                        placeholder="Please specify"
                        className="w-full rounded-lg border border-primary/40 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                      />
                    ) : (
                      <div className="flex flex-wrap justify-center gap-2">
                        {(REFERRAL_DETAILS[referral] ?? []).map((d) => (
                          <motion.button
                            key={d.id}
                            type="button"
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setReferralDetail(d.id)}
                            className={
                              referralDetail === d.id
                                ? "rounded-full border border-primary bg-primary/15 px-3.5 py-1.5 text-sm text-primary"
                                : "rounded-full border border-border px-3.5 py-1.5 text-sm text-muted hover:border-foreground/20"
                            }
                          >
                            {d.label}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <ContinueButton
                disabled={!canContinue}
                loading={saving}
                onClick={persistAndNext}
                label="Finish"
              />
            </StepFrame>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-center text-sm text-negative"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </OnboardingShell>
  );
}

function StepFrame({
  title,
  subtitle,
  heroSrc,
  children,
}: {
  title: string;
  subtitle?: string;
  heroSrc?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <div className={`my-auto w-full ${heroSrc ? "py-2" : "py-2 sm:py-3"}`}>
        {heroSrc && (
          <motion.div
            className="mb-2 flex justify-center sm:mb-3"
            initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            whileHover={{ scale: 1.06, rotate: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
          >
            <Image
              src={heroSrc}
              alt=""
              width={200}
              height={208}
              className="h-auto w-full max-w-[120px] object-contain drop-shadow-[0_12px_40px_hsl(var(--primary)/0.25)] sm:max-w-[140px]"
              priority
            />
          </motion.div>
        )}
        <KineticTitle text={title} />
        {subtitle && (
          <motion.p
            className="mt-1 text-center text-xs text-muted sm:text-sm"
            initial={{ opacity: 0, letterSpacing: "0.08em" }}
            animate={{ opacity: 1, letterSpacing: "0.01em" }}
            transition={{ delay: 0.2, duration: 0.45 }}
          >
            {subtitle}
          </motion.p>
        )}
        <div className="mt-3 pb-4 sm:mt-4 sm:pb-5">{children}</div>
      </div>
    </div>
  );
}
