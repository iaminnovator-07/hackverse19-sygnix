export type SubjectId =
  | "mathematics"
  | "science"
  | "english"
  | "marathi"
  | "hindi"
  | "social-science";

export type Chapter = {
  title: string;
  summary: string;
  progress: number;
  lessons: number;
  questions: number;
  premium?: boolean;
};

export type Subject = {
  id: SubjectId;
  name: string;
  description: string;
  chaptersCount: number;
  progress: number;
  accent: "blue" | "teal" | "amber" | "rose" | "indigo" | "green";
  chapters: Chapter[];
};

export const launchStats = [
  { label: "Practice Questions", value: "500+" },
  { label: "Chapter Notes", value: "100+" },
  { label: "Video Lessons", value: "50+" },
  { label: "Weekly Assessments", value: "Every Sat" },
];

export const features = [
  {
    title: "Chapter-wise Notes",
    copy: "Board-aligned notes with definitions, examples, diagrams, and exam-ready summaries.",
  },
  {
    title: "Video Learning",
    copy: "Short concept videos mapped to Class 9 chapters for focused daily study.",
  },
  {
    title: "Practice Quizzes",
    copy: "Easy, medium, and hard quizzes with timer, score, results, and solutions.",
  },
  {
    title: "Progress Tracking",
    copy: "Subject progress, weekly growth, completion percentage, and learning streaks.",
  },
  {
    title: "Leaderboards",
    copy: "Weekly, monthly, and overall rankings that reward consistent practice.",
  },
  {
    title: "Study Streaks",
    copy: "Daily momentum tracking with smart nudges for notes, tests, and revision.",
  },
  {
    title: "Formula Sheets",
    copy: "Fast revision sheets for Mathematics and Science before tests.",
  },
  {
    title: "Weekly Tests",
    copy: "Structured assessment cycles for chapter mastery and confidence building.",
  },
  {
    title: "Important Questions",
    copy: "High-value board-style questions with model answers and marking focus.",
  },
  {
    title: "Scholarship Preparation",
    copy: "Premium practice tracks for scholarship readiness and competitive confidence.",
  },
];

export const subjects: Subject[] = [
  {
    id: "mathematics",
    name: "Mathematics",
    description: "Algebra, geometry, statistics, and board-style problem solving.",
    chaptersCount: 16,
    progress: 78,
    accent: "blue",
    chapters: [
      {
        title: "Sets",
        summary: "Set notation, Venn diagrams, subsets, and operations.",
        progress: 94,
        lessons: 5,
        questions: 72,
      },
      {
        title: "Real Numbers",
        summary: "Number systems, rationalization, surds, and laws of indices.",
        progress: 81,
        lessons: 6,
        questions: 84,
      },
      {
        title: "Linear Equations",
        summary: "Graphing, solutions, and word problems with two variables.",
        progress: 64,
        lessons: 7,
        questions: 96,
        premium: true,
      },
    ],
  },
  {
    id: "science",
    name: "Science",
    description: "Physics, chemistry, biology, diagrams, and experiments.",
    chaptersCount: 18,
    progress: 71,
    accent: "teal",
    chapters: [
      {
        title: "Laws of Motion",
        summary: "Force, inertia, momentum, and Newton's laws.",
        progress: 88,
        lessons: 6,
        questions: 68,
      },
      {
        title: "Current Electricity",
        summary: "Circuits, Ohm's law, resistance, and safety.",
        progress: 69,
        lessons: 5,
        questions: 54,
      },
      {
        title: "Classification of Plants",
        summary: "Plant groups, characteristics, and examples.",
        progress: 42,
        lessons: 4,
        questions: 48,
        premium: true,
      },
    ],
  },
  {
    id: "english",
    name: "English",
    description: "Grammar, writing skills, prose, poetry, and comprehension.",
    chaptersCount: 12,
    progress: 67,
    accent: "amber",
    chapters: [
      {
        title: "Reading Comprehension",
        summary: "Inference, vocabulary, tone, and structured answers.",
        progress: 73,
        lessons: 4,
        questions: 50,
      },
      {
        title: "Writing Skills",
        summary: "Letters, reports, summaries, and speeches.",
        progress: 62,
        lessons: 6,
        questions: 45,
      },
    ],
  },
  {
    id: "marathi",
    name: "Marathi",
    description: "Vyakaran, gadya, padya, lekhan, and board practice.",
    chaptersCount: 14,
    progress: 58,
    accent: "rose",
    chapters: [
      {
        title: "Vyakaran Practice",
        summary: "Shabdabhed, vakya rachana, and language accuracy.",
        progress: 56,
        lessons: 5,
        questions: 42,
      },
      {
        title: "Lekhan Kaushalya",
        summary: "Nibandh, patra lekhan, and structured answers.",
        progress: 61,
        lessons: 4,
        questions: 38,
      },
    ],
  },
  {
    id: "hindi",
    name: "Hindi",
    description: "Vyakaran, prose, poetry, writing, and revision practice.",
    chaptersCount: 13,
    progress: 52,
    accent: "indigo",
    chapters: [
      {
        title: "Vyakaran Essentials",
        summary: "Sandhi, samas, vakya, and common exam patterns.",
        progress: 49,
        lessons: 4,
        questions: 46,
      },
      {
        title: "Patra Lekhan",
        summary: "Formal and informal letter writing with samples.",
        progress: 55,
        lessons: 3,
        questions: 24,
      },
    ],
  },
  {
    id: "social-science",
    name: "Social Science",
    description: "History, geography, civics, economics, maps, and timelines.",
    chaptersCount: 15,
    progress: 63,
    accent: "green",
    chapters: [
      {
        title: "The French Revolution",
        summary: "Causes, events, outcomes, and timeline revision.",
        progress: 76,
        lessons: 5,
        questions: 40,
      },
      {
        title: "India: Physical Features",
        summary: "Maps, mountain ranges, rivers, and plateaus.",
        progress: 50,
        lessons: 4,
        questions: 44,
        premium: true,
      },
    ],
  },
];

