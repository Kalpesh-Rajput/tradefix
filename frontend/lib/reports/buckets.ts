export type NamedBucket = {
  key: string;
  label: string;
  order: number;
  min: number;
  max: number;
};

function bucket(key: string, label: string, order: number, min: number, max: number): NamedBucket {
  return { key, label, order, min, max };
}

function match(value: number, buckets: NamedBucket[]): NamedBucket {
  for (const b of buckets) {
    if (value >= b.min && value < b.max) return b;
  }
  return buckets[buckets.length - 1];
}

/** Inclusive lower bound, exclusive upper bound. Minutes. */
export const DURATION_BUCKETS: NamedBucket[] = [
  bucket("lt_1m", "<1m", 0, 0, 1),
  bucket("1_2m", "1-1:59m", 1, 1, 2),
  bucket("2_5m", "2-4:59m", 2, 2, 5),
  bucket("5_10m", "5-9:59m", 3, 5, 10),
  bucket("10_30m", "10-29:59m", 4, 10, 30),
  bucket("30_60m", "30-59:59m", 5, 30, 60),
  bucket("1_2h", "1-1:59h", 6, 60, 120),
  bucket("2_4h", "2-3:59h", 7, 120, 240),
  bucket("4h_plus", "4h>", 8, 240, Number.POSITIVE_INFINITY),
];

export function durationBucket(minutes: number): NamedBucket {
  const m = Number.isFinite(minutes) && minutes >= 0 ? minutes : 0;
  return match(m, DURATION_BUCKETS);
}

export const VOLUME_BUCKETS: NamedBucket[] = [
  bucket("1_4", "1 to 4", 0, 1, 5),
  bucket("5_9", "5 to 9", 1, 5, 10),
  bucket("10_19", "10 to 19", 2, 10, 20),
  bucket("20_49", "20 to 49", 3, 20, 50),
  bucket("50_plus", "50+", 4, 50, Number.POSITIVE_INFINITY),
];

export function volumeBucket(quantity: number): NamedBucket {
  const q = Number.isFinite(quantity) ? Math.abs(quantity) : 0;
  if (q < 1) return bucket("lt_1", "<1", -1, 0, 1);
  return match(q, VOLUME_BUCKETS);
}

export const POSITION_SIZE_BUCKETS: NamedBucket[] = [
  bucket("lt_1k", "<1k", 0, 0, 1000),
  bucket("1k_5k", "1k to 5k", 1, 1000, 5000),
  bucket("5k_10k", "5k to 10k", 2, 5000, 10000),
  bucket("10k_25k", "10k to 25k", 3, 10000, 25000),
  bucket("25k_plus", "25k+", 4, 25000, Number.POSITIVE_INFINITY),
];

export function positionSizeBucket(value: number): NamedBucket {
  const v = Number.isFinite(value) ? Math.abs(value) : 0;
  return match(v, POSITION_SIZE_BUCKETS);
}

export const R_BUCKETS: NamedBucket[] = [
  bucket("neg", "<0R", 0, Number.NEGATIVE_INFINITY, 0),
  bucket("0_1", "0 to 1R", 1, 0, 1),
  bucket("1_2", "1 to 2R", 2, 1, 2),
  bucket("2_3", "2 to 3R", 3, 2, 3),
  bucket("3_plus", "3R+", 4, 3, Number.POSITIVE_INFINITY),
];

export function rMultipleBucket(r: number): NamedBucket {
  const v = Number.isFinite(r) ? r : 0;
  return match(v, R_BUCKETS);
}

export const DTE_BUCKETS: NamedBucket[] = [
  bucket("0_7", "0–7 DTE", 0, 0, 8),
  bucket("8_21", "8–21 DTE", 1, 8, 22),
  bucket("22_45", "22–45 DTE", 2, 22, 46),
  bucket("46_90", "46–90 DTE", 3, 46, 91),
  bucket("90_plus", "90+ DTE", 4, 91, Number.POSITIVE_INFINITY),
];

export function dteBucket(days: number): NamedBucket {
  const v = Number.isFinite(days) ? Math.max(0, days) : 0;
  return match(v, DTE_BUCKETS);
}

export const PRICE_BUCKETS: NamedBucket[] = [
  bucket("lt_10", "<10", 0, 0, 10),
  bucket("10_50", "10 to 50", 1, 10, 50),
  bucket("50_100", "50 to 100", 2, 50, 100),
  bucket("100_500", "100 to 500", 3, 100, 500),
  bucket("500_plus", "500+", 4, 500, Number.POSITIVE_INFINITY),
];

export function priceBucket(price: number): NamedBucket {
  const v = Number.isFinite(price) ? Math.abs(price) : 0;
  return match(v, PRICE_BUCKETS);
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const INSTRUMENT_LABELS: Record<string, string> = {
  stock: "Stocks",
  option: "Options",
  future: "Futures",
  forex: "Forex",
  crypto: "Crypto",
};
