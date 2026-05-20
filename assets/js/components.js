window.DashboardComponents = (function () {
  const {
    escapeHtml,
    asArray,
    stateClass,
    formatId,
    titleCaseStatus,
    formatArea,
    formatType,
    formatDateTime,
    formatDateShort,
    normalizeStatus
  } = window.Utils;

  let lastPayload = null;

  const taskFilters = {
    status: "all",
    area: "all",
    owner: "all",
    date: "all",
    query: ""
  };

  function isExtraWorkTask(task) {
    const key = String(task.area || task.category_id || task.category || "")
      .toLowerCase()
      .replaceAll(" ", "_");
    return key === "extras_work" || key === "extra_work";
  }

  function getTechnicalTasks(data) {
    const all = asArray(data.technical_tasks || data.tasks || data.items || data.approved_tasks || [], "tasks");
    return all.filter(task => !task.archived && task.type !== "management" && task.kind !== "management" && !isExtraWorkTask(task));
  }

  function getExtraTechnicalTasks(data) {
    const explicit = asArray(data.extra_technical_tasks || [], "extra_technical_tasks");
    if (explicit.length) return explicit.filter(task => !task.archived);

    const all = asArray(data.technical_tasks || data.tasks || data.items || data.approved_tasks || [], "tasks");
    return all.filter(task => !task.archived && task.type !== "management" && task.kind !== "management" && isExtraWorkTask(task));
  }

  function getManagementTasks(data) {
    return asArray(data.management_tasks || [], "management_tasks").filter(task => !task.archived);
  }

  function getPeople(data) {
    return asArray(data.contributors || data.members || [], "contributors");
  }

  function getAreas(data) {
    return asArray(data.areas || data.categories || data.project_areas || [], "areas");
  }

  function getUpdates(data) {
    return asArray(data.updates || data.activity || data.reports || [], "updates");
  }

  function getCosts(data) {
    return asArray(data.costs_reimbursements || data.reimbursements || data.components || data.extra || [], "reimbursements")
      .filter(cost => !cost.archived);
  }

  function taskTitle(task, index) {
    return task.label || task.title || task.task || `Task ${index + 1}`;
  }

  function taskDoneBy(task) {
    return task.done_by || task.work_done_by || task.owner || task.member || task.member_name || "";
  }

  function taskArea(task) {
    return formatArea(task.area || task.category_name || task.category_id || task.category || "");
  }

  function taskAreaKey(task) {
    return task.area_key || task.area || task.category_id || task.category || "";
  }

  function taskPoints(task) {
    return Number(task.technical_points ?? task.points ?? task.weight ?? 0);
  }

  function taskLastUpdate(task) {
    return task.last_update || task.updated_at || task.approved_at || task.created_at || "";
  }

  function getStatus(task) {
    return normalizeStatus(task.state || task.status || "");
  }

  function isDone(task) {
    const status = getStatus(task);
    return status === "done" || status === "completed";
  }

  function isActive(task) {
    return !isDone(task) && getStatus(task) !== "canceled" && getStatus(task) !== "cancelled";
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean).map(value => String(value).trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
  }

  function datePass(value, filter) {
    if (!filter || filter === "all") return true;

    const raw = String(value || "").trim();
    if (!raw) return false;

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const start = new Date(now);

    if (filter === "today") {
      return date.toDateString() === now.toDateString();
    }

    if (filter === "7") start.setDate(now.getDate() - 7);
    else if (filter === "30") start.setDate(now.getDate() - 30);
    else return true;

    return date >= start;
  }

  function filterTechnicalTasks(tasks) {
    const query = String(taskFilters.query || "").trim().toLowerCase();

    return tasks.filter(task => {
      const status = getStatus(task);
      const area = taskArea(task);
      const owner = taskDoneBy(task);
      const lastUpdate = taskLastUpdate(task);

      if (taskFilters.status !== "all" && status !== taskFilters.status) return false;
      if (taskFilters.area !== "all" && area !== taskFilters.area) return false;
      if (taskFilters.owner !== "all" && owner !== taskFilters.owner) return false;
      if (!datePass(lastUpdate, taskFilters.date)) return false;

      if (query) {
        const haystack = [
          task.display_id,
          task.task_id,
          task.id,
          task.title,
          task.details,
          owner,
          area,
          status
        ].join(" ").toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }

  function renderOptions(values, selected, formatter = value => value) {
    return values.map(value => `
      <option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(formatter(value))}</option>
    `).join("");
  }

  function renderTechnicalFilters(tasks, filteredTasks) {
    const statuses = uniqueSorted(tasks.map(getStatus));
    const areas = uniqueSorted(tasks.map(taskArea));
    const owners = uniqueSorted(tasks.map(taskDoneBy));

    return `
      <div id="technicalTaskFilters" class="filter-panel">
        <div class="filter-panel-head">
          <div>
            <strong>Filter technical tasks</strong>
            <div class="muted small">Showing ${escapeHtml(filteredTasks.length)} of ${escapeHtml(tasks.length)} tasks</div>
          </div>
          <button class="secondary compact" data-task-filter-action="reset">Reset filters</button>
        </div>
        <div class="filter-grid">
          <label>
            Status
            <select data-task-filter="status">
              <option value="all">All statuses</option>
              ${renderOptions(statuses, taskFilters.status, titleCaseStatus)}
            </select>
          </label>
          <label>
            Area
            <select data-task-filter="area">
              <option value="all">All areas</option>
              ${renderOptions(areas, taskFilters.area)}
            </select>
          </label>
          <label>
            Done by
            <select data-task-filter="owner">
              <option value="all">All members</option>
              ${renderOptions(owners, taskFilters.owner)}
            </select>
          </label>
          <label>
            Last update
            <select data-task-filter="date">
              <option value="all" ${taskFilters.date === "all" ? "selected" : ""}>Any date</option>
              <option value="today" ${taskFilters.date === "today" ? "selected" : ""}>Today</option>
              <option value="7" ${taskFilters.date === "7" ? "selected" : ""}>Last 7 days</option>
              <option value="30" ${taskFilters.date === "30" ? "selected" : ""}>Last 30 days</option>
            </select>
          </label>
          <label class="filter-search">
            Search
            <input data-task-filter="query" type="search" value="${escapeHtml(taskFilters.query)}" placeholder="Search ID, title, owner...">
          </label>
          <div class="filter-actions">
            <button class="secondary" data-task-filter-action="apply">Apply</button>
          </div>
        </div>
      </div>
    `;
  }

  function attachFilterHandlers() {
    const panel = document.getElementById("technicalTaskFilters");
    if (!panel || !lastPayload) return;

    function readFilterValues() {
      panel.querySelectorAll("[data-task-filter]").forEach(input => {
        taskFilters[input.getAttribute("data-task-filter")] = input.value;
      });
    }

    panel.querySelectorAll("select[data-task-filter]").forEach(select => {
      select.addEventListener("change", () => {
        readFilterValues();
        render(lastPayload);
      });
    });

    const search = panel.querySelector("input[data-task-filter='query']");
    if (search) {
      search.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          readFilterValues();
          render(lastPayload);
        }
      });
    }

    panel.querySelectorAll("[data-task-filter-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-task-filter-action");

        if (action === "reset") {
          taskFilters.status = "all";
          taskFilters.area = "all";
          taskFilters.owner = "all";
          taskFilters.date = "all";
          taskFilters.query = "";
          render(lastPayload);
          return;
        }

        readFilterValues();
        render(lastPayload);
      });
    });
  }

  function renderTaskRows(tasks) {
    const mainTasks = tasks.filter(task => task.type !== "subtask" && !task.parent_task_id);
    const subtasks = tasks.filter(task => task.type === "subtask" || task.parent_task_id);

    const byParent = new Map();
    for (const subtask of subtasks) {
      const parentId = subtask.parent_task_id || "";
      if (!byParent.has(parentId)) byParent.set(parentId, []);
      byParent.get(parentId).push(subtask);
    }

    const rendered = new Set();
    const rows = [];

    for (const task of mainTasks) {
      const id = task.task_id || task.id || "";
      rows.push(`
        <tr class="task-row">
          <td>${escapeHtml(formatId(task.display_id || task.public_id || task.task_id || task.id || ""))}</td>
          <td>${escapeHtml(taskTitle(task, rows.length))}</td>
          <td><span class="${stateClass(task.state || task.status)}">${escapeHtml(titleCaseStatus(task.state || task.status || ""))}</span></td>
          <td>${escapeHtml(taskDoneBy(task))}</td>
          <td>${escapeHtml(taskArea(task))}</td>
          <td>${escapeHtml(taskPoints(task))}</td>
          <td>${escapeHtml(formatDateShort(taskLastUpdate(task)))}</td>
        </tr>
      `);

      for (const subtask of byParent.get(id) || []) {
        rendered.add(subtask.task_id || subtask.id || "");
        rows.push(`
          <tr class="subtask-row">
            <td>${escapeHtml(formatId(subtask.display_id || subtask.public_id || subtask.task_id || subtask.id || ""))}</td>
            <td><span class="subtask-indent">↳</span>${escapeHtml(taskTitle(subtask, rows.length))}</td>
            <td><span class="${stateClass(subtask.state || subtask.status)}">${escapeHtml(titleCaseStatus(subtask.state || subtask.status || ""))}</span></td>
            <td>${escapeHtml(taskDoneBy(subtask))}</td>
            <td>${escapeHtml(taskArea(subtask))}</td>
            <td>${escapeHtml(taskPoints(subtask))}</td>
            <td>${escapeHtml(formatDateShort(taskLastUpdate(subtask)))}</td>
          </tr>
        `);
      }
    }

    for (const subtask of subtasks) {
      const subtaskId = subtask.task_id || subtask.id || "";
      if (rendered.has(subtaskId)) continue;

      rows.push(`
        <tr class="subtask-row">
          <td>${escapeHtml(formatId(subtask.display_id || subtask.public_id || subtask.task_id || subtask.id || ""))}</td>
          <td><span class="subtask-indent">↳</span>${escapeHtml(taskTitle(subtask, rows.length))}</td>
          <td><span class="${stateClass(subtask.state || subtask.status)}">${escapeHtml(titleCaseStatus(subtask.state || subtask.status || ""))}</span></td>
          <td>${escapeHtml(taskDoneBy(subtask))}</td>
          <td>${escapeHtml(taskArea(subtask))}</td>
          <td>${escapeHtml(taskPoints(subtask))}</td>
          <td>${escapeHtml(formatDateShort(taskLastUpdate(subtask)))}</td>
        </tr>
      `);
    }

    return rows.join("") || `<tr><td colspan="7" class="muted">No approved technical tasks are visible yet.</td></tr>`;
  }

  function buildContributorRows(people, technicalTasks, managementTasks) {
    return people.map(person => {
      const name = person.label || person.name || person.display_name || person.id || "";
      const technicalMine = technicalTasks.filter(task => taskDoneBy(task) === name);
      const managementMine = managementTasks.filter(task => taskDoneBy(task) === name);
      const completed = technicalMine.filter(isDone).length;
      const active = technicalMine.filter(isActive).length;
      const technicalPoints = technicalMine.reduce((sum, task) => sum + taskPoints(task), 0);
      const managementPoints = managementMine.reduce((sum, task) => sum + Number(task.management_points ?? task.points ?? task.weight ?? 0), 0);

      const dates = technicalMine.concat(managementMine).map(taskLastUpdate).filter(Boolean).sort();

      return {
        name,
        completed,
        active,
        technicalPoints,
        managementPoints,
        lastActivity: dates.length ? dates[dates.length - 1] : (person.last_activity || person.last_update || "")
      };
    });
  }

  function buildDerivedAreas(rawAreas, tasks) {
    const defaults = [
      { id: "electronic_design_study", name: "Electronic design", status: "Not started", tasks: 0, completed: 0, points: 0 },
      { id: "mechanical_design_study", name: "Mechanical design", status: "Not started", tasks: 0, completed: 0, points: 0 },
      { id: "prototype_wiring_assembly", name: "Prototype wiring & assembly", status: "Not started", tasks: 0, completed: 0, points: 0 },
      { id: "calibration_testing", name: "Calibration & testing", status: "Not started", tasks: 0, completed: 0, points: 0 }
    ];

    const map = new Map();

    for (const area of defaults) {
      map.set(formatArea(area.id), { ...area });
    }

    // Only merge raw area totals when they match one of the four canonical project areas.
    // This avoids duplicate rows such as "Electronic design" and "Electronic design and study".
    for (const area of rawAreas) {
      const idBasedName = formatArea(area.id || area.category_id || area.area || "");
      const nameBasedName = formatArea(area.label || area.name || area.title || "");
      const canonicalName = map.has(idBasedName) ? idBasedName : (map.has(nameBasedName) ? nameBasedName : "");
      if (!canonicalName) continue;

      const current = map.get(canonicalName);
      map.set(canonicalName, {
        ...current,
        status: area.status || area.state || current.status,
        tasks: Number(area.tasks ?? area.items_count ?? area.tasks_count ?? area.task_count ?? current.tasks ?? 0),
        completed: Number(area.completed ?? area.completed_tasks ?? current.completed ?? 0),
        points: Number(area.points ?? area.total_points ?? area.total_weight ?? current.points ?? 0)
      });
    }

    // Recalculate from visible technical tasks, which is the source of truth for the team dashboard.
    for (const area of map.values()) {
      area.tasks = 0;
      area.completed = 0;
      area.points = 0;
      area.status = "Not started";
    }

    for (const task of tasks) {
      const canonicalName = formatArea(taskAreaKey(task) || task.area || task.category_id || task.category || "");
      if (!map.has(canonicalName)) continue;

      const current = map.get(canonicalName);
      current.tasks += 1;
      current.completed += isDone(task) ? 1 : 0;
      current.points += taskPoints(task);
      current.status = current.tasks ? "Active" : "Not started";
    }

    return Array.from(map.values());
  }

  function renderManagementRows(tasks) {
    return tasks.length
      ? tasks.map(task => `
        <tr>
          <td>${escapeHtml(formatId(task.display_id || task.id || task.task_id || ""))}</td>
          <td>${escapeHtml(taskTitle(task, 0))}</td>
          <td>${escapeHtml(taskDoneBy(task))}</td>
          <td><span class="${stateClass(task.status)}">${escapeHtml(titleCaseStatus(task.status))}</span></td>
          <td>${escapeHtml(Number(task.management_points ?? task.points ?? task.weight ?? 0))}</td>
          <td>${escapeHtml(task.notes || task.note || "—")}</td>
          <td>${escapeHtml(formatDateShort(taskLastUpdate(task)))}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="7" class="muted">No management or coordination tasks are listed yet.</td></tr>`;
  }

  function renderCostRows(costs) {
    return costs.length
      ? costs.map(cost => `
        <tr>
          <td>${escapeHtml(formatId(cost.display_id || cost.public_id || cost.id || cost.component_id || ""))}</td>
          <td>${escapeHtml(cost.description || cost.label || cost.title || cost.name || "")}</td>
          <td>${escapeHtml(formatType(cost.type || cost.kind || ""))}</td>
          <td>${escapeHtml(cost.owner || cost.member_name || cost.reported_by || "")}</td>
          <td><span class="${stateClass(cost.status)}">${escapeHtml(titleCaseStatus(cost.status || ""))}</span></td>
          <td>${escapeHtml(cost.display_amount || cost.amount || cost.price || "")}</td>
          <td>${escapeHtml(titleCaseStatus(cost.bureau_status || cost.client_status || ""))}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="7" class="muted">No costs or reimbursements have been approved yet.</td></tr>`;
  }

  function friendlyUpdateLabel(update, index) {
    const raw = String(update.summary || update.label || update.title || "").trim();
    const kind = String(update.kind || "").trim().toLowerCase();
    const id = String(update.id || update.command_id || update.related_id || "").trim();

    if (raw && !raw.startsWith("CMD-")) return raw;

    if (kind === "task_update") return "Task updated";
    if (kind === "task_create" || kind === "subtask_create") return "Task added";
    if (kind === "task_archive") return "Task removed from active dashboard";
    if (kind === "management_create") return "Management task added";
    if (kind === "management_update") return "Management task updated";
    if (kind === "management_archive") return "Management task removed";
    if (kind === "cost_create") return "Cost / reimbursement added";
    if (kind === "cost_update") return "Cost / reimbursement updated";
    if (kind === "cost_archive") return "Cost / reimbursement removed";
    if (kind === "report") return "Report applied to dashboard";

    if (id.startsWith("CMD-")) return "Dashboard change queued";
    return raw || `Update ${index + 1}`;
  }

  function renderUpdates(updates) {
    return updates.length
      ? updates.map((update, index) => `
        <tr>
          <td>${escapeHtml(friendlyUpdateLabel(update, index))}</td>
          <td>${escapeHtml(update.member_name || update.owner || update.reported_by || "System")}</td>
          <td><span class="${stateClass(update.status)}">${escapeHtml(titleCaseStatus(update.status || ""))}</span></td>
          <td>${escapeHtml(formatDateTime(update.time || update.applied_at || update.submitted_at || update.created_at || ""))}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="4" class="muted">No approved updates are listed yet.</td></tr>`;
  }

  function countPendingReimbursements(costs) {
    return costs.filter(cost => {
      const status = normalizeStatus(cost.status || cost.state || "");
      return !status || status.includes("pending") || status.includes("waiting") || status.includes("review");
    }).length;
  }

  function render(payload) {
    lastPayload = payload;
    const data = payload.data || {};
    const view = payload.view || "normal";

    const technicalTasks = getTechnicalTasks(data);
    const extraTechnicalTasks = getExtraTechnicalTasks(data);
    const filteredTechnicalTasks = filterTechnicalTasks(technicalTasks);
    const managementTasks = getManagementTasks(data);
    const people = getPeople(data);
    const rawAreas = getAreas(data);
    const updates = getUpdates(data);
    const costs = getCosts(data);

    const completedTasks = technicalTasks.filter(isDone).length;
    const totalTasks = technicalTasks.length;
    const technicalPoints = technicalTasks.reduce((sum, task) => sum + taskPoints(task), 0);
    const extraTechnicalPoints = extraTechnicalTasks.reduce((sum, task) => sum + taskPoints(task), 0);
    const managementPoints = managementTasks.reduce((sum, task) => sum + Number(task.management_points ?? task.points ?? task.weight ?? 0), 0);
    const pendingReimbursements = countPendingReimbursements(costs);
    const approvedUpdates = Number(
      data.overview?.approved_updates ??
      data.overview?.accepted_reports ??
      data.report_status?.accepted_reports ??
      updates.length
    );

    const lastUpdate =
      data.last_update ||
      data.generated_at ||
      data.exported_at ||
      data.updated_at ||
      payload.served_at ||
      "";

    const progressPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    document.getElementById("viewBadge").textContent = view === "admin" ? "Admin View" : "Team View";
    document.getElementById("viewBadge").className = view === "admin" ? "pill admin" : "pill";
    document.getElementById("servedAt").textContent = "Data updated: " + formatDateTime(lastUpdate);

    document.getElementById("downloadButton").classList.toggle("hidden", view !== "admin");
    document.getElementById("rawButton").classList.toggle("hidden", view !== "admin");
    document.getElementById("adminPanel").classList.toggle("hidden", view !== "admin");

    const statusCounts = {
      planned: 0,
      in_progress: 0,
      blocked: 0,
      needs_review: 0,
      done: 0
    };

    for (const task of technicalTasks) {
      const status = getStatus(task);
      if (status === "done" || status === "completed") statusCounts.done += 1;
      else if (status === "in_progress") statusCounts.in_progress += 1;
      else if (status === "blocked") statusCounts.blocked += 1;
      else if (status === "needs_review") statusCounts.needs_review += 1;
      else statusCounts.planned += 1;
    }

    const contributorRows = buildContributorRows(people, technicalTasks, managementTasks).length
      ? buildContributorRows(people, technicalTasks, managementTasks).map(person => `
        <tr>
          <td>${escapeHtml(person.name)}</td>
          <td>${escapeHtml(person.completed)}</td>
          <td>${escapeHtml(person.active)}</td>
          <td>${escapeHtml(person.technicalPoints)}</td>
          <td>${escapeHtml(person.managementPoints)}</td>
          <td>${escapeHtml(formatDateTime(person.lastActivity))}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="6" class="muted">No contributor summary available.</td></tr>`;

    const areaRows = buildDerivedAreas(rawAreas, technicalTasks).map(area => {
      const taskCount = Number(area.tasks ?? area.items_count ?? area.tasks_count ?? area.task_count ?? 0);
      const completed = Number(area.completed ?? area.completed_tasks ?? 0);
      const points = Number(area.points ?? area.total_points ?? area.total_weight ?? 0);
      const progress = taskCount ? Math.round((completed / taskCount) * 100) : 0;

      return `
        <tr>
          <td>${escapeHtml(area.name || formatArea(area.id || area.category_id || ""))}</td>
          <td>${escapeHtml(area.status || area.state || (taskCount ? "Active" : "Not started"))}</td>
          <td>${escapeHtml(taskCount)}</td>
          <td>${escapeHtml(completed)}</td>
          <td>${escapeHtml(points)}</td>
          <td>${escapeHtml(progress)}%</td>
        </tr>
      `;
    }).join("");

    const queue = data.command_queue || {};
    const queueHtml = view === "admin" ? `
      <section class="card">
        <h2>Command Queue</h2>
        <div class="table-scroll table-scroll-medium">
          <table>
            <thead><tr><th>Queue</th><th>Count</th></tr></thead>
            <tbody>
              <tr><td>Inbox</td><td>${escapeHtml((queue.inbox || []).length)}</td></tr>
              <tr><td>Processed</td><td>${escapeHtml((queue.processed || []).length)}</td></tr>
              <tr><td>Failed</td><td>${escapeHtml((queue.failed || []).length)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    ` : "";

    document.getElementById("content").innerHTML = `
      <div class="grid overview-grid">
        <div class="card">
          <div class="label">Total technical tasks</div>
          <div class="metric">${totalTasks}</div>
          <div class="muted small">Approved technical work</div>
        </div>
        <div class="card">
          <div class="label">Completed tasks</div>
          <div class="metric">${completedTasks}</div>
          <div class="muted small">Tasks marked done</div>
        </div>
        <div class="card">
          <div class="label">Technical points</div>
          <div class="metric">${technicalPoints}</div>
          <div class="muted small">Approved contribution weight</div>
        </div>
        <div class="card">
          <div class="label">Management points</div>
          <div class="metric">${managementPoints}</div>
          <div class="muted small">Tracked separately</div>
        </div>
        <div class="card">
          <div class="label">Pending reimbursements</div>
          <div class="metric">${pendingReimbursements}</div>
          <div class="muted small">Costs not fully settled</div>
        </div>
        <div class="card">
          <div class="label">Approved updates</div>
          <div class="metric">${approvedUpdates}</div>
          <div class="muted small">Published progress records</div>
        </div>
      </div>

      <section class="card">
        <h2>Project Progress</h2>
        <div class="progress-summary">
          <div>
            <strong>${completedTasks} of ${totalTasks}</strong> technical tasks completed
            <div class="muted small">${progressPercent}% complete based on visible technical tasks</div>
          </div>
          <div class="progress-value">${progressPercent}%</div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${progressPercent}%"></div></div>
        <div class="status-breakdown">
          <span>Planned: ${statusCounts.planned}</span>
          <span>In progress: ${statusCounts.in_progress}</span>
          <span>Blocked: ${statusCounts.blocked}</span>
          <span>Needs review: ${statusCounts.needs_review}</span>
          <span>Done: ${statusCounts.done}</span>
        </div>
      </section>

      <section class="card">
        <h2>Technical Tasks</h2>
        ${renderTechnicalFilters(technicalTasks, filteredTechnicalTasks)}
        <div class="table-scroll table-scroll-panel">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Task</th><th>Status</th><th>Done by</th><th>Area</th><th>Points</th><th>Last update</th>
              </tr>
            </thead>
            <tbody>${renderTaskRows(filteredTechnicalTasks)}</tbody>
          </table>
        </div>
      </section>

      ${extraTechnicalTasks.length ? `
      <section class="card">
        <h2>Extra Technical Work</h2>
        <p class="muted small">Technical work outside the original client-agreed categories. Tracked separately for later extra payment discussion.</p>
        <div class="table-scroll table-scroll-panel">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Task</th><th>Status</th><th>Done by</th><th>Area</th><th>Points</th><th>Last update</th>
              </tr>
            </thead>
            <tbody>${renderTaskRows(extraTechnicalTasks)}</tbody>
          </table>
        </div>
        <div class="muted small extra-summary">Extra work points: ${escapeHtml(extraTechnicalPoints)}</div>
      </section>
      ` : ""}

      <section class="card">
        <h2>Team Contribution Overview</h2>
        <div class="table-scroll table-scroll-panel table-scroll-medium">
          <table>
            <thead>
              <tr>
                <th>Contributor</th><th>Completed tasks</th><th>Active tasks</th><th>Technical points</th><th>Management points</th><th>Last activity</th>
              </tr>
            </thead>
            <tbody>${contributorRows}</tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Project Areas</h2>
        <div class="table-scroll table-scroll-medium">
          <table>
            <thead>
              <tr><th>Area</th><th>Status</th><th>Tasks</th><th>Completed</th><th>Points</th><th>Progress</th></tr>
            </thead>
            <tbody>${areaRows}</tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Management & Coordination</h2>
        <p class="muted small">Tracked separately because management compensation was not defined in the original agreement.</p>
        <div class="table-scroll table-scroll-panel table-scroll-medium">
          <table>
            <thead>
              <tr><th>ID</th><th>Task</th><th>Owner</th><th>Status</th><th>Management points</th><th>Notes</th><th>Last update</th></tr>
            </thead>
            <tbody>${renderManagementRows(managementTasks)}</tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Costs & Reimbursements</h2>
        <div class="table-scroll table-scroll-panel table-scroll-medium">
          <table>
            <thead>
              <tr><th>ID</th><th>Description</th><th>Type</th><th>Owner</th><th>Status</th><th>Amount</th><th>Bureau/client status</th></tr>
            </thead>
            <tbody>${renderCostRows(costs)}</tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Latest Team Updates</h2>
        <div class="table-scroll table-scroll-panel updates-scroll">
          <table>
            <thead><tr><th>Update</th><th>Owner</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>${renderUpdates(updates)}</tbody>
          </table>
        </div>
      </section>

      ${queueHtml}

      <div class="footer">Last data update: ${escapeHtml(formatDateTime(lastUpdate))}</div>
    `;

    attachFilterHandlers();

    document.getElementById("rawData").textContent = JSON.stringify(payload, null, 2);
  }

  return { render };
})();
