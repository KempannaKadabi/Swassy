// Swasya AI - Clean Portal Controller & Web Application State
const SwasyaApp = {
  currentUser: null,
  token: null,
  activeTab: "kiosk-tab",

  init() {
    this.bindEvents();

    const stored = this.loadSession();
    if (stored && stored.token && stored.user) {
      this.currentUser = stored.user;
      this.token = stored.token;
      this.showMainApp();
    } else {
      this.showAuthPage();
    }
  },

  loadSession() {
    try {
      const data = localStorage.getItem("swasya_session");
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  },

  saveSession(token, user) {
    this.token = token;
    this.currentUser = user;
    localStorage.setItem("swasya_session", JSON.stringify({ token, user }));
  },

  clearSession() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem("swasya_session");
  },

  showAuthPage() {
    const authPage = document.getElementById("auth-page");
    const mainApp = document.getElementById("main-app");
    if (authPage) authPage.style.display = "flex";
    if (mainApp) mainApp.style.display = "none";
  },

  showMainApp() {
    const authPage = document.getElementById("auth-page");
    const mainApp = document.getElementById("main-app");
    if (authPage) authPage.style.display = "none";
    if (mainApp) mainApp.style.display = "flex";

    this.applyRoleAccess();
    this.updateUserBadge();
    this.initModules();

    // Restore saved website language
    const savedLang = localStorage.getItem("swasya_language") || "English";
    this.setWebsiteLanguage(savedLang, false);
  },

  currentLanguage: "English",

  UI_TRANSLATIONS: {
    English: {
      patientPortal: "Patient Portal",
      doctorDesk: "Doctor Desk",
      viewPrescription: "View Prescription",
      startFresh: "Start Fresh",
      signOut: "Sign Out",
      kioskEyebrow: "Patient Self-Service · Kiosk 01",
      kioskTitle: "Independent Case-Taking Station",
      kioskDesc: "Patients independently report symptoms, tap symptom locations on the body map, and follow the AI-guided clinical interview before meeting the doctor."
    },
    Hindi: {
      patientPortal: "मरीज़ पोर्टल (Patient Portal)",
      doctorDesk: "डॉक्टर डेस्क (Doctor Desk)",
      viewPrescription: "दवा पर्ची (Prescription)",
      startFresh: "नया केस शुरू करें",
      signOut: "लॉग आउट",
      kioskEyebrow: "मरीज़ स्वयं सेवा · कियोस्क 01",
      kioskTitle: "स्वतंत्र केस-टेकिंग एवं लक्षण केंद्र",
      kioskDesc: "मरीज़ स्वयं अपने लक्षण बताते हैं, शरीर के नक्शे पर दर्द की जगह चुनते हैं और डॉक्टर से मिलने से पहले एआई क्लिनिकल इंटरव्यू पूरा करते हैं।"
    },
    Kannada: {
      patientPortal: "ರೋಗಿಗಳ ಪೋರ್ಟಲ್ (Patient Portal)",
      doctorDesk: "ವೈದ್ಯರ ಡೆಸ್ಕ್ (Doctor Desk)",
      viewPrescription: "ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ವೀಕ್ಷಿಸಿ (Rx)",
      startFresh: "ಹೊಸದಾಗಿ ಪ್ರಾರಂಭಿಸಿ",
      signOut: "ಸೈನ್ ಔಟ್",
      kioskEyebrow: "ರೋಗಿಗಳ ಸ್ವಯಂ ಸೇವೆ · ಕಿಯೋಸ್ಕ್ 01",
      kioskTitle: "ಸ್ವತಂತ್ರ ಕೇಸ್-ಟೇಕಿಂಗ್ ಕೇಂದ್ರ",
      kioskDesc: "ರೋಗಿಗಳು ತಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ಸ್ವತಃ ವರದಿ ಮಾಡುತ್ತಾರೆ, ದೇಹದ ನಕ್ಷೆಯಲ್ಲಿ ಸ್ಥಳ ಗುರುತಿಸುತ್ತಾರೆ ಮತ್ತು ವೈದ್ಯರನ್ನು ಭೇಟಿಯಾಗುವ ಮುನ್ನ AI ಸಂದರ್ಶನ ಪೂರ್ಣಗೊಳಿಸುತ್ತಾರೆ."
    },
    Marathi: {
      patientPortal: "रुग्ण पोर्टल (Patient Portal)",
      doctorDesk: "डॉक्टर डेस्क (Doctor Desk)",
      viewPrescription: "प्रिस्क्रिप्शन पहा (Rx)",
      startFresh: "नवीन सुरुवात करा",
      signOut: "बाहेर पडा",
      kioskEyebrow: "रुग्ण स्व-सेवा · किऑस्क 01",
      kioskTitle: "स्वतंत्र केस-टेकिंग केंद्र",
      kioskDesc: "रुग्ण स्वतः आपल्या त्रासाची माहिती देतात, अवयवांच्या नकाशावर जागा दाखवतात आणि डॉक्टरांना भेटण्यापूर्वी एआय मुलाखत पूर्ण करतात."
    },
    Tamil: {
      patientPortal: "நோயாளி தளம் (Patient Portal)",
      doctorDesk: "மருத்துவர் மேசை (Doctor Desk)",
      viewPrescription: "மருந்து சீட்டு (Rx)",
      startFresh: "புதிதாகத் தொடங்கு",
      signOut: "வெளியேறு",
      kioskEyebrow: "நோயாளி சுய சேவை · கியோஸ்க் 01",
      kioskTitle: "சுயாதீன மருத்துவப் பதிவு நிலையம்",
      kioskDesc: "நோயாளிகள் தங்கள் அறிகுறிகளை பதிவு செய்து, உடல் வரைபடத்தில் இடத்தைத் தேர்ந்தெடுத்து மருத்துவரை சந்திக்கும் முன் AI நேர்காணலை முடிக்கிறார்கள்."
    },
    Telugu: {
      patientPortal: "రోగి పోర్టల్ (Patient Portal)",
      doctorDesk: "డాక్టర్ డెస్క్ (Doctor Desk)",
      viewPrescription: "ప్రిస్క్రిప్షన్ చూడండి (Rx)",
      startFresh: "కొత్తగా ప్రారంభించండి",
      signOut: "లాగ్ అవుట్",
      kioskEyebrow: "రోగి స్వీయ సేవ · కియోస్క్ 01",
      kioskTitle: "స్వతంత్ర కేస్-టేకింగ్ స్టేషన్",
      kioskDesc: "రోగులు వారి లక్షణాలను స్వతంత్రంగా నివేదిస్తారు, శరీర మ్యాప్‌లో ప్రదేశాలను ఎంచుకుని వైద్యుడిని కలవడానికి ముందు AI ఇంటర్వ్యూ పూర్తి చేస్తారు."
    },
    Bengali: {
      patientPortal: "রোগী পোর্টাল (Patient Portal)",
      doctorDesk: "ডাক্তার ডেস্ক (Doctor Desk)",
      viewPrescription: "প্রেসক্রিপশন দেখুন (Rx)",
      startFresh: "নতুন করে শুরু করুন",
      signOut: "লগ আউট",
      kioskEyebrow: "রোগী স্ব-পরিষেবা · কিয়স্ক ০১",
      kioskTitle: "স্বাধীন কেস-টেকিং স্টেশন",
      kioskDesc: "রোগীরা স্বাধীনভাবে লক্ষণগুলি জানান, শরীরের মানচিত্রে অবস্থান নির্বাচন করেন এবং ডাক্তারের সাথে দেখা করার আগে AI সাক্ষাৎকার সম্পন্ন করেন।"
    },
    Gujarati: {
      patientPortal: "દર્દી પોર્ટલ (Patient Portal)",
      doctorDesk: "ડૉક્ટર ડેસ્ક (Doctor Desk)",
      viewPrescription: "પ્રિસ્ક્રિપ્શન જુઓ (Rx)",
      startFresh: "નવેસરથી શરૂ કરો",
      signOut: "લૉગ આઉટ",
      kioskEyebrow: "દર્દી સ્વ-સેવા · કિઓસ્ક 01",
      kioskTitle: "સ્વતંત્ર કેસ-ટેકિંગ સ્ટેશન",
      kioskDesc: "દર્દીઓ સ્વતંત્ર રીતે લક્ષણો જણાવે છે, શરીરના નકશા પર દુખાવાની જગ્યા પસંદ કરે છે અને ડૉક્ટરને મળતા પહેલાં AI ઇન્ટરવ્યૂ પૂર્ણ કરે છે."
    },
    Malayalam: {
      patientPortal: "പേഷ്യന്റ് പോർട്ടൽ (Patient Portal)",
      doctorDesk: "ഡോക്ടർ ഡെസ്ക് (Doctor Desk)",
      viewPrescription: "കുറിപ്പടി കാണുക (Rx)",
      startFresh: "പുതിയതായി തുടങ്ങുക",
      signOut: "പുറത്തുകടക്കുക",
      kioskEyebrow: "രോഗി സ്വയം സേവനം · കിയോസ്ക് 01",
      kioskTitle: "സ്വതന്ത്ര കേസ് ശേഖരണ കേന്ദ്രം",
      kioskDesc: "രോഗികൾ ലക്ഷണങ്ങൾ സ്വയം അറിയിക്കുകയും ശരീര ഭൂപടത്തിൽ അടയാളപ്പെടുത്തുകയും ചെയ്യുന്നു."
    },
    Punjabi: {
      patientPortal: "ਮਰੀਜ਼ ਪੋਰਟਲ (Patient Portal)",
      doctorDesk: "ਡਾਕਟਰ ਡੈਸਕ (Doctor Desk)",
      viewPrescription: "ਦਵਾਈ ਪਰਚੀ ਵੇਖੋ (Rx)",
      startFresh: "ਨਵੇਂ ਸਿਰੇ ਤੋਂ ਸ਼ੁਰੂ ਕਰੋ",
      signOut: "ਲੌਗ ਆਉਟ",
      kioskEyebrow: "ਮਰੀਜ਼ ਸਵੈ-ਸੇਵਾ · ਕਿਓਸਕ 01",
      kioskTitle: "ਸੁਤੰਤਰ ਕੇਸ-ਟੇਕਿੰਗ ਸਟੇਸ਼ਨ",
      kioskDesc: "ਮਰੀਜ਼ ਆਪਣੇ ਲੱਛਣ ਖ਼ੁਦ ਦੱਸਦੇ ਹਨ ਅਤੇ ਡਾਕਟਰ ਨੂੰ ਮਿਲਣ ਤੋਂ ਪਹਿਲਾਂ ਏਆਈ ਇੰਟਰਵਿਊ ਪੂਰੀ ਕਰਦੇ ਹਨ।"
    },
    Odia: {
      patientPortal: "ରୋଗୀ ପୋର୍ଟାଲ (Patient Portal)",
      doctorDesk: "ଡାକ୍ତର ଡେସ୍କ (Doctor Desk)",
      viewPrescription: "ପ୍ରେସକ୍ରିପସନ ଦେଖନ୍ତୁ (Rx)",
      startFresh: "ନୂତନ ଭାବେ ଆରମ୍ଭ କରନ୍ତୁ",
      signOut: "ଲଗ ଆଉଟ",
      kioskEyebrow: "ରୋଗୀ ସ୍ୱୟଂ ସେବା · କିଓସ୍କ ୦୧",
      kioskTitle: "ସ୍ୱତନ୍ତ୍ର କେସ୍-ଟେକିଂ ଷ୍ଟେସନ",
      kioskDesc: "ରୋଗୀ ନିଜେ ଲକ୍ଷଣ ଜଣାଇଥାନ୍ତି ଏବଂ ଡାକ୍ତରଙ୍କୁ ଭେଟିବା ପୂର୍ବରୁ AI ସାକ୍ଷାତକାର ଶେଷ କରିଥାନ୍ତି।"
    },
    Assamese: {
      patientPortal: "ৰোগী পৰ্টেল (Patient Portal)",
      doctorDesk: "চিকিৎসক ডেক্স (Doctor Desk)",
      viewPrescription: "প্ৰেচক্ৰিপচন চাওক (Rx)",
      startFresh: "নতুনকৈ আৰম্ভ কৰক",
      signOut: "লগ আউট",
      kioskEyebrow: "ৰোগীৰ আত্ম-সেৱা · কিয়স্ক ০১",
      kioskTitle: "স্বতন্ত্ৰ কেছ-টেকিং ষ্টেচন",
      kioskDesc: "ৰোগীয়ে নিজেই লক্ষণসমূহ কয় আৰু চিকিৎসকক লগ পোৱাৰ পূৰ্বে AI সাক্ষাৎকাৰ সম্পূৰ্ণ কৰে।"
    },
    Urdu: {
      patientPortal: "مریض پورٹل (Patient Portal)",
      doctorDesk: "ڈاکٹر ڈیسک (Doctor Desk)",
      viewPrescription: "نسخہ دیکھیں (Rx)",
      startFresh: "نئے سرے سے شروع کریں",
      signOut: "سائن آؤٹ",
      kioskEyebrow: "مریض خود خدمت · کیوسک 01",
      kioskTitle: "آزادانہ کیس ریکارڈنگ اسٹیشن",
      kioskDesc: "مریض اپنی علامات خود بتاتے ہیں اور ڈاکٹر سے ملنے سے پہلے AI انٹرویو مکمل کرتے ہیں۔"
    },
    Sanskrit: {
      patientPortal: "रोगी-द्वारम् (Patient Portal)",
      doctorDesk: "चिकित्सक-पीठम् (Doctor Desk)",
      viewPrescription: "औषधपत्रं पश्यतु (Rx)",
      startFresh: "पुनः आरभ्यताम्",
      signOut: "निर्गमनम्",
      kioskEyebrow: "रोगी स्वसेवा · प्रकोष्ठा ०१",
      kioskTitle: "स्वतन्त्रं लक्षण-संग्रह-केन्द्रम्",
      kioskDesc: "रोगिणः स्वयं लक्षणानि सूचयन्ति, शरीरचित्रे स्थानं प्रदर्शयन्ति, चिकित्सकेन सह मेलनात् पूर्वं AI-संवादं पूरयन्ति।"
    }
  },

  setWebsiteLanguage(lang, showNotification = true) {
    if (!lang) return;
    this.currentLanguage = lang;
    try {
      localStorage.setItem("swasya_language", lang);
    } catch(e) {}

    // Synchronize all dropdowns
    const selects = [
      document.getElementById("global-website-lang-select"),
      document.getElementById("auth-website-lang-select"),
      document.getElementById("kiosk-lang-select-1"),
      document.getElementById("kiosk-lang-select-2")
    ];
    selects.forEach(sel => {
      if (sel && sel.value !== lang) sel.value = lang;
    });

    // Apply translations across all UI components via SwasyaI18n
    if (window.SwasyaI18n) {
      SwasyaI18n.applyLanguage(lang);
    }

    // Synchronize with PatientKiosk
    if (window.PatientKiosk) {
      PatientKiosk.selectedLanguage = lang;
      if (typeof PatientKiosk.renderStep === "function") {
        PatientKiosk.renderStep();
      }
    }

    // Trigger Google Translate for deep DOM translation
    this.triggerGoogleTranslate(lang);

    if (showNotification) {
      const nativeName = (window.PatientKiosk && PatientKiosk.LANG_CONFIG && PatientKiosk.LANG_CONFIG[lang]) ? PatientKiosk.LANG_CONFIG[lang].native : lang;
      this.showToast(`Website language updated to ${nativeName} (${lang})`, "info");
    }
  },

  triggerGoogleTranslate(lang) {
    const codeMap = {
      English: "en", Hindi: "hi", Kannada: "kn", Marathi: "mr", Tamil: "ta",
      Telugu: "te", Bengali: "bn", Gujarati: "gu", Malayalam: "ml", Punjabi: "pa",
      Odia: "or", Assamese: "as", Urdu: "ur", Sanskrit: "sa"
    };
    const code = codeMap[lang] || "en";
    try {
      if (code === "en") {
        document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=" + window.location.hostname + "; path=/;";
      } else {
        document.cookie = `googtrans=/en/${code}; path=/;`;
        document.cookie = `googtrans=/en/${code}; domain=${window.location.hostname}; path=/;`;
      }
      const combo = document.querySelector(".goog-te-combo");
      if (combo) {
        combo.value = code;
        combo.dispatchEvent(new Event("change"));
      }
    } catch(e) {}
  },

  roleLabel(role) {
    return role === "doctor" ? "Doctor" : "Patient";
  },

  applyRoleAccess() {
    const isDoctor = this.currentUser && this.currentUser.role === "doctor";
    const doctorBtn = document.getElementById("btn-doctor-portal");
    if (doctorBtn) {
      doctorBtn.style.display = isDoctor ? "" : "none";
      if (!isDoctor) doctorBtn.classList.remove("active");
    }
    const queueBadge = document.getElementById("doctor-queue-badge");
    if (queueBadge) queueBadge.style.display = "none";
  },

  updateUserBadge() {
    const nameEl = document.getElementById("active-user-name");
    const roleEl = document.getElementById("active-user-role");
    if (this.currentUser) {
      if (nameEl) nameEl.textContent = this.currentUser.full_name || this.currentUser.username;
      if (roleEl) roleEl.textContent = `(${this.roleLabel(this.currentUser.role)})`;
    }
  },

  initModules() {
    if (window.PatientKiosk) PatientKiosk.init();
    if (window.BodySkeleton) BodySkeleton.init();

    if (this.currentUser && this.currentUser.role === "doctor") {
      if (window.DoctorDesk) DoctorDesk.init();
      if (window.OutbreakMap) OutbreakMap.init();
    }

    this.checkAiStatus();
    const landing = (this.currentUser && this.currentUser.role === "doctor") ? "doctor-tab" : "kiosk-tab";
    this.switchTab(landing);
  },

  bindEvents() {
    const tabs = [
      { btnId: "btn-patient-portal", tabId: "kiosk-tab" },
      { btnId: "btn-doctor-portal", tabId: "doctor-tab" },
      { btnId: "btn-nurse-portal", tabId: "nurse-tab" },
      { btnId: "btn-admin-portal", tabId: "admin-tab" },
      { btnId: "btn-map-portal", tabId: "map-tab" }
    ];

    tabs.forEach(t => {
      const btn = document.getElementById(t.btnId);
      if (btn) {
        btn.addEventListener("click", () => this.switchTab(t.tabId));
      }
    });

    const aiSettingsBtn = document.getElementById("open-ai-settings-btn");
    if (aiSettingsBtn) {
      aiSettingsBtn.addEventListener("click", () => this.openAiSettings());
    }
  },

  switchTab(tabId) {
    if (tabId === "doctor-tab" &&
        this.currentUser &&
        this.currentUser.role !== "doctor") {
      tabId = "kiosk-tab";
    }

    this.activeTab = tabId;

    const tabMap = {
      "kiosk-tab": "btn-patient-portal",
      "doctor-tab": "btn-doctor-portal",
      "nurse-tab": "btn-nurse-portal",
      "admin-tab": "btn-admin-portal",
      "map-tab": "btn-map-portal"
    };

    Object.entries(tabMap).forEach(([tId, bId]) => {
      const btn = document.getElementById(bId);
      if (btn) {
        btn.classList.toggle("active", tId === tabId);
      }
    });

    document.querySelectorAll(".tab-panel").forEach(p => {
      p.classList.toggle("active", p.id === tabId);
    });

    if (tabId === "kiosk-tab" && window.PatientKiosk) PatientKiosk.renderStep();
    if (tabId === "doctor-tab" && window.DoctorDesk) DoctorDesk.refresh();
    if (tabId === "nurse-tab" && window.NurseDesk) NurseDesk.refresh();
    if (tabId === "admin-tab" && window.AdminDesk) AdminDesk.refresh();
    if (tabId === "map-tab" && window.OutbreakMap) OutbreakMap.refresh();
  },

  async openAiSettings() {
    const modal = document.getElementById("ai-settings-modal");
    if (!modal) return;
    modal.style.display = "flex";

    try {
      const res = await this.api("/api/auth/settings/api-keys");
      const statusEl = document.getElementById("ai-engine-active-status");
      if (statusEl) {
        statusEl.innerHTML = `<strong>Active AI Engine:</strong> ${res.active_engine}`;
        if (res.has_gemini || res.has_groq) {
          statusEl.style.background = "#f0fdf4";
          statusEl.style.color = "#15803d";
          statusEl.style.borderColor = "#bbf7d0";
        } else {
          statusEl.style.background = "#f8fafc";
          statusEl.style.color = "#475569";
          statusEl.style.borderColor = "#cbd5e1";
        }
      }
      if (res.gemini_masked) {
        document.getElementById("settings-gemini-key").placeholder = `Configured: ${res.gemini_masked}`;
      }
      if (res.groq_masked) {
        document.getElementById("settings-groq-key").placeholder = `Configured: ${res.groq_masked}`;
      }
    } catch(e) {
      console.warn("Could not fetch AI status:", e);
    }
  },

  async saveAiSettings() {
    const geminiKey = document.getElementById("settings-gemini-key").value.trim();
    const groqKey = document.getElementById("settings-groq-key").value.trim();

    try {
      const res = await this.api("/api/auth/settings/api-keys", "POST", {
        gemini_api_key: geminiKey,
        groq_api_key: groqKey
      });
      this.showToast(res.message || "Live AI settings updated!", "success");
      document.getElementById("ai-settings-modal").style.display = "none";
      this.checkAiStatus();
    } catch(e) {
      this.showToast("Error updating settings: " + e.message, "error");
    }
  },

  async checkAiStatus() {
    try {
      const res = await this.api("/api/auth/settings/api-keys");
      const badge = document.getElementById("header-ai-engine-badge");
      if (badge) {
        badge.textContent = res.active_engine;
        if (res.has_gemini || res.has_groq) {
          badge.style.background = "#059669";
          badge.style.color = "#ffffff";
        } else {
          badge.style.background = "#1e293b";
          badge.style.color = "#94a3b8";
        }
      }
    } catch(e) {}
  },

  async api(url, method = "GET", body = null, isFormData = false) {
    const headers = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const options = { method, headers };

    if (body) {
      if (isFormData) {
        options.body = body;
      } else {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try { errorJson = JSON.parse(errorText); } catch(e) {}
      throw new Error((errorJson && errorJson.detail) || (errorJson && errorJson.message) || `Server error (${response.status})`);
    }

    return await response.json();
  },

  showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  },

  async downloadFile(url, defaultFilename = 'Swasya_Medical_Report.pdf') {
    this.showToast("Preparing medical document for download...", "info");
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        a.remove();
      }, 800);
      this.showToast("PDF report downloaded successfully to your computer!", "success");
      return true;
    } catch(err) {
      console.warn("Direct blob download fallback to standard navigation:", err);
      // Fallback: direct anchor with download attribute
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 800);
      return true;
    }
  },

  openWhatsApp(targetUrl, phone = '', text = '', summaryText = '') {
    let cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    let rawText = text || summaryText || '';
    let waUrl = targetUrl;
    let webUrl = '';
    let appUrl = '';

    if (!waUrl) {
      const encoded = encodeURIComponent(rawText);
      waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
      webUrl = cleanPhone ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}` : `https://web.whatsapp.com/send?text=${encoded}`;
      appUrl = cleanPhone ? `whatsapp://send?phone=${cleanPhone}&text=${encoded}` : `whatsapp://send?text=${encoded}`;
    } else {
      webUrl = waUrl.replace('api.whatsapp.com/send', 'web.whatsapp.com/send').replace('wa.me/', 'web.whatsapp.com/send?phone=');
      appUrl = waUrl.replace('https://api.whatsapp.com/send', 'whatsapp://send').replace('https://wa.me/', 'whatsapp://send?phone=');
    }

    // Attempt direct pop-up first
    try {
      window.open(waUrl, '_blank');
    } catch(e) {}

    // Always pop up the dedicated, bulletproof WhatsApp dispatch modal
    const modal = document.getElementById('swasya-whatsapp-modal');
    const body = document.getElementById('swasya-whatsapp-modal-body');
    if (modal && body) {
      modal.style.display = 'flex';
      body.innerHTML = `
        <div style="text-align: left;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
              Target Recipient:
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">+</span>
              <input type="text" id="wa-modal-phone-input" value="${cleanPhone || '91'}" style="padding: 4px 8px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-weight: 700; font-size: 0.88rem; width: 140px;" placeholder="919876543210" oninput="SwasyaApp.updateWhatsAppModalLinks()">
            </div>
          </div>

          <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.85rem; font-family: monospace; font-size: 0.78rem; color: #1e293b; max-height: 200px; overflow-y: auto; white-space: pre-wrap; margin-bottom: 1.25rem; line-height: 1.45;" id="wa-modal-msg-preview">${rawText || 'Official Swasya AI Clinical Consultation Summary & Prescription'}</div>

          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem;">
              <a id="wa-modal-web-btn" href="${webUrl}" target="_blank" class="btn" style="background: #25D366; color: #ffffff; font-weight: 800; padding: 0.7rem 1rem; border-radius: 10px; text-decoration: none; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(37,211,102,0.3);">
                Launch WhatsApp Web
              </a>
              <a id="wa-modal-app-btn" href="${appUrl}" class="btn" style="background: #128C7E; color: #ffffff; font-weight: 800; padding: 0.7rem 1rem; border-radius: 10px; text-decoration: none; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">
                Open WhatsApp App
              </a>
            </div>

            <div style="display: flex; gap: 0.65rem;">
              <button type="button" class="btn btn-secondary" style="flex: 1; font-weight: 700; font-size: 0.85rem;" onclick="navigator.clipboard.writeText(document.getElementById('wa-modal-msg-preview').innerText); SwasyaApp.showToast('Prescription text copied to clipboard!', 'success'); this.textContent = 'Copied!';">
                Copy Message Text
              </button>
              <button type="button" class="btn btn-secondary" style="font-weight: 700; font-size: 0.85rem;" onclick="document.getElementById('swasya-whatsapp-modal').style.display='none'">
                Done
              </button>
            </div>
          </div>
        </div>
      `;
    }

    this.showToast(`WhatsApp modal ready! Click below if not redirected automatically.`, "success");
    return waUrl;
  },

  updateWhatsAppModalLinks() {
    const input = document.getElementById('wa-modal-phone-input');
    const preview = document.getElementById('wa-modal-msg-preview');
    const webBtn = document.getElementById('wa-modal-web-btn');
    const appBtn = document.getElementById('wa-modal-app-btn');
    if (!input || !webBtn || !appBtn) return;

    let phone = input.value.replace(/\D/g, '');
    const text = encodeURIComponent((preview && preview.innerText) || '');
    webBtn.href = phone ? `https://web.whatsapp.com/send?phone=${phone}&text=${text}` : `https://web.whatsapp.com/send?text=${text}`;
    appBtn.href = phone ? `whatsapp://send?phone=${phone}&text=${text}` : `whatsapp://send?text=${text}`;
  },

  async resetSystemFresh(skipConfirm = false) {
    if (!skipConfirm) {
      const ok = confirm("START FRESH CONFIRMATION:\n\nThis will clear all patient records, consultation history, triage queues, uploaded documents, and start the platform fresh from zero.\n\nDo you want to proceed?");
      if (!ok) return;
    }

    this.showToast("Resetting platform and clearing all clinical data...", "info");

    try {
      await fetch('/api/analytics/reset-fresh', { method: 'POST' });
    } catch(e) {
      console.warn("Reset fresh notice:", e);
    }

    // Reset Patient Kiosk
    if (window.PatientKiosk && typeof window.PatientKiosk.resetForNewPatient === 'function') {
      window.PatientKiosk.resetForNewPatient();
    }

    // Reset Skeleton
    if (window.BodySkeleton) {
      window.BodySkeleton.selectedRegions = new Set();
      window.BodySkeleton.analysisResult = null;
      if (typeof window.BodySkeleton.updateSVGHighlights === 'function') {
        window.BodySkeleton.updateSVGHighlights();
      }
      if (typeof window.BodySkeleton.updateSelectedDisplay === 'function') {
        window.BodySkeleton.updateSelectedDisplay();
      }
    }

    // Reset Doctor Desk
    if (window.DoctorDesk) {
      window.DoctorDesk.currentTriage = null;
      window.DoctorDesk.currentPatient = null;
      window.DoctorDesk.lastConsultationId = null;
      if (typeof window.DoctorDesk.refresh === 'function') {
        window.DoctorDesk.refresh();
      }
    }

    // Close all open modals
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');

    // Switch to patient portal Step 1
    this.switchTab('kiosk-tab');
    this.showToast("All content cleared! Platform is completely fresh and ready.", "success");
  }
};

