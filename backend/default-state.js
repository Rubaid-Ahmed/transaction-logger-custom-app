function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultState() {
  const drawerId = "drawer-main";
  const tuitionCategoryId = "credit-tuition";

  return {
    version: 1,
    settings: {
      appName: "Transaction Logger",
      ownerName: "New User",
      currencySymbol: "৳",
      drawerLabel: "Drawer",
      tuitionCategoryId,
      testerMode: false
    },
    accounts: [
      {
        id: drawerId,
        type: "drawer",
        name: "Drawer",
        balance: 0,
        archived: false
      }
    ],
    categories: {
      credit: [
        { id: tuitionCategoryId, name: "Tuition", role: "tuition", archived: false },
        { id: "credit-salary", name: "Salary", role: "regular", archived: false },
        { id: "credit-other", name: "Other Income", role: "regular", archived: false }
      ],
      debit: [
        { id: "debit-food", name: "Food", role: "regular", archived: false },
        { id: "debit-transport", name: "Transport", role: "regular", archived: false },
        { id: "debit-education", name: "Education", role: "regular", archived: false },
        { id: "debit-bills", name: "Bills", role: "regular", archived: false },
        { id: "debit-other", name: "Other Expense", role: "regular", archived: false }
      ]
    },
    students: [],
    transactions: [],
    tuitionTracker: {},
    audit: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

function createDemoState() {
  const state = createDefaultState();
  const bankId = id("bank");
  const studentOne = id("student");
  const studentTwo = id("student");
  const today = new Date().toISOString().slice(0, 10);

  state.settings.ownerName = "Tester";
  state.settings.testerMode = true;
  state.accounts.push({
    id: bankId,
    type: "bank",
    name: "Demo Bank",
    balance: 15000,
    archived: false
  });
  state.accounts[0].balance = 3500;
  state.students = [
    { id: studentOne, name: "Demo Student A", active: true, cycleDays: null },
    { id: studentTwo, name: "Demo Student B", active: true, cycleDays: 12 }
  ];
  state.transactions = [
    {
      id: id("tx"),
      direction: "credit",
      categoryId: state.settings.tuitionCategoryId,
      categoryName: "Tuition",
      accountId: bankId,
      accountName: "Demo Bank",
      studentId: studentOne,
      studentName: "Demo Student A",
      amount: 2500,
      date: today,
      note: "Sample tuition payment",
      createdAt: new Date().toISOString()
    },
    {
      id: id("tx"),
      direction: "debit",
      categoryId: "debit-food",
      categoryName: "Food",
      accountId: "drawer-main",
      accountName: "Drawer",
      studentId: null,
      studentName: "",
      amount: 450,
      date: today,
      note: "Sample expense",
      createdAt: new Date().toISOString()
    }
  ];

  const monthKey = today.slice(0, 7);
  state.tuitionTracker[monthKey] = {
    studentIds: [studentOne, studentTwo],
    attendance: {
      [studentOne]: { [today]: true },
      [studentTwo]: {}
    }
  };

  return state;
}

module.exports = {
  createDefaultState,
  createDemoState
};
