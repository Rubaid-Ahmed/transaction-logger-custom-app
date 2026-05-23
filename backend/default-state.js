function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultState() {
  const tuitionCategoryId = "credit-tuition";

  return {
    version: 1,
    settings: {
      appName: "Transaction Logger",
      ownerName: "New User",
      currencySymbol: "৳",
      tuitionCategoryId
    },
    accounts: [],
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

module.exports = {
  createDefaultState
};
