import Constants from "expo-constants";

import { usePasswordPrompt, type AskPasswordOptions } from "@/components/password-prompt";
import { onboardingEnabled } from "@/hooks/use-onboarding-redirect";
import { deleteServerData } from "@/lib/account-data";
import { analytics } from "@/lib/analytics";
import { auth, type AuthUser } from "@/lib/auth";
import { openUrl } from "@/lib/browser";
import { confirm } from "@/lib/confirm";
import { consent, consentEnabled } from "@/lib/consent";
import { crash } from "@/lib/crash";
import { payments } from "@/lib/payments";
import { exportLocalData, shareDataExport, wipeLocalData } from "@/lib/privacy";
import { privacyCategories } from "@/lib/privacy-categories";
import { readynative } from "@/lib/readynative";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  setLanguage,
  useLanguage,
  useT,
  type Language,
  type TFn,
} from "@/lib/i18n";
import { useConsentState, type ConsentCategory } from "@/stores/consent";
import { resetOnboarding } from "@/stores/onboarding";
import {
  Box,
  Button,
  Card,
  Divider,
  Icon,
  Row,
  Screen,
  Switch,
  Text,
  setThemeMode,
  toast,
  useResolvedMode,
  useThemeMode,
  type ThemeMode,
} from "@/components/ui";

const MODES: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type LinkRow = {
  key: keyof typeof readynative.urls;
  label: string;
  /** SF Symbol + its Material counterpart; `Row` only auto-renders the SF name. */
  icon: string;
  fallback: string;
};

const LINKS: LinkRow[] = [
  { key: "website", label: "Website", icon: "globe", fallback: "language" },
  { key: "support", label: "Support", icon: "lifepreserver", fallback: "support_agent" },
  { key: "privacy", label: "Privacy policy", icon: "lock.shield", fallback: "privacy_tip" },
  { key: "terms", label: "Terms of service", icon: "doc.text", fallback: "description" },
];

// Widened so the picker keeps compiling when `LANGUAGES` holds a single locale (`--i18n none`).
const languages: readonly Language[] = LANGUAGES;

/** Rows bring their own 16pt padding, so a row card is unpadded and clips them. */
const ROW_CARD = { overflow: "hidden" } as const;

function RowIcon({ name, fallback }: { name: string; fallback: string }) {
  return <Icon name={name} fallback={fallback} size={22} color="mutedForeground" />;
}

function isUsableUrl(url: string): boolean {
  return url.length > 0 && url !== "mailto:";
}

/** The root layout's `useSignOutCleanup` wipes local data on every sign-out. */
function signOut(): void {
  auth.signOut().catch((err: unknown) => {
    crash.capture(err, { where: "settings.signOut" });
  });
}

/** `my-data-<date>.json`: local data minus credentials, plus the account profile. */
async function exportData(t: TFn, user: AuthUser | null): Promise<void> {
  try {
    const json = await exportLocalData({ user });
    await shareDataExport(json, { title: t("My data") });
  } catch (err) {
    crash.capture(err, { where: "settings.exportData" });
    toast.show({ title: t("Could not export data"), kind: "error" });
  }
}

const CATEGORY_ROWS: Record<ConsentCategory, { title: string; icon: string; fallback: string }> = {
  analytics: { title: "Analytics", icon: "chart.bar", fallback: "bar_chart" },
  crash: { title: "Crash reports", icon: "ant", fallback: "bug_report" },
};

function errorCode(err: unknown): unknown {
  return typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
}

/** Derived, not imported: every auth module's `deleteAccount` takes it, not all export the type. */
type DeleteAccountOptions = Parameters<typeof auth.deleteAccount>[0];

/**
 * The optional pre-flight of the auth contract, typed locally: auth modules that declare their
 * own `Auth` interface (Supabase) may not list it yet.
 */
type DeletePreflight = { prepareDeleteAccount?(options?: DeleteAccountOptions): Promise<void> };

/** What a failed deletion step means for the flow. */
type DeleteOutcome = "retry-with-password" | "retry-wrong-password" | "sign-in-again" | "failed";

