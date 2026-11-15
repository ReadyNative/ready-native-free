/** No-op tester feedback (contract 5). Replaced by the selected feedback module. */

/**
 * What a tester sends: the note, and optionally a reply-to address and a screenshot. The
 * module adds the app version, build, update id, device, OS and current route itself.
 */
export interface FeedbackReport {
  message: string;
  /** Reply-to address the tester typed, if any. */
  email?: string;
  /** Local file uri of a screenshot, if attached. */
  screenshotUri?: string;
}

export interface Feedback {
  /** Open the feedback sheet. No-op when the module is not selected or feedback is off in this build. */
  open(): void;
  /** Deliver a report through the first available sink; resolves to the sink id used. */
  send(report: FeedbackReport): Promise<string | undefined>;
}

/** `false` here; the feedback module exports whether feedback is on in this build. */
export const feedbackEnabled = false;

export const feedback: Feedback = {
  open: () => {},
  send: () => Promise.resolve(undefined),
};
