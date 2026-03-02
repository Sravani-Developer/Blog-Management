const POST_CATEGORIES = [
  "Database",
  "Code Quality",
  "DevOps",
  "Frontend",
  "Security"
];

const CATEGORY_KEYWORDS = [
  {
    category: "Database",
    keywords: ["sql", "mysql", "postgres", "mongodb", "mongoose", "database", "query", "schema", "index"]
  },
  {
    category: "Code Quality",
    keywords: ["refactor", "testing", "test", "lint", "clean code", "review", "quality", "jest"]
  },
  {
    category: "DevOps",
    keywords: ["docker", "kubernetes", "ci/cd", "ci", "cd", "deploy", "deployment", "devops", "nginx"]
  },
  {
    category: "Frontend",
    keywords: ["frontend", "ui", "ux", "css", "html", "javascript", "react", "vue", "tailwind"]
  },
  {
    category: "Security",
    keywords: ["security", "auth", "authentication", "authorization", "csrf", "xss", "jwt", "ssl", "https"]
  }
];

const normalizeCategory = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  const match = POST_CATEGORIES.find((cat) => cat.toLowerCase() === trimmed);
  return match || null;
};

const inferCategoryFromText = ({ title = "", content = "" }) => {
  const haystack = `${title} ${content}`.toLowerCase();

  let best = { category: "Code Quality", score: 0 };
  CATEGORY_KEYWORDS.forEach(({ category, keywords }) => {
    let score = 0;
    keywords.forEach((kw) => {
      if (haystack.includes(kw)) score += 1;
    });
    if (score > best.score) {
      best = { category, score };
    }
  });

  return best.category;
};

const resolvePostCategoryInput = ({ title, content, category }) => {
  const manualCategory = normalizeCategory(category);
  const autoCategory = inferCategoryFromText({ title, content });

  return {
    category: manualCategory || autoCategory,
    autoCategory,
    categorySource: manualCategory ? "manual" : "auto"
  };
};

module.exports = {
  POST_CATEGORIES,
  normalizeCategory,
  inferCategoryFromText,
  resolvePostCategoryInput
};