// ============================================================================
// AUTH CONTROLLER: Login, Register, Demo Login, Logout
// ============================================================================
const SwasyaAuth = {
  switchForm(formType) {
    const loginTab = document.getElementById("auth-tab-login");
    const registerTab = document.getElementById("auth-tab-register");
    const loginForm = document.getElementById("auth-login-form");
    const registerForm = document.getElementById("auth-register-form");

    if (formType === "login") {
      loginTab.classList.add("active");
      registerTab.classList.remove("active");
      loginForm.classList.add("active");
      registerForm.classList.remove("active");
    } else {
      registerTab.classList.add("active");
      loginTab.classList.remove("active");
      registerForm.classList.add("active");
      loginForm.classList.remove("active");
    }

    this.clearErrors();
  },

  clearErrors() {
    ["login-error", "register-error"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.display = "none"; el.textContent = ""; }
    });
    const successEl = document.getElementById("register-success");
    if (successEl) { successEl.style.display = "none"; successEl.textContent = ""; }
  },

  showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = "flex";
    }
  },

  showSuccess(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = "flex";
    }
  },

  setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const textEl = btn.querySelector(".auth-btn-text");
    const loaderEl = btn.querySelector(".auth-btn-loader");
    if (loading) {
      btn.disabled = true;
      btn.style.opacity = "0.7";
      if (textEl) textEl.style.display = "none";
      if (loaderEl) loaderEl.style.display = "inline-flex";
    } else {
      btn.disabled = false;
      btn.style.opacity = "1";
      if (textEl) textEl.style.display = "inline";
      if (loaderEl) loaderEl.style.display = "none";
    }
  },

  togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
      input.type = "password";
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    this.clearErrors();

    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    if (!username || !password) {
      this.showError("login-error", "Please enter both username and password.");
      return;
    }

    this.setLoading("login-submit-btn", true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        const rawText = await res.text().catch(() => "");
        throw new Error(rawText || "Server error occurred. Please try again.");
      }

      if (!res.ok) {
        throw new Error(data.detail || "Invalid credentials");
      }

      SwasyaApp.saveSession(data.token, data.user);
      SwasyaApp.showMainApp();
      SwasyaApp.showToast(`Welcome back, ${data.user.full_name}!`, "success");
    } catch (err) {
      this.showError("login-error", err.message || "Login failed. Please check your credentials.");
    } finally {
      this.setLoading("login-submit-btn", false);
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    this.clearErrors();

    const full_name = document.getElementById("reg-fullname").value.trim();
    const username = document.getElementById("reg-username").value.trim();
    const password = document.getElementById("reg-password").value;
    const role = document.getElementById("reg-role").value;
    const phc_center = document.getElementById("reg-phc").value.trim();

    if (!full_name || !username || !password) {
      this.showError("register-error", "Please fill in all required fields.");
      return;
    }

    if (username.length < 3) {
      this.showError("register-error", "Username must be at least 3 characters.");
      return;
    }

    if (password.length < 6) {
      this.showError("register-error", "Password must be at least 6 characters.");
      return;
    }

    this.setLoading("register-submit-btn", true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, full_name, role, phc_center: phc_center || "Primary Health Center" })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        const rawText = await res.text().catch(() => "");
        throw new Error(rawText || "Server error occurred. Please try again.");
      }

      if (!res.ok) {
        throw new Error(data.detail || "Registration failed");
      }

      SwasyaApp.saveSession(data.token, data.user);
      SwasyaApp.showMainApp();
      SwasyaApp.showToast(`Welcome, ${data.user.full_name}! Your account has been created.`, "success");
    } catch (err) {
      this.showError("register-error", err.message || "Registration failed. Please try again.");
    } finally {
      this.setLoading("register-submit-btn", false);
    }
  },


  logout() {
    SwasyaApp.clearSession();

    document.getElementById("login-username").value = "";
    document.getElementById("login-password").value = "";
    this.clearErrors();

    SwasyaApp.showAuthPage();
    SwasyaApp.showToast("Signed out successfully.", "info");
  }
};

window.addEventListener("DOMContentLoaded", () => {
  SwasyaApp.init();
});
