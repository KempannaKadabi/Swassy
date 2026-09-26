// Swasya Admin & Analytics Controller
const AdminDesk = {
  init() {
    this.bindEvents();
    this.refresh();
  },

  bindEvents() {
    const resetBtn = document.getElementById("admin-reset-demo-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.handleResetDemo());
    }
  },

  async refresh() {
    try {
      const data = await SwasyaApp.api("/api/analytics/dashboard");
      this.renderSummaryKPIs(data.summary);
      this.renderUrgencyStats(data.urgency_breakdown);
      this.renderDiseaseDistribution(data.disease_distribution);
      this.renderStaffActivity(data.staff_activity);
    } catch (err) {
      console.error("Admin dashboard error:", err);
    }
  },

  renderSummaryKPIs(s) {
    if (!s) return;
    document.getElementById("kpi-total-patients").textContent = s.total_registered_patients;
    document.getElementById("kpi-total-triaged").textContent = s.total_triaged;
    document.getElementById("kpi-total-consults").textContent = s.total_consultations;
    document.getElementById("kpi-active-queue").textContent = s.active_waiting_queue;
    document.getElementById("kpi-avg-wait").textContent = `${s.avg_triage_time_min}m`;
    document.getElementById("kpi-time-saved").textContent = `${s.avg_doctor_prep_saved_pct}%`;
  },

  renderUrgencyStats(u) {
    if (!u) return;
    const total = (u.normal || 0) + (u.urgent || 0) + (u.critical || 0) || 1;
    const normPct = Math.round(((u.normal || 0) / total) * 100);
    const urgPct = Math.round(((u.urgent || 0) / total) * 100);
    const critPct = Math.round(((u.critical || 0) / total) * 100);

    const el = document.getElementById("admin-urgency-bars");
    if (el) {
      el.innerHTML = `
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
            <span>Routine / Normal Priority</span>
            <strong>${u.normal || 0} (${normPct}%)</strong>
          </div>
          <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
            <div style="width: ${normPct}%; background: #16a34a; height: 100%;"></div>
          </div>
        </div>

        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
            <span>Urgent / High Fever / Dehydration</span>
            <strong>${u.urgent || 0} (${urgPct}%)</strong>
          </div>
          <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
            <div style="width: ${urgPct}%; background: #d97706; height: 100%;"></div>
          </div>
        </div>

        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
            <span>Critical / Chest Pain / Hypoxemia</span>
            <strong>${u.critical || 0} (${critPct}%)</strong>
          </div>
          <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
            <div style="width: ${critPct}%; background: #dc2626; height: 100%;"></div>
          </div>
        </div>
      `;
    }
  },

  renderDiseaseDistribution(dist) {
    const el = document.getElementById("admin-disease-chart");
    if (!el || !dist) return;
    el.innerHTML = "";

    const maxCases = Math.max(...Object.values(dist));

    Object.entries(dist).forEach(([category, cases]) => {
      const pct = Math.round((cases / maxCases) * 100);
      const row = document.createElement("div");
      row.style.marginBottom = "0.75rem";
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
          <span>${category}</span>
          <strong style="color: #1b5e20;">${cases} cases</strong>
        </div>
        <div style="height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden;">
          <div style="width: ${pct}%; background: linear-gradient(90deg, #2e7d32, #0f766e); height: 100%; border-radius: 5px;"></div>
        </div>
      `;
      el.appendChild(row);
    });
  },

  renderStaffActivity(staff) {
    const tbody = document.getElementById("admin-staff-tbody");
    if (!tbody || !staff) return;
    tbody.innerHTML = "";

    staff.forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding: 0.65rem; font-weight: 600;">${s.full_name}</td>
        <td style="padding: 0.65rem;"><span class="badge badge-normal">${s.role.toUpperCase()}</span></td>
        <td style="padding: 0.65rem; font-size: 0.85rem; color: #475569;">${s.phc_center}</td>
        <td style="padding: 0.65rem; font-weight: 700; color: #2e7d32;">${s.triages_done} patients</td>
        <td style="padding: 0.65rem; font-weight: 700; color: #059669;">${s.consults_done} patients</td>
      `;
      tbody.appendChild(tr);
    });
  },

  async handleResetDemo() {
    if (!confirm("Are you sure you want to clear all data from the database?")) return;
    try {
      await SwasyaApp.api("/api/analytics/reset-demo", "POST");
      SwasyaApp.showToast("Database successfully cleared!", "success");
      this.refresh();
      if (window.NurseDesk) NurseDesk.refresh();
      if (window.DoctorDesk) DoctorDesk.refresh();
      if (window.OutbreakMap) OutbreakMap.refresh();
    } catch (err) {
      console.error("Reset error:", err);
      SwasyaApp.showToast("Reset failed: " + err.message, "error");
    }
  }
};

window.AdminDesk = AdminDesk;
