export const SITE_NAME = "NoShowZero";
export const SITE_DESCRIPTION =
  "Eliminate no-shows, fill empty slots, and boost revenue with AI-powered appointment management.";
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
] as const;

export const INDUSTRIES = [
  { name: "Healthcare", icon: "Stethoscope", description: "Clinics, hospitals, telehealth" },
  { name: "Dental", icon: "SmilePlus", description: "Dental offices & orthodontics" },
  { name: "Salon & Spa", icon: "Scissors", description: "Hair salons, spas, beauty" },
  { name: "Auto Service", icon: "Car", description: "Mechanics, detailing, dealers" },
  { name: "Fitness", icon: "Dumbbell", description: "Gyms, personal training, yoga" },
  { name: "Professional", icon: "Briefcase", description: "Consulting, legal, financial" },
] as const;

export type PlanTier = "growth" | "pro" | "enterprise";

export interface PricingPlan {
  readonly name: string;
  readonly tier: PlanTier;
  readonly monthlyPrice: number;
  readonly annualPrice: number;
  readonly description: string;
  readonly features: readonly string[];
  readonly highlighted: boolean;
  readonly cta: string;
  readonly limits: {
    readonly appointments: string;
    readonly locations: string;
    readonly users: string;
  };
}

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    name: "Growth",
    tier: "growth",
    monthlyPrice: 199,
    annualPrice: 169,
    description: "Perfect for solo practitioners and small practices.",
    highlighted: false,
    cta: "Start Free Trial",
    limits: { appointments: "1,000/mo", locations: "2", users: "5" },
    features: [
      "1,000 appointments/month",
      "Up to 2 locations",
      "WhatsApp + SMS + Email reminders",
      "Basic waitlist",
      "REST API access",
      "5 team members",
      "Basic analytics & reporting",
      "Email support",
    ],
  },
  {
    name: "Professional",
    tier: "pro",
    monthlyPrice: 499,
    annualPrice: 399,
    description: "For growing businesses with multiple locations.",
    highlighted: true,
    cta: "Start Free Trial",
    limits: { appointments: "10,000/mo", locations: "10", users: "25" },
    features: [
      "10,000 appointments/month",
      "Up to 10 locations",
      "WhatsApp + SMS + Email reminders",
      "AI-powered smart waitlist",
      "Calendar optimization engine",
      "REST API + Webhooks",
      "25 team members",
      "Advanced analytics + ROI dashboard",
      "Custom reminder templates",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    monthlyPrice: 999,
    annualPrice: 849,
    description: "For large organizations and hospital networks.",
    highlighted: false,
    cta: "Start Free Trial",
    limits: { appointments: "Unlimited", locations: "Unlimited", users: "Unlimited" },
    features: [
      "Unlimited appointments",
      "Unlimited locations",
      "WhatsApp + SMS + Email reminders",
      "AI + priority waitlist",
      "Full calendar optimization",
      "Full API + FHIR + SSO",
      "Unlimited team members",
      "Custom analytics & reporting",
      "Dedicated account manager",
      "SLA guarantee",
      "White-label option",
    ],
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "How does the 14-day free trial work?",
    answer:
      "Sign up and get full access to your chosen plan for 14 days — no credit card required. If you love it, add your payment details to continue. If not, your account simply pauses.",
  },
  {
    question: "What channels do reminders support?",
    answer:
      "We send reminders via WhatsApp, SMS, and email. You can configure which channels to use per appointment type, and customize the message templates and timing.",
  },
  {
    question: "How does the AI waitlist work?",
    answer:
      "When a slot opens up (cancellation or no-show), our AI scores waitlisted patients based on urgency, reliability, time preference, distance, and more — then automatically offers the slot to the best match.",
  },
  {
    question: "Can I integrate with my existing scheduling software?",
    answer:
      "Yes! Our REST API and webhooks let you connect NoShowZero with any scheduling system. We provide SDKs, documentation, and sample code to get you started in minutes.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Absolutely. We use end-to-end encryption, SOC 2 compliant infrastructure, and follow HIPAA guidelines for healthcare data. Your data never leaves our secure cloud.",
  },
  {
    question: "Can I switch plans later?",
    answer:
      "Yes, upgrade or downgrade at any time. Changes take effect at the start of your next billing cycle. If you upgrade mid-cycle, we prorate the difference.",
  },
  {
    question: "What happens if I exceed my appointment limit?",
    answer:
      "We'll notify you when you reach 80% of your limit. If you exceed it, reminders continue working but new appointments queue until the next cycle — or you can upgrade instantly.",
  },
  {
    question: "Do you offer discounts for annual billing?",
    answer:
      "Yes! Annual billing saves you ~15-20% compared to monthly. Growth drops from $199/mo to $169/mo, Professional from $499/mo to $399/mo, and Enterprise from $999/mo to $849/mo.",
  },
] as const;

