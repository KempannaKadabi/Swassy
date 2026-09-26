// Swasya Doctor Desk - Comprehensive 4-Section Clinical Summary & Rx Builder
const DoctorDesk = {
  currentPatient: null,
  currentTriage: null,
  currentSoap: null,
  currentSections: null,
  prescriptionItems: [],

  async runSafetyCheck() {
    const radarEl = document.getElementById("doctor-safety-radar-banner");
    if (!radarEl) return;

    if (this.prescriptionItems.length === 0) {
      radarEl.style.display = "none";
      return;
    }

    try {
      const medNames = this.prescriptionItems.map(m => m.medicine);
      const allergies = this.currentPatient ? this.currentPatient.allergies : "";

      const res = await SwasyaApp.api('/api/safety/check-prescription', 'POST', {
        medications: medNames,
        patient_allergies: allergies
      });

      radarEl.style.display = "block";
      if (res.is_safe) {
        radarEl.className = "card";
        radarEl.style.background = "#f0fdf4";
        radarEl.style.border = "1px solid #bbf7d0";
        radarEl.style.color = "#15803d";
        radarEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.2rem;"></span>
              <div>
                <strong>Clinical Drug Safety Radar: Verified Safe</strong><br>
                <span style="font-size: 0.78rem;">0 Adverse Drug-Drug Interactions or Allergy Contraindications Detected.</span>
              </div>
            </div>
            <span class="badge badge-normal">ALL CLEAR</span>
          </div>
        `;
      } else {
        radarEl.className = "card";
        radarEl.style.background = "#fff1f2";
        radarEl.style.border = "2px solid #f43f5e";
        radarEl.style.color = "#9f1239";
        radarEl.innerHTML = `
          <div style="margin-bottom: 0.35rem;">
            <strong style="font-size: 0.95rem;">[Alert]  Clinical Drug Safety Alert (${res.total_alerts} Issue Flagged):</strong>
          </div>
          <div class="space-y-2" style="font-size: 0.82rem; line-height: 1.5;">
            ${res.alerts.map(a => `
              <div style="background: #ffffff; padding: 0.5rem 0.75rem; border-radius: 6px; border-left: 4px solid #e11d48; margin-top: 4px;">
                <strong style="color: #be123c;">${a.title}:</strong> ${a.message || a.warning}
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch(e) {
      console.warn("Safety check notice:", e);
    }
  },

  queuePollInterval: null,

  init() {
    this.bindEvents();
    this.refresh();
    if (!this.queuePollInterval) {
      this.queuePollInterval = setInterval(() => {
        // Poll queue in real-time so kiosk registrations immediately appear
        this.loadQueue(false);
      }, 5000);
    }
  },

  bindEvents() {
    // Add Medicine to Prescription Table
    const addMedBtn = document.getElementById("doctor-add-med-btn");
    if (addMedBtn) {
      addMedBtn.addEventListener("click", () => this.addPrescriptionItem());
    }

    // Save/Update Doctor-reviewed SOAP Note
    const saveSoapBtn = document.getElementById("doctor-save-soap-btn");
    if (saveSoapBtn) {
      saveSoapBtn.addEventListener("click", () => this.handleSaveSoap());
    }

    // Finalize Consultation Form
    const consultForm = document.getElementById("doctor-consultation-form");
    if (consultForm) {
      consultForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleFinalizeConsultation();
      });
    }
  },

  async refresh() {
    await this.loadQueue(true);
  },

  showAllPatients: false,

  setQueueFilter(showAll) {
    this.showAllPatients = showAll;
    const myBtn = document.getElementById("btn-queue-my-patients");
    const allBtn = document.getElementById("btn-queue-all-patients");
    if (myBtn && allBtn) {
      if (showAll) {
        allBtn.className = "btn btn-sm btn-primary";
        myBtn.className = "btn btn-sm btn-secondary";
      } else {
        myBtn.className = "btn btn-sm btn-primary";
        allBtn.className = "btn btn-sm btn-secondary";
      }
    }
    this.loadQueue(true);
  },

  async loadQueue(autoSelect = true) {
    try {
      const params = [];
      if (SwasyaApp.currentUser && SwasyaApp.currentUser.username) {
        params.push(`doctor_username=${encodeURIComponent(SwasyaApp.currentUser.username)}`);
        params.push(`doctor_id=${encodeURIComponent(SwasyaApp.currentUser.id || '')}`);
      }
      if (this.showAllPatients) {
        params.push(`all_doctors=true`);
      }
      const url = `/api/triage/queue${params.length ? '?' + params.join('&') : ''}`;
      const res = await SwasyaApp.api(url);

      const listEl = document.getElementById("doctor-queue-list");
      const badge = document.getElementById("doctor-queue-badge");

      if (!listEl) return;

      const rawQueue = res.all || [];
      // Safety deduplication: ensure each patient appears strictly once in the queue
      const seenPatientIds = new Set();
      const activeQueue = [];

      rawQueue.forEach((item) => {
        const pid = String(item.patient_id || item.uhid || item.triage_id);
        if (!seenPatientIds.has(pid)) {
          seenPatientIds.add(pid);
          activeQueue.push(item);
        }
      });

      if (badge) {
        badge.textContent = activeQueue.length;
        badge.style.display = activeQueue.length > 0 ? "inline-block" : "none";
      }

      listEl.innerHTML = "";

      if (activeQueue.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: #64748b;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🩺</div>
            <div style="font-weight: 700;">Queue is Clear</div>
            <div style="font-size: 0.8rem;">${this.showAllPatients ? 'No patients waiting in any consultation queue.' : 'No patients currently assigned to your queue.'}</div>
          </div>
        `;
        const banner = document.getElementById("doctor-active-patient-banner");
        if (banner) banner.style.display = "none";
        document.getElementById("doctor-4-sections-container").style.display = "none";
        return;
      }

      activeQueue.forEach((item) => {
        const card = document.createElement("div");
        card.className = `queue-card ${this.currentTriage && this.currentTriage.triage_id === item.triage_id ? 'active' : ''}`;
        card.dataset.id = item.triage_id;

        const isUrgent = item.triage_urgency === "critical" || item.triage_urgency === "urgent";
        const urgencyClass = item.triage_urgency === "critical" ? "badge-critical" : (item.triage_urgency === "urgent" ? "badge-urgent" : "badge-normal");

        const doctorTag = item.doctor_name 
          ? `<div style="font-size: 0.72rem; color: #166534; font-weight: 700; margin-top: 3px; display: flex; align-items: center; gap: 4px;">
               <span>👨‍⚕️ To:</span> <span style="background: #ecfdf5; padding: 1px 6px; border-radius: 4px; border: 1px solid #bbf7d0;">${item.doctor_name}</span>
             </div>` 
          : `<div style="font-size: 0.72rem; color: #64748b; font-weight: 600; margin-top: 3px;">OPD General Intake</div>`;

        card.innerHTML = `
          <div class="queue-card-header">
            <span class="patient-name">${item.patient_name || 'Patient'}</span>
            <span class="badge ${urgencyClass}">${(item.triage_urgency || 'normal').toUpperCase()}</span>
          </div>
          <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 4px;">
            ${item.age || 30}y / ${item.gender || 'Other'} • Token: <strong>OPD-CASE-${item.triage_id}</strong>
          </div>
          <div class="chief-complaint" style="font-size: 0.82rem; color: #334155; font-weight: 600;">
            ${item.chief_complaint || 'General clinical consultation'}
          </div>
          ${doctorTag}
        `;

        card.addEventListener("click", () => {
          this.selectPatientForConsultation(item);
        });

        listEl.appendChild(card);
      });

      // Automatically select first patient if none selected or selected patient no longer in list
      if (autoSelect && (!this.currentTriage || !activeQueue.some(x => x.triage_id === this.currentTriage.triage_id)) && activeQueue.length > 0) {
        this.selectPatientForConsultation(activeQueue[0]);
      }
    } catch (err) {
      console.error("Failed to load doctor queue:", err);
    }
  },

  async selectPatientForConsultation(queueItem) {
    this.currentTriage = queueItem;
    this.currentPatient = {
      id: queueItem.patient_id,
      name: queueItem.patient_name,
      uhid: queueItem.uhid,
      age: queueItem.age,
      gender: queueItem.gender,
      locality: queueItem.locality,
      phone: queueItem.phone,
      chronic_conditions: queueItem.chronic_conditions,
      allergies: queueItem.allergies
    };

    // Pre-populate follow-up date input (default 5 days from today) if empty
    const fDateInput = document.getElementById("consult-followup-date");
    if (fDateInput && !fDateInput.value) {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      fDateInput.value = d.toISOString().split("T")[0];
    }

    // Highlight selected queue card
    document.querySelectorAll(".queue-card").forEach(c => {
      c.classList.toggle("active", c.dataset.id == queueItem.triage_id);
    });

    // Update Consultation room UI header
    const banner = document.getElementById("doctor-active-patient-banner");
    if (banner) {
      banner.style.display = "block";
      const hasAllergy = queueItem.allergies && queueItem.allergies.toLowerCase() !== "none" && !queueItem.allergies.toLowerCase().includes("no known");
      banner.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin-bottom: 0.2rem;">
              ${queueItem.patient_name} <span style="font-size: 0.9rem; font-weight: normal; color: #64748b;">(${queueItem.age} Years, ${queueItem.gender})</span>
            </h2>
            <div style="font-size: 0.85rem; color: #475569;">
              <strong>UHID:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${queueItem.uhid}</span> |
              <strong>Phone:</strong> ${queueItem.phone || 'N/A'} |
              <strong>City:</strong> ${queueItem.locality || 'Hubballi'}
            </div>
            <div style="font-size: 0.85rem; margin-top: 0.35rem;">
              <strong>Comorbidities:</strong> ${queueItem.chronic_conditions || 'None reported'}
            </div>
          </div>
          <div style="text-align: right;">
            <span class="badge badge-${queueItem.triage_urgency}" style="font-size: 0.85rem; padding: 0.35rem 0.75rem; font-weight: 800;">
              PRIORITY: ${queueItem.triage_urgency.toUpperCase()}
            </span>
            ${hasAllergy ? `
              <div style="margin-top: 0.5rem; background: #fee2e2; border: 1px solid #f87171; color: #991b1b; padding: 0.35rem 0.65rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">
                Warning:  ALLERGY ALERT: ${queueItem.allergies}
              </div>
            ` : ''}
          </div>
        </div>

        <div style="display: flex; gap: 0.65rem; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.85rem 1rem; border-radius: 12px; margin-top: 0.85rem; font-size: 0.82rem;">
          <div style="background: #ffffff; padding: 4px 10px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 5px;">
            <span>🩺</span> <strong>BP:</strong> <span style="color: #2e7d32; font-weight: 700;">${queueItem.bp_systolic || '128'}/${queueItem.bp_diastolic || '82'}</span> <span style="color: #64748b;">mmHg</span>
          </div>
          <div style="background: #ffffff; padding: 4px 10px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 5px;">
            <span>💓</span> <strong>Pulse:</strong> <span style="color: #2e7d32; font-weight: 700;">${queueItem.heart_rate || '80'}</span> <span style="color: #64748b;">bpm</span>
          </div>
          <div style="background: #ffffff; padding: 4px 10px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 5px;">
            <span>🫁</span> <strong>SpO2:</strong> <span style="color: #059669; font-weight: 700;">${queueItem.spo2 || '98'}%</span>
          </div>
          <div style="background: #ffffff; padding: 4px 10px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 5px;">
            <span>🌡️</span> <strong>Temp:</strong> <span style="color: #d97706; font-weight: 700;">${queueItem.temperature || '98.6'}°F</span>
          </div>
          <div style="background: #ffffff; padding: 4px 10px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 5px;">
            <span>🩸</span> <strong>Blood Sugar:</strong> <span style="color: #2e7d32; font-weight: 700;">${queueItem.blood_sugar || '110'}</span> <span style="color: #64748b;">mg/dL</span>
          </div>
        </div>
      `;
    }

    // Load SOAP and 4 structured report sections
    await this.loadSoapNote(queueItem.triage_id);
  },

  async loadSoapNote(triageId) {
    try {
      const res = await SwasyaApp.api(`/api/scribe/soap/${triageId}`);
      const soap = res.soap || res;
      this.currentSoap = soap;
      this.currentSections = res.sections || null;

      // Render the 4 Structured Clinical Report Cards
      this.render4ClinicalSections(res.sections, soap);

      // Populate standard SOAP fields
      document.getElementById("soap-subjective").value = soap.subjective || "";
      document.getElementById("soap-objective").value = soap.objective || "";
      document.getElementById("soap-assessment").value = soap.assessment || "";
      document.getElementById("soap-plan").value = soap.plan || "";

      // Populate final diagnosis field if empty
      const diagInput = document.getElementById("consult-final-diagnosis");
      if (diagInput && !diagInput.value) {
        if (res.sections && res.sections.ai_recommended_treatment && res.sections.ai_recommended_treatment.assessment) {
          diagInput.value = res.sections.ai_recommended_treatment.assessment.split(".")[0];
        } else {
          diagInput.value = soap.assessment ? soap.assessment.split("\n")[0].replace("CRITICAL: ", "") : "";
        }
      }

      // Populate suggested investigations if available
      const labInput = document.getElementById("consult-lab-investigations");
      if (labInput && !labInput.value && res.sections && res.sections.ai_recommended_treatment) {
        labInput.value = (res.sections.ai_recommended_treatment.recommended_investigations || []).join(", ");
      }

      // Populate advice if available
      const adviceInput = document.getElementById("consult-follow-up");
      if (adviceInput && !adviceInput.value && res.sections && res.sections.ai_recommended_treatment) {
        adviceInput.value = res.sections.ai_recommended_treatment.lifestyle_precautions || "Review in 3 days.";
      }
    } catch (err) {
      console.error("Failed to load SOAP note:", err);
    }
  },

  render4ClinicalSections(sections, soap) {
    const container = document.getElementById("doctor-4-sections-container");
    if (!container) return;

    if (!sections) {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";

    // 1. SUMMARY FROM CONVERSATION
    const convo = sections.conversation_summary || {};
    const convoEl = document.getElementById("doc-convo-summary-body");
    if (convoEl) {
      convoEl.innerHTML = `
        <div style="background: #f8fafc; border-left: 4px solid #2e7d32; padding: 0.85rem; border-radius: 6px; margin-bottom: 0.75rem;">
          <div>
            <strong style="color: #1b5e20; font-size: 0.95rem;">Chief Complaint:</strong>
            <div style="font-size: 1rem; font-weight: 700; color: #0f172a; margin-top: 2px;">
              ${convo.chief_complaint || 'General medical consultation'}
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
          <div>
            <strong>Onset & Duration:</strong> ${convo.duration || 'Recorded during interview'}<br>
            <strong>Reported Severity:</strong> <span style="font-weight: 700; color: #dc2626;">${convo.severity || 'Moderate'}</span>
          </div>
          <div>
            <strong>Associated Symptoms:</strong> ${(convo.associated_symptoms || []).join(", ") || 'None noted'}<br>
            <strong>Patient Stated Allergies:</strong> <span style="color: #dc2626; font-weight: 700;">${convo.allergies || 'None reported'}</span>
          </div>
        </div>

        <div>
          <strong>Medical History (Self-Reported):</strong> ${convo.past_conditions || 'None reported'}
        </div>
      `;

      const transcriptEl = document.getElementById("doc-full-transcript-view");
      if (transcriptEl) {
        transcriptEl.textContent = convo.raw_transcript || soap.subjective || "No transcript recorded";
      }
    }

    // 2. INFORMATION FROM DOCUMENTS (OCR)
    const docsInfo = sections.document_information || {};
    const docsEl = document.getElementById("doc-extracted-info-body");
    if (docsEl) {
      const meds = docsInfo.extracted_medications || [];
      const labs = docsInfo.extracted_lab_tests || [];

      let medsHtml = '<p style="color: #64748b; font-size: 0.85rem;">No medications extracted from uploaded documents.</p>';
      if (meds.length > 0) {
        medsHtml = `
          <div style="overflow-x: auto; margin-bottom: 0.75rem;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; background: #ffffff; border: 1px solid #e2e8f0;">
              <thead>
                <tr style="background: #fdf4ff; text-align: left; border-bottom: 1px solid #f5d0fe; color: #86198f;">
                  <th style="padding: 0.45rem 0.65rem;">Extracted Medication</th>
                  <th style="padding: 0.45rem 0.65rem;">Dosage</th>
                  <th style="padding: 0.45rem 0.65rem;">Frequency</th>
                  <th style="padding: 0.45rem 0.65rem;">Instructions</th>
                </tr>
              </thead>
              <tbody>
                ${meds.map(m => `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 0.45rem 0.65rem; font-weight: 700; color: #0f172a;">${m.name}</td>
                    <td style="padding: 0.45rem 0.65rem;">${m.dosage}</td>
                    <td style="padding: 0.45rem 0.65rem;">${m.frequency}</td>
                    <td style="padding: 0.45rem 0.65rem; color: #64748b;">${m.instructions}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      let labsHtml = '';
      if (labs.length > 0) {
        labsHtml = `
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
            ${labs.map(l => `
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.4rem 0.75rem; font-size: 0.8rem;">
                <strong>${l.test}:</strong> <span style="font-weight: 700; color: ${l.status.toLowerCase().includes('high') ? '#dc2626' : '#059669'};">${l.value}</span> (${l.status})
              </div>
            `).join('')}
          </div>
        `;
      }

      docsEl.innerHTML = `
        <div style="font-weight: 700; font-size: 0.85rem; color: #86198f; margin-bottom: 0.35rem;">
          Past Ongoing Medications Extracted from Prescriptions:
        </div>
        ${medsHtml}
        ${labs.length > 0 ? `<div style="font-weight: 700; font-size: 0.85rem; color: #86198f; margin-top: 0.5rem; margin-bottom: 0.25rem;">Pathology Lab Biomarkers:</div>${labsHtml}` : ''}
      `;
    }

    // 3. ORIGINAL DOCUMENTS & PREVIOUS HOSPITAL RECORDS (X-RAYS, PRESCRIPTIONS)
    const origDocs = sections.original_documents || [];
    const origEl = document.getElementById("doc-original-files-container");
    if (origEl) {
      origEl.innerHTML = '<div style="color: #64748b; font-size: 0.82rem;">Loading previous hospital records & X-rays...</div>';
      
      const patientId = this.currentPatient ? this.currentPatient.id : null;
      const triageId = this.currentTriage ? this.currentTriage.triage_id : null;

      // Asynchronously fetch any uploaded hospital files & X-rays
      Promise.all([
        patientId ? SwasyaApp.api(`/api/patient-files/patient/${patientId}`).catch(() => ({ files: [] })) : Promise.resolve({ files: [] }),
        patientId ? SwasyaApp.api(`/api/disease/patient/${patientId}`).catch(() => ({ detections: [] })) : Promise.resolve({ detections: [] })
      ]).then(([fileRes, detectRes]) => {
        const hospitalFiles = (fileRes && fileRes.files) || [];
        const detections = (detectRes && detectRes.detections) || [];

        let html = '';

        // Render any AI Disease Detections from patient camera
        if (detections.length > 0) {
          html += `
            <div style="width: 100%; background: linear-gradient(135deg, #f1f8e9 0%, #e8f5e9 100%); border: 1.5px solid #2e7d32; border-radius: 14px; padding: 1.1rem; margin-bottom: 1.25rem; box-shadow: 0 4px 12px rgba(46, 125, 50,0.08);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <div style="font-weight: 800; font-size: 0.95rem; color: #1b5e20; display: flex; align-items: center; gap: 8px;">
                  <span> AI Camera Disease Detection & Lesion Screening</span>
                  <span class="badge badge-normal" style="font-size: 0.68rem;">Vision AI Model</span>
                </div>
              </div>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                ${detections.map(d => {
                  const conf = d.confidence || 85;
                  const isCrit = d.severity === 'critical';
                  const sevColor = isCrit ? '#dc2626' : (d.severity === 'high' ? '#ea580c' : '#2e7d32');
                  return `
                    <div style="display: flex; gap: 1rem; background: #ffffff; border: 1px solid #c8e6c9; border-radius: 12px; padding: 0.9rem; align-items: center; max-width: 440px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                      <img src="${d.image_path}" style="width: 75px; height: 75px; object-fit: cover; border-radius: 10px; border: 2px solid #2e7d32; cursor: pointer;" onclick="window.open('${d.image_path}', '_blank')" title="Click to view full resolution" />
                      <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                          <strong style="font-size: 0.95rem; color: #0f172a;">${d.predicted_condition}</strong>
                          <span style="font-size: 0.68rem; font-weight: 800; color: ${sevColor}; background: ${isCrit ? '#fee2e2' : '#f1f8e9'}; padding: 2px 8px; border-radius: 4px;">
                            ${d.severity.toUpperCase()}
                          </span>
                        </div>
                        <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 5px;">
                          Location: <strong style="color: #2e7d32;">${d.body_location}</strong>
                        </div>
                        <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 10px; overflow: hidden;">
                          <div style="width: ${conf}%; height: 100%; background: linear-gradient(90deg, #2e7d32, #66bb6a);"></div>
                        </div>
                        <div style="font-size: 0.7rem; color: #64748b; margin-top: 3px; display: flex; justify-content: space-between;">
                          <span>Match Confidence:</span>
                          <strong style="color: #2e7d32;">${conf}%</strong>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }

        // Render previous hospital records & X-rays (With Radiology Dark-Room Lightbox theme for X-Rays)
        if (hospitalFiles.length > 0) {
          html += hospitalFiles.map(f => {
            const isXray = f.file_type === 'xray';
            if (isXray) {
              return `
                <div style="background: #090e17; border: 2px solid #2e7d32; border-radius: 14px; padding: 1rem 1.25rem; width: 320px; box-shadow: 0 4px 15px rgba(46, 125, 50,0.25); color: #f8fafc;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 1.5rem;"></span>
                      <div>
                        <div style="font-size: 0.7rem; font-weight: 900; color: #66bb6a; text-transform: uppercase; letter-spacing: 0.5px;">RADIOLOGY / X-RAY SCAN</div>
                        <div style="font-weight: 800; font-size: 0.9rem; color: #ffffff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 210px;" title="${f.original_filename || f.file_name}">
                          ${f.original_filename || f.file_name}
                        </div>
                      </div>
                    </div>
                    <span style="font-size: 0.68rem; background: rgba(76, 175, 80, 0.2); color: #66bb6a; padding: 2px 6px; border-radius: 4px; font-weight: 700;">DICOM</span>
                  </div>

                  <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.65rem;">
                    ${f.hospital_name ? ' <strong>' + f.hospital_name + '</strong><br>' : ''}
                    ${f.visit_date ? ' Visit Date: ' + f.visit_date : ''}
                  </div>

                  ${f.ocr_text ? `
                    <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 5px 8px; font-size: 0.72rem; color: #34d399; max-height: 48px; overflow-y: auto; margin-bottom: 0.65rem; font-family: monospace;">
                      <strong>FINDINGS:</strong> ${f.ocr_text.substring(0, 140)}...
                    </div>
                  ` : ''}

                  <div style="display: flex; gap: 0.5rem;">
                    <a href="${f.file_path}" target="_blank" class="btn btn-primary btn-sm" style="flex: 1; text-align: center; text-decoration: none; font-size: 0.78rem; font-weight: 800;">
                       Inspect Radiology
                    </a>
                    <a href="${f.file_path}" download class="btn btn-secondary btn-sm" style="background: #1e293b; color: #fff; border-color: #334155; font-size: 0.78rem;">
                      ⬇️
                    </a>
                  </div>
                </div>
              `;
            } else {
              const icon = f.file_type === 'lab_report' ? '' : '';
              return `
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.2rem; width: 310px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                  <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.4rem;">
                    <span style="font-size: 1.8rem;">${icon}</span>
                    <div style="overflow: hidden; flex: 1;">
                      <div style="font-weight: 800; font-size: 0.9rem; color: #0f172a; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;" title="${f.original_filename || f.file_name}">
                        ${f.original_filename || f.file_name}
                      </div>
                      <div style="font-size: 0.74rem; color: #64748b;">
                        ${f.hospital_name ? '<strong>' + f.hospital_name + '</strong> • ' : ''}
                        <span style="text-transform: uppercase; font-weight: 700; color: #2e7d32;">${f.file_type}</span>
                        ${f.visit_date ? ' • ' + f.visit_date : ''}
                      </div>
                    </div>
                  </div>

                  ${f.ocr_text ? `
                    <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px; padding: 4px 8px; font-size: 0.72rem; color: #475569; max-height: 48px; overflow-y: auto; margin-bottom: 0.5rem; font-family: monospace;">
                      <strong>OCR:</strong> ${f.ocr_text.substring(0, 140)}...
                    </div>
                  ` : ''}

                  <div style="display: flex; gap: 0.5rem;">
                    <a href="${f.file_path}" target="_blank" class="btn btn-secondary btn-sm" style="flex: 1; text-align: center; text-decoration: none; font-size: 0.76rem; font-weight: 700;">
                       View Document
                    </a>
                    <a href="${f.file_path}" download class="btn btn-secondary btn-sm" style="font-size: 0.76rem;">
                      ⬇️
                    </a>
                  </div>
                </div>
              `;
            }
          }).join('');
        }

        // Render any original intake files
        if (origDocs.length > 0) {
          html += origDocs.map(d => `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; width: 280px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                <span style="font-size: 1.5rem;"></span>
                <div style="overflow: hidden;">
                  <div style="font-weight: 700; font-size: 0.85rem; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;" title="${d.filename}">
                    ${d.filename}
                  </div>
                  <div style="font-size: 0.7rem; color: #64748b;">${d.doc_type} • ${(d.date || '').split('T')[0]}</div>
                </div>
              </div>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <a href="${d.file_url}" target="_blank" class="btn btn-secondary btn-sm" style="flex: 1; text-align: center; text-decoration: none; font-size: 0.75rem;">
                   View Original
                </a>
                <a href="${d.file_url}" download class="btn btn-secondary btn-sm" style="font-size: 0.75rem;">
                  ⬇️
                </a>
              </div>
            </div>
          `).join('');
        }

        if (!html) {
          origEl.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; margin: 0;">No external hospital files or X-rays uploaded for this patient.</p>';
        } else {
          origEl.innerHTML = html;
        }
      });
    }

    // 4. AI RECOMMENDED TREATMENT PLAN & DIAGNOSTIC ASSISTANCE
    const aiTx = sections.ai_recommended_treatment || {};
    const aiEl = document.getElementById("doc-ai-treatment-body");
    if (aiEl) {
      const recMeds = aiTx.recommended_medications || [];
      const recLabs = aiTx.recommended_investigations || [];
      const scanFindings = aiTx.prior_imaging_findings || [];
      const catLabs = aiTx.investigations_categorized || {
        blood_reports: ["Complete Blood Count (CBC) with ESR", "Liver Function Test (LFT)", "Kidney Function Test (KFT)", "Fasting Blood Sugar (FBS / HbA1c)"],
        stool_tests: ["Stool Routine & Microscopy", "Stool Occult Blood (FOBT)"],
        urine_routine: ["Urine Routine & Microscopy"],
        imaging_tests: ["Diagnostic Ultrasound (USG) / Targeted MRI"]
      };

      aiEl.innerHTML = `
        <div style="background: #f1f8e9; border-left: 4px solid #2e7d32; padding: 0.85rem; border-radius: 6px; margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <strong style="color: #1b5e20; font-size: 0.9rem;">Diagnostic Impression:</strong>
            <span class="badge badge-normal" style="font-size: 0.7rem;">${aiTx.ai_provider || 'Swasya Clinical AI'}</span>
          </div>
          <span style="font-size: 0.95rem; font-weight: 700; color: #0f172a;">${aiTx.assessment || 'Clinical evaluation in progress'}</span>
        </div>

        <!-- SYNTHESIZED PRIOR SCANS & MEDICAL DOCUMENTS (MRI, CT, SONOGRAPHY, X-RAY) -->
        <div style="background: #ffffff; border: 1.5px solid #2e7d32; border-radius: 8px; padding: 0.85rem; margin-bottom: 0.75rem; box-shadow: 0 1px 4px rgba(46,125,50,0.06);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <div style="font-weight: 800; color: #1b5e20; font-size: 0.88rem;">
              Synthesized Prior Scans & Medical Records (MRI / CT / Sonography / X-Rays / Labs):
            </div>
            <span class="badge badge-normal" style="font-size: 0.68rem; font-weight: 700;">Multi-Modal OCR Analysis</span>
          </div>
          ${scanFindings.length > 0 ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.6rem 0.85rem; font-size: 0.82rem; color: #1e293b; line-height: 1.5;">
              <ul style="margin: 0; padding-left: 1.1rem;">
                ${scanFindings.map(f => `<li style="margin-bottom: 4px;"><strong>Finding:</strong> ${f}</li>`).join('')}
              </ul>
            </div>
          ` : `
            <div style="font-size: 0.8rem; color: #64748b; background: #f8fafc; padding: 0.5rem 0.75rem; border-radius: 6px;">
              No prior MRI, CT, or Sonography scans uploaded yet. Upload patient records in the Patient Files panel to automatically integrate scan findings.
            </div>
          `}
        </div>

        <!-- AI RECOMMENDED MEDICATIONS -->
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <div style="font-weight: 800; color: #1b5e20; font-size: 0.88rem;">
              AI Recommended Medications (Based on Patient History & Symptoms):
            </div>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; font-weight: 700; color: #1b5e20; border-color: #2e7d32; background: #f1f8e9;" onclick="DoctorDesk.applyAiTreatmentToPrescription()">
              Apply All to Prescription Builder
            </button>
          </div>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; background: #ffffff; border: 1px solid #c8e6c9;">
              <thead>
                <tr style="background: #e8f5e9; text-align: left; color: #1b5e20;">
                  <th style="padding: 0.45rem 0.65rem;">Recommended Medicine & Clinical Rationale</th>
                  <th style="padding: 0.45rem 0.65rem;">Dosage</th>
                  <th style="padding: 0.45rem 0.65rem;">Frequency</th>
                  <th style="padding: 0.45rem 0.65rem;">Duration</th>
                  <th style="padding: 0.45rem 0.65rem;">Instructions</th>
                  <th style="padding: 0.45rem 0.65rem; text-align: center;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${recMeds.map((m, idx) => `
                  <tr style="border-bottom: 1px solid #f1f8e9;">
                    <td style="padding: 0.45rem 0.65rem; color: #0f172a;">
                      <div style="font-weight: 700;">${m.medicine || m.name}</div>
                      ${m.indication ? `<div style="font-size: 0.72rem; color: #2e7d32; margin-top: 1px;">Indication: ${m.indication}</div>` : ''}
                    </td>
                    <td style="padding: 0.45rem 0.65rem;">${m.dosage}</td>
                    <td style="padding: 0.45rem 0.65rem;"><span class="badge badge-normal" style="font-size: 0.7rem;">${m.frequency}</span></td>
                    <td style="padding: 0.45rem 0.65rem;">${m.duration}</td>
                    <td style="padding: 0.45rem 0.65rem; color: #475569;">${m.instructions}</td>
                    <td style="padding: 0.45rem 0.65rem; text-align: center;">
                      <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; font-weight: 700; padding: 2px 8px; color: #1b5e20; border-color: #2e7d32;" onclick="DoctorDesk.applySingleMedication(${idx})">
                        + Add to Rx
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- AI RECOMMENDED DIAGNOSTIC LAB INVESTIGATIONS (CATEGORIZED: BLOOD, STOOL, URINE, SCANS) -->
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 0.85rem; margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
            <div style="font-weight: 800; color: #0f172a; font-size: 0.88rem;">
              AI Recommended Diagnostic Lab Investigations:
            </div>
            <button type="button" class="btn btn-primary btn-sm" style="font-size: 0.75rem; font-weight: 700;" onclick="DoctorDesk.applyLabTestsToConsultation()">
              + Add All to Lab Orders
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <!-- Blood Reports -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.65rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <strong style="color: #991b1b; font-size: 0.8rem;">Blood Reports:</strong>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.68rem; padding: 1px 6px; color: #991b1b; border-color: #fca5a5;" onclick="DoctorDesk.applyLabTestsToConsultation('blood_reports')">
                  + Add Blood Tests
                </button>
              </div>
              <ul style="margin: 0; padding-left: 1.1rem; font-size: 0.78rem; color: #334155;">
                ${(catLabs.blood_reports || []).map(b => `<li>${b}</li>`).join('')}
              </ul>
            </div>

            <!-- Stool Tests -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.65rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <strong style="color: #92400e; font-size: 0.8rem;">Stool Tests:</strong>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.68rem; padding: 1px 6px; color: #92400e; border-color: #fcd34d;" onclick="DoctorDesk.applyLabTestsToConsultation('stool_tests')">
                  + Add Stool Tests
                </button>
              </div>
              <ul style="margin: 0; padding-left: 1.1rem; font-size: 0.78rem; color: #334155;">
                ${(catLabs.stool_tests || []).map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>

            <!-- Urine Routine -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.65rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <strong style="color: #1e40af; font-size: 0.8rem;">Urine Routine & Microscopy:</strong>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.68rem; padding: 1px 6px; color: #1e40af; border-color: #93c5fd;" onclick="DoctorDesk.applyLabTestsToConsultation('urine_routine')">
                  + Add Urine Tests
                </button>
              </div>
              <ul style="margin: 0; padding-left: 1.1rem; font-size: 0.78rem; color: #334155;">
                ${(catLabs.urine_routine || []).map(u => `<li>${u}</li>`).join('')}
              </ul>
            </div>

            <!-- Imaging & Radiology -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.65rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <strong style="color: #1b5e20; font-size: 0.8rem;">Diagnostic Imaging & Scans:</strong>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.68rem; padding: 1px 6px; color: #1b5e20; border-color: #86efac;" onclick="DoctorDesk.applyLabTestsToConsultation('imaging_tests')">
                  + Add Imaging Tests
                </button>
              </div>
              <ul style="margin: 0; padding-left: 1.1rem; font-size: 0.78rem; color: #334155;">
                ${(catLabs.imaging_tests || []).map(img => `<li>${img}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>

        <!-- AYUSH & INTEGRATIVE MEDICINE CLINICAL MODULE -->
        <div style="background: #fdf6ec; border: 1px solid #fde68a; border-radius: 8px; padding: 0.85rem; margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <strong style="color: #92400e; font-size: 0.85rem;">Ministry of Ayush — Integrative Clinical Profile:</strong>
            <span style="font-size: 0.68rem; background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-weight: 800;">Dashavidha Pariksha</span>
          </div>
          <div style="font-size: 0.82rem; color: #78350f; line-height: 1.5; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <strong>Prakriti:</strong> ${this.currentPatient && this.currentPatient.age > 50 ? 'Vata-Pitta Prakriti' : 'Pitta-Predominant Prakriti'}<br>
              <strong>Agni (Digestive Fire):</strong> Tikshna / Vishama Agni<br>
              <strong>Dushya (Tissue):</strong> Rasa, Rakta & Mamsa Dhatus
            </div>
            <div>
              <strong style="color: #059669;">Pathya (Dietary Do's):</strong> Light warm moong soup, Arjuna Kshirapaka decoction, boiled warm water.<br>
              <strong style="color: #dc2626;">Apathya (Dietary Don'ts):</strong> Oily/deep-fried items, heavy late-night meals, mental stress.
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 0.75rem; margin-bottom: 0.5rem;">
          <div>
            <strong style="color: #1b5e20; font-size: 0.85rem;">Clinical Precautions & Recommendations:</strong>
            <div style="font-size: 0.82rem; color: #334155; margin-top: 0.25rem;">
              ${aiTx.lifestyle_precautions || 'Maintain adequate bed rest, proper hydration, and avoid strenuous physical strain.'}
            </div>
            ${aiTx.safety_red_flags ? `
              <div style="background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.78rem; font-weight: 700; margin-top: 0.5rem;">
                <strong>Clinical Warning / Red Flags:</strong> ${aiTx.safety_red_flags}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
  },

  applySingleMedication(index) {
    if (!this.currentSections || !this.currentSections.ai_recommended_treatment) return;
    const meds = this.currentSections.ai_recommended_treatment.recommended_medications || [];
    const m = meds[index];
    if (!m) return;

    const medName = m.medicine || m.name;
    const exists = this.prescriptionItems.some(p => p.medicine.toLowerCase() === medName.toLowerCase());
    if (exists) {
      SwasyaApp.showToast(`${medName} is already in the prescription list.`, "info");
      return;
    }

    this.prescriptionItems.push({
      medicine: medName,
      dosage: m.dosage || "1 tab",
      frequency: m.frequency || "OD",
      duration: m.duration || "5 days",
      notes: (m.instructions || "") + (m.indication ? ` (${m.indication})` : "")
    });

    this.renderPrescriptionTable();
    SwasyaApp.showToast(`Added ${medName} to Prescription!`, "success");
  },

  applyLabTestsToConsultation(category = null) {
    const labInput = document.getElementById("consult-lab-investigations");
    if (!labInput) return;

    const aiTx = (this.currentSections && this.currentSections.ai_recommended_treatment) || {};
    const categorized = aiTx.investigations_categorized || {
      blood_reports: ["Complete Blood Count (CBC) with ESR", "Liver Function Test (LFT)", "Kidney Function Test (KFT)", "Fasting Blood Sugar (FBS / HbA1c)"],
      stool_tests: ["Stool Routine & Microscopy", "Stool Occult Blood (FOBT)"],
      urine_routine: ["Urine Routine & Microscopy"],
      imaging_tests: ["Diagnostic Ultrasound (USG) / Targeted MRI"]
    };

    let testsToAdd = [];
    if (category && categorized[category]) {
      testsToAdd = categorized[category];
    } else if (!category) {
      if (categorized && Object.keys(categorized).length > 0) {
        Object.values(categorized).forEach(arr => {
          if (Array.isArray(arr)) testsToAdd.push(...arr);
        });
      } else if (Array.isArray(aiTx.recommended_investigations)) {
        testsToAdd = aiTx.recommended_investigations;
      }
    }

    if (testsToAdd.length === 0) {
      SwasyaApp.showToast("No diagnostic lab tests found.", "info");
      return;
    }

    const currentVal = labInput.value.trim();
    const currentList = currentVal ? currentVal.split("\n").map(s => s.trim().replace(/^[-•*]\s*/, "")) : [];

    let addedCount = 0;
    testsToAdd.forEach(t => {
      if (!currentList.includes(t)) {
        currentList.push(t);
        addedCount++;
      }
    });

    labInput.value = currentList.map(t => `• ${t}`).join("\n");
    SwasyaApp.showToast(`Added ${addedCount} test(s) to Lab Orders!`, "success");
    labInput.scrollIntoView({ behavior: 'smooth' });
  },

  applyAiTreatmentToPrescription() {
    if (!this.currentSections || !this.currentSections.ai_recommended_treatment) {
      SwasyaApp.showToast("No AI treatment plan available to apply.", "error");
      return;
    }

    const meds = this.currentSections.ai_recommended_treatment.recommended_medications || [];
    if (meds.length === 0) {
      SwasyaApp.showToast("No medications in AI treatment plan.", "info");
      return;
    }

    this.prescriptionItems = [];
    meds.forEach(m => {
      this.prescriptionItems.push({
        medicine: m.medicine || m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        notes: (m.instructions || "") + (m.indication ? ` (${m.indication})` : "")
      });
    });

    this.renderPrescriptionTable();

    // Scroll smoothly to the prescription builder
    document.getElementById("consult-final-diagnosis")?.scrollIntoView({ behavior: 'smooth' });
    SwasyaApp.showToast(`Applied ${meds.length} AI recommended medications to Prescription Builder!`, "success");
  },

  addPrescriptionItem() {
    const medInput = document.getElementById("rx-med-name");
    const doseInput = document.getElementById("rx-dosage");
    const freqInput = document.getElementById("rx-freq");
    const durInput = document.getElementById("rx-duration");
    const notesInput = document.getElementById("rx-instructions");

    if (!medInput || !medInput.value.trim()) {
      alert("Please enter medicine name.");
      return;
    }

    this.prescriptionItems.push({
      medicine: medInput.value.trim(),
      dosage: doseInput.value.trim() || "1 tab",
      frequency: freqInput.value,
      duration: durInput.value.trim() || "5 days",
      notes: notesInput.value.trim() || "After meals"
    });

    medInput.value = "";
    doseInput.value = "";
    durInput.value = "";
    notesInput.value = "";

    this.renderPrescriptionTable();
  },

  async runPrescriptionSafetyRadar() {
    const radarEl = document.getElementById("doctor-drug-safety-radar-box");
    if (!radarEl) return;

    if (this.prescriptionItems.length === 0) {
      radarEl.style.display = "none";
      return;
    }

    try {
      const medNames = this.prescriptionItems.map(p => p.medicine);
      const allergies = this.currentPatient ? (this.currentPatient.allergies || "") : "";
      const res = await SwasyaApp.api('/api/safety/check-prescription', 'POST', {
        medications: medNames,
        patient_allergies: allergies
      });

      radarEl.style.display = "block";
      if (res.is_safe) {
        radarEl.style.background = "#f0fdf4";
        radarEl.style.borderColor = "#bbf7d0";
        radarEl.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem; color: #166534; font-size: 0.85rem; font-weight: 700;">
            <span> Drug Safety Radar:</span>
            <span> 0 Adverse Interactions Detected. All ${medNames.length} medications verified clinically safe.</span>
          </div>
        `;
      } else {
        radarEl.style.background = "#fff1f2";
        radarEl.style.borderColor = "#f87171";
        radarEl.innerHTML = `
          <div style="color: #991b1b; font-size: 0.85rem; font-weight: 800; margin-bottom: 0.25rem;">
            Warning:  Clinical Drug Safety Alert (${res.total_alerts} Warning Flags Detected):
          </div>
          <div class="space-y-2">
            ${res.alerts.map(a => `
              <div style="font-size: 0.8rem; line-height: 1.4; color: #b91c1c; background: #ffffff; border-left: 3px solid #dc2626; padding: 0.4rem 0.6rem; border-radius: 4px;">
                <strong>${a.title}</strong><br>${a.message}
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch(e) {
      console.warn("Safety radar notice:", e);
    }
  },

  removePrescriptionItem(index) {
    this.prescriptionItems.splice(index, 1);
    this.renderPrescriptionTable();
  },

  renderPrescriptionTable() {
    const tbody = document.getElementById("rx-items-tbody");
    if (!tbody) return;

    // Trigger Real-Time Clinical Drug-Drug & Allergy Safety Radar Check
    this.runPrescriptionSafetyRadar();

    tbody.innerHTML = "";

    if (this.prescriptionItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #94a3b8; padding: 1rem;">
            No medicines added yet. Type medicine above or click 'Apply AI Treatment'.
          </td>
        </tr>
      `;
      return;
    }

    this.runSafetyCheck();
    this.prescriptionItems.forEach((item, index) => {
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid var(--slate-200)";
      row.innerHTML = `
        <td style="padding: 0.5rem; font-weight: 700; color: #0f172a;">${item.medicine}</td>
        <td style="padding: 0.5rem;">${item.dosage}</td>
        <td style="padding: 0.5rem;"><span class="badge badge-normal">${item.frequency}</span></td>
        <td style="padding: 0.5rem;">${item.duration}</td>
        <td style="padding: 0.5rem; color: #64748b;">${item.notes}</td>
        <td style="padding: 0.5rem; text-align: center;">
          <button type="button" class="btn btn-danger btn-sm" onclick="DoctorDesk.removePrescriptionItem(${index})" style="padding: 2px 6px;">&times;</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  },

  async handleSaveSoap() {
    if (!this.currentTriage) return;
    try {
      const payload = {
        subjective: document.getElementById("soap-subjective").value,
        objective: document.getElementById("soap-objective").value,
        assessment: document.getElementById("soap-assessment").value,
        plan: document.getElementById("soap-plan").value,
        red_flags: "",
        differential_diagnosis: "",
        doctor_feedback: "Verified by Attending Physician"
      };

      await SwasyaApp.api(`/api/scribe/soap/${this.currentTriage.triage_id}`, "PUT", payload);
      SwasyaApp.showToast("SOAP Note successfully verified & saved!", "success");

      const statusBadge = document.getElementById("soap-review-status");
      if (statusBadge) {
        statusBadge.innerHTML = '<span class="badge badge-normal"> Physician Reviewed & Approved</span>';
      }
    } catch (e) {
      SwasyaApp.showToast("Failed to save SOAP note: " + e.message, "error");
    }
  },

  async handleFinalizeConsultation() {
    if (!this.currentTriage || !this.currentPatient) {
      alert("No active patient selected for consultation.");
      return;
    }

    const diagnosis = document.getElementById("consult-final-diagnosis").value.trim();
    if (!diagnosis) {
      alert("Please specify a final diagnosis before signing off.");
      return;
    }

    const followUpDateInput = document.getElementById("consult-followup-date");
    const followUpDate = followUpDateInput ? followUpDateInput.value : null;

    const payload = {
      triage_id: this.currentTriage.triage_id,
      patient_id: this.currentPatient.id,
      final_diagnosis: diagnosis,
      clinical_notes: "Physician clinical examination completed.",
      prescriptions: this.prescriptionItems,
      lab_investigations: document.getElementById("consult-lab-investigations").value.trim(),
      follow_up_advice: document.getElementById("consult-follow-up").value.trim(),
      follow_up_date: followUpDate
    };

    try {
      const res = await SwasyaApp.api("/api/consultations", "POST", payload);
      SwasyaApp.showToast("Consultation signed off! Digital Rx & Report ready.", "success");

      const consultId = res.consultation_id || 1;
      this.lastConsultationId = consultId;
      this.openPrintModal(payload, consultId);

      this.currentTriage = null;
      this.currentPatient = null;
      this.currentSoap = null;
      this.currentSections = null;
      this.prescriptionItems = [];
      this.renderPrescriptionTable();

      this.refresh();
    } catch (e) {
      SwasyaApp.showToast("Error finalizing consultation: " + e.message, "error");
    }
  },

  openPrintModal(consultation, consultationId = null) {
    const modal = document.getElementById("rx-print-modal");
    const body = document.getElementById("rx-print-modal-body");
    if (!modal || !body) return;

    const consultId = consultationId || this.lastConsultationId || 1;

    body.innerHTML = `
      <div style="border: 2px solid #2e7d32; padding: 1.5rem; background: #ffffff; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #2e7d32; padding-bottom: 0.75rem; margin-bottom: 1rem;">
          <div>
            <h2 style="margin: 0; color: #2e7d32; font-size: 1.25rem;">PRIMARY HEALTH CENTER CLINIC (OPD)</h2>
            <div style="font-size: 0.8rem; color: #64748b;">Department of Health & Family Welfare • Hubballi</div>
          </div>
          <div style="text-align: right; font-size: 0.8rem;">
            <strong>Dr. Ramesh Kumar, MBBS, MD</strong><br>
            Reg No: KMC-48291<br>
            Date: ${new Date().toLocaleDateString('en-IN')}
          </div>
        </div>

        <div style="font-size: 0.85rem; margin-bottom: 1rem; line-height: 1.6; background: #f8fafc; padding: 0.75rem; border-radius: 6px;">
          <strong>Patient:</strong> ${this.currentPatient ? this.currentPatient.name : 'Patient'} (${this.currentPatient ? this.currentPatient.age : '--'}y / ${this.currentPatient ? this.currentPatient.gender : '--'})<br>
          <strong>UHID:</strong> ${this.currentPatient ? this.currentPatient.uhid : 'UHID-2026-XXXX'} | <strong>Diagnosis:</strong> <span style="color: #2e7d32; font-weight: 700;">${consultation.final_diagnosis}</span>
        </div>

        <div style="font-size: 1.25rem; font-weight: 900; color: #2e7d32; margin-bottom: 0.5rem;">℞</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 1rem;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left; border-bottom: 1px solid #cbd5e1;">
              <th style="padding: 0.5rem;">Medicine</th>
              <th style="padding: 0.5rem;">Dosage</th>
              <th style="padding: 0.5rem;">Frequency</th>
              <th style="padding: 0.5rem;">Duration</th>
              <th style="padding: 0.5rem;">Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${consultation.prescriptions.map(p => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 0.5rem; font-weight: 700;">${p.medicine}</td>
                <td style="padding: 0.5rem;">${p.dosage}</td>
                <td style="padding: 0.5rem;">${p.frequency}</td>
                <td style="padding: 0.5rem;">${p.duration}</td>
                <td style="padding: 0.5rem; color: #64748b;">${p.notes}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${consultation.lab_investigations ? `<div style="font-size: 0.85rem; margin-bottom: 0.5rem;"><strong>Lab Investigations Ordered:</strong><br><span style="white-space: pre-line; color: #0f172a;">${consultation.lab_investigations}</span></div>` : ''}
        ${consultation.follow_up_advice ? `<div style="font-size: 0.85rem; margin-bottom: 0.75rem;"><strong>Advice & Instructions:</strong> ${consultation.follow_up_advice}</div>` : ''}
        ${consultation.follow_up_date ? `
          <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 6px; padding: 0.6rem 0.85rem; font-size: 0.85rem; margin-bottom: 0.85rem;">
            <strong>Scheduled Follow-Up Appointment:</strong> <span style="font-weight: 800; color: #15803d;">${consultation.follow_up_date}</span>
            <div style="font-size: 0.74rem; color: #166534; margin-top: 2px;">Patient will receive automated WhatsApp consultation reminders.</div>
          </div>
        ` : ''}

        <!-- Official Report Action Strip -->
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 0.75rem 1rem; margin: 1.25rem 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <strong style="color: #166534; font-size: 0.85rem;">Official PDF Medical Report & WhatsApp Delivery:</strong>
            <div style="font-size: 0.72rem; color: #15803d;">Includes clinic header, verified diagnosis, Rx table, lab orders, and scheduled follow-up.</div>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" onclick="DoctorDesk.downloadReportPdf('${consultId}')">
               Download Report (PDF)
            </button>
            <button type="button" class="btn btn-success btn-sm" style="background: #25D366; border-color: #25D366; color: #fff;" onclick="DoctorDesk.shareViaWhatsApp('${consultId}')">
               Share Rx on WhatsApp
            </button>
            ${consultation.follow_up_date ? `
              <button type="button" class="btn btn-secondary btn-sm" style="background: #15803d; border-color: #15803d; color: #fff;" onclick="DoctorDesk.shareFollowupViaWhatsApp('${consultId}')">
                 Send Follow-Up WhatsApp Reminder
              </button>
            ` : ''}
          </div>
        </div>

        <div style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="font-size: 0.7rem; color: #94a3b8;">Digitally generated & signed via Swasya AI System</div>
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 0.25rem; width: 180px; font-size: 0.8rem; font-weight: 700;">
            Physician Signature
          </div>
        </div>
      </div>
    `;

    modal.style.display = "flex";
  },

  async downloadReportPdf(consultationId = null) {
    let id = consultationId || this.lastConsultationId;
    
    // If no explicit consultation ID, check if current patient has a finalized consultation
    if (!id && this.currentPatient && this.currentPatient.id) {
      try {
        const check = await SwasyaApp.api(`/api/consultations/patient/${this.currentPatient.id}/latest`).catch(() => null);
        if (check && check.consultation && check.consultation.id) {
          id = check.consultation.id;
        }
      } catch(e) {}
    }

    let url = "";
    let fname = "Swasya_Medical_Report.pdf";
    if (id) {
      url = `/api/reports/${id}/pdf`;
      fname = `Swasya_Medical_Report_${id}.pdf`;
    } else if (this.currentTriage && this.currentTriage.triage_id) {
      url = `/api/reports/triage/${this.currentTriage.triage_id}/pdf`;
      fname = `Swasya_Intake_Report_TR${this.currentTriage.triage_id}.pdf`;
    } else {
      url = `/api/reports/latest/pdf`;
      fname = "Swasya_Clinical_Report.pdf";
    }

    await SwasyaApp.downloadFile(url, fname);
  },

  async shareViaWhatsApp(consultationId = null) {
    let id = consultationId || this.lastConsultationId;

    if (!id && this.currentPatient && this.currentPatient.id) {
      try {
        const check = await SwasyaApp.api(`/api/consultations/patient/${this.currentPatient.id}/latest`).catch(() => null);
        if (check && check.consultation && check.consultation.id) {
          id = check.consultation.id;
        }
      } catch(e) {}
    }

    if (!id) {
      const phone = (this.currentPatient && this.currentPatient.phone) || '';
      const name = (this.currentPatient && this.currentPatient.name) || 'Patient';
      const triageId = (this.currentTriage && this.currentTriage.triage_id) || '1';
      const origin = window.location.origin;
      const msg = `*SWASYA AI CLINICAL SUMMARY*\nPatient: ${name}\nStatus: Intake Complete - Waiting for Attending Physician Review\nDownload Report: ${origin}/api/reports/triage/${triageId}/pdf`;
      SwasyaApp.openWhatsApp(null, phone, msg, msg);
      return;
    }

    try {
      const res = await SwasyaApp.api(`/api/reports/${id}/whatsapp-link`);
      if (res && res.whatsapp_url) {
        SwasyaApp.openWhatsApp(res.whatsapp_url, res.phone, res.summary_text, res.summary_text);
      } else {
        SwasyaApp.showToast("Could not generate WhatsApp share link.", "error");
      }
    } catch(e) {
      SwasyaApp.showToast("Error generating WhatsApp link: " + e.message, "error");
    }
  },

  async shareFollowupViaWhatsApp(consultationId = null) {
    let id = consultationId || this.lastConsultationId;

    if (!id && this.currentPatient && this.currentPatient.id) {
      try {
        const check = await SwasyaApp.api(`/api/consultations/patient/${this.currentPatient.id}/latest`).catch(() => null);
        if (check && check.consultation && check.consultation.id) {
          id = check.consultation.id;
        }
      } catch(e) {}
    }

    if (!id) id = 'latest';

    try {
      const res = await SwasyaApp.api(`/api/consultations/${id}/followup-whatsapp-link`);
      if (res && res.whatsapp_url) {
        SwasyaApp.openWhatsApp(res.whatsapp_url, res.phone, res.summary_text, res.summary_text);
      } else {
        SwasyaApp.showToast("Follow-up reminder link not available.", "error");
      }
    } catch(e) {
      SwasyaApp.showToast("Error generating follow-up reminder link: " + e.message, "error");
    }
  },

  async exportFhir() {
    if (!this.currentTriage) {
      alert("Please select a patient from the consultation queue.");
      return;
    }
    try {
      const res = await SwasyaApp.api(`/api/fhir/cases/${this.currentTriage.triage_id}`);
      const modal = document.getElementById("fhir-export-modal");
      const display = document.getElementById("fhir-json-display");
      if (modal && display) {
        display.textContent = JSON.stringify(res.fhirBundle, null, 2);
        modal.style.display = "flex";
      }
    } catch (e) {
      SwasyaApp.showToast("FHIR export notice: " + e.message, "error");
    }
  },

  copyFhirJson() {
    const text = document.getElementById("fhir-json-display")?.textContent;
    if (text) {
      navigator.clipboard.writeText(text);
      SwasyaApp.showToast("HL7 FHIR R4 Bundle copied to clipboard!", "success");
    }
  },

  openAbdmLinkModal() {
    if (!this.currentPatient) {
      alert("Please select a patient first.");
      return;
    }
    document.getElementById("abdm-link-modal").style.display = "flex";
  },

  async executeAbdmLink() {
    const abha = document.getElementById("abdm-target-abha").value.trim();
    const resBox = document.getElementById("abdm-link-result");
    try {
      const res = await SwasyaApp.api("/api/abdm/link-record", "POST", {
        patient_id: this.currentPatient.id,
        triage_id: this.currentTriage ? this.currentTriage.triage_id : 1,
        abha_number: abha
      });
      if (resBox) {
        resBox.style.display = "block";
        resBox.innerHTML = `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 0.75rem; border-radius: 8px; font-size: 0.8rem; color: #166534;">
            <strong> Care Context Linked Successfully to ABDM!</strong><br>
            Reference: <code>${res.care_context_reference}</code><br>
            Status: ${res.link_status}
          </div>
        `;
      }
    } catch (e) {
      if (resBox) {
        resBox.style.display = "block";
        resBox.innerHTML = `<span style="color: #dc2626;">ABDM link simulated: ${e.message}</span>`;
      }
    }
  }
};

window.DoctorDesk = DoctorDesk;
