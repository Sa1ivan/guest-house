"use client";

import { useEffect, useState } from "react";
import { validStay } from "@/components/stay-search";
import type { Stay } from "@/components/stay-search";
import { bookingEndpoint } from "@/lib/site";

type Period = { start: string; end: string; nights: number; nightlyBaseRub: number; nightlyExtraRub: number };

export type Quote = { status: "unpriced" } | {
  status: "capacity"; neededExtraBeds: number;
} | {
  status: "priced";
  nights: number;
  baseRub: number;
  extrasRub: number;
  totalRub: number;
  signature: string;
  periods: Period[];
};

export type QuoteResponse = { quotes: Record<string, Quote>; acceptingRequests: boolean };

export function useQuote(stay: Stay, hasPublishedRates: boolean, room?: string, extraBeds = 0) {
  const request = validStay(stay) && hasPublishedRates
    ? JSON.stringify({ ...stay, room, extraBeds })
    : "";
  const [response, setResponse] = useState<{ request: string; data?: QuoteResponse; error?: string }>();

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();

    fetch(bookingEndpoint("quote"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: request,
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
    }).then(async (result) => {
      const body = await result.json() as QuoteResponse & { message?: string };
      if (controller.signal.aborted) return;
      if (result.ok) setResponse({ request, data: body });
      else setResponse({ request, error: body.message ?? "Расчёт временно недоступен." });
    }).catch(() => {
      if (!controller.signal.aborted) setResponse({ request, error: "Расчёт временно недоступен." });
    });
    return () => controller.abort();
  }, [request]);

  return {
    request,
    data: request && response?.request === request ? response.data : undefined,
    loading: Boolean(request && response?.request !== request),
    error: request && response?.request === request ? response.error : undefined,
  };
}
