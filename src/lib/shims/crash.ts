/** No-op crash reporting (contract 5). Replaced by the selected crash module. */

export type CrashContext = Record<string, unknown>;

/** A tester report for the crash SDK's own feedback channel (feedback/feedback's Sentry sink). */
export interface CrashFeedback {
  message: string;
  email?: string;
  /** Local file uri of a screenshot to attach, if any. */
  screenshotUri?: string;
  context?: CrashContext;
}

export interface Crash {
  capture(err: unknown, ctx?: CrashContext): void;
  /**
   * Optional: deliver a tester report through the SDK's feedback channel. Only the crash
   * module implements it, and only while it can deliver (DSN set); the feedback module's
   * Sentry sink is available when this is a function. Rejects when nothing was delivered.
   */
  sendFeedback?(feedback: CrashFeedback): Promise<void> | void;
}

/** `false` here; the crash module exports `true` so the crash-report toggle is shown. */
export const crashEnabled = false;

export const crash: Crash = {
  capture: (err, ctx) => {
    if (__DEV__) console.error("[crash]", err, ctx ?? "");
  },
};
