const fs = require("fs");
const path = require("path");

const { createDefaultState } = require("./default-state");

const DATA_DIR = process.env.CUSTOM_LOGGER_DATA_DIR || path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeState(payload) {
  const defaults = createDefaultState();
  const source = payload && typeof payload === "object" ? payload : {};
  const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
  const categories = source.categories && typeof source.categories === "object" ? source.categories : {};

  const accounts = Array.isArray(source.accounts)
    ? source.accounts
        .map((account, index) => ({
          id: normalizeText(account.id, `account-${index + 1}`),
          type: "account",
          name: normalizeText(account.name, `Account ${index + 1}`),
          balance: normalizeNumber(account.balance, 0),
          archived: account.archived === true
        }))
        .filter((account) => account.name)
    : clone(defaults.accounts);

  const normalized = {
    version: 1,
    settings: {
      ...defaults.settings,
      appName: normalizeText(settings.appName, defaults.settings.appName),
      ownerName: normalizeText(settings.ownerName, defaults.settings.ownerName),
      currencySymbol: normalizeText(settings.currencySymbol, defaults.settings.currencySymbol),
      tuitionCategoryId: normalizeText(settings.tuitionCategoryId, defaults.settings.tuitionCategoryId)
    },
    accounts,
    categories: {
      credit: normalizeCategories(categories.credit, defaults.categories.credit),
      debit: normalizeCategories(categories.debit, defaults.categories.debit)
    },
    students: normalizeStudents(source.students),
    transactions: normalizeTransactions(source.transactions),
    tuitionTracker: normalizeTuitionTracker(source.tuitionTracker),
    audit: {
      createdAt: normalizeText(source.audit?.createdAt, new Date().toISOString()),
      updatedAt: new Date().toISOString()
    }
  };

  if (!normalized.categories.credit.some((category) => category.id === normalized.settings.tuitionCategoryId)) {
    const tuition = normalized.categories.credit.find((category) => category.role === "tuition");
    normalized.settings.tuitionCategoryId = tuition ? tuition.id : normalized.categories.credit[0]?.id || "";
  }

  return normalized;
}

function normalizeCategories(items, fallbackItems) {
  const source = Array.isArray(items) && items.length ? items : fallbackItems;
  return source
    .map((category, index) => ({
      id: normalizeText(category.id, `category-${index + 1}`),
      name: normalizeText(category.name, `Category ${index + 1}`),
      role: category.role === "tuition" ? "tuition" : "regular",
      archived: category.archived === true
    }))
    .filter((category) => category.name);
}

function normalizeStudents(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((student, index) => ({
      id: normalizeText(student.id, `student-${index + 1}`),
      name: normalizeText(student.name, ""),
      active: student.active !== false,
      cycleDays:
        Number.isInteger(Number(student.cycleDays)) && Number(student.cycleDays) > 0
          ? Number(student.cycleDays)
          : null
    }))
    .filter((student) => student.name);
}

function normalizeTransactions(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((transaction, index) => ({
    id: normalizeText(transaction.id, `tx-${index + 1}`),
    direction: transaction.direction === "debit" || transaction.direction === "transfer" ? transaction.direction : "credit",
    categoryId: normalizeText(transaction.categoryId, ""),
    categoryName: normalizeText(transaction.categoryName, ""),
    accountId: normalizeText(transaction.accountId, ""),
    accountName: normalizeText(transaction.accountName, ""),
    transferAccountId: normalizeText(transaction.transferAccountId, ""),
    transferAccountName: normalizeText(transaction.transferAccountName, ""),
    studentId: normalizeText(transaction.studentId, ""),
    studentName: normalizeText(transaction.studentName, ""),
    amount: normalizeNumber(transaction.amount, 0),
    date: normalizeText(transaction.date, ""),
    note: normalizeText(transaction.note, ""),
    createdAt: normalizeText(transaction.createdAt, new Date().toISOString())
  }));
}

function normalizeTuitionTracker(value) {
  const tracker = {};
  const source = value && typeof value === "object" ? value : {};

  Object.entries(source).forEach(([monthKey, record]) => {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return;
    }

    const attendance = {};
    const rawAttendance = record?.attendance && typeof record.attendance === "object" ? record.attendance : {};
    Object.entries(rawAttendance).forEach(([studentId, dates]) => {
      const cleanStudentId = normalizeText(studentId, "");
      if (!cleanStudentId || !dates || typeof dates !== "object") {
        return;
      }
      attendance[cleanStudentId] = {};
      Object.entries(dates).forEach(([date, checked]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          attendance[cleanStudentId][date] = checked === true;
        }
      });
    });

    tracker[monthKey] = {
      studentIds: Array.isArray(record?.studentIds)
        ? record.studentIds.map((item) => normalizeText(item, "")).filter(Boolean)
        : [],
      attendance
    };
  });

  return tracker;
}

function loadState() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    const state = createDefaultState();
    saveState(state);
    return state;
  }

  try {
    return normalizeState(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
  } catch {
    return createDefaultState();
  }
}

function saveState(state) {
  ensureDataDir();
  const normalized = normalizeState(state);
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(normalized, null, 2), "utf8");
  fs.renameSync(tempFile, DATA_FILE);
  return normalized;
}

function getDataPath() {
  ensureDataDir();
  return DATA_FILE;
}

module.exports = {
  loadState,
  saveState,
  getDataPath,
  normalizeState
};
