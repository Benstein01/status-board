window.Utils = (function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function asArray(value, key) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value[key])) return value[key];
    return [];
  }

  function showMessage(el, type, text) {
    if (!el) return;
    if (!text) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = `<div class="${type}">${escapeHtml(text)}</div>`;
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  }

  function stateClass(value) {
    const s = normalizeStatus(value);

    if (s === "done" || s === "completed") return "pill done";
    if (s === "blocked") return "pill blocked";
    if (s === "in_progress") return "pill in-progress";
    if (s === "needs_review" || s === "pending_review" || s.includes("pending")) return "pill needs-review";
    if (s === "planned" || s === "todo" || s === "not_started") return "pill planned";
    if (s === "waiting_reimbursement") return "pill needs-review";
    if (s === "reimbursed" || s === "approved" || s === "used_in_prototype") return "pill done";
    if (s === "archived") return "pill archived";

    return "pill";
  }

  function titleCaseStatus(value) {
    const s = String(value || "").trim();

    if (!s) return "";

    const normalized = s
      .replaceAll("_", " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

    const map = {
      "done": "Done",
      "completed": "Done",
      "in progress": "In progress",
      "blocked": "Blocked",
      "needs review": "Needs review",
      "planned": "Planned",
      "todo": "Planned",
      "not started": "Planned",
      "cancelled": "Canceled",
      "canceled": "Canceled",
      "draft": "Draft",
      "pending review": "Pending review",
      "waiting reimbursement": "Waiting reimbursement",
      "reimbursed": "Reimbursed",
      "used in prototype": "Used in prototype",
      "approved": "Approved",
      "not shared yet": "Not shared yet",
      "shared": "Shared",
      "included in agreement": "Included in agreement",
      "needs discussion": "Needs discussion",
      "archived": "Archived"
    };

    return map[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function formatId(value) {
    const s = String(value || "").trim();
    if (!s) return "";

    let m = s.match(/^T-0*(\d+)$/i);
    if (m) return "T-" + Number(m[1]);

    m = s.match(/^T-0*(\d+)\.0*(\d+)$/i);
    if (m) return "T-" + Number(m[1]) + "." + Number(m[2]);

    m = s.match(/^ST-0*(\d+)[-.]0*(\d+)$/i);
    if (m) return "T-" + Number(m[1]) + "." + Number(m[2]);

    m = s.match(/^(R|PM|C|CMP)-0*(\d+)$/i);
    if (m) {
      const prefix = m[1].toUpperCase() === "CMP" ? "C" : m[1].toUpperCase();
      return prefix + "-" + Number(m[2]);
    }

    return s;
  }

  function formatType(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
    const map = {
      "component": "Component",
      "material": "Material",
      "3d_print": "3D Print",
      "3d_printing": "3D Print",
      "fabricated_part": "Fabricated Part",
      "pcb_manufacturing": "PCB Manufacturing",
      "tool_service": "Tool / Service",
      "tool": "Tool / Service",
      "service": "Tool / Service",
      "other": "Other"
    };

    if (map[key]) return map[key];

    return raw
      .replaceAll("_", " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, ch => ch.toUpperCase())
      .replace("3D", "3D");
  }

  function areaKey(value) {
    const s = String(value || "").trim().toLowerCase();
    const map = {
      "electronic_design_study": "electronic_design",
      "electronic_design": "electronic_design",
      "electronic design": "electronic_design",
      "mechanical_design_study": "mechanical_design",
      "mechanical_design": "mechanical_design",
      "mechanical design": "mechanical_design",
      "prototype_wiring_assembly": "prototype_wiring_assembly",
      "prototype wiring & assembly": "prototype_wiring_assembly",
      "prototype assembly": "prototype_wiring_assembly",
      "calibration_testing": "calibration_testing",
      "calibration_and_testing": "calibration_testing",
      "calibration & testing": "calibration_testing",
      "calibration and testing": "calibration_testing",
      "project_management": "project_management",
      "extra_components": "extra_components",
      "extras_work": "extras_work"
    };

    return map[s] || s.replace(/\s+/g, "_");
  }

  function formatArea(value) {
    const key = areaKey(value);

    const map = {
      "electronic_design_study": "Electronic design",
      "electronic_design": "Electronic design",
      "mechanical_design_study": "Mechanical design",
      "mechanical_design": "Mechanical design",
      "prototype_wiring_assembly": "Prototype wiring & assembly",
      "calibration_testing": "Calibration & testing",
      "project_management": "Project management",
      "extra_components": "Extra components",
      "extras_work": "Extra work",
      "costs_reimbursements": "Costs & reimbursements"
    };

    if (map[key]) return map[key];

    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, ch => ch.toUpperCase());
  }

  function formatDateTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return "—";

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDateShort(value) {
    const raw = String(value || "").trim();
    if (!raw) return "—";

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  return {
    escapeHtml,
    asArray,
    showMessage,
    normalizeStatus,
    stateClass,
    titleCaseStatus,
    formatId,
    areaKey,
    formatArea,
    formatType,
    formatDateTime,
    formatDateShort
  };
})();