export const TESTIMONIALS = [
  {
    name: "Dr. Sarah Chen",
    role: "Owner, Bright Smile Dental",
    content:
      "Our no-show rate dropped from 22% to under 4% in the first month. The AI waitlist fills cancelled slots within minutes. It's been a game-changer for our practice.",
    avatar: "SC",
  },
  {
    name: "Marco Rossi",
    role: "Manager, UrbanFit Gym",
    content:
      "We used to lose thousands every month to missed PT sessions. NoShowZero's smart reminders and automatic rebooking recovered over $12K in the first quarter.",
    avatar: "MR",
  },
  {
    name: "Lisa Park",
    role: "Owner, Glow Beauty Studio",
    content:
      "Setup took 15 minutes with the API. Now our clients get WhatsApp reminders, and when someone cancels, the next person on the waitlist gets notified instantly.",
    avatar: "LP",
  },
] as const;

export const STATS = [
  { value: 23, suffix: "%", prefix: "", label: "Average no-show rate across industries" },
  { value: 150, suffix: "B", prefix: "$", label: "Lost annually to missed appointments" },
  { value: 67, suffix: "%", prefix: "", label: "Of no-shows simply forgot their appointment" },
] as const;

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Connect Your Calendar",
    description: "Integrate with your existing scheduling system via our API or use our built-in dashboard. Setup takes under 15 minutes.",
    icon: "CalendarSync",
  },
  {
    step: 2,
    title: "We Remind Your Clients",
    description: "Smart multi-channel reminders via WhatsApp, SMS, and email — timed perfectly based on AI analysis of your client behavior.",
    icon: "Bell",
  },
  {
    step: 3,
    title: "Empty Slots Get Filled",
    description: "When someone cancels, our AI-powered waitlist instantly finds the best replacement — scoring by urgency, reliability, and preference.",
    icon: "UserCheck",
  },
] as const;

export const FEATURES = [
  {
    title: "Smart Reminders",
    description: "AI-timed reminders via WhatsApp, SMS, and email that reduce no-shows by up to 80%.",
    icon: "Bell",
  },
  {
    title: "AI Waitlist",
    description: "Automatically fill cancelled slots by scoring waitlisted clients on urgency, reliability, and preferences.",
    icon: "ListChecks",
  },
  {
    title: "Calendar Optimization",
    description: "AI analyzes your schedule to reduce gaps, cluster appointments, and maximize daily throughput.",
    icon: "CalendarDays",
  },
  {
    title: "Real-time Dashboard",
    description: "Monitor no-show rates, revenue recovered, waitlist performance, and trends at a glance.",
    icon: "LayoutDashboard",
  },
  {
    title: "Multi-location",
    description: "Manage multiple branches from one account with per-location analytics and team permissions.",
    icon: "MapPin",
  },
  {
    title: "Developer API",
    description: "REST API with webhooks for seamless integration with any scheduling or EHR system.",
    icon: "Code",
  },
] as const;