function outcomeOf(err: unknown): DeleteOutcome {
  const code = errorCode(err);
  if (code === "REAUTH_REQUIRED") return "retry-with-password";
  if (code === "INVALID_PASSWORD") return "retry-wrong-password";
  if (code === "SIGN_IN_AGAIN") return "sign-in-again";
  return "failed";
}

/**
 * Confirm, then delete in an order where nothing is erased until the provider will accept the
 * deletion:
 *   a. `auth.prepareDeleteAccount` - re-authentication (password) or "deletion is off";
 *   b. analytics flushes and stops, the store SDK logs out - nothing re-creates the person;
 *   c. `deleteServerData()` erases the user at the server's third-party services;
 *   d. `auth.deleteAccount()`;
 *   e. local data is wiped (`useSignOutCleanup` also runs on the sign-out that follows).
 * A cancelled password prompt or a refusal in (a) leaves everything as it was.
 */
async function deleteAccount(
  t: TFn,
  askPassword: (opts?: AskPasswordOptions) => Promise<string | null>
): Promise<void> {
  const ok = await confirm({
    title: t("Delete account"),
    message: t("This permanently deletes your account and its data."),
    confirmLabel: t("Delete"),
    cancelLabel: t("Cancel"),
    destructive: true,
  });
  if (!ok) return;

  const fail = (err: unknown): void => {
    // The reason (a missing migration, a dashboard switch) is for you, not for users.
    console.warn("[settings] delete account failed:", err instanceof Error ? err.message : err);
    crash.capture(err, { where: "settings.deleteAccount" });
    toast.show({ title: t("Could not delete account"), kind: "error" });
  };
  /** The password to retry with, or `null` when the flow stops here (cancelled or failed). */
  const handle = async (err: unknown): Promise<string | null> => {
    const outcome = outcomeOf(err);
    if (outcome === "retry-with-password" || outcome === "retry-wrong-password") {
      return askPassword({ retry: outcome === "retry-wrong-password" });
    }
    if (outcome === "sign-in-again") {
      toast.show({
        title: t("Sign in again to delete your account"),
        description: t("For your security, deleting needs a recent sign-in."),
        kind: "error",
      });
    } else {
      fail(err);
    }
    return null;
  };

  let options: DeleteAccountOptions | undefined;
  for (;;) {
    // a. Will the provider accept it? Nothing has been touched yet.
    try {
      await (auth as DeletePreflight).prepareDeleteAccount?.(options);
    } catch (err) {
      const password = await handle(err);
      if (password === null) return;
      options = { password };
      continue;
    }
    // b. + c. + d.
    try {
      await analytics.suspend();
      await payments.logOut?.();
      await deleteServerData();
      await auth.deleteAccount(options);
    } catch (err) {
      analytics.resume();
      // Only a provider without `prepareDeleteAccount` gets here with a re-auth code.
      const password = await handle(err);
      if (password === null) return;
      options = { password };
      continue;
    }
    // e.
    try {
      await wipeLocalData();
    } catch (err) {
      crash.capture(err, { where: "settings.deleteAccount.wipe" });
    }
    toast.show({ title: t("Account deleted") });
    return;
  }
}

