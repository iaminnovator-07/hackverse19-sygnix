import {
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Flame,
  GraduationCap,
  LineChart,
  LockKeyhole,
  Medal,
  PlayCircle,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { faqs, features, launchStats, subjects, testimonials } from "@/data/studentHub";
import {
  CheckItem,
  LaunchBadge,
  Logo,
  PrimaryLink,
  SecondaryLink,
  SectionHeader,
  StatCard,
  accentClasses,
} from "./Primitives";

const featureIcons = [
  BookOpen,
  Video,
  ClipboardCheck,
  LineChart,
  Trophy,
  Flame,
  FileText,
  Target,
  CheckCircle2,
  Rocket,
];

const subjectIcons = {
  mathematics: Brain,
  science: Sparkles,
  english: BookOpen,
  marathi: FileText,
  hindi: GraduationCap,
  "social-science": Users,
};

const premiumFeatures = [
  "Full Notes Access",
  "All Quizzes",
  "Premium Tests",
  "Progress Analytics",
  "Premium Resources",
  "Future Updates Included",
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Diamond Student Hub home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex">
            <a href="#features" className="hover:text-blue-700">
              Features
            </a>
            <a href="#subjects" className="hover:text-blue-700">
              Subjects
            </a>
            <a href="#pricing" className="hover:text-blue-700">
              Pricing
            </a>
            <a href="#about" className="hover:text-blue-700">
              About
            </a>
            <Link to="/login" className="hover:text-blue-700">
              Login
            </Link>
          </div>
          <Link
            to="/register"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
          >
            Get Started
            <Rocket className="size-4" aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <section className="overflow-hidden border-b border-slate-200 bg-gradient-to-br from-white via-sky-50 to-teal-50">
        <div className="mx-auto grid min-h-[calc(100vh-68px)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-14">
          <div className="max-w-3xl">
            <LaunchBadge />
            <h1 className="mt-6 max-w-3xl text-5xl font-extrabold leading-[1.02] text-slate-950 sm:text-6xl lg:text-7xl">
              Learn Smarter . Score Higher .
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Chapter-wise Notes, Video Lessons, Practice Tests and Smart Progress Tracking built for
              Maharashtra Board Students.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
              >
                Start Free
                <Rocket className="size-4" aria-hidden="true" />
              </Link>
              <SecondaryLink href="#features" icon={PlayCircle}>
                Explore Features
              </SecondaryLink>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">
                <span className="mr-2 text-slate-400 line-through">₹499</span>
                <span className="text-blue-700">₹69 only</span>
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
                Limited-time offer
              </span>
            </div>
          </div>

          <div className="relative">
            <img
              src="/diamond-student-hub-hero.png"
              alt="Diamond Student Hub analytics dashboard with notes, quizzes, video lessons, and leaderboard cards"
              className="w-full rounded-lg border border-white shadow-2xl shadow-blue-200/70"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-12">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {launchStats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </section>

      <section id="features" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Premium Learning System"
            title="Everything Class 9 students need to study, practice, and improve."
            copy="The product experience is built for daily learning: notes first, practice next, then analytics that show what to revise."
            align="center"
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {features.map((feature, index) => {
              const Icon = featureIcons[index] ?? BookOpen;

              return (
                <article
                  key={feature.title}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
                >
                  <div className="grid size-11 place-items-center rounded-lg bg-blue-50 text-blue-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold text-slate-950">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="How It Works"
            title="A simple rhythm for better marks."
            copy="Create an account, learn chapter concepts, practice quizzes, track progress, and unlock premium resources when ready."
          />
          <div className="mt-9 grid gap-4 md:grid-cols-5">
            {["Create Free Account", "Start Learning", "Practice Quizzes", "Track Progress", "Upgrade to Premium"].map(
              (step, index) => (
                <article key={step} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid size-10 place-items-center rounded-lg bg-slate-950 text-sm font-extrabold text-white">
                    {index + 1}
                  </div>
                  <h3 className="mt-5 text-base font-extrabold text-slate-950">{step}</h3>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section id="subjects" className="border-y border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Subjects"
            title="Class 9 Maharashtra Board subjects in one study hub."
            copy="Each subject includes chapter counts, descriptions, notes, videos, formula sheets, important questions, and quizzes."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => {
              const Icon = subjectIcons[subject.id];
              const tone = accentClasses[subject.accent];

              return (
                <article
                  key={subject.id}
                  className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className={`grid size-12 place-items-center rounded-lg ${tone.icon}`}>
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold text-slate-950">{subject.name}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{subject.description}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-bold text-slate-500">{subject.chaptersCount} chapters</span>
                    <span className={`text-sm font-extrabold ${tone.text}`}>{subject.progress}% ready</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <SectionHeader
              eyebrow="Premium Pricing"
              title="Launch access priced for students."
              copy="Unlock the complete learning stack for notes, quizzes, tests, analytics, resources, and future updates."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink href="/register">Unlock Premium</PrimaryLink>
              <SecondaryLink href="#faq" icon={LockKeyhole}>
                View FAQ
              </SecondaryLink>
            </div>
          </div>
          <article className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-teal-50 p-6 shadow-lg shadow-blue-100">
            <LaunchBadge />
            <div className="mt-6 flex flex-wrap items-end gap-3">
              <span className="text-2xl font-extrabold text-slate-400 line-through">₹499</span>
              <span className="text-6xl font-extrabold text-slate-950">₹69</span>
              <span className="pb-2 text-sm font-bold text-slate-500">only</span>
            </div>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {premiumFeatures.map((item) => (
                <CheckItem key={item}>{item}</CheckItem>
              ))}
            </ul>
            <Link
              to="/register"
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Unlock Premium
              <Rocket className="size-4" aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-950 py-20 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <span className="inline-flex rounded-full bg-amber-400 px-3 py-1 text-sm font-extrabold text-slate-950">
              Coming Soon
            </span>
            <h2 className="mt-5 text-4xl font-extrabold">SSC Board Preparation</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Class 10 support is being prepared with board exam practice, PYQs, full test series,
              revision resources, and a 90%+ strategy path.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {["Board Exam Preparation", "PYQs", "Full Test Series", "90%+ Strategy", "Revision Resources"].map(
              (item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/10 p-5">
                  <Medal className="size-6 text-amber-300" aria-hidden="true" />
                  <p className="mt-4 text-lg font-extrabold">{item}</p>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section id="about" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Trusted By Students, Parents, And Teachers"
            title="Built for focused Maharashtra Board preparation."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <article key={testimonial.name} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-base leading-7 text-slate-700">"{testimonial.quote}"</p>
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="font-extrabold text-slate-950">{testimonial.name}</p>
                  <p className="text-sm font-semibold text-slate-500">{testimonial.role}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeader eyebrow="FAQ" title="Common questions." align="center" />
          <div className="mt-10 grid gap-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-extrabold text-slate-950">{faq.question}</summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Logo />
          <div className="flex flex-wrap gap-5 text-sm font-bold text-slate-500">
            <a href="#about" className="hover:text-blue-700">
              About
            </a>
            <a href="mailto:support@diamondstudenthub.com" className="hover:text-blue-700">
              Contact
            </a>
            <a href="#faq" className="hover:text-blue-700">
              Privacy Policy
            </a>
            <a href="#faq" className="hover:text-blue-700">
              Terms
            </a>
            <a href="#faq" className="hover:text-blue-700">
              Support
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
