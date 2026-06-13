'use client';

import { useState, useEffect } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react';

interface Settings {
  hasApiKey: boolean;
  keyPreview: string | null;
  updatedAt: string | null;
}

interface TestResult {
  success: boolean;
  message: string;
}

export function ProviderImportSettingsContent() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/provider-import-settings');
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      setSaveError('Please enter an API key.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/provider-import-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: apiKey.trim() }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setSaveError(data?.message || 'Failed to save API key.');
        return;
      }

      setSaveSuccess(true);
      setApiKey('');
      setSettings(data);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      setSaveError('Failed to connect. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/provider-import-settings/test');
      const data = await res.json().catch(() => null);
      setTestResult(data ?? { success: false, message: 'Unknown error.' });
    } catch {
      setTestResult({ success: false, message: 'Failed to connect to backend.' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-2xl font-bold text-[hsl(var(--foreground))]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
            <KeyRound className="h-5 w-5 text-violet-500" />
          </div>
          Provider Import AI Settings
        </h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          Manage the Google Gemini API key used for AI-powered document extraction. This key is stored securely in the database and never exposed to customers.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Current Status Card */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[hsl(var(--foreground))]">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
            Current Status
          </h2>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading settings…
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--muted))]/50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  {settings?.hasApiKey ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">API key configured</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-amber-600 dark:text-amber-400">No API key configured</span>
                    </>
                  )}
                </div>
                {settings?.hasApiKey && settings.keyPreview && (
                  <code className="rounded-md bg-[hsl(var(--muted))] px-2 py-1 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                    {settings.keyPreview}
                  </code>
                )}
              </div>

              {settings?.updatedAt && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Last updated:{' '}
                  {new Date(settings.updatedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}

              {settings?.hasApiKey && (
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 text-amber-500" />
                  )}
                  Test Connection
                </button>
              )}

              {testResult && (
                <div
                  className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                    testResult.success
                      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                      : 'border-red-500/20 bg-red-500/5 text-red-500'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Update API Key Card */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-[hsl(var(--foreground))]">
            <KeyRound className="h-4 w-4 text-[hsl(var(--primary))]" />
            {settings?.hasApiKey ? 'Update API Key' : 'Configure API Key'}
          </h2>
          <p className="mb-5 text-sm text-[hsl(var(--muted-foreground))]">
            Enter your Google Gemini API key. It will be stored securely in the database and never returned to customers.
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                Google Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setSaveError(''); setSaveSuccess(false); }}
                  placeholder="AIza…"
                  className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 pr-12 text-sm text-[hsl(var(--foreground))] outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {saveError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                API key saved successfully.
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save API Key
            </button>
          </div>
        </div>

        {/* Help Card */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[hsl(var(--foreground))]">
            <Info className="h-4 w-4 text-blue-500" />
            How to get a Google Gemini API Key
          </h3>
          <ol className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-bold text-[hsl(var(--foreground))]">1</span>
              Go to{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"
              >
                aistudio.google.com/app/apikey <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-bold text-[hsl(var(--foreground))]">2</span>
              Sign in with your Google account and click <strong className="text-[hsl(var(--foreground))]">Create API key</strong>.
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-bold text-[hsl(var(--foreground))]">3</span>
              Copy the key (it starts with <code className="rounded bg-[hsl(var(--muted))] px-1 font-mono text-xs">AIza</code>) and paste it above.
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-bold text-[hsl(var(--foreground))]">4</span>
              The system uses <strong className="text-[hsl(var(--foreground))]">gemini-2.0-flash-exp</strong> for fast, cost-effective extraction.
            </li>
          </ol>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Gemini API has a free tier. For production use, ensure your quota covers your expected extraction volume.
          </div>
        </div>
      </div>
    </div>
  );
}
