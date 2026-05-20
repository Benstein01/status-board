window.AdminEditor = (function () {
  const {
    escapeHtml,
    asArray,
    formatId,
    titleCaseStatus,
    formatArea
  } = window.Utils;

  const TEAM_MEMBERS = [
    "M. Benhadjer",
    "A. El Mohri",
    "A. Hadjamar",
    "Y. Benyahia"
  ];

  const PROJECT_AREAS = [
    ["electronic_design_study", "Electronic design"],
    ["mechanical_design_study", "Mechanical design"],
    ["prototype_wiring_assembly", "Prototype wiring & assembly"],
    ["calibration_testing", "Calibration & testing"],
    ["extras_work", "Extra technical work"]
  ];

  const STATUS_OPTIONS = [
    ["planned", "Planned"],
    ["in_progress", "In progress"],
    ["blocked", "Blocked"],
    ["needs_review", "Needs review"],
    ["done", "Done"],
    ["canceled", "Canceled"]
  ];

  const POINT_OPTIONS = [
    ["0", "0 — No points"],
    ["1", "1 — Small task"],
    ["2", "2 — Standard task"],
    ["3", "3 — Important task"],
    ["4", "4 — Major task"],
    ["5", "5 — Critical / high-effort task"]
  ];

  const COST_TYPE_OPTIONS = [
    ["component", "Component"],
    ["material", "Material"],
    ["3d_print", "3D print"],
    ["fabricated_part", "Fabricated part"],
    ["pcb_manufacturing", "PCB manufacturing"],
    ["tool_service", "Tool/service"],
    ["other", "Other"]
  ];

  const COST_STATUS_OPTIONS = [
    ["draft", "Draft"],
    ["pending_review", "Pending review"],
    ["approved", "Approved"],
    ["used_in_prototype", "Used in prototype"],
    ["waiting_reimbursement", "Waiting reimbursement"],
    ["reimbursed", "Reimbursed"],
    ["rejected", "Rejected"]
  ];

  const BUREAU_STATUS_OPTIONS = [
    ["not_shared_yet", "Not shared yet"],
    ["shared", "Shared"],
    ["approved", "Approved"],
    ["included_in_agreement", "Included in agreement"],
    ["needs_discussion", "Needs discussion"]
  ];

  let currentChanges = [];
  let nextTaskNumber = 1;
  let nextManagementNumber = 1;
  let nextCostNumber = 1;
  let subtaskCounters = {};

  function getTechnicalTasks(data) {
    const all = asArray(data.technical_tasks || data.tasks || [], "tasks");
    return all.filter(task => !task.archived && task.type !== "management" && task.kind !== "management");
  }

  function getManagementTasks(data) {
    return asArray(data.management_tasks || [], "management_tasks").filter(task => !task.archived);
  }

  function getCosts(data) {
    return asArray(data.costs_reimbursements || data.components || data.reimbursements || [], "components").filter(cost => !cost.archived);
  }

  function rawId(item) {
    return item.task_id || item.component_id || item.id || item.public_id || "";
  }

  function extractFirstNumber(value) {
    const match = String(value || "").match(/(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function extractTaskNumber(value) {
    let match = String(value || "").match(/^T-0*(\d+)$/i);
    if (match) return Number(match[1]);

    match = String(value || "").match(/^ST-0*(\d+)-0*(\d+)$/i);
    if (match) return Number(match[1]);

    return extractFirstNumber(value);
  }

  function extractSubtaskNumber(value) {
    const match = String(value || "").match(/^ST-0*(\d+)-0*(\d+)$/i);
    return match ? Number(match[2]) : 0;
  }

  function makeInternalTaskId(number) {
    return "T-" + String(number).padStart(4, "0");
  }

  function makeInternalManagementId(number) {
    return "PM-" + String(number).padStart(4, "0");
  }

  function makeInternalCostId(number) {
    return "C-" + String(number).padStart(4, "0");
  }

  function makeSubtaskId(parentId) {
    const parentNumber = extractTaskNumber(parentId);
    subtaskCounters[parentId] = (subtaskCounters[parentId] || 0) + 1;

    return {
      internal: "ST-" + String(parentNumber).padStart(4, "0") + "-" + String(subtaskCounters[parentId]).padStart(2, "0"),
      display: "T-" + parentNumber + "." + subtaskCounters[parentId]
    };
  }

  function calculateNextTaskNumber(tasks) {
    return tasks.reduce((max, task) => Math.max(max, extractTaskNumber(rawId(task))), 0) + 1;
  }

  function calculateNextPrefixedNumber(items, prefix) {
    let max = 0;

    for (const item of items) {
      const id = rawId(item);
      const pattern = new RegExp("^" + prefix + "-0*(\\d+)$", "i");
      const match = String(id || "").match(pattern);
      if (match) max = Math.max(max, Number(match[1]));
    }

    return max + 1;
  }

  function resetSubtaskCounters(tasks) {
    subtaskCounters = {};

    for (const task of tasks) {
      if (!(task.type === "subtask" || task.parent_task_id)) continue;
      const parentId = task.parent_task_id || "";
      const n = extractSubtaskNumber(rawId(task));
      subtaskCounters[parentId] = Math.max(subtaskCounters[parentId] || 0, n);
    }
  }

  function selectOptions(options, currentValue) {
    const normalized = String(currentValue || "").toLowerCase().replaceAll(" ", "_");
    return options.map(([value, label]) => {
      const selected = String(value).toLowerCase() === normalized ||
        (value === "done" && normalized === "completed")
        ? "selected"
        : "";
      return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function textInput(field, value, widthClass = "") {
    return `<input class="${widthClass}" data-admin-edit="field" data-field="${escapeHtml(field)}" data-original="${escapeHtml(value || "")}" value="${escapeHtml(value || "")}">`;
  }

  function textareaInput(field, value) {
    return `<textarea data-admin-edit="field" data-field="${escapeHtml(field)}" data-original="${escapeHtml(value || "")}">${escapeHtml(value || "")}</textarea>`;
  }

  function selectInput(field, options, value) {
    return `
      <select data-admin-edit="field" data-field="${escapeHtml(field)}" data-original="${escapeHtml(value || "")}">
        ${selectOptions(options, value)}
      </select>
    `;
  }

  function memberSelect(field, value) {
    return `
      <select data-admin-edit="field" data-field="${escapeHtml(field)}" data-original="${escapeHtml(value || "")}">
        <option value="">Choose member</option>
        ${TEAM_MEMBERS.map(name => `<option value="${escapeHtml(name)}" ${name === value ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
      </select>
    `;
  }

  function pointSelect(field, value) {
    return selectInput(field, POINT_OPTIONS, value);
  }

  function rowValues(row) {
    const values = {};

    row.querySelectorAll("[data-admin-edit='field']").forEach(input => {
      values[input.getAttribute("data-field")] = input.value;
    });

    return values;
  }

  function taskTitle(task, index) {
    return task.title || task.label || task.task || `Task ${index + 1}`;
  }

  function taskStatus(task) {
    return String(task.status || task.state || "planned").toLowerCase().replaceAll(" ", "_");
  }

  function taskDoneBy(task) {
    return task.done_by || task.work_done_by || task.owner || task.member || task.member_name || "";
  }

  function taskAreaRaw(task) {
    return task.area || task.category_id || task.category || "electronic_design_study";
  }

  function taskPoints(task) {
    return String(task.technical_points ?? task.points ?? task.weight ?? 0);
  }

  function managementPoints(task) {
    return String(task.management_points ?? task.points ?? task.weight ?? 0);
  }

  function makeTechnicalRow(options) {
    const {
      id, displayId, title, status, doneBy, area, points, rowKind, sourceTaskId, parentTaskId, isSubtask
    } = options;

    return `
      <tr
        data-admin-row="true"
        data-domain="technical"
        data-row-kind="${escapeHtml(rowKind || "existing")}"
        data-item-id="${escapeHtml(id)}"
        data-display-id="${escapeHtml(displayId)}"
        data-source-item-id="${escapeHtml(sourceTaskId || "")}"
        data-parent-task-id="${escapeHtml(parentTaskId || "")}"
      >
        <td>
          <strong>${escapeHtml(displayId)}</strong>
          ${isSubtask ? `<div class="muted small">Subtask</div>` : ""}
          ${rowKind === "new_task" ? `<div class="muted small">New</div>` : ""}
          ${rowKind === "duplicate_task" ? `<div class="muted small">Duplicate</div>` : ""}
          ${rowKind === "archive" ? `<div class="muted small">Will be removed</div>` : ""}
        </td>
        <td>${textInput("title", title)}</td>
        <td>${selectInput("status", STATUS_OPTIONS, status)}</td>
        <td>${memberSelect("done_by", doneBy)}</td>
        <td>${selectInput("area", PROJECT_AREAS, area)}</td>
        <td>${pointSelect("points", points)}</td>
        <td class="editor-actions-cell">
          ${rowKind === "archive" ? `
            <button class="secondary compact" data-editor-action="undo_archive">Undo</button>
          ` : rowKind === "existing" ? `
            <button class="secondary compact" data-editor-action="duplicate" data-source-id="${escapeHtml(id)}">Duplicate</button>
            ${isSubtask ? "" : `<button class="secondary compact" data-editor-action="add_subtask" data-parent-id="${escapeHtml(id)}">Add subtask</button>`}
            <button class="danger compact" data-editor-action="archive_existing">Remove</button>
          ` : `
            <button class="danger compact" data-editor-action="remove_new_row">Remove</button>
          `}
        </td>
      </tr>
    `;
  }

  function makeManagementRow(options) {
    const { id, displayId, title, owner, status, points, notes, rowKind } = options;

    return `
      <tr
        data-admin-row="true"
        data-domain="management"
        data-row-kind="${escapeHtml(rowKind || "existing")}"
        data-item-id="${escapeHtml(id)}"
        data-display-id="${escapeHtml(displayId)}"
      >
        <td>
          <strong>${escapeHtml(displayId)}</strong>
          ${rowKind === "new" ? `<div class="muted small">New</div>` : ""}
          ${rowKind === "archive" ? `<div class="muted small">Will be removed</div>` : ""}
        </td>
        <td>${textInput("title", title)}</td>
        <td>${memberSelect("owner", owner)}</td>
        <td>${selectInput("status", STATUS_OPTIONS, status)}</td>
        <td>${pointSelect("management_points", points)}</td>
        <td>${textInput("notes", notes)}</td>
        <td class="editor-actions-cell">
          ${rowKind === "archive" ? `
            <button class="secondary compact" data-editor-action="undo_archive">Undo</button>
          ` : rowKind === "existing" ? `
            <button class="danger compact" data-editor-action="archive_existing">Remove</button>
          ` : `
            <button class="danger compact" data-editor-action="remove_new_row">Remove</button>
          `}
        </td>
      </tr>
    `;
  }

  function makeCostRow(options) {
    const { id, displayId, description, type, owner, status, amount, bureauStatus, notes, rowKind } = options;

    return `
      <tr
        data-admin-row="true"
        data-domain="cost"
        data-row-kind="${escapeHtml(rowKind || "existing")}"
        data-item-id="${escapeHtml(id)}"
        data-display-id="${escapeHtml(displayId)}"
      >
        <td>
          <strong>${escapeHtml(displayId)}</strong>
          ${rowKind === "new" ? `<div class="muted small">New</div>` : ""}
          ${rowKind === "archive" ? `<div class="muted small">Will be removed</div>` : ""}
        </td>
        <td>${textInput("description", description)}</td>
        <td>${selectInput("type", COST_TYPE_OPTIONS, type)}</td>
        <td>${memberSelect("owner", owner)}</td>
        <td>${selectInput("status", COST_STATUS_OPTIONS, status)}</td>
        <td>${textInput("amount", amount)}</td>
        <td>${selectInput("bureau_status", BUREAU_STATUS_OPTIONS, bureauStatus)}</td>
        <td>${textInput("notes", notes)}</td>
        <td class="editor-actions-cell">
          ${rowKind === "archive" ? `
            <button class="secondary compact" data-editor-action="undo_archive">Undo</button>
          ` : rowKind === "existing" ? `
            <button class="danger compact" data-editor-action="archive_existing">Remove</button>
          ` : `
            <button class="danger compact" data-editor-action="remove_new_row">Remove</button>
          `}
        </td>
      </tr>
    `;
  }

  function collectChanges() {
    const rows = Array.from(document.querySelectorAll("[data-admin-row='true']"));
    const changes = [];

    for (const row of rows) {
      const domain = row.getAttribute("data-domain");
      const rowKind = row.getAttribute("data-row-kind") || "existing";
      const itemId = row.getAttribute("data-item-id");
      const displayId = row.getAttribute("data-display-id");
      const parentTaskId = row.getAttribute("data-parent-task-id") || "";
      const sourceItemId = row.getAttribute("data-source-item-id") || "";

      if (rowKind === "archive") {
        changes.push({
          type: domain === "technical" ? "task_archive" : (domain === "management" ? "management_archive" : "cost_archive"),
          id: itemId,
          task_id: itemId,
          item_id: itemId,
          display_id: displayId,
          reason: "Removed from dashboard editor"
        });
        continue;
      }

      if (rowKind !== "existing") {
        const values = rowValues(row);

        if (domain === "technical") {
          changes.push({
            type: rowKind === "new_subtask" ? "subtask_create" : "task_create",
            task_id: itemId,
            display_id: displayId,
            parent_task_id: parentTaskId,
            source_task_id: sourceItemId,
            values
          });
        } else if (domain === "management") {
          changes.push({
            type: "management_create",
            id: itemId,
            display_id: displayId,
            values
          });
        } else if (domain === "cost") {
          changes.push({
            type: "cost_create",
            id: itemId,
            display_id: displayId,
            values
          });
        }

        continue;
      }

      row.querySelectorAll("[data-admin-edit='field']").forEach(input => {
        const original = String(input.getAttribute("data-original") || "");
        const value = String(input.value || "");
        const field = input.getAttribute("data-field");

        if (value === original) return;

        changes.push({
          type: domain === "technical" ? "task_update" : (domain === "management" ? "management_update" : "cost_update"),
          id: itemId,
          task_id: itemId,
          item_id: itemId,
          display_id: displayId,
          field,
          from: original,
          to: value
        });
      });
    }

    currentChanges = changes;
    renderDraftChanges();
  }

  function labelForField(field) {
    const map = {
      title: "title",
      status: "status",
      done_by: "done by",
      owner: "owner",
      area: "area",
      points: "points",
      management_points: "management points",
      description: "description",
      type: "type",
      amount: "amount",
      bureau_status: "bureau/client status",
      notes: "notes"
    };

    return map[field] || field;
  }

  function prettyValue(value, field) {
    if (field === "status" || field === "bureau_status") return titleCaseStatus(value);
    if (field === "area") return formatArea(value);
    return value || "empty";
  }

  function changeSummary(change) {
    if (change.type === "task_create") {
      return `<strong>${escapeHtml(change.display_id)}</strong> new technical task: <strong>${escapeHtml(change.values.title || "Untitled task")}</strong>`;
    }

    if (change.type === "subtask_create") {
      return `<strong>${escapeHtml(change.display_id)}</strong> new subtask under ${escapeHtml(formatId(change.parent_task_id))}: <strong>${escapeHtml(change.values.title || "Untitled subtask")}</strong>`;
    }

    if (change.type === "management_create") {
      return `<strong>${escapeHtml(change.display_id)}</strong> new management task: <strong>${escapeHtml(change.values.title || "Untitled task")}</strong>`;
    }

    if (change.type === "cost_create") {
      return `<strong>${escapeHtml(change.display_id)}</strong> new cost/reimbursement: <strong>${escapeHtml(change.values.description || "Untitled cost")}</strong>`;
    }

    if (change.type.endsWith("_archive")) {
      return `<strong>${escapeHtml(change.display_id || change.id || change.task_id)}</strong> will be removed from active dashboards.`;
    }

    return `
      <strong>${escapeHtml(change.display_id || change.id || change.task_id || change.item_id)}</strong>
      ${escapeHtml(labelForField(change.field))}:
      <span class="muted">${escapeHtml(prettyValue(change.from, change.field))}</span>
      →
      <strong>${escapeHtml(prettyValue(change.to, change.field))}</strong>
    `;
  }

  function renderDraftChanges() {
    const list = document.getElementById("draftChangesList");
    const submitButton = document.getElementById("submitDraftChangesButton");

    if (!list || !submitButton) return;

    submitButton.disabled = currentChanges.length === 0;

    if (!currentChanges.length) {
      list.innerHTML = `<p class="muted small">No draft changes yet. Edit a field, add a task, add a cost, or remove an entry.</p>`;
      return;
    }

    list.innerHTML = `
      <ul class="draft-list">
        ${currentChanges.map(change => `<li>${changeSummary(change)}</li>`).join("")}
      </ul>
    `;
  }

  function disableRow(row, disabled) {
    row.querySelectorAll("[data-admin-edit='field']").forEach(input => {
      input.disabled = disabled;
    });
  }

  function bindEditorInputs() {
    document.querySelectorAll("[data-admin-edit='field']").forEach(input => {
      input.removeEventListener("input", collectChanges);
      input.removeEventListener("change", collectChanges);
      input.addEventListener("input", collectChanges);
      input.addEventListener("change", collectChanges);
    });
  }

  function addTechnicalTask() {
    const tbody = document.getElementById("technicalEditorRows");
    const number = nextTaskNumber++;
    const id = makeInternalTaskId(number);

    tbody.insertAdjacentHTML("beforeend", makeTechnicalRow({
      id,
      displayId: formatId(id),
      title: "New task",
      status: "planned",
      doneBy: "",
      area: "electronic_design_study",
      points: "1",
      rowKind: "new_task"
    }));

    bindEditorInputs();
    collectChanges();
  }

  function duplicateTechnicalTask(sourceId) {
    const sourceRow = document.querySelector(`[data-item-id="${CSS.escape(sourceId)}"]`);
    if (!sourceRow) return;

    const values = rowValues(sourceRow);
    const number = nextTaskNumber++;
    const id = makeInternalTaskId(number);

    sourceRow.insertAdjacentHTML("afterend", makeTechnicalRow({
      id,
      displayId: formatId(id),
      title: (values.title || "Task") + " copy",
      status: values.status || "planned",
      doneBy: values.done_by || "",
      area: values.area || "electronic_design_study",
      points: values.points || "1",
      rowKind: "duplicate_task",
      sourceTaskId: sourceId
    }));

    bindEditorInputs();
    collectChanges();
  }

  function addSubtask(parentId) {
    const parentRow = document.querySelector(`[data-item-id="${CSS.escape(parentId)}"]`);
    if (!parentRow) return;

    const values = rowValues(parentRow);
    const ids = makeSubtaskId(parentId);

    parentRow.insertAdjacentHTML("afterend", makeTechnicalRow({
      id: ids.internal,
      displayId: ids.display,
      title: "New subtask",
      status: "planned",
      doneBy: values.done_by || "",
      area: values.area || "electronic_design_study",
      points: "1",
      rowKind: "new_subtask",
      parentTaskId: parentId,
      isSubtask: true
    }));

    bindEditorInputs();
    collectChanges();
  }

  function addManagementTask() {
    const tbody = document.getElementById("managementEditorRows");
    const id = makeInternalManagementId(nextManagementNumber++);

    tbody.insertAdjacentHTML("beforeend", makeManagementRow({
      id,
      displayId: formatId(id),
      title: "New management task",
      owner: "",
      status: "planned",
      points: "1",
      notes: "Tracked separately; final cut to be decided.",
      rowKind: "new"
    }));

    bindEditorInputs();
    collectChanges();
  }

  function addCost() {
    const tbody = document.getElementById("costEditorRows");
    const id = makeInternalCostId(nextCostNumber++);

    tbody.insertAdjacentHTML("beforeend", makeCostRow({
      id,
      displayId: formatId(id),
      description: "New cost / reimbursement",
      type: "component",
      owner: "",
      status: "pending_review",
      amount: "",
      bureauStatus: "not_shared_yet",
      notes: "",
      rowKind: "new"
    }));

    bindEditorInputs();
    collectChanges();
  }

  function discardChanges() {
    document.querySelectorAll("[data-admin-row='true']").forEach(row => {
      const rowKind = row.getAttribute("data-row-kind") || "existing";

      if (rowKind !== "existing") {
        row.remove();
        return;
      }

      row.classList.remove("archive-preview");
      row.querySelectorAll("[data-admin-edit='field']").forEach(input => {
        input.value = input.getAttribute("data-original") || "";
        input.disabled = false;
      });
    });

    collectChanges();
    showEditorMessage("");
  }

  function showEditorMessage(text, type = "") {
    const el = document.getElementById("adminEditorMessage");
    if (!el) return;

    if (!text) {
      el.innerHTML = "";
      return;
    }

    el.innerHTML = `<div class="${type || "success"}">${escapeHtml(text)}</div>`;
  }

  function readableSummaryForChange(change) {
    if (change.type === "task_create") return `- Create task ${change.display_id}: ${change.values.title}`;
    if (change.type === "subtask_create") return `- Create subtask ${change.display_id} under ${formatId(change.parent_task_id)}: ${change.values.title}`;
    if (change.type === "management_create") return `- Create management task ${change.display_id}: ${change.values.title}`;
    if (change.type === "cost_create") return `- Create cost/reimbursement ${change.display_id}: ${change.values.description}`;
    if (change.type.endsWith("_archive")) return `- Remove/archive ${change.display_id || change.id || change.task_id}`;
    return `- ${change.display_id || change.id || change.task_id}: ${labelForField(change.field)} from "${prettyValue(change.from, change.field)}" to "${prettyValue(change.to, change.field)}"`;
  }

  async function submitDraftChanges() {
    if (!currentChanges.length) return;

    const token = window.AppState.getToken();
    if (!token) {
      showEditorMessage("Session expired. Lock and unlock again.", "error");
      return;
    }

    const submitButton = document.getElementById("submitDraftChangesButton");
    submitButton.disabled = true;

    const commandPayload = {
      request_type: "dashboard_edit_request",
      created_from: "github_admin_dashboard",
      created_at: new Date().toISOString(),
      changes: currentChanges
    };

    const text =
`Dashboard edit request

Please review and apply these dashboard edits if valid.

${currentChanges.map(readableSummaryForChange).join("\n")}

Machine-readable changes:
${JSON.stringify(commandPayload, null, 2)}
`;

    try {
      const result = await window.Api.jsonp({
        action: "command",
        token,
        command_type: "request_changes",
        text
      });

      if (!result || !result.ok) {
        const backendMessage = [
          result && result.error ? result.error : "Could not queue dashboard edit request.",
          result && result.message ? result.message : ""
        ].filter(Boolean).join(": ");

        showEditorMessage(backendMessage, "error");
        submitButton.disabled = false;
        return;
      }

      const commandId = result.command_id;
      showEditorMessage("Draft changes queued: " + commandId + ". Waiting for the local watcher to finish...", "success");
      currentChanges = [];
      renderDraftChanges();

      const finalStatus = await window.Api.pollCommandStatus(commandId, {
        onStatus(status) {
          if (status === "inbox") {
            showEditorMessage("Draft changes queued: " + commandId + ". Waiting for the local watcher...", "success");
          } else if (status === "waiting") {
            showEditorMessage("Checking draft change status: " + commandId + "...", "success");
          }
        }
      });

      if (finalStatus.status === "processed") {
        showEditorMessage("Done. The local watcher processed the draft changes. Click Reload latest snapshot.", "success");
      } else if (finalStatus.status === "failed") {
        showEditorMessage("The draft changes moved to Failed. Check the watcher log or Drive Failed folder: " + commandId, "error");
      } else {
        showEditorMessage("Draft changes are still queued or status is unclear. Check the watcher, then use Reload latest snapshot.", "success");
      }

    } catch (error) {
      showEditorMessage(error.message, "error");
      submitButton.disabled = false;
    }
  }

  function renderTechnicalRows(tasks) {
    if (!tasks.length) return `<tr><td colspan="7" class="muted">No technical tasks available for editing.</td></tr>`;

    const mainTasks = tasks.filter(task => task.type !== "subtask" && !task.parent_task_id);
    const subtasks = tasks.filter(task => task.type === "subtask" || task.parent_task_id);
    const byParent = new Map();

    for (const subtask of subtasks) {
      const parent = subtask.parent_task_id || "";
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(subtask);
    }

    const rows = [];

    for (const task of mainTasks) {
      const id = rawId(task);
      rows.push(makeTechnicalRow({
        id,
        displayId: task.display_id || formatId(id),
        title: taskTitle(task, rows.length),
        status: taskStatus(task),
        doneBy: taskDoneBy(task),
        area: taskAreaRaw(task),
        points: taskPoints(task),
        rowKind: "existing"
      }));

      for (const subtask of byParent.get(id) || []) {
        const subId = rawId(subtask);
        rows.push(makeTechnicalRow({
          id: subId,
          displayId: subtask.display_id || formatId(subId),
          title: taskTitle(subtask, rows.length),
          status: taskStatus(subtask),
          doneBy: taskDoneBy(subtask),
          area: taskAreaRaw(subtask),
          points: taskPoints(subtask),
          rowKind: "existing",
          parentTaskId: id,
          isSubtask: true
        }));
      }
    }

    for (const subtask of subtasks) {
      const parentExists = mainTasks.some(task => rawId(task) === subtask.parent_task_id);
      if (parentExists) continue;

      const subId = rawId(subtask);
      rows.push(makeTechnicalRow({
        id: subId,
        displayId: subtask.display_id || formatId(subId),
        title: taskTitle(subtask, rows.length),
        status: taskStatus(subtask),
        doneBy: taskDoneBy(subtask),
        area: taskAreaRaw(subtask),
        points: taskPoints(subtask),
        rowKind: "existing",
        parentTaskId: subtask.parent_task_id || "",
        isSubtask: true
      }));
    }

    return rows.join("");
  }

  function render(payload) {
    const data = payload && payload.data ? payload.data : {};
    const view = payload && payload.view ? payload.view : "normal";
    const adminPanel = document.getElementById("adminPanel");

    const existing = document.getElementById("adminWorkspace");
    if (existing) existing.remove();

    if (view !== "admin" || !adminPanel) return;

    const technicalTasks = getTechnicalTasks(data);
    const managementTasks = getManagementTasks(data);
    const costs = getCosts(data);

    nextTaskNumber = calculateNextTaskNumber(technicalTasks);
    nextManagementNumber = calculateNextPrefixedNumber(managementTasks, "PM");
    nextCostNumber = calculateNextPrefixedNumber(costs, "C");
    resetSubtaskCounters(technicalTasks);

    const shell = document.createElement("section");
    shell.id = "adminWorkspace";
    shell.className = "admin-workspace";

    shell.innerHTML = `
      <section class="card">
        <div class="admin-workspace-head">
          <div>
            <h2>Admin Workspace</h2>
            <p class="muted small">Review and prepare changes before sending them to the local watcher pipeline.</p>
          </div>
          <span class="pill admin">Draft editing</span>
        </div>

        <div class="admin-overview-grid">
          <div class="mini-card"><div class="label">Proposal status</div><strong>${escapeHtml(data.admin?.proposal_status || "Not available")}</strong></div>
          <div class="mini-card"><div class="label">Proposed tasks</div><strong>${escapeHtml(data.admin?.proposed_tasks_count ?? 0)}</strong></div>
          <div class="mini-card"><div class="label">Proposed components</div><strong>${escapeHtml(data.admin?.proposed_components_count ?? 0)}</strong></div>
        </div>
      </section>

      <section class="card">
        <div class="admin-workspace-head">
          <div>
            <h2>Technical Tasks Editor</h2>
            <p class="muted small">Edit technical tasks and subtasks. Remove means archive, not permanent delete.</p>
          </div>
          <button id="addTechnicalTaskButton" class="secondary">Add technical task</button>
        </div>

        <div class="points-help"><strong>Points scale:</strong> 1 small · 2 standard · 3 important · 4 major · 5 critical/high-effort.</div>

        <div class="table-scroll">
          <table class="admin-editor-table">
            <thead>
              <tr><th>ID</th><th>Task title</th><th>Status</th><th>Done by</th><th>Area</th><th>Points</th><th>Actions</th></tr>
            </thead>
            <tbody id="technicalEditorRows">${renderTechnicalRows(technicalTasks)}</tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="admin-workspace-head">
          <div>
            <h2>Management & Coordination Editor</h2>
            <p class="muted small">Tracked separately because management compensation was not defined in the original agreement.</p>
          </div>
          <button id="addManagementTaskButton" class="secondary">Add management task</button>
        </div>

        <div class="table-scroll">
          <table class="admin-editor-table">
            <thead>
              <tr><th>ID</th><th>Task</th><th>Owner</th><th>Status</th><th>Management points</th><th>Notes</th><th>Actions</th></tr>
            </thead>
            <tbody id="managementEditorRows">
              ${managementTasks.length ? managementTasks.map(task => makeManagementRow({
                id: rawId(task),
                displayId: task.display_id || formatId(rawId(task)),
                title: task.title || "",
                owner: task.owner || task.work_done_by || task.done_by || "",
                status: task.status || "planned",
                points: managementPoints(task),
                notes: task.notes || task.note || "",
                rowKind: "existing"
              })).join("") : `<tr><td colspan="7" class="muted">No management tasks yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="admin-workspace-head">
          <div>
            <h2>Costs & Reimbursements Editor</h2>
            <p class="muted small">Track components, materials, 3D printing, services, and reimbursement status.</p>
          </div>
          <button id="addCostButton" class="secondary">Add cost / reimbursement</button>
        </div>

        <div class="table-scroll">
          <table class="admin-editor-table">
            <thead>
              <tr><th>ID</th><th>Description</th><th>Type</th><th>Owner</th><th>Status</th><th>Amount</th><th>Bureau/client status</th><th>Notes</th><th>Actions</th></tr>
            </thead>
            <tbody id="costEditorRows">
              ${costs.length ? costs.map(cost => makeCostRow({
                id: rawId(cost),
                displayId: cost.display_id || formatId(rawId(cost)),
                description: cost.description || cost.title || cost.name || "",
                type: cost.type || cost.kind || "component",
                owner: cost.owner || cost.member_name || cost.reported_by || "",
                status: cost.status || "pending_review",
                amount: cost.amount || cost.price || "",
                bureauStatus: cost.bureau_status || cost.client_status || "not_shared_yet",
                notes: cost.notes || cost.details || "",
                rowKind: "existing"
              })).join("") : `<tr><td colspan="9" class="muted">No costs or reimbursements yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="draft-panel">
          <h2>Draft Changes</h2>
          <div id="draftChangesList">
            <p class="muted small">No draft changes yet. Edit a field above to create a change request.</p>
          </div>

          <div class="button-row">
            <button id="submitDraftChangesButton" disabled>Queue draft changes</button>
            <button id="discardDraftChangesButton" class="secondary">Discard changes</button>
          </div>

          <div id="adminEditorMessage"></div>
        </div>
      </section>
    `;

    adminPanel.prepend(shell);

    bindEditorInputs();

    shell.addEventListener("click", event => {
      const button = event.target.closest("[data-editor-action]");
      if (!button) return;

      const action = button.getAttribute("data-editor-action");

      if (action === "duplicate") duplicateTechnicalTask(button.getAttribute("data-source-id"));
      if (action === "add_subtask") addSubtask(button.getAttribute("data-parent-id"));

      if (action === "archive_existing") {
        const row = button.closest("[data-admin-row='true']");
        row.setAttribute("data-row-kind", "archive");
        row.classList.add("archive-preview");
        disableRow(row, true);
        collectChanges();
      }

      if (action === "undo_archive") {
        const row = button.closest("[data-admin-row='true']");
        row.setAttribute("data-row-kind", "existing");
        row.classList.remove("archive-preview");
        disableRow(row, false);
        collectChanges();
      }

      if (action === "remove_new_row") {
        button.closest("[data-admin-row='true']").remove();
        collectChanges();
      }
    });

    document.getElementById("addTechnicalTaskButton").addEventListener("click", addTechnicalTask);
    document.getElementById("addManagementTaskButton").addEventListener("click", addManagementTask);
    document.getElementById("addCostButton").addEventListener("click", addCost);
    document.getElementById("submitDraftChangesButton").addEventListener("click", submitDraftChanges);
    document.getElementById("discardDraftChangesButton").addEventListener("click", discardChanges);

    collectChanges();
  }

  return { render };
})();
