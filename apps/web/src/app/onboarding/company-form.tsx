'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Globe,
  MapPin,
  Phone,
  Mail,
  Users,
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Factory,
  ShoppingCart,
  ArrowRightLeft,
} from 'lucide-react';

const STEPS = [
  { id: 'role', label: 'Company Role' },
  { id: 'basics', label: 'Basic Info' },
  { id: 'details', label: 'Details' },
  { id: 'review', label: 'Review' },
];

const COMPANY_SIZES = [
  { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor', desc: '1 employee' },
  { value: 'SMALL', label: 'Small', desc: '2–50 employees' },
  { value: 'MEDIUM', label: 'Medium', desc: '51–250 employees' },
  { value: 'LARGE', label: 'Large', desc: '251–1000 employees' },
  { value: 'ENTERPRISE', label: 'Enterprise', desc: '1000+ employees' },
];

const INDUSTRIES = [
  'Manufacturing',
  'Construction',
  'Technology',
  'Healthcare',
  'Automotive',
  'Energy',
  'Food & Beverage',
  'Chemicals',
  'Aerospace & Defense',
  'Logistics & Transportation',
  'Retail',
  'Telecommunications',
  'Other',
];

interface FormData {
  roles: string[];
  legalName: string;
  website: string;
  country: string;
  city: string;
  industry: string;
  companySize: string;
  phoneNumber: string;
  email: string;
  description: string;
}

interface FormErrors {
  [key: string]: string;
}

export function CompanyForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<FormData>({
    roles: [],
    legalName: '',
    website: '',
    country: '',
    city: '',
    industry: '',
    companySize: '',
    phoneNumber: '',
    email: session?.user?.email || '',
    description: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const update = (field: keyof FormData, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const toggleRole = (role: string) => {
    const current = form.roles;
    if (current.includes(role)) {
      update('roles', current.filter((r) => r !== role));
    } else {
      update('roles', [...current, role]);
    }
  };

  const validateStep = (s: number): boolean => {
    const newErrors: FormErrors = {};

    if (s === 0) {
      if (form.roles.length === 0) newErrors.roles = 'Select at least one role';
    }

    if (s === 1) {
      if (!form.legalName.trim()) newErrors.legalName = 'Company name is required';
      if (form.legalName.trim().length < 2) newErrors.legalName = 'At least 2 characters';
      if (!form.country.trim()) newErrors.country = 'Country is required';
      if (form.website && !/^https?:\/\/.+/.test(form.website)) {
        newErrors.website = 'Enter a valid URL starting with http:// or https://';
      }
    }

    if (s === 2) {
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        newErrors.email = 'Enter a valid email';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    if (!validateStep(step)) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          legalName: form.legalName,
          website: form.website || undefined,
          country: form.country,
          city: form.city || undefined,
          industry: form.industry || undefined,
          companySize: form.companySize || undefined,
          phoneNumber: form.phoneNumber || undefined,
          email: form.email || undefined,
          description: form.description || undefined,
          roles: form.roles,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        // Redirect to dashboard after short delay for success animation
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        const data = await res.json().catch(() => null);
        setErrors({ submit: data?.message || 'Failed to create company. Please try again.' });
      }
    } catch {
      setErrors({ submit: 'Network error. Make sure the API is running.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="h-10 w-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Company profile created!
        </h2>
        <p className="mt-3 text-[hsl(var(--muted-foreground))]">
          Your company <strong>{form.legalName}</strong> has been set up. You can now start
          using the platform.
        </p>
        <a
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-6 py-3 text-sm font-semibold text-white transition-all hover:opacity-90"
        >
          Go to Dashboard
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Progress */}
      <div className="mb-10">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    i < step
                      ? 'bg-emerald-500 text-white'
                      : i === step
                        ? 'bg-[hsl(var(--primary))] text-white'
                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    i <= step
                      ? 'text-[hsl(var(--foreground))]'
                      : 'text-[hsl(var(--muted-foreground))]'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-px flex-1 transition-colors ${
                    i < step ? 'bg-emerald-500' : 'bg-[hsl(var(--border))]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm sm:p-8">
        {/* Step 0: Company Role */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
              How will your company use xProcurAI?
            </h2>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              Select one or both roles. You can change this later.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                {
                  value: 'BUYER',
                  label: 'Buyer',
                  desc: 'Source and manage suppliers',
                  Icon: ShoppingCart,
                },
                {
                  value: 'SUPPLIER',
                  label: 'Supplier',
                  desc: 'Get discovered by buyers',
                  Icon: Factory,
                },
              ].map(({ value, label, desc, Icon }) => (
                <button
                  key={value}
                  onClick={() => toggleRole(value)}
                  className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all ${
                    form.roles.includes(value)
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/40'
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      form.roles.includes(value)
                        ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-[hsl(var(--foreground))]">{label}</p>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{desc}</p>
                  </div>
                  {form.roles.includes(value) && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            {form.roles.length === 2 && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))]/5 px-4 py-2.5 text-sm text-[hsl(var(--primary))]">
                <ArrowRightLeft className="h-4 w-4 shrink-0" />
                Great — acting as both buyer and supplier.
              </div>
            )}
            {errors.roles && (
              <p className="mt-3 text-sm text-red-500">{errors.roles}</p>
            )}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
              Company basics
            </h2>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              Enter your company&apos;s legal name and location.
            </p>
            <div className="mt-6 space-y-5">
              <Field
                label="Legal Name"
                required
                icon={<Building2 className="h-4 w-4" />}
                error={errors.legalName}
              >
                <input
                  type="text"
                  value={form.legalName}
                  onChange={(e) => update('legalName', e.target.value)}
                  placeholder="Acme Corporation"
                  className="field-input"
                />
              </Field>
              <Field
                label="Website"
                icon={<Globe className="h-4 w-4" />}
                error={errors.website}
              >
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => update('website', e.target.value)}
                  placeholder="https://acme.com"
                  className="field-input"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Country"
                  required
                  icon={<MapPin className="h-4 w-4" />}
                  error={errors.country}
                >
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => update('country', e.target.value)}
                    placeholder="United States"
                    className="field-input"
                  />
                </Field>
                <Field label="City" icon={<MapPin className="h-4 w-4" />}>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                    placeholder="New York"
                    className="field-input"
                  />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
              Additional details
            </h2>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              Optional information to complete your profile.
            </p>
            <div className="mt-6 space-y-5">
              <Field label="Industry" icon={<Factory className="h-4 w-4" />}>
                <select
                  value={form.industry}
                  onChange={(e) => update('industry', e.target.value)}
                  className="field-input"
                >
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Company Size" icon={<Users className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {COMPANY_SIZES.map((size) => (
                    <button
                      key={size.value}
                      type="button"
                      onClick={() => update('companySize', size.value)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                        form.companySize === size.value
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--foreground))]'
                          : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/40'
                      }`}
                    >
                      <span className="font-medium">{size.label}</span>
                      <br />
                      <span className="text-xs opacity-70">{size.desc}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Phone"
                  icon={<Phone className="h-4 w-4" />}
                >
                  <input
                    type="tel"
                    value={form.phoneNumber}
                    onChange={(e) => update('phoneNumber', e.target.value)}
                    placeholder="+1-555-0100"
                    className="field-input"
                  />
                </Field>
                <Field
                  label="Email"
                  icon={<Mail className="h-4 w-4" />}
                  error={errors.email}
                >
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="contact@acme.com"
                    className="field-input"
                  />
                </Field>
              </div>
              <Field label="Description" icon={<FileText className="h-4 w-4" />}>
                <textarea
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Brief description of your company..."
                  rows={3}
                  className="field-input resize-none"
                />
              </Field>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
              Review your company profile
            </h2>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              Make sure everything looks good before creating.
            </p>
            <div className="mt-6 space-y-4">
              <ReviewRow label="Roles" value={form.roles.join(', ')} />
              <ReviewRow label="Legal Name" value={form.legalName} />
              {form.website && <ReviewRow label="Website" value={form.website} />}
              <ReviewRow label="Country" value={form.country} />
              {form.city && <ReviewRow label="City" value={form.city} />}
              {form.industry && <ReviewRow label="Industry" value={form.industry} />}
              {form.companySize && (
                <ReviewRow
                  label="Size"
                  value={COMPANY_SIZES.find((s) => s.value === form.companySize)?.label || form.companySize}
                />
              )}
              {form.phoneNumber && <ReviewRow label="Phone" value={form.phoneNumber} />}
              {form.email && <ReviewRow label="Email" value={form.email} />}
              {form.description && <ReviewRow label="Description" value={form.description} />}
            </div>
            {errors.submit && (
              <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-500">
                {errors.submit}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={prev}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div />
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Company
                  <Check className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  icon,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--foreground))]">
        {icon && <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))]/50 pb-3 last:border-0">
      <span className="text-sm text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="text-right text-sm font-medium text-[hsl(var(--foreground))]">{value}</span>
    </div>
  );
}
