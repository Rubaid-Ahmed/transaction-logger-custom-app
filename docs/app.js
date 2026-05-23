(() => {
  const API_STATE = "/api/state";
  const API_HEALTH = "/api/health";
  const API_DEFAULT_STATE = "/api/default-state";
  const STORAGE_KEY = "custom-transaction-logger-state-v1";

  const appRoot = document.getElementById("app");
  const toastRoot = document.getElementById("toast");
  const serverStatus = document.getElementById("serverStatus");

  let state = null;
  let health = null;
  let apiAvailable = true;
  let saveTimer = null;

  const ui = {
    route: "dashboard",
    logDirection: "credit",
    selectedCreditCategoryId: "",
    selectedDebitCategoryId: "",
    tuitionMonth: currentMonthKey(),
    historyDirection: "all",
    historyCategory: "all",
    historyAccount: "all",
    historyStudent: "all",
    editingAccountId: "",
    editingCreditCategoryId: "",
    editingDebitCategoryId: "",
    editingStudentId: ""
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    syncRouteFromHash();
    await Promise.all([loadState(), loadHealth()]);
    initializeSelections();
    render();
  }

  function bindEvents() {
    window.addEventListener("hashchange", () => {
      syncRouteFromHash();
      render();
    });

    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target) {
        return;
      }

      const action = target.dataset.action;

      if (action === "set-log-direction") {
        ui.logDirection = target.dataset.direction;
        render();
      }

      if (action === "select-credit-category") {
        ui.selectedCreditCategoryId = target.dataset.categoryId;
        render();
      }

      if (action === "select-debit-category") {
        ui.selectedDebitCategoryId = target.dataset.categoryId;
        render();
      }

      if (action === "delete-transaction") {
        deleteTransaction(target.dataset.transactionId);
      }

      if (action === "edit-account") {
        ui.editingAccountId = target.dataset.accountId;
        render();
      }

      if (action === "cancel-account-edit") {
        ui.editingAccountId = "";
        render();
      }

      if (action === "archive-account") {
        setAccountArchived(target.dataset.accountId, true);
      }

      if (action === "restore-account") {
        setAccountArchived(target.dataset.accountId, false);
      }

      if (action === "edit-category") {
        setCategoryEditor(target.dataset.direction, target.dataset.categoryId);
      }

      if (action === "cancel-category-edit") {
        setCategoryEditor(target.dataset.direction, "");
      }

      if (action === "archive-category") {
        setCategoryArchived(target.dataset.direction, target.dataset.categoryId, true);
      }

      if (action === "restore-category") {
        setCategoryArchived(target.dataset.direction, target.dataset.categoryId, false);
      }

      if (action === "edit-student") {
        ui.editingStudentId = target.dataset.studentId;
        render();
      }

      if (action === "cancel-student-edit") {
        ui.editingStudentId = "";
        render();
      }

      if (action === "archive-student") {
        setStudentActive(target.dataset.studentId, false);
      }

      if (action === "restore-student") {
        setStudentActive(target.dataset.studentId, true);
      }

      if (action === "toggle-attendance") {
        toggleAttendance(target.dataset.month, target.dataset.studentId, target.dataset.date);
      }

      if (action === "export-data") {
        exportData();
      }

      if (action === "import-data") {
        document.getElementById("importFile")?.click();
      }

    if (action === "reset-blank") {
      resetBlankState();
    }
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      const action = target.dataset.action;

      if (action === "set-tuition-month") {
        ui.tuitionMonth = target.value || currentMonthKey();
        render();
      }

      if (action === "toggle-tuition-student") {
        toggleTuitionStudent(target.dataset.month, target.value, target.checked);
      }

      if (action === "set-history-direction") {
        ui.historyDirection = target.value;
        render();
      }

      if (action === "set-history-category") {
        ui.historyCategory = target.value;
        render();
      }

      if (action === "set-history-account") {
        ui.historyAccount = target.value;
        render();
      }

      if (action === "set-history-student") {
        ui.historyStudent = target.value;
        render();
      }

      if (target.id === "importFile" && target.files?.[0]) {
        importDataFile(target.files[0]);
        target.value = "";
      }
    });

    document.addEventListener("submit", (event) => {
      const form = event.target.closest("form[data-form]");
      if (!form) {
        return;
      }

      event.preventDefault();
      const formType = form.dataset.form;

      if (formType === "transaction") {
        submitTransaction(form);
      }

      if (formType === "transfer") {
        submitTransfer(form);
      }

      if (formType === "profile") {
        submitProfile(form);
      }

      if (formType === "account") {
        submitAccount(form);
      }

      if (formType === "category") {
        submitCategory(form);
      }

      if (formType === "student") {
        submitStudent(form);
      }
    });
  }

  async function loadState() {
    try {
      const response = await fetch(API_STATE, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load server state");
      }
      state = prepareState(await response.json());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      apiAvailable = false;
      const cached = localStorage.getItem(STORAGE_KEY);
      state = cached ? prepareState(JSON.parse(cached)) : createDefaultState();
    }
  }

  async function loadHealth() {
    try {
      health = await fetchJson(API_HEALTH);
    } catch {
      health = null;
      apiAvailable = false;
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed: ${url}`);
    }
    return response.json();
  }

  function initializeSelections() {
    const credit = activeCategories("credit");
    const debit = activeCategories("debit");
    ui.selectedCreditCategoryId =
      credit.find((category) => category.id === state.settings.tuitionCategoryId)?.id ||
      credit[0]?.id ||
      "";
    ui.selectedDebitCategoryId = debit[0]?.id || "";
  }

  function syncRouteFromHash() {
    const route = (window.location.hash || "#/dashboard").replace(/^#\/?/, "") || "dashboard";
    ui.route = ["dashboard", "log", "tuition", "students", "history", "settings"].includes(route)
      ? route
      : "dashboard";
  }

  function render() {
    if (!state) {
      appRoot.innerHTML = `<section class="empty"><h3>Loading</h3></section>`;
      return;
    }

    ensureValidUiSelections();
    refreshChrome();

    if (ui.route === "dashboard") {
      appRoot.innerHTML = renderDashboard();
    }
    if (ui.route === "log") {
      appRoot.innerHTML = renderLog();
    }
    if (ui.route === "tuition") {
      appRoot.innerHTML = renderTuition();
    }
    if (ui.route === "students") {
      appRoot.innerHTML = renderStudents();
    }
    if (ui.route === "history") {
      appRoot.innerHTML = renderHistory();
    }
    if (ui.route === "settings") {
      appRoot.innerHTML = renderSettings();
    }
  }

  function refreshChrome() {
    document.title = state.settings.appName || "Transaction Logger";
    document.querySelector('[data-bind="app-title"]').textContent = state.settings.appName;
    document.querySelector('[data-bind="owner-name"]').textContent = state.settings.ownerName;

    document.querySelectorAll("[data-route]").forEach((link) => {
      link.classList.toggle("active", link.dataset.route === ui.route);
    });

    if (serverStatus) {
      serverStatus.innerHTML = health
        ? `Server ready<br>${escapeHtml(health.localUrl)}`
        : "Static mode";
    }
  }

  function ensureValidUiSelections() {
    const credit = activeCategories("credit");
    const debit = activeCategories("debit");
    if (!credit.some((category) => category.id === ui.selectedCreditCategoryId)) {
      ui.selectedCreditCategoryId = credit[0]?.id || "";
    }
    if (!debit.some((category) => category.id === ui.selectedDebitCategoryId)) {
      ui.selectedDebitCategoryId = debit[0]?.id || "";
    }
  }

  function renderDashboard() {
    const summary = getSummary();
    const recent = state.transactions
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);

    return `
      <section class="page">
        ${pageHeader(
          "Home",
          escapeHtml(state.settings.ownerName),
          "",
          `<a class="button" href="#/log">Log transaction</a><a class="ghost-button" href="#/settings">Customize</a>`
        )}
        <section class="grid-4">
          ${metric("Total balance", formatMoney(summary.totalBalance))}
          ${metric("Income", formatMoney(summary.income), "positive")}
          ${metric("Expenses", formatMoney(summary.expenses), "negative")}
          ${metric("Net logged", formatMoney(summary.net), summary.net < 0 ? "negative" : "positive")}
        </section>
        <section class="grid-2">
          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>Accounts</h3>
              </div>
              <a class="ghost-button" href="#/settings">Manage</a>
            </div>
            <div class="list">
              ${activeAccounts().map(renderAccountCard).join("") || emptyBlock("No active accounts")}
            </div>
          </div>
          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>Tuition</h3>
              </div>
              <a class="ghost-button" href="#/tuition">Open tracker</a>
            </div>
            <section class="grid-2">
              ${metric("Tuition credited", formatMoney(summary.tuition))}
              ${metric("Attendance marks", String(getTotalAttendanceMarks()))}
            </section>
            <div class="list">
              ${activeStudents()
                .slice(0, 4)
                .map((student) => renderStudentCard(student, { compact: true }))
                .join("") || emptyBlock("No students yet")}
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <div>
              <h3>Recent activity</h3>
            </div>
            <a class="ghost-button" href="#/history">View all</a>
          </div>
          <div class="list">
            ${recent.map(renderTransactionCard).join("") || emptyBlock("No transactions yet")}
          </div>
        </section>
      </section>
    `;
  }

  function renderLog() {
    const isCredit = ui.logDirection === "credit";
    const categories = activeCategories(isCredit ? "credit" : "debit");
    const selectedCategory = categoryById(isCredit ? "credit" : "debit", isCredit ? ui.selectedCreditCategoryId : ui.selectedDebitCategoryId);
    const accounts = activeAccounts();
    const tuitionMode = isCredit && selectedCategory?.role === "tuition";

    return `
      <section class="page">
        ${pageHeader(
          "Transactions",
          "Money in and money out",
          "",
          `<a class="ghost-button" href="#/history">History</a>`
        )}
        <section class="panel">
          <div>
            <p class="label">Direction</p>
            <div class="segmented">
              <button class="chip ${isCredit ? "active" : ""}" type="button" data-action="set-log-direction" data-direction="credit">Credit</button>
              <button class="chip ${!isCredit ? "active" : ""}" type="button" data-action="set-log-direction" data-direction="debit">Debit</button>
            </div>
          </div>
          <div>
            <p class="label">Category</p>
            <div class="chip-row">
              ${categories
                .map(
                  (category) => `
                    <button class="chip ${selectedCategory?.id === category.id ? "active" : ""}" type="button" data-action="select-${isCredit ? "credit" : "debit"}-category" data-category-id="${category.id}">
                      ${escapeHtml(category.name)}
                    </button>
                  `
                )
                .join("")}
            </div>
          </div>
          ${
            categories.length && accounts.length
              ? renderTransactionForm(isCredit ? "credit" : "debit", selectedCategory, tuitionMode)
              : emptyBlock("Setup needed")
          }
        </section>
        <section class="panel">
          <div class="panel-head">
            <div>
              <h3>Transfer between accounts</h3>
            </div>
          </div>
          ${accounts.length >= 2 ? renderTransferForm(accounts) : emptyBlock("Add another account first")}
        </section>
      </section>
    `;
  }

  function renderTransactionForm(direction, category, tuitionMode) {
    return `
      <form class="form-grid" data-form="transaction" data-direction="${direction}" data-category-id="${category?.id || ""}">
        <div class="field">
          <label for="txAmount">Amount</label>
          <input id="txAmount" name="amount" type="number" min="0" step="0.01" placeholder="0.00" required />
        </div>
        <div class="field">
          <label for="txAccount">Account</label>
          <select id="txAccount" name="accountId" required>
            ${activeAccounts()
              .map((account) => `<option value="${account.id}">${escapeHtml(account.name)} (${formatMoney(account.balance)})</option>`)
              .join("")}
          </select>
        </div>
        <div class="field">
          <label for="txDate">Date</label>
          <input id="txDate" name="date" type="date" value="${today()}" required />
        </div>
        ${
          tuitionMode
            ? `
              <div class="field">
                <label for="txStudent">Student</label>
                <select id="txStudent" name="studentId" required>
                  <option value="">Choose student</option>
                  ${activeStudents()
                    .map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`)
                    .join("")}
                </select>
              </div>
            `
            : ""
        }
        <div class="field wide">
          <label for="txNote">Note</label>
          <textarea id="txNote" name="note" placeholder="Optional note"></textarea>
        </div>
        <div class="field wide">
          <button class="button" type="submit">Save ${direction === "credit" ? "credit" : "debit"}</button>
        </div>
      </form>
    `;
  }

  function renderTransferForm(accounts) {
    return `
      <form class="form-grid" data-form="transfer">
        <div class="field">
          <label for="transferFrom">From</label>
          <select id="transferFrom" name="fromAccountId" required>
            ${accounts.map((account) => `<option value="${account.id}">${escapeHtml(account.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="transferTo">To</label>
          <select id="transferTo" name="toAccountId" required>
            ${accounts.map((account) => `<option value="${account.id}">${escapeHtml(account.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="transferAmount">Amount</label>
          <input id="transferAmount" name="amount" type="number" min="0" step="0.01" placeholder="0.00" required />
        </div>
        <div class="field">
          <label for="transferDate">Date</label>
          <input id="transferDate" name="date" type="date" value="${today()}" required />
        </div>
        <div class="field wide">
          <label for="transferNote">Note</label>
          <textarea id="transferNote" name="note" placeholder="Optional transfer note"></textarea>
        </div>
        <div class="field wide">
          <button class="button-secondary" type="submit">Save transfer</button>
        </div>
      </form>
    `;
  }

  function renderTuition() {
    const record = getTuitionRecord(ui.tuitionMonth);
    const students = activeStudents();
    const selectedStudents = students.filter((student) => record.studentIds.includes(student.id));
    const rows = monthRows(ui.tuitionMonth);

    return `
      <section class="page">
        ${pageHeader(
          "Tuition Tracker",
          "Attendance and student tracker",
          "",
          `<a class="ghost-button" href="#/students">Manage students</a>`
        )}
        <section class="grid-3">
          ${students
            .slice(0, 3)
            .map((student) => metric(student.name, `${getStudentAttendanceCount(student.id)} days`))
            .join("") || metric("Students", "0")}
        </section>
        <section class="panel">
          <div class="form-grid">
            <div class="field">
              <label for="tuitionMonth">Month</label>
              <input id="tuitionMonth" data-action="set-tuition-month" type="month" value="${ui.tuitionMonth}" />
            </div>
            <div class="field wide">
              <span class="label">Visible students</span>
              <div class="chip-row">
                ${
                  students.length
                    ? students
                        .map(
                          (student) => `
                            <label class="chip ${record.studentIds.includes(student.id) ? "active" : ""}">
                              <input class="hidden" type="checkbox" data-action="toggle-tuition-student" data-month="${ui.tuitionMonth}" value="${student.id}" ${record.studentIds.includes(student.id) ? "checked" : ""} />
                              ${escapeHtml(student.name)}
                            </label>
                          `
                        )
                        .join("")
                    : `<a class="button-secondary" href="#/students">Add student</a>`
                }
              </div>
            </div>
          </div>
        </section>
        <section class="panel tuition-grid">
          <div class="panel-head">
            <div>
              <h3>${escapeHtml(formatMonthTitle(ui.tuitionMonth))}</h3>
            </div>
          </div>
          ${
            selectedStudents.length
              ? renderTuitionTable(record, selectedStudents, rows)
              : emptyBlock("Choose students for this month")
          }
        </section>
      </section>
    `;
  }

  function renderTuitionTable(record, students, rows) {
    return `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            ${students
              .map(
                (student) => `
                  <th>${escapeHtml(student.name)}<br><span class="muted">${getMonthlyAttendanceCount(record, student.id)} days</span></th>
                `
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.dateLabel)}</td>
                  <td>${escapeHtml(row.dayLabel)}</td>
                  ${students
                    .map((student) => {
                      const checked = record.attendance?.[student.id]?.[row.isoDate] === true;
                      return `
                        <td>
                          <button
                            class="attendance-button ${checked ? "checked" : ""}"
                            type="button"
                            data-action="toggle-attendance"
                            data-month="${ui.tuitionMonth}"
                            data-student-id="${student.id}"
                            data-date="${row.isoDate}"
                            aria-label="${checked ? "Remove" : "Mark"} ${escapeAttribute(student.name)} on ${row.isoDate}">
                          </button>
                        </td>
                      `;
                    })
                    .join("")}
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderStudents() {
    const editing = state.students.find((student) => student.id === ui.editingStudentId);
    return `
      <section class="page">
        ${pageHeader(
          "Students",
          "Student names and credit totals",
          "",
          `<a class="ghost-button" href="#/tuition">Tuition tracker</a>`
        )}
        <section class="settings-grid">
          <div class="panel">
            <h3>${editing ? "Edit student" : "Add student"}</h3>
            ${renderStudentForm(editing)}
          </div>
          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>Student list</h3>
              </div>
            </div>
            <div class="list">
              ${state.students.map((student) => renderStudentCard(student)).join("") || emptyBlock("No students yet")}
            </div>
          </div>
        </section>
      </section>
    `;
  }

  function renderHistory() {
    const filtered = getFilteredTransactions();
    return `
      <section class="page">
        ${pageHeader(
          "History",
          "All saved activity",
          "",
          `<a class="button" href="#/log">Log transaction</a>`
        )}
        <section class="panel">
          <div class="form-grid">
            <div class="field">
              <label for="historyDirection">Direction</label>
              <select id="historyDirection" data-action="set-history-direction">
                <option value="all" ${selected(ui.historyDirection, "all")}>All</option>
                <option value="credit" ${selected(ui.historyDirection, "credit")}>Credit</option>
                <option value="debit" ${selected(ui.historyDirection, "debit")}>Debit</option>
                <option value="transfer" ${selected(ui.historyDirection, "transfer")}>Transfer</option>
              </select>
            </div>
            <div class="field">
              <label for="historyCategory">Category</label>
              <select id="historyCategory" data-action="set-history-category">
                <option value="all" ${selected(ui.historyCategory, "all")}>All</option>
                ${allCategories()
                  .map((category) => `<option value="${category.id}" ${selected(ui.historyCategory, category.id)}>${escapeHtml(category.name)}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="field">
              <label for="historyAccount">Account</label>
              <select id="historyAccount" data-action="set-history-account">
                <option value="all" ${selected(ui.historyAccount, "all")}>All</option>
                ${state.accounts
                  .map((account) => `<option value="${account.id}" ${selected(ui.historyAccount, account.id)}>${escapeHtml(account.name)}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="field">
              <label for="historyStudent">Student</label>
              <select id="historyStudent" data-action="set-history-student">
                <option value="all" ${selected(ui.historyStudent, "all")}>All</option>
                ${state.students
                  .map((student) => `<option value="${student.id}" ${selected(ui.historyStudent, student.id)}>${escapeHtml(student.name)}</option>`)
                  .join("")}
              </select>
            </div>
          </div>
        </section>
        <section class="table-shell">
          ${filtered.length ? renderHistoryTable(filtered) : emptyBlock("No matching activity")}
        </section>
      </section>
    `;
  }

  function renderHistoryTable(items) {
    return `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Direction</th>
            <th>Category</th>
            <th>Account</th>
            <th>Student</th>
            <th>Amount</th>
            <th>Note</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (transaction) => `
                <tr>
                  <td>${escapeHtml(formatDate(transaction.date))}</td>
                  <td><span class="${transaction.direction}">${escapeHtml(formatDirection(transaction.direction))}</span></td>
                  <td>${escapeHtml(transaction.direction === "transfer" ? "Transfer" : getTransactionCategoryName(transaction))}</td>
                  <td>${escapeHtml(formatTransactionAccount(transaction))}</td>
                  <td>${escapeHtml(transaction.studentName || "")}</td>
                  <td>${formatMoney(transaction.amount)}</td>
                  <td>${escapeHtml(transaction.note || "")}</td>
                  <td><button class="icon-button" type="button" data-action="delete-transaction" data-transaction-id="${transaction.id}">Delete</button></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderSettings() {
    return `
      <section class="page">
        ${pageHeader(
          "Settings",
          "Settings",
          "",
          `<button class="ghost-button" type="button" data-action="export-data">Export JSON</button><button class="ghost-button" type="button" data-action="import-data">Import JSON</button><input id="importFile" class="hidden" type="file" accept="application/json,.json" />`
        )}
        <section class="panel">
          <h3>Profile</h3>
          ${renderProfileForm()}
        </section>
        <section class="settings-grid">
          <div class="panel">
            <h3>${ui.editingAccountId ? "Edit account" : "Add account"}</h3>
            ${renderAccountForm()}
          </div>
          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>Accounts</h3>
              </div>
            </div>
            <div class="list">
              ${state.accounts.map(renderAccountManagementCard).join("") || emptyBlock("No accounts yet")}
            </div>
          </div>
        </section>
        <section class="settings-grid">
          <div class="panel">
            <h3>${ui.editingCreditCategoryId ? "Edit credit category" : "Add credit category"}</h3>
            ${renderCategoryForm("credit")}
          </div>
          <div class="panel">
            <h3>Credit categories</h3>
            <div class="list">
              ${state.categories.credit.map((category) => renderCategoryCard(category, "credit")).join("")}
            </div>
          </div>
        </section>
        <section class="settings-grid">
          <div class="panel">
            <h3>${ui.editingDebitCategoryId ? "Edit debit category" : "Add debit category"}</h3>
            ${renderCategoryForm("debit")}
          </div>
          <div class="panel">
            <h3>Debit categories</h3>
            <div class="list">
              ${state.categories.debit.map((category) => renderCategoryCard(category, "debit")).join("")}
            </div>
          </div>
        </section>
      </section>
    `;
  }

  function renderProfileForm() {
    return `
      <form class="form-grid" data-form="profile">
        <div class="field wide">
          <label for="appName">App name</label>
          <input id="appName" name="appName" value="${escapeAttribute(state.settings.appName)}" required />
        </div>
        <div class="field wide">
          <label for="ownerName">User name</label>
          <input id="ownerName" name="ownerName" value="${escapeAttribute(state.settings.ownerName)}" required />
        </div>
        <div class="field half">
          <label for="currencySymbol">Currency symbol</label>
          <input id="currencySymbol" name="currencySymbol" value="${escapeAttribute(state.settings.currencySymbol)}" required />
        </div>
        <div class="field wide">
          <button class="button" type="submit">Save profile</button>
        </div>
      </form>
    `;
  }

  function renderAccountForm() {
    const account = state.accounts.find((item) => item.id === ui.editingAccountId);
    return `
      <form class="form-grid" data-form="account" data-account-id="${account?.id || ""}">
        <div class="field wide">
          <label for="accountName">Account name</label>
          <input id="accountName" name="name" value="${escapeAttribute(account?.name || "")}" placeholder="Account name" required />
        </div>
        <div class="field wide">
          <label for="accountBalance">Current balance</label>
          <input id="accountBalance" name="balance" type="number" step="0.01" value="${account ? account.balance : ""}" placeholder="0.00" required />
        </div>
        <div class="field wide">
          <div class="actions">
            <button class="button" type="submit">${account ? "Update account" : "Add account"}</button>
            ${account ? `<button class="ghost-button" type="button" data-action="cancel-account-edit">Cancel</button>` : ""}
          </div>
        </div>
      </form>
    `;
  }

  function renderCategoryForm(direction) {
    const editingId = direction === "credit" ? ui.editingCreditCategoryId : ui.editingDebitCategoryId;
    const category = categoryById(direction, editingId);
    return `
      <form class="form-grid" data-form="category" data-direction="${direction}" data-category-id="${category?.id || ""}">
        <div class="field wide">
          <label for="${direction}CategoryName">Category name</label>
          <input id="${direction}CategoryName" name="name" value="${escapeAttribute(category?.name || "")}" placeholder="${direction === "credit" ? "Bonus" : "Groceries"}" required />
        </div>
        ${
          direction === "credit"
            ? `
              <div class="field wide">
                <label class="check-row">
                  <input name="role" value="tuition" type="checkbox" ${category?.role === "tuition" ? "checked" : ""} />
                  <span>Use this category for tuition/student credits</span>
                </label>
              </div>
            `
            : ""
        }
        <div class="field wide">
          <div class="actions">
            <button class="button" type="submit">${category ? "Update category" : "Add category"}</button>
            ${category ? `<button class="ghost-button" type="button" data-action="cancel-category-edit" data-direction="${direction}">Cancel</button>` : ""}
          </div>
        </div>
      </form>
    `;
  }

  function renderStudentForm(student) {
    return `
      <form class="form-grid" data-form="student" data-student-id="${student?.id || ""}">
        <div class="field wide">
          <label for="studentName">Student name</label>
          <input id="studentName" name="name" value="${escapeAttribute(student?.name || "")}" placeholder="Student name" required />
        </div>
        <div class="field wide">
          <label for="cycleDays">Cycle days</label>
          <input id="cycleDays" name="cycleDays" type="number" min="1" step="1" value="${student?.cycleDays || ""}" placeholder="Optional" />
        </div>
        <div class="field wide">
          <label class="check-row">
            <input name="active" type="checkbox" ${student?.active === false ? "" : "checked"} />
            <span>Active in new forms</span>
          </label>
        </div>
        <div class="field wide">
          <div class="actions">
            <button class="button" type="submit">${student ? "Update student" : "Add student"}</button>
            ${student ? `<button class="ghost-button" type="button" data-action="cancel-student-edit">Cancel</button>` : ""}
          </div>
        </div>
      </form>
    `;
  }

  function submitTransaction(form) {
    const data = new FormData(form);
    const direction = form.dataset.direction;
    const category = categoryById(direction, form.dataset.categoryId);
    const account = accountById(data.get("accountId"));
    const amount = Number(data.get("amount"));

    if (!category || !account || !Number.isFinite(amount) || amount <= 0) {
      showToast("Check category, account, and amount.");
      return;
    }

    let student = null;
    if (direction === "credit" && category.role === "tuition") {
      student = studentById(data.get("studentId"));
      if (!student) {
        showToast("Choose a student for tuition credit.");
        return;
      }
    }

    const transaction = {
      id: createId("tx"),
      direction,
      categoryId: category.id,
      categoryName: category.name,
      accountId: account.id,
      accountName: account.name,
      transferAccountId: "",
      transferAccountName: "",
      studentId: student?.id || "",
      studentName: student?.name || "",
      amount,
      date: String(data.get("date") || today()),
      note: cleanText(data.get("note")),
      createdAt: new Date().toISOString()
    };

    state.transactions.push(transaction);
    applyTransactionEffect(transaction, 1);
    persistAndRender("Transaction saved.");
  }

  function submitTransfer(form) {
    const data = new FormData(form);
    const from = accountById(data.get("fromAccountId"));
    const to = accountById(data.get("toAccountId"));
    const amount = Number(data.get("amount"));

    if (!from || !to || from.id === to.id) {
      showToast("Choose two different accounts.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid transfer amount.");
      return;
    }

    const transaction = {
      id: createId("tx"),
      direction: "transfer",
      categoryId: "",
      categoryName: "Transfer",
      accountId: from.id,
      accountName: from.name,
      transferAccountId: to.id,
      transferAccountName: to.name,
      studentId: "",
      studentName: "",
      amount,
      date: String(data.get("date") || today()),
      note: cleanText(data.get("note")),
      createdAt: new Date().toISOString()
    };

    state.transactions.push(transaction);
    applyTransactionEffect(transaction, 1);
    persistAndRender("Transfer saved.");
  }

  function submitProfile(form) {
    const data = new FormData(form);
    state.settings.appName = cleanText(data.get("appName")) || "Transaction Logger";
    state.settings.ownerName = cleanText(data.get("ownerName")) || "New User";
    state.settings.currencySymbol = cleanText(data.get("currencySymbol")) || "৳";
    persistAndRender("Profile saved.");
  }

  function submitAccount(form) {
    const data = new FormData(form);
    const id = form.dataset.accountId;
    const existing = accountById(id);
    const name = cleanText(data.get("name"));
    const balance = Number(data.get("balance"));

    if (!name || !Number.isFinite(balance)) {
      showToast("Enter account name and balance.");
      return;
    }

    if (existing) {
      existing.name = name;
      existing.balance = balance;
    } else {
      state.accounts.push({
        id: createId("account"),
        type: "account",
        name,
        balance,
        archived: false
      });
    }

    ui.editingAccountId = "";
    persistAndRender(existing ? "Account updated." : "Account added.");
  }

  function submitCategory(form) {
    const data = new FormData(form);
    const direction = form.dataset.direction;
    const id = form.dataset.categoryId;
    const name = cleanText(data.get("name"));
    const role = direction === "credit" && data.get("role") === "tuition" ? "tuition" : "regular";
    const existing = categoryById(direction, id);

    if (!name) {
      showToast("Enter a category name.");
      return;
    }

    if (role === "tuition") {
      state.categories.credit.forEach((category) => {
        category.role = "regular";
      });
    }

    if (existing) {
      existing.name = name;
      existing.role = role;
      if (role === "tuition") {
        state.settings.tuitionCategoryId = existing.id;
      }
    } else {
      const category = {
        id: createId(direction === "credit" ? "credit" : "debit"),
        name,
        role,
        archived: false
      };
      state.categories[direction].push(category);
      if (role === "tuition") {
        state.settings.tuitionCategoryId = category.id;
      }
    }

    setCategoryEditor(direction, "", false);
    persistAndRender(existing ? "Category updated." : "Category added.");
  }

  function submitStudent(form) {
    const data = new FormData(form);
    const id = form.dataset.studentId;
    const existing = studentById(id);
    const name = cleanText(data.get("name"));
    const cycleDays = Number(data.get("cycleDays"));
    const active = data.get("active") === "on";

    if (!name) {
      showToast("Enter a student name.");
      return;
    }

    const payload = {
      id: existing?.id || createId("student"),
      name,
      active,
      cycleDays: Number.isInteger(cycleDays) && cycleDays > 0 ? cycleDays : null
    };

    if (existing) {
      Object.assign(existing, payload);
    } else {
      state.students.push(payload);
    }

    ui.editingStudentId = "";
    persistAndRender(existing ? "Student updated." : "Student added.");
  }

  function deleteTransaction(transactionId) {
    const transaction = state.transactions.find((item) => item.id === transactionId);
    if (!transaction) {
      return;
    }

    if (!window.confirm("Delete this transaction and reverse its balance effect?")) {
      return;
    }

    applyTransactionEffect(transaction, -1);
    state.transactions = state.transactions.filter((item) => item.id !== transactionId);
    persistAndRender("Transaction deleted.");
  }

  function setAccountArchived(accountId, archived) {
    const account = accountById(accountId);
    if (!account) {
      return;
    }
    account.archived = archived;
    persistAndRender(archived ? "Account archived." : "Account restored.");
  }

  function setCategoryArchived(direction, categoryId, archived) {
    const category = categoryById(direction, categoryId);
    if (!category) {
      return;
    }
    if (category.role === "tuition" && archived) {
      showToast("Set another tuition category before archiving this one.");
      return;
    }
    category.archived = archived;
    persistAndRender(archived ? "Category archived." : "Category restored.");
  }

  function setStudentActive(studentId, active) {
    const student = studentById(studentId);
    if (!student) {
      return;
    }
    student.active = active;
    persistAndRender(active ? "Student restored." : "Student marked inactive.");
  }

  function setCategoryEditor(direction, categoryId, shouldRender = true) {
    if (direction === "credit") {
      ui.editingCreditCategoryId = categoryId;
    } else {
      ui.editingDebitCategoryId = categoryId;
    }
    if (shouldRender) {
      render();
    }
  }

  function toggleTuitionStudent(month, studentId, checked) {
    const record = getTuitionRecord(month);
    if (checked && !record.studentIds.includes(studentId)) {
      record.studentIds.push(studentId);
    }
    if (!checked) {
      record.studentIds = record.studentIds.filter((id) => id !== studentId);
    }
    persistAndRender("Tuition columns updated.");
  }

  function toggleAttendance(month, studentId, date) {
    const record = getTuitionRecord(month);
    if (!record.attendance[studentId]) {
      record.attendance[studentId] = {};
    }
    record.attendance[studentId][date] = record.attendance[studentId][date] !== true;
    persistAndRender("Attendance updated.");
  }

  async function resetBlankState() {
    if (!window.confirm("Reset this new app to a blank state?")) {
      return;
    }
    state = apiAvailable ? await fetchJson(API_DEFAULT_STATE) : createDefaultState();
    initializeSelections();
    persistAndRender("Blank state loaded.");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = today();
    link.href = url;
    link.download = `transaction-logger-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Export ready.");
  }

  function importDataFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        if (!payload || typeof payload !== "object") {
          throw new Error("Invalid data");
        }
        state = payload;
        initializeSelections();
        persistAndRender("Imported data saved.");
      } catch {
        showToast("That JSON file could not be imported.");
      }
    };
    reader.readAsText(file);
  }

  function applyTransactionEffect(transaction, multiplier) {
    const amount = Number(transaction.amount) * multiplier;
    if (!Number.isFinite(amount)) {
      return;
    }

    if (transaction.direction === "credit") {
      adjustAccount(transaction.accountId, amount);
    }
    if (transaction.direction === "debit") {
      adjustAccount(transaction.accountId, -amount);
    }
    if (transaction.direction === "transfer") {
      adjustAccount(transaction.accountId, -amount);
      adjustAccount(transaction.transferAccountId, amount);
    }
  }

  function adjustAccount(accountId, delta) {
    const account = accountById(accountId);
    if (!account) {
      return;
    }
    account.balance = roundMoney((Number(account.balance) || 0) + delta);
  }

  function persistAndRender(message) {
    persistState();
    render();
    if (message) {
      showToast(message);
    }
  }

  function persistState() {
    state.audit = {
      ...(state.audit || {}),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!apiAvailable) {
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await fetch(API_STATE, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state)
        });
      } catch {
        apiAvailable = false;
        showToast("Saved locally. Server save failed.");
      }
    }, 120);
  }

  function showToast(message) {
    toastRoot.textContent = message;
    toastRoot.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toastRoot.classList.remove("show");
    }, 2600);
  }

  function pageHeader(kicker, title, copy, actions = "") {
    return `
      <header class="page-header">
        <div>
          <p class="eyebrow">${escapeHtml(kicker)}</p>
          <h2>${title}</h2>
        </div>
        ${actions ? `<div class="actions">${actions}</div>` : ""}
      </header>
    `;
  }

  function metric(label, value, valueClass = "") {
    return `
      <article class="metric">
        <p class="metric-label">${escapeHtml(label)}</p>
        <strong class="${valueClass}">${escapeHtml(String(value))}</strong>
      </article>
    `;
  }

  function renderAccountCard(account) {
    return `
      <article class="list-card">
        <div class="list-top">
          <div>
            <p class="list-title">${escapeHtml(account.name)}</p>
            <p class="list-meta">Account</p>
          </div>
          <span class="amount-pill">${formatMoney(account.balance)}</span>
        </div>
      </article>
    `;
  }

  function renderAccountManagementCard(account) {
    return `
      <article class="list-card">
        <div class="list-top">
          <div>
            <p class="list-title">${escapeHtml(account.name)}</p>
            <p class="list-meta">${account.archived ? "Archived" : "Active"}</p>
          </div>
          <span class="amount-pill">${formatMoney(account.balance)}</span>
        </div>
        <div class="inline-actions">
          <button class="icon-button" type="button" data-action="edit-account" data-account-id="${account.id}">Edit</button>
          ${
            account.archived
                ? `<button class="ghost-button" type="button" data-action="restore-account" data-account-id="${account.id}">Restore</button>`
                : `<button class="ghost-button" type="button" data-action="archive-account" data-account-id="${account.id}">Archive</button>`
          }
        </div>
      </article>
    `;
  }

  function renderCategoryCard(category, direction) {
    return `
      <article class="list-card">
        <div class="list-top">
          <div>
            <p class="list-title">${escapeHtml(category.name)}</p>
            <p class="list-meta">${category.role === "tuition" ? "Tuition/student credit category" : category.archived ? "Archived" : "Active"}</p>
          </div>
          <span class="status-pill">${escapeHtml(direction)}</span>
        </div>
        <div class="inline-actions">
          <button class="icon-button" type="button" data-action="edit-category" data-direction="${direction}" data-category-id="${category.id}">Edit</button>
          ${
            category.archived
              ? `<button class="ghost-button" type="button" data-action="restore-category" data-direction="${direction}" data-category-id="${category.id}">Restore</button>`
              : `<button class="ghost-button" type="button" data-action="archive-category" data-direction="${direction}" data-category-id="${category.id}">Archive</button>`
          }
        </div>
      </article>
    `;
  }

  function renderStudentCard(student, options = {}) {
    const total = getStudentTuitionTotal(student.id);
    const attendance = getStudentAttendanceCount(student.id);
    const compact = options.compact === true;
    return `
      <article class="list-card">
        <div class="list-top">
          <div>
            <p class="list-title">${escapeHtml(student.name)}</p>
            <p class="list-meta">${student.active === false ? "Inactive" : "Active"}${student.cycleDays ? `, ${student.cycleDays}-day cycle` : ""} - ${attendance} attendance mark(s)</p>
          </div>
          <span class="amount-pill">${formatMoney(total)}</span>
        </div>
        ${
          compact
            ? ""
            : `
              <div class="inline-actions">
                <button class="icon-button" type="button" data-action="edit-student" data-student-id="${student.id}">Edit</button>
                ${
                  student.active === false
                    ? `<button class="ghost-button" type="button" data-action="restore-student" data-student-id="${student.id}">Restore</button>`
                    : `<button class="ghost-button" type="button" data-action="archive-student" data-student-id="${student.id}">Mark inactive</button>`
                }
              </div>
            `
        }
      </article>
    `;
  }

  function renderTransactionCard(transaction) {
    return `
      <article class="list-card">
        <div class="list-top">
          <div>
            <p class="list-title">${escapeHtml(formatTransactionTitle(transaction))}</p>
            <p class="list-meta">${escapeHtml(formatDate(transaction.date))} - ${escapeHtml(formatTransactionAccount(transaction))}</p>
          </div>
          <span class="amount-pill ${transaction.direction}">${formatMoney(transaction.amount)}</span>
        </div>
        ${transaction.note ? `<p class="list-meta">${escapeHtml(transaction.note)}</p>` : ""}
      </article>
    `;
  }

  function emptyBlock(title) {
    return `
      <div class="empty">
        <h3>${escapeHtml(title)}</h3>
      </div>
    `;
  }

  function getSummary() {
    const income = state.transactions
      .filter((transaction) => transaction.direction === "credit")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const expenses = state.transactions
      .filter((transaction) => transaction.direction === "debit")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const totalBalance = activeAccounts().reduce((sum, account) => sum + Number(account.balance || 0), 0);
    const tuition = state.transactions
      .filter((transaction) => transaction.direction === "credit" && transaction.categoryId === state.settings.tuitionCategoryId)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return {
      income,
      expenses,
      totalBalance,
      tuition,
      net: income - expenses
    };
  }

  function getFilteredTransactions() {
    return state.transactions
      .filter((transaction) => {
        if (ui.historyDirection !== "all" && transaction.direction !== ui.historyDirection) {
          return false;
        }
        if (ui.historyCategory !== "all" && transaction.categoryId !== ui.historyCategory) {
          return false;
        }
        if (
          ui.historyAccount !== "all" &&
          transaction.accountId !== ui.historyAccount &&
          transaction.transferAccountId !== ui.historyAccount
        ) {
          return false;
        }
        if (ui.historyStudent !== "all" && transaction.studentId !== ui.historyStudent) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function getTuitionRecord(month) {
    if (!state.tuitionTracker[month]) {
      state.tuitionTracker[month] = {
        studentIds: activeStudents().map((student) => student.id),
        attendance: {}
      };
    }
    return state.tuitionTracker[month];
  }

  function getMonthlyAttendanceCount(record, studentId) {
    return Object.values(record.attendance?.[studentId] || {}).filter(Boolean).length;
  }

  function getStudentAttendanceCount(studentId) {
    return Object.values(state.tuitionTracker || {}).reduce((total, record) => {
      return total + getMonthlyAttendanceCount(record, studentId);
    }, 0);
  }

  function getTotalAttendanceMarks() {
    return state.students.reduce((total, student) => total + getStudentAttendanceCount(student.id), 0);
  }

  function getStudentTuitionTotal(studentId) {
    return state.transactions
      .filter((transaction) => transaction.studentId === studentId)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }

  function activeAccounts() {
    return state.accounts.filter((account) => account.archived !== true);
  }

  function activeStudents() {
    return state.students.filter((student) => student.active !== false);
  }

  function activeCategories(direction) {
    return state.categories[direction].filter((category) => category.archived !== true);
  }

  function allCategories() {
    return [...state.categories.credit, ...state.categories.debit];
  }

  function accountById(accountId) {
    return state.accounts.find((account) => account.id === accountId);
  }

  function categoryById(direction, categoryId) {
    if (!direction || !state.categories[direction]) {
      return null;
    }
    return state.categories[direction].find((category) => category.id === categoryId) || null;
  }

  function studentById(studentId) {
    return state.students.find((student) => student.id === studentId) || null;
  }

  function getTransactionCategoryName(transaction) {
    const direction = transaction.direction === "credit" ? "credit" : "debit";
    return categoryById(direction, transaction.categoryId)?.name || transaction.categoryName || "Uncategorized";
  }

  function formatTransactionTitle(transaction) {
    if (transaction.direction === "transfer") {
      return `Transfer to ${transaction.transferAccountName || "account"}`;
    }
    const label = transaction.direction === "credit" ? "Credit" : "Debit";
    const category = getTransactionCategoryName(transaction);
    return `${label}: ${category}${transaction.studentName ? ` for ${transaction.studentName}` : ""}`;
  }

  function formatTransactionAccount(transaction) {
    if (transaction.direction === "transfer") {
      return `${transaction.accountName || "Account"} to ${transaction.transferAccountName || "Account"}`;
    }
    return transaction.accountName || accountById(transaction.accountId)?.name || "";
  }

  function formatDirection(direction) {
    if (direction === "credit") {
      return "Credit";
    }
    if (direction === "debit") {
      return "Debit";
    }
    return "Transfer";
  }

  function formatMoney(value) {
    const numeric = Number(value) || 0;
    const formatted = numeric.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${state?.settings?.currencySymbol || "৳"} ${formatted}`;
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatMonthTitle(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function monthRows(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    return Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      const date = new Date(year, month - 1, day);
      const isoDate = [
        year,
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0")
      ].join("-");
      return {
        isoDate,
        dateLabel: String(day).padStart(2, "0"),
        dayLabel: date.toLocaleDateString("en-US", { weekday: "short" })
      };
    });
  }

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function selected(value, expected) {
    return value === expected ? "selected" : "";
  }

  function createId(prefix) {
    if (window.crypto?.randomUUID) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function prepareState(payload) {
    const defaults = createDefaultState();
    const next = payload && typeof payload === "object" ? payload : defaults;
    next.settings = {
      ...defaults.settings,
      ...(next.settings || {})
    };
    delete next.settings.testerMode;

    next.accounts = Array.isArray(next.accounts) ? next.accounts : [];
    next.transactions = Array.isArray(next.transactions) ? next.transactions : [];
    next.students = Array.isArray(next.students) ? next.students : [];
    next.categories = next.categories || defaults.categories;
    next.categories.credit = Array.isArray(next.categories.credit)
      ? next.categories.credit
      : defaults.categories.credit;
    next.categories.debit = Array.isArray(next.categories.debit)
      ? next.categories.debit
      : defaults.categories.debit;
    next.tuitionTracker =
      next.tuitionTracker && typeof next.tuitionTracker === "object" ? next.tuitionTracker : {};

    next.accounts = next.accounts.map((account) => ({
        ...account,
        type: "account"
      }));

    return next;
  }

  function createDefaultState() {
    const tuitionCategoryId = "credit-tuition";
    return {
      version: 1,
      settings: {
        appName: "Transaction Logger",
        ownerName: "New User",
        currencySymbol: "৳",
        tuitionCategoryId,
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

  function roundMoney(value) {
    return Math.round(value * 100) / 100;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
