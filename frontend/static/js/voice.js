// Swasya Listen - Real-Time Voice Scribe & Speech-to-Text Controller
const VoiceScribe = {
  recognition: null,
  isRecording: false,
  targetInputId: null,
  currentLanguage: "hi-IN",
  mediaRecorder: null,
  audioChunks: [],

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguage;

      this.recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const targetEl = document.getElementById(this.targetInputId);
        if (targetEl) {
          if (finalTranscript) {
            targetEl.value = (targetEl.value + " " + finalTranscript).trim();
          } else if (interimTranscript) {
            // display interim in a preview label if available
            const previewEl = document.getElementById("voice-interim-preview");
            if (previewEl) previewEl.textContent = interimTranscript;
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.warn("Speech recognition notice:", event.error);
        if (event.error !== "no-speech") {
          SwasyaApp.showToast(`Speech status: ${event.error}`, "warning");
        }
        this.stop();
      };

      this.recognition.onend = () => {
        if (this.isRecording) {
          // Restart if still marked recording
          try { this.recognition.start(); } catch(e) {}
        } else {
          this.updateUI(false);
        }
      };
    }
  },

  toggle(targetInputId, language = "hi-IN") {
    this.targetInputId = targetInputId;
    this.currentLanguage = language;

    if (this.isRecording) {
      this.stop();
    } else {
      this.start();
    }
  },

  start() {
    this.isRecording = true;
    this.updateUI(true);

    if (this.recognition) {
      this.recognition.lang = this.currentLanguage;
      try {
        this.recognition.start();
      } catch (err) {
        console.warn("Recognition already started or error:", err);
      }
    } else {
      SwasyaApp.showToast("Speech recognition initialized in fallback audio mode.", "info");
    }

    // Attempt audio recording
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          this.mediaRecorder = new MediaRecorder(stream);
          this.audioChunks = [];
          this.mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) this.audioChunks.push(e.data);
          };
          this.mediaRecorder.start();
        })
        .catch(err => {
          console.log("Mic media permission note:", err);
        });
    }
  },

  stop() {
    this.isRecording = false;
    this.updateUI(false);

    if (this.recognition) {
      try { this.recognition.stop(); } catch(e) {}
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  },

  updateUI(recording) {
    const micBtns = document.querySelectorAll(".mic-button");
    const scribeBoxes = document.querySelectorAll(".scribe-box");
    const statusText = document.getElementById("voice-status-text");

    micBtns.forEach(btn => btn.classList.toggle("recording", recording));
    scribeBoxes.forEach(box => box.classList.toggle("recording", recording));

    if (statusText) {
      statusText.textContent = recording 
        ? "Listening... Speak in Hindi, English, or regional language" 
        : "Click microphone to start clinical voice dictation";
    }
  },

  insertSampleDictation(targetInputId, sampleType = "dengue") {
    const samples = {
      dengue: "मरीज को 4 दिन से बहुत तेज बुखार आ रहा है, कंपकंपी के साथ। सिर में आंखों के पीछे बहुत तेज दर्द है और जोड़ों में अकड़न है। उल्टी जैसा मन हो रहा है। पेनिसिलिन से एलर्जी है।",
      gastro: "Severe loose motions since morning, 6 episodes. Crampy lower abdominal pain after drinking water from municipal supply. Mild dehydration, no blood in stool.",
      respiratory: "Patient has productive cough with yellowish phlegm for 10 days, accompanied by wheezing and shortness of breath when walking. Known history of diabetes and asthma."
    };

    const target = document.getElementById(targetInputId);
    if (target) {
      target.value = samples[sampleType] || samples.dengue;
      SwasyaApp.showToast("Loaded sample clinical voice transcript", "success");
    }
  }
};

window.VoiceScribe = VoiceScribe;
