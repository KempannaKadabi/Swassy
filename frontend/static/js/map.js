// Swasya Map - Regional Health Outbreak & Epidemic Surveillance
const OutbreakMap = {
  clusters: [],
  selectedCluster: null,
  activeFilterDisease: "All",
  activeFilterSeverity: "All",

  init() {
    this.bindEvents();
    this.refresh();
  },

  bindEvents() {
    const diseaseFilter = document.getElementById("map-filter-disease");
    if (diseaseFilter) {
      diseaseFilter.addEventListener("change", (e) => {
        this.activeFilterDisease = e.target.value;
        this.filterAndRender();
      });
    }

    const severityFilter = document.getElementById("map-filter-severity");
    if (severityFilter) {
      severityFilter.addEventListener("change", (e) => {
        this.activeFilterSeverity = e.target.value;
        this.filterAndRender();
      });
    }
  },

  async refresh() {
    try {
      const data = await SwasyaApp.api("/api/outbreaks/map-data");
      this.clusters = data.clusters || [];
      await this.loadAlerts();
      this.filterAndRender();
    } catch (err) {
      console.error("Failed to load map data:", err);
    }
  },

  async loadAlerts() {
    try {
      const data = await SwasyaApp.api("/api/outbreaks/alerts");
      const listEl = document.getElementById("outbreak-alerts-list");
      const badgeEl = document.getElementById("outbreak-alert-badge");
      if (badgeEl) badgeEl.textContent = data.active_count;

      if (!listEl) return;
      listEl.innerHTML = "";

      if (data.alerts.length === 0) {
        listEl.innerHTML = `<div style="color: #64748b; font-size: 0.85rem; padding: 0.5rem;">No active epidemic alerts. Normal seasonal baseline.</div>`;
        return;
      }

      data.alerts.forEach(alert => {
        const card = document.createElement("div");
        card.className = `alert-card ${alert.severity === 'critical' ? '' : 'warning'}`;
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
            <strong>${alert.disease_name} Outbreak</strong>
            <span class="badge ${alert.severity === 'critical' ? 'badge-critical' : 'badge-urgent'}">${alert.severity.toUpperCase()}</span>
          </div>
          <div style="font-size: 0.8rem; margin-bottom: 0.35rem;">
            <strong>Location:</strong> ${alert.locality}, ${alert.district} (${alert.cases_count} cases)
          </div>
          <div style="font-size: 0.75rem; color: #334155;">
            ${alert.notes}
          </div>
        `;
        card.addEventListener("click", () => {
          this.selectCluster(alert);
        });
        listEl.appendChild(card);
      });
    } catch (err) {
      console.error("Failed to load outbreak alerts:", err);
    }
  },

  filterAndRender() {
    let filtered = [...this.clusters];

    if (this.activeFilterDisease !== "All") {
      filtered = filtered.filter(c => c.disease_name.toLowerCase().includes(this.activeFilterDisease.toLowerCase()));
    }

    if (this.activeFilterSeverity !== "All") {
      filtered = filtered.filter(c => c.severity === this.activeFilterSeverity);
    }

    this.renderCanvasMap(filtered);
    this.renderClusterTable(filtered);
  },

  renderCanvasMap(clusters) {
    const canvas = document.getElementById("outbreak-map-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width = canvas.parentElement.clientWidth || 800;
    const height = canvas.height = 520;

    // Draw map background (Stylized Regional Geospatial Grid of Jalandhar / Punjab)
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Map title overlay
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("DISTRICT HEALTH SURVEILLANCE RADAR: JALANDHAR & DOABA REGION", 20, 30);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.fillText("Real-time Geo-spatial Case Clusters & Spike Detection (PHC Network Sync)", 20, 48);

    // Coordinate mapping bounds centered around Jalandhar (lat ~31.25 to 31.36, lng ~75.52 to 75.64)
    const minLat = 31.240, maxLat = 31.365;
    const minLng = 75.510, maxLng = 75.640;

    const project = (lat, lng) => {
      const x = ((lng - minLng) / (maxLng - minLng)) * (width - 100) + 50;
      // Invert Y because latitude increases upwards
      const y = (1.0 - ((lat - minLat) / (maxLat - minLat))) * (height - 120) + 70;
      return { x, y };
    };

    // Draw river / canal landmark line
    ctx.strokeStyle = "rgba(46, 125, 50, 0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(20, height - 80);
    ctx.bezierCurveTo(width * 0.3, height - 120, width * 0.6, height - 40, width - 20, height - 60);
    ctx.stroke();

    // Draw each outbreak cluster
    clusters.forEach((c) => {
      const pos = project(c.latitude, c.longitude);
      const isSelected = this.selectedCluster && this.selectedCluster.id === c.id;

      // Color by severity
      let color = "#43a047"; // low
      let radius = Math.max(12, Math.min(40, c.cases_count * 1.8));

      if (c.severity === "critical") color = "#ef4444";
      else if (c.severity === "high") color = "#f97316";
      else if (c.severity === "medium") color = "#eab308";

      // Pulsing outer wave for critical clusters
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + (c.severity === 'critical' ? 8 : 4), 0, Math.PI * 2);
      ctx.fillStyle = color.replace(")", ", 0.2)").replace("rgb", "rgba").replace("#ef4444", "rgba(239, 68, 68, 0.25)").replace("#f97316", "rgba(249, 115, 22, 0.25)");
      ctx.fill();

      // Inner solid circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color.replace(")", ", 0.7)").replace("#ef4444", "rgba(239, 68, 68, 0.8)").replace("#f97316", "rgba(249, 115, 22, 0.8)").replace("#eab308", "rgba(234, 179, 8, 0.8)").replace("#43a047", "rgba(59, 130, 246, 0.8)");
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#ffffff" : color;
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.stroke();

      // Case count label inside bubble
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.cases_count, pos.x, pos.y);

      // Locality name label
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(c.locality, pos.x, pos.y + radius + 14);

      // Disease name label
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px sans-serif";
      ctx.fillText(c.disease_name, pos.x, pos.y + radius + 25);
    });

    // Handle canvas click to select clusters
    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      let clicked = null;
      clusters.forEach(c => {
        const pos = project(c.latitude, c.longitude);
        const dist = Math.hypot(pos.x - clickX, pos.y - clickY);
        if (dist <= 30) {
          clicked = c;
        }
      });

      if (clicked) {
        this.selectCluster(clicked);
      }
    };
  },

  selectCluster(cluster) {
    this.selectedCluster = cluster;
    const detailBox = document.getElementById("outbreak-cluster-details");
    if (!detailBox) return;

    detailBox.style.display = "block";
    detailBox.innerHTML = `
      <div class="card" style="border-left: 4px solid ${cluster.severity === 'critical' ? '#dc2626' : '#d97706'};">
        <div class="card-header">
          <div class="card-title">
            <span>📍 ${cluster.locality} Cluster Analysis</span>
          </div>
          <span class="badge ${cluster.severity === 'critical' ? 'badge-critical' : 'badge-urgent'}">
            ${cluster.severity.toUpperCase()}
          </span>
        </div>
        <div class="card-body">
          <div style="font-size: 1.1rem; font-weight: 700; color: #2e7d32; margin-bottom: 0.35rem;">
            ${cluster.disease_name}: ${cluster.cases_count} Active Cases
          </div>
          <div style="font-size: 0.85rem; color: #475569; margin-bottom: 0.75rem;">
            <strong>District:</strong> ${cluster.district}, ${cluster.state} • 
            <strong>Geo Coordinates:</strong> ${cluster.latitude.toFixed(4)}°N, ${cluster.longitude.toFixed(4)}°E
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 0.75rem;">
            <strong>Field Surveillance Notes:</strong><br>
            ${cluster.notes || 'Routine surveillance cluster.'}
          </div>

          <div style="font-size: 0.8rem; color: #0f766e; font-weight: 600;">
            ${cluster.alert_flag ? '⚠️ Automated Notice Dispatched to Municipal Corporation & Vector Control Teams' : '✓ Standard Monitoring Active'}
          </div>
        </div>
      </div>
    `;

    // Re-render canvas to highlight selected cluster
    this.filterAndRender();
  },

  renderClusterTable(clusters) {
    const tbody = document.getElementById("outbreak-clusters-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    clusters.forEach(c => {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.innerHTML = `
        <td style="padding: 0.5rem; font-weight: 600;">${c.locality}</td>
        <td style="padding: 0.5rem;">${c.disease_name}</td>
        <td style="padding: 0.5rem; font-weight: 700; color: #1b5e20;">${c.cases_count}</td>
        <td style="padding: 0.5rem;"><span class="badge ${c.severity === 'critical' ? 'badge-critical' : c.severity === 'high' ? 'badge-urgent' : 'badge-normal'}">${c.severity.toUpperCase()}</span></td>
        <td style="padding: 0.5rem; font-size: 0.75rem; color: #475569;">${c.alert_flag ? '🚨 Alert Active' : 'Normal'}</td>
      `;
      tr.addEventListener("click", () => this.selectCluster(c));
      tbody.appendChild(tr);
    });
  }
};

window.OutbreakMap = OutbreakMap;