export function SettingsScreen() {
  const t = useT();
  const language = useLanguage();
  const choices = consent.useConsent();
  const consentState = useConsentState();
  const [passwordPrompt, askPassword] = usePasswordPrompt();
  const mode = useThemeMode();
  const resolved = useResolvedMode();
  const links = LINKS.filter((l) => isUsableUrl(readynative.urls[l.key]));
  const version = Constants.expoConfig?.version ?? t("unknown");
  const session = auth.useSession();

  return (
    <Screen scroll>
      <Box gap={4}>
        <Text variant="title">{t("Settings")}</Text>

        <Card>
          <Box gap={3}>
            <Text variant="heading">{t("Appearance")}</Text>
            <Box row gap={2}>
              {MODES.map((m) => (
                <Button
                  key={m.value}
                  size="sm"
                  variant={mode === m.value ? "primary" : "outline"}
                  onPress={() => setThemeMode(m.value)}
                >
                  {t(m.label)}
                </Button>
              ))}
            </Box>
            <Text variant="caption">
              {t("Currently {{mode}}", { mode: t(resolved === "dark" ? "Dark" : "Light") })}
            </Text>
          </Box>
        </Card>

        {languages.length > 1 ? (
          <Card>
            <Box gap={3}>
              <Text variant="heading">{t("Language")}</Text>
              <Box row gap={2}>
                {languages.map((lang) => (
                  <Button
                    key={lang}
                    size="sm"
                    variant={language === lang ? "primary" : "outline"}
                    onPress={() => void setLanguage(lang)}
                  >
                    {LANGUAGE_LABELS[lang]}
                  </Button>
                ))}
              </Box>
            </Box>
          </Card>
        ) : null}

        {session.status === "authenticated" ? (
          <Card p={0} style={ROW_CARD}>
            <Box gap={2} px={4} pt={4} pb={2}>
              <Text variant="heading">{t("Account")}</Text>
              <Text>{session.user.name ?? session.user.email ?? session.user.id}</Text>
              {session.user.name && session.user.email ? (
                <Text variant="caption">{session.user.email}</Text>
              ) : null}
            </Box>
            <Divider spacing={0} />
            <Row
              title={t("Sign out")}
              leading={<RowIcon name="rectangle.portrait.and.arrow.right" fallback="logout" />}
              destructive
              chevron={false}
              onPress={signOut}
            />
            <Divider spacing={0} />
            <Row
              title={t("Delete account")}
              leading={<RowIcon name="person.crop.circle.badge.xmark" fallback="person_remove" />}
              destructive
              chevron={false}
              onPress={() => void deleteAccount(t, askPassword)}
            />
          </Card>
        ) : null}

        <Card p={0} style={ROW_CARD}>
          <Box px={4} pt={4} pb={2}>
            <Text variant="heading">{t("Privacy")}</Text>
          </Box>
          {consentEnabled
            ? privacyCategories.map((category) => (
                <Box key={category}>
                  <Divider spacing={0} />
                  <Row
                    title={t(CATEGORY_ROWS[category].title)}
                    leading={
                      <RowIcon
                        name={CATEGORY_ROWS[category].icon}
                        fallback={CATEGORY_ROWS[category].fallback}
                      />
                    }
                    trailing={
                      <Switch
                        value={choices[category]}
                        onValueChange={(v) => consent.set({ [category]: v })}
                      />
                    }
                  />
                </Box>
              ))
            : null}
          {privacyCategories.includes("analytics") ? (
            <>
              <Divider spacing={0} />
              <Row
                title={t("Do not sell or share my personal information")}
                leading={<RowIcon name="hand.raised" fallback="do_not_touch" />}
                trailing={
                  <Switch
                    value={consentState.doNotSell}
                    onValueChange={(v) => consent.setDoNotSell(v)}
                  />
                }
              />
            </>
          ) : null}
          <Divider spacing={0} />
          <Row
            title={t("Export my data")}
            leading={<RowIcon name="square.and.arrow.up" fallback="ios_share" />}
            chevron={false}
            onPress={() => void exportData(t, session.user)}
          />
        </Card>

        {links.length > 0 ? (
          <Card p={0} style={ROW_CARD}>
            <Box px={4} pt={4} pb={2}>
              <Text variant="heading">{t("Links")}</Text>
            </Box>
            {links.map((l, i) => (
              <Box key={l.key}>
                {i > 0 ? <Divider spacing={0} /> : null}
                <Row
                  title={t(l.label)}
                  leading={<RowIcon name={l.icon} fallback={l.fallback} />}
                  onPress={() => openUrl(readynative.urls[l.key])}
                />
              </Box>
            ))}
          </Card>
        ) : null}

        {onboardingEnabled ? (
          <Card p={0} style={ROW_CARD}>
            <Box px={4} pt={4} pb={2}>
              <Text variant="heading">{t("Onboarding")}</Text>
            </Box>
            <Row
              title={t("Reset onboarding")}
              leading={<RowIcon name="arrow.counterclockwise" fallback="restart_alt" />}
              chevron={false}
              onPress={() => {
                resetOnboarding();
                toast.show({ title: t("Onboarding reset") });
              }}
            />
          </Card>
        ) : null}

        <Text variant="caption" align="center">
          {t("Version {{version}}", { version })}
        </Text>
      </Box>
      {passwordPrompt}
    </Screen>
  );
}
