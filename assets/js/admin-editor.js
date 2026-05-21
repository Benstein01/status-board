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
    const main = asArray(data.technical_tasks || data.tasks || [], "tasks");
    const extra = asArray(data.extra_technical_tasks || [], "extra_technical_tasks");
    const byId = new Map();

    main.concat(extra).forEach(task => {
      if (!task || task.archived || task.type === "management" || task.kind === "management") return;
      const id = rawId(task) || JSON.stringify(task);
      if (!byId.has(id)) byId.set(id, task);
    });

    return Array.from(byId.values()).sort((a, b) => {
      const ao = Number(a.sort_order ?? 999999);
      const bo = Number(b.sort_order ?? 999999);
      if (ao !== bo) return ao - bo;
      return String(rawId(a)).localeCompare(String(rawId(b)));
    });
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
      id, displayId, title, status, doneBy, area, points, rowKind, sourceTaskId, parentTaskId, isSubtask, sortOrder
    } = options;

    const safeSortOrder = sortOrder === undefined || sortOrder === null ? "" : String(sortOrder);

    return `
      <tr
        data-admin-row="true"
        data-domain="technical"
        data-row-kind="${escapeHtml(rowKind || "existing")}"
        data-item-id="${escapeHtml(id)}"
        data-display-id="${escapeHtml(displayId)}"
        data-source-item-id="${escapeHtml(sourceTaskId || "")}"
        data-parent-task-id="${escapeHtml(parentTaskId || "")}"
        data-original-sort-order="${escapeHtml(safeSortOrder)}"
        data-sort-order="${escapeHtml(safeSortOrder)}"
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
            <button class="secondary compact" data-editor-action="move_up" title="Move up">↑</button>
            <button class="secondary compact" data-editor-action="move_down" title="Move down">↓</button>
            <button class="secondary compact" data-editor-action="duplicate" data-source-id="${escapeHtml(id)}">Duplicate</button>
            ${isSubtask ? `<button class="secondary compact" data-editor-action="promote_subtask">Promote</button>` : `<button class="secondary compact" data-editor-action="add_subtask" data-parent-id="${escapeHtml(id)}">Add subtask</button><button class="secondary compact" data-editor-action="make_subtask">Make subtask</button>`}
            <button class="danger compact" data-editor-action="archive_existing">Remove</button>
          ` : `
            <button class="secondary compact" data-editor-action="move_up" title="Move up">↑</button>
            <button class="secondary compact" data-editor-action="move_down" title="Move down">↓</button>
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

      if (domain === "technical" && rowKind === "existing") {
        const originalSort = String(row.getAttribute("data-original-sort-order") || "");
        const currentSort = String(row.getAttribute("data-sort-order") || "");
        if (currentSort && currentSort !== originalSort) {
          changes.push({
            type: "task_update",
            id: itemId,
            task_id: itemId,
            item_id: itemId,
            display_id: displayId,
            field: "sort_order",
            from: originalSort,
            to: currentSort
          });
        }
      }

      if (domain === "technical" && rowKind === "existing") {
        const convertAction = row.getAttribute("data-convert-action") || "";
        if (convertAction === "task_to_subtask") {
          changes.push({
            type: "task_convert_to_subtask",
            id: itemId,
            task_id: itemId,
            item_id: itemId,
            display_id: displayId,
            parent_task_id: row.getAttribute("data-new-parent-task-id") || ""
          });
        } else if (convertAction === "subtask_to_task") {
          changes.push({
            type: "subtask_promote_to_task",
            id: itemId,
            task_id: itemId,
            item_id: itemId,
            display_id: displayId
          });
        }
      }
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
      notes: "notes",
      sort_order: "order"
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

    if (change.type === "task_convert_to_subtask") {
      return `<strong>${escapeHtml(change.display_id || change.task_id)}</strong> will become a subtask under <strong>${escapeHtml(formatId(change.parent_task_id))}</strong>.`;
    }

    if (change.type === "subtask_promote_to_task") {
      return `<strong>${escapeHtml(change.display_id || change.task_id)}</strong> will be promoted to a main task.`;
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
      list.innerHTML = `<p class="muted small">No dashboard changes yet. Edit a field, add a task, add a cost, or remove an entry.</p>`;
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

  function normalizeTaskInputId(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const rows = Array.from(document.querySelectorAll("[data-domain='technical'][data-admin-row='true']"));
    const found = rows.find(row => {
      const id = row.getAttribute("data-item-id") || "";
      const display = row.getAttribute("data-display-id") || "";
      return raw.toLowerCase() === id.toLowerCase() || raw.toLowerCase() === display.toLowerCase();
    });

    return found ? found.getAttribute("data-item-id") : raw;
  }

  function refreshTechnicalSortOrders() {
    const rows = Array.from(document.querySelectorAll("[data-domain='technical'][data-admin-row='true']"));
    rows.forEach((row, index) => {
      row.setAttribute("data-sort-order", String((index + 1) * 10));
    });
  }

  function moveEditorRow(row, direction) {
    if (!row) return;
    if (direction < 0 && row.previousElementSibling) {
      row.parentNode.insertBefore(row, row.previousElementSibling);
    } else if (direction > 0 && row.nextElementSibling) {
      row.parentNode.insertBefore(row.nextElementSibling, row);
    }
    refreshTechnicalSortOrders();
    collectChanges();
  }

  function markMakeSubtask(row) {
    if (!row) return;
    const currentId = row.getAttribute("data-item-id") || "";
    const parentInput = window.prompt("Make this task a subtask of which task? Type the parent ID, for example T-1 or T-0001.", "");
    if (!parentInput) return;
    const parentId = normalizeTaskInputId(parentInput);

    if (!parentId || parentId === currentId) {
      showEditorMessage("Choose a different parent task.", "error");
      return;
    }

    row.setAttribute("data-convert-action", "task_to_subtask");
    row.setAttribute("data-new-parent-task-id", parentId);
    row.classList.add("convert-preview");
    showEditorMessage("Conversion added to draft changes. Review the draft panel before submitting.", "success");
    collectChanges();
  }

  function markPromoteSubtask(row) {
    if (!row) return;
    row.setAttribute("data-convert-action", "subtask_to_task");
    row.classList.add("convert-preview");
    showEditorMessage("Promotion added to draft changes. Review the draft panel before submitting.", "success");
    collectChanges();
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
    if (change.type === "task_convert_to_subtask") return `- Convert ${change.display_id || change.task_id} to subtask under ${formatId(change.parent_task_id)}`;
    if (change.type === "subtask_promote_to_task") return `- Promote ${change.display_id || change.task_id} to a main task`;
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
      showEditorMessage("Dashboard changes submitted: " + commandId + ". Applying changes...", "success");
      currentChanges = [];
      renderDraftChanges();

      const finalStatus = await window.Api.pollCommandStatus(commandId, {
        onStatus(status) {
          if (status === "inbox") {
            showEditorMessage("Dashboard changes submitted: " + commandId + ". Waiting for processing...", "success");
          } else if (status === "waiting") {
            showEditorMessage("Checking dashboard change status: " + commandId + "...", "success");
          }
        }
      });

      if (finalStatus.status === "processed") {
        showEditorMessage("Done. Dashboard changes were applied. Reloading latest snapshot...", "success");
        if (window.AppActions && window.AppActions.reloadLatestSnapshot) {
          await window.AppActions.reloadLatestSnapshot();
          showEditorMessage("Done. Dashboard changes were applied and the latest snapshot is loaded.", "success");
        }
      } else if (finalStatus.status === "failed") {
        showEditorMessage("The dashboard changes moved to Failed. Check the watcher log or Drive Failed folder: " + commandId, "error");
      } else {
        showEditorMessage("Dashboard changes are still processing. Keep the watcher running; the page will show the latest data after reload.", "success");
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
        sortOrder: task.sort_order || "",
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
          sortOrder: subtask.sort_order || "",
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


  function isProposalActive(data) {
    const proposal = data && data.admin && data.admin.proposal ? data.admin.proposal : null;
    if (!proposal) return false;
    return Boolean(proposal.active);
  }

  function renderProposalTask(task) {
    const status = task.status || "";
    return `
      <article class="proposal-change-card">
        <div class="proposal-change-head">
          <div>
            <strong>${escapeHtml(task.title || "Untitled proposed task")}</strong>
            <div class="muted small">${escapeHtml(task.display_id || task.id || "Proposed task")}</div>
          </div>
          <span class="pill ${status === "done" || status === "completed" ? "done" : ""}">${escapeHtml(titleCaseStatus(status || "planned"))}</span>
        </div>
        <div class="proposal-detail-grid">
          <div><span class="label">Owner</span><strong>${escapeHtml(task.owner || task.work_done_by || "—")}</strong></div>
          <div><span class="label">Area</span><strong>${escapeHtml(task.area_label || formatArea(task.area) || "—")}</strong></div>
          <div><span class="label">Points</span><strong>${escapeHtml(task.points ?? "—")}</strong></div>
          <div><span class="label">Confidence</span><strong>${escapeHtml(task.confidence || "—")}</strong></div>
        </div>
        ${task.details ? `<p class="muted small proposal-details">${escapeHtml(task.details)}</p>` : ""}
        ${asArray(task.source_reports || [], "source_reports").length ? `<p class="muted small">Source report: ${asArray(task.source_reports || [], "source_reports").map(escapeHtml).join(", ")}</p>` : ""}
      </article>
    `;
  }

  function renderProposalComponent(component) {
    return `
      <article class="proposal-change-card">
        <div class="proposal-change-head">
          <div>
            <strong>${escapeHtml(component.title || "Untitled proposed cost")}</strong>
            <div class="muted small">${escapeHtml(component.display_id || component.id || "Proposed cost")}</div>
          </div>
          <span class="pill">${escapeHtml(titleCaseStatus(component.status || "proposed"))}</span>
        </div>
        <div class="proposal-detail-grid">
          <div><span class="label">Type</span><strong>${escapeHtml(titleCaseStatus(component.type || "component"))}</strong></div>
          <div><span class="label">Owner</span><strong>${escapeHtml(component.owner || "—")}</strong></div>
          <div><span class="label">Amount</span><strong>${escapeHtml(component.amount || "—")}</strong></div>
          <div><span class="label">Confidence</span><strong>${escapeHtml(component.confidence || "—")}</strong></div>
        </div>
        ${component.details ? `<p class="muted small proposal-details">${escapeHtml(component.details)}</p>` : ""}
      </article>
    `;
  }

  function renderProposalReview(data) {
    const admin = data.admin || {};
    const proposal = admin.proposal || {};
    const active = Boolean(proposal.active);

    if (!active) {
      return `
        <section class="card proposal-review-card proposal-empty-card">
          <div class="admin-workspace-head">
            <div>
              <h2>Proposal Review</h2>
              <p class="muted small">Review AI/local-agent proposals before they affect the team dashboard.</p>
            </div>
            <span class="pill">No proposal</span>
          </div>
          <div class="empty-state">
            <h3>No proposal waiting for review</h3>
            <p>When the local agent analyzes new reports, proposed dashboard changes will appear here before they are added to the team dashboard.</p>
          </div>
        </section>
      `;
    }

    const tasks = asArray(proposal.proposed_tasks || [], "proposed_tasks");
    const components = asArray(proposal.proposed_components || [], "proposed_components");
    const questions = asArray(proposal.questions || [], "questions");
    const reports = asArray(proposal.source_reports || [], "source_reports");

    return `
      <section class="card proposal-review-card">
        <div class="admin-workspace-head">
          <div>
            <h2>Proposal Review</h2>
            <p class="muted small">Review proposed changes before they are added to the team dashboard.</p>
          </div>
          <span class="pill warning">Proposal waiting</span>
        </div>

        <div class="admin-overview-grid">
          <div class="mini-card"><div class="label">Status</div><strong>${escapeHtml(titleCaseStatus(proposal.status || "proposal_ready"))}</strong></div>
          <div class="mini-card"><div class="label">Generated</div><strong>${escapeHtml(proposal.generated_at || "—")}</strong></div>
          <div class="mini-card"><div class="label">Proposed tasks</div><strong>${escapeHtml(tasks.length)}</strong></div>
          <div class="mini-card"><div class="label">Source reports</div><strong>${escapeHtml(reports.length)}</strong></div>
        </div>

        ${tasks.length ? `
          <div class="proposal-block">
            <h3>Proposed technical tasks</h3>
            <div class="proposal-change-list">${tasks.map(renderProposalTask).join("")}</div>
          </div>
        ` : ""}

        ${components.length ? `
          <div class="proposal-block">
            <h3>Proposed costs / reimbursements</h3>
            <div class="proposal-change-list">${components.map(renderProposalComponent).join("")}</div>
          </div>
        ` : ""}

        ${questions.length ? `
          <div class="proposal-block">
            <h3>Questions / needs clarification</h3>
            <ul class="proposal-question-list">${questions.map(q => `<li>${escapeHtml(typeof q === "string" ? q : (q.question || q.text || JSON.stringify(q)))}</li>`).join("")}</ul>
          </div>
        ` : ""}

        <div class="proposal-actions">
          <p class="muted small">Approve only after checking the proposed changes. Approval is processed by the workspace pipeline, then the latest snapshot can be reloaded.</p>
          <div class="button-row">
            <button class="compact" data-proposal-command="approve_proposal">Approve proposal</button>
            <button class="danger compact" data-proposal-command="reject_proposal">Reject proposal</button>
          </div>
          <div id="proposalReviewMessage" class="small"></div>
        </div>
      </section>
    `;
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
      ${renderProposalReview(data)}

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
          <h2>Dashboard Changes</h2>
          <div id="draftChangesList">
            <p class="muted small">No dashboard changes yet. Edit a field above to create a change request.</p>
          </div>

          <div class="button-row">
            <button id="submitDraftChangesButton" disabled>Apply dashboard changes</button>
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
      if (action === "move_up") moveEditorRow(button.closest("[data-admin-row='true']"), -1);
      if (action === "move_down") moveEditorRow(button.closest("[data-admin-row='true']"), 1);
      if (action === "make_subtask") markMakeSubtask(button.closest("[data-admin-row='true']"));
      if (action === "promote_subtask") markPromoteSubtask(button.closest("[data-admin-row='true']"));

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

    shell.querySelectorAll("[data-proposal-command]").forEach(button => {
      button.addEventListener("click", async () => {
        const type = button.getAttribute("data-proposal-command");
        const active = isProposalActive(data);
        const message = document.getElementById("proposalReviewMessage");

        if (!active) {
          if (message) message.innerHTML = `<div class="error">No active proposal is waiting for review.</div>`;
          return;
        }

        const label = type === "approve_proposal" ? "approve" : "reject";
        const ok = window.confirm(`Are you sure you want to ${label} this proposal?`);
        if (!ok) return;

        if (window.AdminActions && window.AdminActions.sendTextCommand) {
          await window.AdminActions.sendTextCommand(type, `Proposal Review action: ${type}`);
          if (message) message.innerHTML = `<div class="success">${label[0].toUpperCase() + label.slice(1)} proposal command queued. Wait for processing, then reload the latest snapshot.</div>`;
        }
      });
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
