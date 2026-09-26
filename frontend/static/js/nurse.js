// Swasya Nurse Desk - Patient Registration, Vitals Triage & Scribe Interface
const NurseDesk = {
  selectedPatientId: null,
  activeTriageId: null,

  init() {
    VoiceScribe.init();
    this.bindEvents();
    this.refresh();
  },

  bindEvents() {
    // Quick search patient
    const searchInput = document.getElementById("nurse-patient-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchPatients(e.target.value);
      });
    }

    // New Patient Form Submission
    const regForm = document.getElementById("patient-reg-form");
    if (regForm) {
      regForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handlePatientRegistration();
      });
    }

    // Triage Form Submission
    const triageForm = document.getElementById("triage-vitals-form");
    if (triageForm) {
      triageForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleTriageSubmission();
      });
    }

    // Dynamic BMI Calculator
    const weightInput = document.getElementById("vitals-weight");
    const heightInput = document.getElementById("vitals-height");
    if (weightInput && heightInput) {
      const calcBMI = () => {
        const w = parseFloat(weightInput.value);
        const h = parseFloat(heightInput.value);
        const bmiEl = document.getElementById("calculated-bmi-display");
        if (w > 0 && h > 0) {
          const hm = h / 100.0;
          const bmi = (w / (hm * hm)).toFixed(1);
          if (bmiEl) bmiEl.textContent = `BMI: ${bmi} kg/m²`;
        } else if (bmiEl) {
          bmiEl.textContent = "BMI: --";
        }
      };
      weightInput.addEventListener("input", calcBMI);
      heightInput.addEventListener("input", calcBMI);
    }

    // Voice Scribe Mic button
    const micBtn = document.getElementById("nurse-mic-btn");
    if (micBtn) {
      micBtn.addEventListener("click", () => {
        const langSelect = document.getElementById("nurse-voice-lang");
        const lang = langSelect ? langSelect.value : "hi-IN";
        VoiceScribe.toggle("vitals-complaint", lang);
      });
    }

    // OCR Document Upload
    const ocrInput = document.getElementById("nurse-ocr-file-input");
    if (ocrInput) {
      ocrInput.addEventListener("change", (e) => {
        this.handleDocumentOCRUpload(e.target.files[0]);
      });
    }
  },

  async refresh() {
    await this.loadQueue();
    await this.loadRecentPatients();
  },

  async loadQueue() {
    try {
      const data = await SwasyaApp.api("/api/triage/queue");
      const listEl = document.getElementById("nurse-queue-list");
      const badgeEl = document.getElementById("nurse-queue-badge");
      if (badgeEl) badgeEl.textContent = data.waiting_for_doctor.length;

      if (!listEl) return;
      listEl.innerHTML = "";

      if (data.waiting_for_doctor.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; color: #64748b; padding: 2rem;">No patients currently in triage queue.</div>`;
        return;
      }

      data.waiting_for_doctor.forEach(item => {
        const card = document.createElement("div");
        card.className = `queue-item ${item.triage_urgency}`;
        card.innerHTML = `
          <div class="queue-header">
            <div>
              <div class="patient-name">${item.patient_name} (${item.age}y / ${item.gender[0]})</div>
              <div class="uhid-tag">${item.uhid} • ${item.locality}</div>
            </div>
            <span class="badge badge-${item.triage_urgency}">${item.triage_urgency}</span>
          </div>
          <div class="complaint-preview"><strong>Vitals:</strong> BP ${item.bp_systolic || '--'}/${item.bp_diastolic || '--'} | SpO2 ${item.spo2 || '--'}% | Pulse ${item.heart_rate || '--'} | Temp ${item.temperature || '--'}°F</div>
          <div class="complaint-preview"><strong>Chief Complaint:</strong> ${item.chief_complaint}</div>
          <div class="queue-footer">
            <span>Triaged by: ${item.nurse_name || 'Nurse Sunita'}</span>
            <span class="badge badge-normal">Ready for Doctor</span>
          </div>
        `;
        listEl.appendChild(card);
      });
    } catch (err) {
      console.error("Failed to load queue:", err);
    }
  },

  async loadRecentPatients() {
    try {
      const data = await SwasyaApp.api("/api/patients");
      const selectEl = document.getElementById("triage-patient-select");
      if (!selectEl) return;

      selectEl.innerHTML = `<option value="">-- Choose Registered Patient (or Search UHID) --</option>`;
      data.patients.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.uhid} - ${p.name} (${p.age}y, ${p.gender}) [${p.locality}]`;
        selectEl.appendChild(opt);
      });

      selectEl.addEventListener("change", (e) => {
        const pId = parseInt(e.target.value);
        if (pId) {
          const patient = data.patients.find(pt => pt.id === pId);
          this.selectPatientForTriage(patient);
        }
      });
    } catch (err) {
      console.error("Failed to load patients:", err);
    }
  },

  async searchPatients(query) {
    if (!query || query.length < 2) {
      this.loadRecentPatients();
      return;
    }
    try {
      const data = await SwasyaApp.api(`/api/patients?query=${encodeURIComponent(query)}`);
      const selectEl = document.getElementById("triage-patient-select");
      if (!selectEl) return;

      selectEl.innerHTML = `<option value="">-- Search Results (${data.patients.length} found) --</option>`;
      data.patients.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.uhid} - ${p.name} (${p.age}y, ${p.gender}) [${p.locality}]`;
        selectEl.appendChild(opt);
      });
    } catch (err) {
      console.error("Patient search error:", err);
    }
  },

  selectPatientForTriage(patient) {
    this.selectedPatientId = patient.id;
    const infoEl = document.getElementById("selected-patient-meta");
    if (infoEl) {
      infoEl.style.display = "block";
      infoEl.innerHTML = `
        <div style="background: #e8f5e9; padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 1rem;">
          <strong>Selected:</strong> ${patient.name} (${patient.age}y, ${patient.gender}) | <strong>UHID:</strong> <span style="font-family: monospace;">${patient.uhid}</span><br>
          <strong>Locality:</strong> ${patient.locality} | <strong>Phone:</strong> ${patient.phone || 'N/A'}<br>
          <strong>Known Comorbidities:</strong> ${patient.chronic_conditions || 'None'} | <strong>Allergies:</strong> <span style="color: #b91c1c; font-weight: 600;">${patient.allergies || 'None'}</span>
        </div>
      `;
    }
  },

  async handlePatientRegistration() {
    const name = document.getElementById("reg-name").value;
    const age = parseInt(document.getElementById("reg-age").value);
    const gender = document.getElementById("reg-gender").value;
    const phone = document.getElementById("reg-phone").value;
    const locality = document.getElementById("reg-locality").value;
    const bloodGroup = document.getElementById("reg-blood-group").value;
    const chronic = document.getElementById("reg-chronic").value;
    const allergies = document.getElementById("reg-allergies").value;

    if (!name || isNaN(age)) {
      SwasyaApp.showToast("Please enter valid patient name and age", "error");
      return;
    }

    try {
      const res = await SwasyaApp.api("/api/patients", "POST", {
        name, age, gender, phone, locality,
        blood_group: bloodGroup,
        chronic_conditions: chronic,
        allergies: allergies
      });

      SwasyaApp.showToast(`Patient Registered! Assigned UHID: ${res.patient.uhid}`, "success");
      document.getElementById("patient-reg-form").reset();
      this.closeModal("register-patient-modal");
      await this.loadRecentPatients();

      // Auto-select newly registered patient in triage select
      const selectEl = document.getElementById("triage-patient-select");
      if (selectEl) {
        selectEl.value = res.patient.id;
        this.selectPatientForTriage(res.patient);
      }
    } catch (err) {
      console.error("Registration error:", err);
      SwasyaApp.showToast("Registration failed: " + err.message, "error");
    }
  },

  async handleTriageSubmission() {
    if (!this.selectedPatientId) {
      SwasyaApp.showToast("Please select a registered patient first", "warning");
      return;
    }

    const sys = parseInt(document.getElementById("vitals-bp-sys").value) || null;
    const dia = parseInt(document.getElementById("vitals-bp-dia").value) || null;
    const hr = parseInt(document.getElementById("vitals-hr").value) || null;
    const spo2 = parseInt(document.getElementById("vitals-spo2").value) || null;
    const temp = parseFloat(document.getElementById("vitals-temp").value) || null;
    const rbs = parseFloat(document.getElementById("vitals-rbs").value) || null;
    const weight = parseFloat(document.getElementById("vitals-weight").value) || null;
    const height = parseFloat(document.getElementById("vitals-height").value) || null;
    const complaint = document.getElementById("vitals-complaint").value;

    if (!complaint) {
      SwasyaApp.showToast("Please record the patient's chief complaint or voice dictation", "warning");
      return;
    }

    try {
      const res = await SwasyaApp.api("/api/triage", "POST", {
        patient_id: this.selectedPatientId,
        bp_systolic: sys,
        bp_diastolic: dia,
        heart_rate: hr,
        spo2: spo2,
        temperature: temp,
        blood_sugar: rbs,
        weight_kg: weight,
        height_cm: height,
        chief_complaint: complaint
      });

      SwasyaApp.showToast(`Vitals Triaged! Priority: ${res.urgency.toUpperCase()}. Sent to Doctor Queue.`, "success");
      document.getElementById("triage-vitals-form").reset();
      const meta = document.getElementById("selected-patient-meta");
      if (meta) meta.style.display = "none";
      this.selectedPatientId = null;

      await this.loadQueue();
      if (window.DoctorDesk) DoctorDesk.refresh();
    } catch (err) {
      console.error("Triage submission error:", err);
      SwasyaApp.showToast("Triage failed: " + err.message, "error");
    }
  },

  async handleDocumentOCRUpload(file) {
    if (!file) return;
    if (!this.selectedPatientId) {
      SwasyaApp.showToast("Select a patient before scanning prescription/document", "warning");
      return;
    }

    const ocrResultBox = document.getElementById("nurse-ocr-result-box");
    if (ocrResultBox) {
      ocrResultBox.style.display = "block";
      ocrResultBox.innerHTML = `<em>Running OCR extraction and medical entity parsing...</em>`;
    }

    try {
      const formData = new FormData();
      formData.append("patient_id", this.selectedPatientId);
      formData.append("doc_type", "prescription");
      formData.append("file", file);

      const res = await SwasyaApp.api("/api/ocr/upload", "POST", formData, true);
      SwasyaApp.showToast("Document OCR processed and linked to UHID!", "success");

      if (ocrResultBox) {
        const meds = res.extracted_data.medicines || [];
        const tests = res.extracted_data.tests || [];
        const allergies = res.extracted_data.allergies || [];
        ocrResultBox.innerHTML = `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 0.75rem; border-radius: 8px; font-size: 0.85rem;">
            <div style="color: #15803d; font-weight: 700; margin-bottom: 0.35rem;">✓ OCR Extraction Completed</div>
            <div><strong>Summary:</strong> ${res.summary}</div>
            ${meds.length > 0 ? `<div><strong>Detected Meds:</strong> ${meds.join(", ")}</div>` : ''}
            ${tests.length > 0 ? `<div><strong>Detected Lab Values:</strong> ${tests.join(", ")}</div>` : ''}
            ${allergies.length > 0 ? `<div style="color: #b91c1c;"><strong>Allergy Flag:</strong> ${allergies.join(", ")}</div>` : ''}
          </div>
        `;
      }
    } catch (err) {
      console.error("OCR upload error:", err);
      SwasyaApp.showToast("OCR scanning failed: " + err.message, "error");
      if (ocrResultBox) {
        ocrResultBox.innerHTML = `<span style="color: #dc2626;">OCR extraction error. Document logged.</span>`;
      }
    }
  },

  openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.style.display = "flex";
  },

  closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.style.display = "none";
  }
};

window.NurseDesk = NurseDesk;