export const weeklyPerformance = [
  { day: "Mon", score: 68, minutes: 42 },
  { day: "Tue", score: 74, minutes: 55 },
  { day: "Wed", score: 71, minutes: 46 },
  { day: "Thu", score: 82, minutes: 64 },
  { day: "Fri", score: 88, minutes: 72 },
  { day: "Sat", score: 91, minutes: 80 },
  { day: "Sun", score: 86, minutes: 58 },
];

export const monthlyGrowth = [
  { month: "Jan", completion: 34, tests: 4 },
  { month: "Feb", completion: 43, tests: 5 },
  { month: "Mar", completion: 51, tests: 6 },
  { month: "Apr", completion: 62, tests: 7 },
  { month: "May", completion: 70, tests: 8 },
  { month: "Jun", completion: 76, tests: 9 },
];

export const recentActivity = [
  "Completed Science notes: Laws of Motion",
  "Scored 18/20 in Mathematics practice quiz",
  "Unlocked English writing skill revision pack",
  "Joined Weekly Test: Algebra and Motion",
];

export const upcomingTests = [
  { title: "Mathematics Weekly Test", date: "Saturday", scope: "Sets + Real Numbers" },
  { title: "Science Diagram Test", date: "Monday", scope: "Electricity basics" },
  { title: "English Grammar Sprint", date: "Wednesday", scope: "Tenses + voice" },
];

export const quizCategories = [
  {
    level: "Easy",
    description: "Warm-up concept checks with instant solutions.",
    questions: 10,
    time: "8 min",
    score: "86%",
  },
  {
    level: "Medium",
    description: "Board-style mixed questions for chapter mastery.",
    questions: 15,
    time: "15 min",
    score: "78%",
  },
  {
    level: "Hard",
    description: "Challenge sets with tricky applications and explanations.",
    questions: 20,
    time: "25 min",
    score: "64%",
  },
];

export const leaderboard = {
  weekly: [
    { rank: 1, name: "Aarav Patil", score: 980, streak: 19 },
    { rank: 2, name: "Isha Deshmukh", score: 948, streak: 16 },
    { rank: 3, name: "Riya More", score: 921, streak: 14 },
    { rank: 4, name: "Vedant Kulkarni", score: 904, streak: 13 },
  ],
  monthly: [
    { rank: 1, name: "Isha Deshmukh", score: 3720, streak: 28 },
    { rank: 2, name: "Aarav Patil", score: 3658, streak: 25 },
    { rank: 3, name: "Neel Shah", score: 3510, streak: 22 },
    { rank: 4, name: "Riya More", score: 3444, streak: 21 },
  ],
  overall: [
    { rank: 1, name: "Aarav Patil", score: 12880, streak: 42 },
    { rank: 2, name: "Isha Deshmukh", score: 12420, streak: 39 },
    { rank: 3, name: "Neel Shah", score: 11984, streak: 35 },
    { rank: 4, name: "Vedant Kulkarni", score: 11120, streak: 31 },
  ],
};

export const resources = [
  { title: "Mathematics Formula Sheets", type: "PDF", premium: false },
  { title: "Science Diagram Bank", type: "PDF", premium: true },
  { title: "Important Questions Pack", type: "Practice", premium: true },
  { title: "Scholarship Preparation Track", type: "Course", premium: true },
  { title: "Weekly Test Archive", type: "Tests", premium: true },
  { title: "Revision Calendar", type: "Planner", premium: false },
];

export const testimonials = [
  {
    name: "Saanvi Jadhav",
    role: "Class 9 Student, Pune",
    quote: "The notes are short, clear, and exactly what I need before weekly tests.",
  },
  {
    name: "Rohan Shinde",
    role: "Parent",
    quote: "The progress dashboard makes it easy to see what my son studied this week.",
  },
  {
    name: "Meera Joshi",
    role: "Science Teacher",
    quote: "The practice flow is structured well for Maharashtra Board revision.",
  },
];

export const faqs = [
  {
    question: "Is Diamond Student Hub a tuition class?",
    answer:
      "No. It is a self-paced Maharashtra State Board learning platform with notes, videos, tests, analytics, and premium resources.",
  },
  {
    question: "Which class is supported right now?",
    answer: "Class 9 is live. Class 10 SSC Board preparation is displayed as Coming Soon.",
  },
  {
    question: "What is included in Premium?",
    answer:
      "Full notes access, all quizzes, premium weekly tests, analytics, premium resources, and future updates.",
  },
  {
    question: "Can parents track learning progress?",
    answer:
      "Yes. The dashboard includes subject progress, recent activity, weekly performance, upcoming tests, and study streaks.",
  },
];
