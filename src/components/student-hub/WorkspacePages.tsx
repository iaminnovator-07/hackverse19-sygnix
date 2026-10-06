import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  Eye,
  FileQuestion,
  FileText,
  Flame,
  GraduationCap,
  LineChart as LineChartIcon,
  Lock,
  Medal,
  PlayCircle,
  Star,
  Target,
  Trophy,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  leaderboard,
  monthlyGrowth,
  quizCategories,
  recentActivity,
  resources,
  subjects,
  upcomingTests,
  weeklyPerformance,
  type Subject,
} from "@/data/studentHub";
import { CheckItem, LockedPill, ProgressBar, accentClasses } from "./Primitives";

function PageTitle({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-sm font-bold text-blue-700">{eyebrow}</p>
      <h2 className="mt-1 text-3xl font-extrabold text-slate-950">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: keyof typeof accentClasses;
}) {
  const accent = accentClasses[tone];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`grid size-11 place-items-center rounded-lg ${accent.card}`}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-5 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-semibold text-slate-500">{detail}</p>
    </article>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-extrabold text-slate-950">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="font-bold text-slate-600">
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
}

function WeeklyPerformanceChart() {
  return (
    <Panel className="min-h-[320px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-950">Weekly Performance</h3>
          <p className="text-sm font-semibold text-slate-500">Score and study minutes by day</p>
        </div>
        <LineChartIcon className="size-5 text-blue-700" aria-hidden="true" />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={weeklyPerformance} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} fill="url(#scoreFill)" />
            <Line type="monotone" dataKey="minutes" stroke="#14b8a6" strokeWidth={3} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function SubjectProgressCard({ subject }: { subject: Subject }) {
  const tone = accentClasses[subject.accent];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-950">{subject.name}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{subject.chaptersCount} chapters</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${tone.card}`}>{subject.progress}%</span>
      </div>
      <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{subject.description}</p>
      <div className="mt-4">
        <ProgressBar value={subject.progress} tone={tone.progress} />
      </div>
    </article>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const continueSubject = subjects[0];
  const continueChapter = continueSubject.chapters[2];

  return (
    <div>
      <PageTitle
        eyebrow="Dashboard"
        title={`Welcome back, ${user?.name.split(" ")[0] ?? "Student"}`}
        copy="Track today's study flow, pick up unfinished chapters, and keep weekly tests in sight."
      />

      <section className="mb-6 rounded-lg border border-blue-100 bg-gradient-to-br from-blue-600 to-teal-500 p-6 text-white shadow-lg shadow-blue-200">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-sm font-bold text-blue-100">Continue Learning</p>
            <h3 className="mt-2 text-3xl font-extrabold">{continueChapter.title}</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50">{continueChapter.summary}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/learn"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-extrabold text-blue-700"
              >
                Resume Chapter
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                to="/quizzes"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/40 px-4 text-sm font-extrabold text-white"
              >
                Take Quiz
                <FileQuestion className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="rounded-lg bg-white/15 p-5">
            <div className="flex items-center justify-between text-sm font-bold text-blue-50">
              <span>Chapter progress</span>
              <span>{continueChapter.progress}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${continueChapter.progress}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white/15 p-4">
                <p className="text-2xl font-extrabold">{continueChapter.lessons}</p>
                <p className="font-bold text-blue-50">Lessons</p>
              </div>
              <div className="rounded-lg bg-white/15 p-4">
                <p className="text-2xl font-extrabold">{continueChapter.questions}</p>
                <p className="font-bold text-blue-50">Questions</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Flame} label="Study Streak" value="14 days" detail="3 days above target" tone="amber" />
        <MetricCard icon={BarChart3} label="Overall Progress" value="72%" detail="Across six subjects" />
        <MetricCard icon={FileText} label="Notes Completed" value="48/100" detail="12 this month" tone="teal" />
        <MetricCard icon={GraduationCap} label="Quizzes Attempted" value="26" detail="5 weekly tests" tone="indigo" />
        <MetricCard icon={Target} label="Average Score" value="84%" detail="Up 8% this week" tone="green" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <WeeklyPerformanceChart />
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-slate-950">Upcoming Tests</h3>
            <CalendarDays className="size-5 text-blue-700" aria-hidden="true" />
          </div>
          <div className="grid gap-3">
            {upcomingTests.map((test) => (
              <article key={test.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-extrabold text-slate-950">{test.title}</p>
                <p className="mt-1 text-xs font-bold text-blue-700">{test.date}</p>
                <p className="mt-2 text-sm text-slate-600">{test.scope}</p>
              </article>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <h3 className="text-lg font-extrabold text-slate-950">Recent Activity</h3>
          <div className="mt-4 grid gap-3">
            {recentActivity.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <h3 className="text-lg font-extrabold text-slate-950">Recommended Learning</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {subjects.slice(0, 4).map((subject) => (
              <SubjectProgressCard key={subject.id} subject={subject} />
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {subjects.slice(0, 3).map((subject) => (
          <SubjectProgressCard key={subject.id} subject={subject} />
        ))}
      </div>
    </div>
  );
}

export function LearnPage() {
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0].id);
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? subjects[0];
  const tone = accentClasses[selectedSubject.accent];
  const chapterActions: Array<{ label: string; icon: LucideIcon }> = [
    { label: "Notes PDF", icon: FileText },
    { label: "Video Lessons", icon: Video },
    { label: "Summary Notes", icon: BookOpen },
    { label: "Important Questions", icon: FileQuestion },
    { label: "Formula Sheets", icon: Download },
  ];

  return (
    <div>
      <PageTitle
        eyebrow="Learn"
        title="Subjects, chapters, and resources."
        copy="Move from subject overviews to chapter-level notes, videos, summary notes, important questions, formula sheets, and quizzes."
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {subjects.map((subject) => {
          const active = subject.id === selectedSubjectId;
          const subjectTone = accentClasses[subject.accent];

          return (
            <button
              key={subject.id}
              type="button"
              onClick={() => setSelectedSubjectId(subject.id)}
              className={`rounded-lg border p-4 text-left transition ${
                active
                  ? "border-blue-300 bg-blue-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
              }`}
            >
              <p className="text-sm font-extrabold text-slate-950">{subject.name}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{subject.chaptersCount} chapters</p>
              <div className="mt-3">
                <ProgressBar value={subject.progress} tone={subjectTone.progress} />
              </div>
            </button>
          );
        })}
      </div>

      <Panel className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${tone.card}`}>Selected subject</span>
            <h3 className="mt-4 text-2xl font-extrabold text-slate-950">{selectedSubject.name}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selectedSubject.description}</p>
          </div>
          <div className="w-full max-w-xs">
            <ProgressBar value={selectedSubject.progress} tone={tone.progress} label="Subject progress" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {selectedSubject.chapters.map((chapter) => (
            <article key={chapter.title} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-lg font-extrabold text-slate-950">{chapter.title}</h4>
                {chapter.premium && <LockedPill />}
              </div>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{chapter.summary}</p>
              <div className="mt-4">
                <ProgressBar value={chapter.progress} tone={tone.progress} label="Chapter progress" />
              </div>
              <div className="mt-5 grid gap-2">
                {chapterActions.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    className="flex min-h-10 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-4 text-blue-700" aria-hidden="true" />
                      {label}
                    </span>
                    {chapter.premium ? <Lock className="size-4 text-slate-400" /> : <Eye className="size-4 text-slate-400" />}
                  </button>
                ))}
              </div>
              <Link
                to="/quizzes"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Start Quiz
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function QuizzesPage() {
  const [selectedLevel, setSelectedLevel] = useState("Medium");
  const selectedQuiz = quizCategories.find((quiz) => quiz.level === selectedLevel) ?? quizCategories[1];

  return (
    <div>
      <PageTitle
        eyebrow="Quizzes"
        title="Practice by difficulty."
        copy="Timed quizzes include scores, results, solutions, and chapter-level feedback for easy, medium, and hard practice."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {quizCategories.map((quiz) => (
          <button
            key={quiz.level}
            type="button"
            onClick={() => setSelectedLevel(quiz.level)}
            className={`rounded-lg border p-5 text-left transition ${
              selectedLevel === quiz.level
                ? "border-blue-300 bg-blue-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-blue-200"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-extrabold text-slate-950">{quiz.level}</h3>
              <GraduationCap className="size-5 text-blue-700" aria-hidden="true" />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{quiz.description}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <span className="rounded-lg bg-white px-2 py-2 text-xs font-extrabold text-slate-600">
                {quiz.questions} Qs
              </span>
              <span className="rounded-lg bg-white px-2 py-2 text-xs font-extrabold text-slate-600">{quiz.time}</span>
              <span className="rounded-lg bg-white px-2 py-2 text-xs font-extrabold text-blue-700">{quiz.score}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-blue-700">Active Quiz</p>
              <h3 className="mt-1 text-2xl font-extrabold text-slate-950">{selectedQuiz.level} Practice Set</h3>
            </div>
            <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-700">
              <Clock className="size-4" aria-hidden="true" />
              {selectedQuiz.time}
            </span>
          </div>
          <div className="mt-6 rounded-lg bg-slate-50 p-5">
            <p className="text-sm font-bold text-slate-500">Question 1 of {selectedQuiz.questions}</p>
            <h4 className="mt-3 text-lg font-extrabold text-slate-950">
              Which graph best represents a pair of linear equations with exactly one solution?
            </h4>
            <div className="mt-5 grid gap-3">
              {["Parallel lines", "Intersecting lines", "Coincident lines", "Curved lines"].map((answer, index) => (
                <button
                  key={answer}
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-bold ${
                    index === 1
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {answer}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Submit Quiz
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </Panel>

        <Panel>
          <h3 className="text-lg font-extrabold text-slate-950">Results & Solutions Preview</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <MetricCard icon={Target} label="Score" value={selectedQuiz.score} detail="Latest attempt" tone="green" />
            <MetricCard icon={Clock} label="Timer" value={selectedQuiz.time} detail="Quiz duration" tone="amber" />
            <MetricCard icon={FileQuestion} label="Questions" value={`${selectedQuiz.questions}`} detail="With solutions" />
          </div>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <p className="font-extrabold text-slate-950">Solution</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A pair of linear equations has exactly one solution when the two lines intersect at
              one point. The dashboard stores wrong answers for later revision.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function ProgressPage() {
  const completion = Math.round(subjects.reduce((sum, subject) => sum + subject.progress, 0) / subjects.length);

  return (
    <div>
      <PageTitle
        eyebrow="Progress"
        title="Completion, analytics, and growth."
        copy="See completion percentage, subject analytics, weekly progress, monthly growth, and learning streaks."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BarChart3} label="Completion" value={`${completion}%`} detail="All subjects" />
        <MetricCard icon={Flame} label="Learning Streak" value="14 days" detail="Best streak: 21" tone="amber" />
        <MetricCard icon={Target} label="Average Score" value="84%" detail="Across 26 quizzes" tone="green" />
        <MetricCard icon={CalendarDays} label="Weekly Growth" value="+12%" detail="Study minutes" tone="teal" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel className="min-h-[340px]">
          <h3 className="text-lg font-extrabold text-slate-950">Subject Analytics</h3>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjects} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="progress" radius={[8, 8, 0, 0]} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="min-h-[340px]">
          <h3 className="text-lg font-extrabold text-slate-950">Monthly Growth</h3>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyGrowth} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="completion" stroke="#2563eb" strokeWidth={3} />
                <Line type="monotone" dataKey="tests" stroke="#14b8a6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {subjects.map((subject) => (
          <SubjectProgressCard key={subject.id} subject={subject} />
        ))}
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const [range, setRange] = useState<keyof typeof leaderboard>("weekly");
  const rankings = leaderboard[range];

  return (
    <div>
      <PageTitle
        eyebrow="Leaderboard"
        title="Weekly, monthly, and overall rankings."
        copy="Rankings reward consistent quiz attempts, weekly tests, and study streaks."
      />

      <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {(["weekly", "monthly", "overall"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={`min-h-10 rounded-md px-4 text-sm font-extrabold capitalize ${
              range === key ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <Panel>
        <div className="grid gap-3">
          {rankings.map((entry) => (
            <article
              key={`${range}-${entry.rank}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div
                className={`grid size-12 place-items-center rounded-lg text-lg font-extrabold ${
                  entry.rank === 1 ? "bg-amber-400 text-slate-950" : "bg-white text-blue-700"
                }`}
              >
                {entry.rank}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-slate-950">{entry.name}</p>
                <p className="text-sm font-semibold text-slate-500">{entry.streak} day streak</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold text-blue-700">{entry.score}</p>
                <p className="text-xs font-bold text-slate-500">points</p>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function ResourcesPage() {
  const { user } = useAuth();

  return (
    <div>
      <PageTitle
        eyebrow="Resources"
        title="Premium study resources."
        copy="Access formula sheets, diagram banks, important question packs, scholarship preparation, and weekly test archives."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {resources.map((resource) => {
          const locked = resource.premium && !user?.premium;

          return (
            <article key={resource.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="grid size-12 place-items-center rounded-lg bg-blue-50 text-blue-700">
                  <FileText className="size-6" aria-hidden="true" />
                </div>
                {locked ? <LockedPill /> : <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">Unlocked</span>}
              </div>
              <h3 className="mt-5 text-lg font-extrabold text-slate-950">{resource.title}</h3>
              <p className="mt-2 text-sm font-semibold text-slate-500">{resource.type}</p>
              <button
                type="button"
                className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold ${
                  locked ? "bg-slate-100 text-slate-500" : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {locked ? "Preview Locked" : "Open Resource"}
                {locked ? <Lock className="size-4" /> : <Download className="size-4" />}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function PremiumPage() {
  const { updateStudent, user } = useAuth();

  return (
    <div>
      <PageTitle
        eyebrow="Premium"
        title="Unlock the complete Class 9 learning system."
        copy="Free users get limited content and demo quizzes. Premium users get full notes, unlimited quizzes, weekly tests, analytics, and resources."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">Free Users</span>
          <h3 className="mt-5 text-2xl font-extrabold text-slate-950">Limited Content</h3>
          <ul className="mt-5 grid gap-3">
            <CheckItem>Demo quizzes</CheckItem>
            <CheckItem>Selected notes access</CheckItem>
            <CheckItem>Basic progress view</CheckItem>
          </ul>
        </Panel>

        <section className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-teal-50 p-6 shadow-lg shadow-blue-100">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700">Launch Offer</span>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <span className="text-2xl font-extrabold text-slate-400 line-through">₹499</span>
            <span className="text-6xl font-extrabold text-slate-950">₹69</span>
            <span className="pb-2 text-sm font-bold text-slate-500">only</span>
          </div>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {["Complete Access", "Premium Notes", "Unlimited Quizzes", "Weekly Tests", "Premium Resources", "Future Updates"].map(
              (item) => (
                <CheckItem key={item}>{item}</CheckItem>
              ),
            )}
          </ul>
          <button
            type="button"
            onClick={() => updateStudent({ premium: true })}
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
          >
            {user?.premium ? "Premium Active" : "Unlock Premium"}
            <Crown className="size-4" aria-hidden="true" />
          </button>
        </section>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { authReady, updateStudent, user } = useAuth();
  const stats = useMemo(
    () => [
      ["Class", user?.className ?? "Class 9"],
      ["Premium Status", user?.premium ? "Premium" : "Free"],
      ["Notes Completed", "48"],
      ["Quizzes Attempted", "26"],
      ["Average Score", "84%"],
      ["Learning Streak", "14 days"],
    ],
    [user?.className, user?.premium],
  );

  return (
    <div>
      <PageTitle
        eyebrow="Profile"
        title="Student profile and learning statistics."
        copy="Manage student identity, class, premium status, and quick learning statistics."
      />

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel>
          <div className="grid justify-items-center text-center">
            <div className="grid size-24 place-items-center rounded-lg bg-blue-600 text-4xl font-extrabold text-white">
              {user?.name.slice(0, 1) ?? "D"}
            </div>
            <h3 className="mt-5 text-2xl font-extrabold text-slate-950">{user?.name}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">{user?.email}</p>
            <span className="mt-4 rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
              {authReady ? "Firebase account" : "Demo account"}
            </span>
          </div>
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => updateStudent({ premium: true })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
            >
              Upgrade Status
              <Crown className="size-4" aria-hidden="true" />
            </button>
          </div>
        </Panel>

        <Panel>
          <h3 className="text-lg font-extrabold text-slate-950">Learning Statistics</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-extrabold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function ComingSoonClass10Page() {
  return (
    <div>
      <PageTitle
        eyebrow="Coming Soon"
        title="SSC Board Preparation"
        copy="Class 10 support is on the roadmap with board exam preparation, PYQs, full test series, 90%+ strategy, and revision resources."
      />
      <Panel>
        <div className="grid gap-4 md:grid-cols-5">
          {["Board Exam Preparation", "PYQs", "Full Test Series", "90%+ Strategy", "Revision Resources"].map((item) => (
            <div key={item} className="rounded-lg bg-slate-50 p-5">
              <Star className="size-6 text-amber-500" aria-hidden="true" />
              <p className="mt-4 text-sm font-extrabold text-slate-950">{item}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
