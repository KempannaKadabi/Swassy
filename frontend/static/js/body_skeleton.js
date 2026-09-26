/**
 * Swasya AI — Professional Diagnostic Anatomical Body Scanner & Vision AI Disease Detection Console
 * High-Precision Biometric Vector Graphics (Anterior & Posterior Views) + Real-Time Organ Nodes
 * Integrated with Hugging Face & Vision AI for Dermatological / Lesion Analysis
 */

const BodySkeleton = {
  activeView: 'anterior', // 'anterior' or 'posterior'
  selectedRegions: new Set(),
  lastDetectedCondition: null,
  capturedImageFile: null,
  diseasesByRegion: null,   // cached from /api/scribe/regions
  selectedDisease: null,    // {region, id, name}
  analysisResult: null,     // latest /api/scribe/analyze output
  animTimer: null,
  animChapter: 0,

  selectedConditions: [],
  REGION_DISEASES: {
    head: {
      en: 'Head', hi: 'सिर', kn: 'ತಲೆ', mr: 'डोके', ta: 'தலை', te: 'తల', bn: 'মাথা', gu: 'માથું', ml: 'തല', pa: 'ਸਿਰ', or: 'ମୁଣ୍ଡ', as: 'মূৰ', ur: 'سر', sa: 'शिरः',
      conditions: [
        'Migraine', 'Tension Headache', 'Cluster Headache', 'Sinusitis', 
        'Concussion', 'Vertigo / Dizziness', 'Meningitis', 'Brain Tumor',
        'Stroke / TIA', 'Epilepsy / Seizures', "Bell's Palsy", 
        'Trigeminal Neuralgia', 'Encephalitis', 'Hydrocephalus',
        'Temporal Arteritis', 'Post-Concussion Syndrome'
      ]
    },
    throat: {
      en: 'Throat', hi: 'गला', kn: 'ಗಂಟಲು', mr: 'घसा', ta: 'தொண்டை', te: 'గొంతు', bn: 'গলা', gu: 'ગળું', ml: 'തൊണ്ട', pa: 'ਗਲਾ', or: 'ଗଳା', as: 'ডিঙি', ur: 'گلا', sa: 'कण्ठः',
      conditions: [
        'Pharyngitis / Sore Throat', 'Tonsillitis', 'Laryngitis', 'Thyroid Disorders',
        'Goiter', 'Cervical Spondylosis', 'Neck Strain / Whiplash', 'Lymphadenopathy',
        'Esophageal Reflux', 'Dysphagia (Swallowing Difficulty)', 'Cervical Disc Herniation',
        'Torticollis', 'Parotitis / Mumps', 'Epiglottitis'
      ]
    },
    chest: {
      en: 'Chest', hi: 'छाती', kn: 'ಎದೆ', mr: 'छाती', ta: 'மார்பு', te: 'ఛాతీ', bn: 'বুক', gu: 'છાતી', ml: 'നെഞ്ച്', pa: 'ਛਾਤੀ', or: 'ଛାତି', as: 'বুকু', ur: 'سینہ', sa: 'वक्षःस्थल',
      conditions: [
        'Acute Coronary Syndrome (Heart Attack)', 'Angina Pectoris', 'Bronchitis',
        'Pneumonia', 'Asthma', 'COPD', 'Pleurisy', 'Pulmonary Embolism',
        'Heart Failure', 'Pericarditis', 'Costochondritis', 'Tuberculosis',
        'Pneumothorax', 'Bronchiectasis', 'Lung Cancer', 'Myocarditis',
        'Aortic Dissection', 'Intercostal Neuralgia'
      ]
    },
    upper_abdomen: {
      en: 'Upper Abdomen', hi: 'ऊपरी पेट', kn: 'ಮೇಲ್ಹೊಟ್ಟೆ', mr: 'वरचे पोट', ta: 'மேல் வயிறு', te: 'పై కడుపు', bn: 'উচ্চ পেট', gu: 'ઉપરનું પેટ', ml: 'മേൽവയർ', pa: 'ਉੱਪਰਲਾ ਪੇਟ', or: 'ଉପର ପେଟ', as: 'ওপৰৰ পেট', ur: 'اوپری پیٹ', sa: 'ऊर्ध्वोदरम्',
      conditions: [
        'Gastritis', 'GERD / Acid Reflux', 'Peptic Ulcer', 'Gallstones / Cholecystitis',
        'Pancreatitis', 'Hepatitis', 'Liver Cirrhosis', 'Fatty Liver Disease',
        'Gastric Cancer', 'Hiatal Hernia', 'Duodenitis', 'Splenic Disorders',
        'Gastroparesis', 'Celiac Disease', 'H. pylori Infection'
      ]
    },
    lower_abdomen: {
      en: 'Lower Abdomen', hi: 'निचला पेट', kn: 'ಕೆಳಹೊಟ್ಟೆ', mr: 'खालचे पोट', ta: 'அடிவயிறு', te: 'కటి కడుపు', bn: 'নিম্ন পেট', gu: 'નીચલું પેટ', ml: 'അടിവയർ', pa: 'ਹੇਠਲਾ ਪੇਟ', or: 'ତଳ ପେଟ', as: 'তলৰ পেট', ur: 'نچلا پیٹ', sa: 'अधोदरम्',
      conditions: [
        'Appendicitis', 'Irritable Bowel Syndrome (IBS)', 'Urinary Tract Infection (UTI)',
        'Kidney Stones', 'Hernia (Inguinal/Umbilical)', 'Inflammatory Bowel Disease',
        'Diverticulitis', 'Ovarian Cyst', 'Endometriosis', 'Pelvic Inflammatory Disease',
        'Colorectal Cancer', 'Intestinal Obstruction', "Crohn's Disease",
        'Ulcerative Colitis', 'Prostate Disorders', 'Bladder Infection'
      ]
    },
    arms: {
      en: 'Arms', hi: 'भुजाएं', kn: 'ತೋಳುಗಳು', mr: 'हात', ta: 'கைகள்', te: 'చేతులు', bn: 'বাহু', gu: 'હાથ', ml: 'കൈകൾ', pa: 'ਬਾਹਾਂ', or: 'ବାହୁ', as: 'হাত', ur: 'بازو', sa: 'बाहुः',
      conditions: [
        'Frozen Shoulder', 'Rotator Cuff Injury', 'Tennis Elbow (Lateral Epicondylitis)',
        "Golfer's Elbow (Medial Epicondylitis)", 'Carpal Tunnel Syndrome',
        'Bursitis', 'Tendinitis', 'Fracture', 'Dislocated Shoulder',
        'Bicep Tendon Tear', 'Peripheral Neuropathy', 'Cellulitis',
        'Deep Vein Thrombosis', 'Ganglion Cyst', 'Cubital Tunnel Syndrome'
      ]
    },
    hands: {
      en: 'Hands', hi: 'हाथ', kn: 'ಕೈಗಳು', mr: 'हात', ta: 'கைகள்', te: 'చేతులు', bn: 'হাত', gu: 'હાથ', ml: 'കൈകൾ', pa: 'ਹੱਥ', or: 'ହାତ', as: 'হাত', ur: 'ہاتھ', sa: 'हस्तः',
      conditions: [
        'Carpal Tunnel Syndrome', 'Trigger Finger', "De Quervain's Tenosynovitis",
        'Rheumatoid Arthritis', 'Osteoarthritis', 'Ganglion Cyst',
        "Dupuytren's Contracture", 'Hand Fracture', "Raynaud's Disease",
        'Psoriatic Arthritis', 'Tendon Injury', 'Scaphoid Fracture',
        'Mallet Finger', 'Hand Infection / Paronychia'
      ]
    },
    upper_back: {
      en: 'Upper Back', hi: 'ऊपरी पीठ', kn: 'ಮೇಲ್ಬೆನ್ನು', mr: 'पाठीचा वरचा भाग', ta: 'மேல் முதுகு', te: 'పై వీపు', bn: 'পিঠের উপরিভাগ', gu: 'પીઠનો ઉપરનો ભાગ', ml: 'മേൽഭാഗം', pa: 'ਉੱਪਰਲੀ ਪਿੱਠ', or: 'ଉପର ପିଠି', as: 'পিঠিৰ ওপৰৰ অংশ', ur: 'اوپری کمر', sa: 'पृष्ठभागः',
      conditions: [
        'Thoracic Spondylosis', 'Muscle Strain / Spasm', 'Kyphosis',
        'Thoracic Disc Herniation', 'Osteoporotic Vertebral Fracture',
        'Ankylosing Spondylitis', 'Costochondritis', 'Shingles (Herpes Zoster)',
        'Fibromyalgia', 'Spinal Stenosis', 'Scoliosis', 'Referred Heart Pain',
        'Myofascial Pain Syndrome', 'Thoracic Outlet Syndrome'
      ]
    },
    lower_back: {
      en: 'Lower Back', hi: 'निचली पीठ', kn: 'ಕೆಳಬೆನ್ನು', mr: 'पाठीचा खालचा भाग', ta: 'கீழ் முதுகு', te: 'దిగువ వీపు', bn: 'কোমর', gu: 'કમર', ml: 'നട്ടെല്ല്', pa: 'ਹੇਠਲੀ ਪਿੱਠ', or: 'ଅଣ୍ଟା', as: 'কঁকাল', ur: 'نچلی کمر', sa: 'कटिः',
      conditions: [
        'Lumbar Disc Herniation (Slipped Disc)', 'Sciatica', 'Lumbar Spondylosis',
        'Spinal Stenosis', 'Muscle Strain / Sprain', 'Kidney Infection (Pyelonephritis)',
        'Kidney Stones', 'Sacroiliac Joint Dysfunction', 'Ankylosing Spondylitis',
        'Degenerative Disc Disease', 'Spondylolisthesis', 'Cauda Equina Syndrome',
        'Vertebral Compression Fracture', 'Piriformis Syndrome', 'Facet Joint Arthropathy'
      ]
    },
    legs: {
      en: 'Legs', hi: 'पैर', kn: 'ಕಾಲುಗಳು', mr: 'पाय', ta: 'கால்கள்', te: 'కాళ్ళు', bn: 'পা', gu: 'પગ', ml: 'കാലുകൾ', pa: 'ਲੱਤਾਂ', or: 'ଗୋଡ଼', as: 'ঠেং', ur: 'ٹانگیں', sa: 'जङ्घे',
      conditions: [
        'Deep Vein Thrombosis (DVT)', 'Peripheral Artery Disease', 'Sciatica',
        'Muscle Strain / Tear', 'Shin Splints', 'Varicose Veins',
        'Femoral Fracture', 'Hip Bursitis', 'Hip Osteoarthritis',
        'Compartment Syndrome', 'Peripheral Neuropathy', 'Restless Leg Syndrome',
        'Cellulitis', 'Stress Fracture', 'Hamstring Injury'
      ]
    },
    knees: {
      en: 'Knees', hi: 'घुटने', kn: 'ಮೊಣಕಾಲುಗಳು', mr: 'गुडघे', ta: 'முழங்கால்கள்', te: 'మోకాళ్ళు', bn: 'হাঁটু', gu: 'ઢીંચણ', ml: 'മുട്ടുകൾ', pa: 'ਗੋਡੇ', or: 'ଆଣ୍ଠୁ', as: 'আঁঠু', ur: 'گھٹنے', sa: 'जानुनी',
      conditions: [
        'Osteoarthritis', 'Rheumatoid Arthritis', 'Meniscus Tear',
        'ACL / PCL Ligament Tear', "Patellar Tendinitis (Jumper's Knee)",
        'Bursitis', "Baker's Cyst", 'Gout', 'Chondromalacia Patella',
        'IT Band Syndrome', 'Osgood-Schlatter Disease', 'Knee Fracture',
        'Knee Dislocation', 'Plica Syndrome', 'Tibial Plateau Fracture'
      ]
    },
    feet: {
      en: 'Feet', hi: 'पंजे', kn: 'ಪಾದಗಳು', mr: 'पावले', ta: 'பாதங்கள்', te: 'పాదాలు', bn: 'পায়ের পাতা', gu: 'પગના પંજા', ml: 'പാദങ്ങൾ', pa: 'ਪੈਰ', or: 'ପାଦ', as: 'তলুৱা', ur: 'پاؤں', sa: 'पादौ',
      conditions: [
        'Plantar Fasciitis', 'Achilles Tendinitis', 'Ankle Sprain',
        'Stress Fracture', 'Bunion (Hallux Valgus)', 'Gout',
        "Morton's Neuroma", 'Diabetic Foot Ulcer', 'Flat Feet (Pes Planus)',
        'Heel Spur', 'Tarsal Tunnel Syndrome', 'Ankle Fracture',
        'Peripheral Neuropathy', "Athlete's Foot (Tinea Pedis)",
        'Ingrown Toenail', 'Metatarsalgia'
      ]
    }
  },

  showDiseasePopup(regionId) {
    const langCode = (window.PatientKiosk && PatientKiosk.getCurrentLangCode) ? PatientKiosk.getCurrentLangCode() : 'en';
    const regionData = this.REGION_DISEASES[regionId];
    if (!regionData) return;
    const regionName = regionData[langCode] || regionData.en || regionId;
    const conditions = regionData.conditions || [];

    const modal = document.createElement('div');
    modal.id = 'disease-popup-modal';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 9999;';
    
    const conditionsHtml = conditions.map(cond => `
      <label style="display: block; padding: 8px; border-bottom: 1px solid rgba(46,125,50,0.2); cursor: pointer; color: #1e5f3a;">
        <input type="checkbox" class="disease-checkbox" value="${cond}" style="margin-right: 8px;"> ${cond}
      </label>
    `).join('');

    modal.innerHTML = `
      <div style="background: #e8f5e9; padding: 20px; border-radius: 12px; width: 400px; max-width: 90%; max-height: 80vh; display: flex; flex-direction: column; border: 2px solid #2e7d32; box-shadow: 0 4px 20px rgba(46,125,50,0.4);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3 style="margin: 0; color: #2e7d32; font-weight: 800;">${regionName} Conditions</h3>
          <button onclick="document.getElementById('disease-popup-modal').remove()" style="background: none; border: none; font-size: 1.2rem; color: #1e5f3a; cursor: pointer;">✕</button>
        </div>
        <input type="text" id="disease-search" placeholder="Search conditions..." style="padding: 8px; margin-bottom: 15px; border: 1px solid #81c784; border-radius: 6px; width: 100%; box-sizing: border-box;" onkeyup="
          const filter = this.value.toLowerCase();
          const labels = document.querySelectorAll('#disease-list label');
          labels.forEach(label => {
            if (label.innerText.toLowerCase().includes(filter)) {
              label.style.display = 'block';
            } else {
              label.style.display = 'none';
            }
          });
        ">
        <div id="disease-list" style="overflow-y: auto; flex-grow: 1; background: #ffffff; border: 1px solid #81c784; border-radius: 6px; padding: 5px;">
          ${conditionsHtml}
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
          <button onclick="document.getElementById('disease-popup-modal').remove()" style="padding: 8px 15px; border: none; background: #c8e6c9; color: #2e7d32; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancel</button>
          <button onclick="BodySkeleton.confirmDiseases('${regionId}')" style="padding: 8px 15px; border: none; background: #2e7d32; color: #ffffff; border-radius: 6px; cursor: pointer; font-weight: 600;">Confirm Selection</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  confirmDiseases(regionId) {
    const checkboxes = document.querySelectorAll('.disease-checkbox:checked');
    checkboxes.forEach(cb => {
      this.selectedConditions.push({ region: regionId, condition: cb.value });
    });
    document.getElementById('disease-popup-modal').remove();
    if(window.SwasyaApp) {
      SwasyaApp.showToast(`Selected ${checkboxes.length} conditions for ${regionId}`, "success");
    }
  },

  // Fallback region -> candidate condition knowledge (keeps the scanner fully
  // functional even if the backend knowledge API is unreachable).
  FALLBACK_REGION_DISEASES: {
    head: ["migraine", "dengue"],
    throat: ["bronchitis", "dengue"],
    chest: ["acs", "bronchitis", "gerd"],
    upper_abdomen: ["gerd", "gastroenteritis"],
    lower_abdomen: ["gastroenteritis"],
    arms: ["radiculopathy", "acs"],
    hands: ["radiculopathy"],
    upper_back: ["radiculopathy", "bronchitis"],
    lower_back: ["radiculopathy"],
    legs: ["radiculopathy"],
    knees: ["radiculopathy"],
    feet: ["radiculopathy", "dengue"]
  },
  FALLBACK_DISEASES: {
    acs: "Acute Coronary Syndrome / Angina",
    bronchitis: "Acute Bronchitis / Respiratory Infection",
    dengue: "Dengue / Febrile Illness",
    gastroenteritis: "Acute Gastroenteritis / Enteric Infection",
    gerd: "Acid Peptic Disease / GERD",
    migraine: "Migraine / Vascular Headache",
    radiculopathy: "Lumbar Radiculopathy / Sciatica"
  },

  // Multi-lingual anatomical region translations (14 Indian Languages)
  REGION_TRANSLATIONS: {
    head: { en: "Head & Cranium", hi: "सिर और खोपड़ी", kn: "ತಲೆ ಮತ್ತು ಕಪಾಲ", mr: "डोके आणि कवटी", ta: "தலை மற்றும் மண்டை ஓடு", te: "తల మరియు పుర్రె", bn: "মাথা ও করোটি", gu: "માથું અને ખોપરી", ml: "തലയും തലയോട്ടിയും", pa: "ਸਿਰ ਅਤੇ ਖੋਪੜੀ", or: "ମୁଣ୍ଡ ଏବଂ ଖପୁରୀ", as: "মূৰ আৰু খুলি", ur: "سر اور کھوپڑی", sa: "शिरः कपालं च" },
    throat: { en: "Throat & Neck", hi: "गला और गर्दन", kn: "ಗಂಟಲು ಮತ್ತು ಕುತ್ತಿಗೆ", mr: "घसा आणि मान", ta: "தொண்டை மற்றும் கழுத்து", te: "గొంతు మరియు మెడ", bn: "গলা ও ঘাড়", gu: "ગળું અને ગરદન", ml: "തൊണ്ടയും കഴുത്തും", pa: "ਗਲਾ ਅਤੇ ਗਰਦਨ", or: "ଗଳା ଏବଂ ବେକ", as: "ডিঙি আৰু ডিঙি", ur: "گلا اور گردن", sa: "कण्ठः ग्रीवा च" },
    chest: { en: "Chest & Heart/Lungs", hi: "छाती (हृदय व फेफड़े)", kn: "ಎದೆ (ಹೃದಯ ಮತ್ತು ಶ್ವಾಸಕೋಶ)", mr: "छाती (हृदय व फुफ्फुसे)", ta: "மார்பு (இதயம் மற்றும் நுரையீரல்)", te: "ఛాతీ (గుండె మరియు ఊపిరితిత్తులు)", bn: "বুক (হৃৎপিণ্ড ও ফুসফুস)", gu: "છાતી (હૃદય અને ફેફસાં)", ml: "നെഞ്ച് (ഹൃദയവും ശ്വാസകോശവും)", pa: "ਛਾਤੀ (ਦਿਲ ਅਤੇ ਫੇਫੜੇ)", or: "ଛାତି (ହୃଦୟ ଏବଂ ଫୁସଫୁସ)", as: "বুকু (হৃদযন্ত্ৰ আৰু হাওঁফাওঁ)", ur: "سینہ (دل اور پھیپھڑے)", sa: "वक्षःस्थलं हृदयम् च" },
    upper_abdomen: { en: "Upper Stomach (Acidity/Liver)", hi: "ऊपरी पेट (एसिडिटी/लिवर)", kn: "ಮೇಲ್ಹೊಟ್ಟೆ (ಉರಿ/ಯಕೃತ್ತು)", mr: "वरचे पोट (पित्त/यकृत)", ta: "மேல் வயிறு (அமிலத்தன்மை)", te: "పై కడుపు (ఎసిడిటీ)", bn: "উচ্চ পেট (অম্লতা)", gu: "ઉપરનું પેટ (એસિડિટી)", ml: "മേൽവയർ (അസിഡിറ്റി)", pa: "ਉੱਪਰਲਾ ਪੇਟ (ਐਸਿਡਿਟੀ)", or: "ଉପର ପେଟ (ଏସିଡିଟି)", as: "ওপৰৰ পেট", ur: "اوپری پیٹ", sa: "ऊर्ध्वोदरम्" },
    lower_abdomen: { en: "Lower Abdomen & Bowel", hi: "निचला पेट व आंत", kn: "ಕೆಳಹೊಟ್ಟೆ ಮತ್ತು ಕರುಳು", mr: "खालचे पोट आणि आतडे", ta: "அடிவயிறு மற்றும் குடல்", te: "కటి కడుపు మరియు ప్రేగు", bn: "নিম্ন পেট ও অন্ত্র", gu: "નીચલું પેટ અને આંતરડું", ml: "അടിവയറും കുടലും", pa: "ਹੇਠਲਾ ਪੇਟ ਅਤੇ ਅੰਤੜੀਆਂ", or: "ତଳ ପେଟ ଏବଂ ଅନ୍ତନଳୀ", as: "তলৰ পেট", ur: "نچلا پیٹ اور آنتیں", sa: "अधोदरम्" },
    arms: { en: "Arms & Elbows", hi: "भुजाएं और कोहनी", kn: "ತೋಳುಗಳು ಮತ್ತು ಮೊಣಕೈ", mr: "हात आणि कोपर", ta: "கைகள் மற்றும் முழங்கைகள்", te: "చేతులు మరియు మోచేతులు", bn: "বাহু ও কনুই", gu: "હાથ અને કોણી", ml: "കൈകളും കൈമുട്ടുകളും", pa: "ਬਾਹਾਂ ਅਤੇ ਕੂਹਣੀਆਂ", or: "ବାହୁ ଏବଂ କହୁଣୀ", as: "হাত আৰু কিলাকুটি", ur: "بازو اور کہنی", sa: "बाहुः कूर्परम् च" },
    hands: { en: "Hands, Wrists & Fingers", hi: "हाथ, कलाई और उंगलियां", kn: "ಕೈಗಳು, ಮಣಿಕಟ್ಟು ಮತ್ತು ಬೆರಳುಗಳು", mr: "हात, मनगट आणि बोटे", ta: "கைகள், மணிக்கட்டுகள்", te: "చేతులు, మణికట్టు", bn: "হাত, কব্জি ও আঙুল", gu: "હાથ, કાંડા અને આંગળીઓ", ml: "കൈകൾ, കൈത്തണ്ട", pa: "ਹੱਥ, ਗੁੱਟ ਅਤੇ ਉਂਗਲਾਂ", or: "ହାତ, ମଣିବନ୍ଧ", as: "হাত আৰু আঙুলি", ur: "ہاتھ، کلائیاں اور انگلیاں", sa: "हस्तः मणिकण्ठः च" },
    upper_back: { en: "Upper Back & Shoulders", hi: "ऊपरी पीठ और कंधे", kn: "ಮೇಲ್ಬೆನ್ನು ಮತ್ತು ಹೆಗಲು", mr: "पाठीचा वरचा भाग आणि खांदे", ta: "மேல் முதுகு மற்றும் தோள்கள்", te: "పై వీపు మరియు భుజాలు", bn: "পিঠের উপরিভাগ ও কাঁধ", gu: "પીઠનો ઉપરનો ભાગ અને ખભા", ml: "മേൽഭാഗവും തോളുകളും", pa: "ਉੱਪਰਲੀ ਪਿੱਠ ਅਤੇ ਮੋਢੇ", or: "ଉପର ପିଠି ଏବଂ କାନ୍ଧ", as: "পিঠিৰ ওপৰৰ অংশ", ur: "اوپری کمر اور کندھے", sa: "पृष्ठभागः स्कन्धौ च" },
    lower_back: { en: "Lower Back & Spine", hi: "निचली पीठ और रीढ़", kn: "ಕೆಳಬೆನ್ನು ಮತ್ತು ಬೆನ್ನುಮೂಳೆ", mr: "पाठीचा खालचा भाग आणि कणा", ta: "கீழ் முதுகு மற்றும் முதுகெலும்பு", te: "దిగువ వీపు మరియు వెన్నెముక", bn: "কোমর ও মেরুদণ্ড", gu: "કમર અને કરોડરજ્જુ", ml: "നട്ടെല്ലും അരക്കെട്ടും", pa: "ਹੇਠਲੀ ਪਿੱਠ ਅਤੇ ਰੀੜ੍ਹ", or: "ଅଣ୍ଟା ଏବଂ ମେରୁଦଣ୍ଡ", as: "কঁকাল আৰু মেৰুদণ্ড", ur: "نچلی کمر اور ریڑھ کی ہڈی", sa: "कटिः मेरुदण्डः च" },
    legs: { en: "Thighs & Legs", hi: "जांघें और पैर", kn: "ತೊಡೆಗಳು ಮತ್ತು ಕಾಲುಗಳು", mr: "मांडी आणि पाय", ta: "தொடைகள் மற்றும் கால்கள்", te: "తొడలు మరియు కాళ్ళు", bn: "উরু ও পা", gu: "જાંઘ અને પગ", ml: "തുടകളും കാലുകളും", pa: "ਪੱਟ ਅਤੇ ਲੱਤਾਂ", or: "ଜଙ୍ଘ ଏବଂ ଗୋଡ଼", as: "উৰু আৰু ঠেং", ur: "رانیں اور ٹانگیں", sa: "ऊरू जङ्घे च" },
    knees: { en: "Knees & Joints", hi: "घुटने और जोड़", kn: "ಮೊಣಕಾಲುಗಳು ಮತ್ತು ಕೀಲುಗಳು", mr: "गुडघे आणि सांधे", ta: "முழங்கால்கள் மற்றும் மூட்டுகள்", te: "మోకాళ్ళు మరియు కీళ్ళు", bn: "হাঁটু ও জয়েন্ট", gu: "ઢીંચણ અને સાંધા", ml: "മുട്ടുകളും സന്ധികളും", pa: "ਗੋਡੇ ਅਤੇ ਜੋੜ", or: "ଆଣ୍ଠୁ ଏବଂ ଗଣ୍ଠି", as: "আঁঠু আৰু গাঁঠি", ur: "گھٹنے اور جوڑ", sa: "जानुनी सन्धयः च" },
    feet: { en: "Ankles & Feet", hi: "टखने और पंजे", kn: "ಹಿಮ್ಮಡಿ ಮತ್ತು ಪಾದಗಳು", mr: "घोट्या आणि पावले", ta: "கணுக்கால் மற்றும் பாதங்கள்", te: "చీలమండలు మరియు పాదాలు", bn: "গোড়ালি ও পায়ের পাতা", gu: "ઘૂંટી અને પગના પંજા", ml: "കണങ്കാലുകളും പാദങ്ങളും", pa: "ਗਿੱਟੇ ਅਤੇ ਪੈਰ", or: "ଗୋଡ଼ ଗଣ୍ଠି ଏବଂ ପାଦ", as: "ভৰিৰ গাঁঠি আৰু তলুৱা", ur: "ٹخنے اور پاؤں", sa: "गुल्फौ पादौ च" }
  },

  init() {
    this.loadRegionMeta();
    this.bindEvents();
  },

  switchView(view) {
    this.activeView = view;
    document.querySelectorAll('.skeleton-view-tab').forEach((el) => {
        const v = el.getAttribute('data-view') || (el.textContent.toLowerCase().includes('front') ? 'anterior' : 'posterior');
        if (v === view) {
            el.classList.add('active');
            el.style.background = '#2e7d32';
            el.style.borderColor = '#4ade80';
        } else {
            el.classList.remove('active');
            el.style.background = 'transparent';
            el.style.borderColor = '#334155';
        }
    });

    const frontOverlay = document.getElementById('muscular-hotspots-front');
    const backOverlay = document.getElementById('muscular-hotspots-back');
    const imgEl = document.getElementById('muscular-anatomy-image');

    if (view === 'posterior') {
      if (frontOverlay) frontOverlay.style.display = 'none';
      if (backOverlay) backOverlay.style.display = 'block';
      if (imgEl) imgEl.style.objectPosition = 'right 15%';
    } else {
      if (frontOverlay) frontOverlay.style.display = 'block';
      if (backOverlay) backOverlay.style.display = 'none';
      if (imgEl) imgEl.style.objectPosition = 'left center';
    }

    this.updateSVGHighlights();
  },

  toggleRegion(regionId) {
    if (this.selectedRegions.has(regionId)) {
      this.selectedRegions.delete(regionId);
    } else {
      this.selectedRegions.add(regionId);
    }

    const isSelected = this.selectedRegions.has(regionId);
    const title = this.getRegionTitle(regionId);
    if (window.SwasyaApp && SwasyaApp.showToast) {
      SwasyaApp.showToast(
        isSelected ? `${title}: Area mapped to intake` : `${title}: Removed from intake`,
        isSelected ? 'success' : 'info'
      );
    }

    this.updateSVGHighlights();
    this.updateSelectedDisplay();

    // Auto-sync location dropdown in camera disease detection panel
    const selEl = document.getElementById('lesion-body-location');
    if (selEl) {
      selEl.value = regionId;
    }

    // Refresh the deep-analysis panel fed by the patient's own tapping.
    this.renderRegionDiseasePanel();
  },

  clearSelection() {
    this.selectedRegions.clear();
    this.updateSVGHighlights();
    this.updateSelectedDisplay();
  },

  updateSVGHighlights() {
    document.querySelectorAll('.skel-region').forEach(el => {
      const regId = el.getAttribute('data-region');
      if (this.selectedRegions.has(regId)) {
        el.classList.add('active-selected');
      } else {
        el.classList.remove('active-selected');
      }
    });

    document.querySelectorAll('.organ-node').forEach(node => {
      const regId = node.getAttribute('data-region');
      if (this.selectedRegions.has(regId)) {
        node.classList.add('active-selected');
      } else {
        node.classList.remove('active-selected');
      }
    });
  },

  getRegionTitle(regionId) {
    const langCode = (window.PatientKiosk && PatientKiosk.getCurrentLangCode) ? PatientKiosk.getCurrentLangCode() : 'en';
    const profile = this.REGION_TRANSLATIONS[regionId];
    if (!profile) return regionId.toUpperCase();
    return profile[langCode] || profile.en || regionId;
  },

  updateSelectedDisplay() {
    const container = document.getElementById('skeleton-selected-chips');
    const countEl = document.getElementById('skeleton-selected-count');
    const applyBtn = document.getElementById('btn-apply-skeleton-complaint');

    if (countEl) countEl.textContent = this.selectedRegions.size;

    if (!container) return;

    if (this.selectedRegions.size === 0) {
      container.innerHTML = `<span style="color: #64748b; font-size: 0.8rem; font-style: italic;">Tap on any anatomical area or organ node on the scanner to highlight symptom location.</span>`;
      if (applyBtn) applyBtn.disabled = true;
      return;
    }

    if (applyBtn) applyBtn.disabled = false;

    container.innerHTML = Array.from(this.selectedRegions).map(regId => {
      const title = this.getRegionTitle(regId);
      return `
        <span class="region-chip active" style="display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #2e7d32, #166534); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; margin: 3px; box-shadow: 0 2px 6px rgba(46, 125, 50,0.35);">
          ${title}
          <button type="button" onclick="BodySkeleton.toggleRegion('${regId}')" style="background: none; border: none; color: #fff; cursor: pointer; font-size: 0.85rem; margin-left: 4px; padding: 0 2px;">✕</button>
        </span>
      `;
    }).join('');
  },

  applySelectedToComplaint() {
    if (this.selectedRegions.size === 0) return;

    const titles = Array.from(this.selectedRegions).map(r => this.getRegionTitle(r));
    const complaintSummary = `Pain, discomfort, or symptoms localized in: ${titles.join(', ')}`;

    if (window.PatientKiosk) {
      PatientKiosk.selectBodyPart(titles.join(' & '), complaintSummary);
      SwasyaApp.showToast(`Anatomical locations added to clinical consultation`, "success");
    }
  },

  // ------------------------------------------------------------------
  // Deep Analysis Panel: region -> disease driven by the patient's taps
  // ------------------------------------------------------------------
  loadRegionMeta() {
    if (!this.diseasesByRegion) {
      // Instant synchronous pre-population from built-in knowledge base (0ms load time)
      this.diseasesByRegion = {};
      Object.keys(this.FALLBACK_REGION_DISEASES).forEach(rid => {
        const dList = this.FALLBACK_REGION_DISEASES[rid] || [];
        this.diseasesByRegion[rid] = dList.map(id => ({
          id,
          name: this.FALLBACK_DISEASES[id] || id,
          region: rid,
          systems: []
        }));
      });
    }

    // Background asynchronous sync without blocking UI
    fetch('/api/scribe/regions')
      .then(r => r.json())
      .then(data => {
        if (data && data.success && Array.isArray(data.regions)) {
          data.regions.forEach(r => {
            this.diseasesByRegion[r.id] = r.diseases.map(d => ({
              id: d.id,
              name: d.name,
              region: r.id,
              systems: r.systems || []
            }));
          });
        }
      })
      .catch(() => {});
    return this.diseasesByRegion;
  },

  getRegionDiseases(regionId) {
    if (this.diseasesByRegion && this.diseasesByRegion[regionId]) {
      return this.diseasesByRegion[regionId];
    }
    const ids = this.FALLBACK_REGION_DISEASES[regionId] || [];
    return ids.map(id => ({ id, name: this.FALLBACK_DISEASES[id] || id, region: regionId, systems: [] }));
  },

  renderRegionDiseasePanel() {
    const host = document.getElementById('region-disease-panel');
    if (!host) return;

    if (this.selectedRegions.size === 0) {
      host.innerHTML = `
        <div class="rpd-empty" style="text-align: center; padding: 2rem 1rem;">
          <div style="font-size: 1.8rem; color: #4ade80; margin-bottom: 0.5rem; font-weight: 900;">+</div>
          <strong style="color: #f8fafc; font-size: 1rem;">Targeted Body-Map Intake</strong>
          <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.5rem; line-height: 1.4;">
            Tap on the anatomical muscular map where you feel pain or discomfort. The AI clinical intake will tailor its questions directly to your selected areas.
          </p>
        </div>`;
      return;
    }

    const chips = Array.from(this.selectedRegions).map(r => {
      const label = this.getRegionTitle(r);
      return `<button type="button" class="rpd-region-chip" onclick="BodySkeleton.toggleRegion('${r}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; background: #1b4332; border: 1px solid #2d6a4f; color: #86efac; font-size: 0.8rem; font-weight: 700; cursor: pointer; margin: 3px;">${label} <span style="color: #f87171; font-weight: 900;">✕</span></button>`;
    }).join('');

    const regionSummary = Array.from(this.selectedRegions).map(r => this.getRegionTitle(r)).join(', ');

    host.innerHTML = `
      <div class="rpd-head" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
        <div style="font-weight: 800; font-size: 0.95rem; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px #4ade80;"></span>
          Selected Pain Locations
        </div>
        <span class="rpd-count" style="font-size: 0.8rem; font-weight: 700; color: #86efac; background: rgba(46, 125, 50, 0.25); padding: 2px 8px; border-radius: 12px; border: 1px solid #2e7d32;">
          ${this.selectedRegions.size} area${this.selectedRegions.size > 1 ? 's' : ''}
        </span>
      </div>

      <div class="rpd-chips" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap;">${chips}</div>

      <div style="background: rgba(46, 125, 50, 0.12); border: 1px solid rgba(74, 222, 128, 0.25); border-radius: 10px; padding: 12px; margin-bottom: 1.2rem;">
        <div style="font-weight: 800; font-size: 0.88rem; color: #86efac; margin-bottom: 4px;">Clinical Intake Direction</div>
        <p style="color: #cbd5e1; font-size: 0.82rem; margin: 0; line-height: 1.45;">
          Our AI medical intake assistant will begin inquiring directly about your symptoms in <strong>${regionSummary}</strong>, evaluating pain onset, radiation, severity, and functional impact.
        </p>
      </div>

      <button type="button" class="btn rpd-cta" id="btn-start-guided" onclick="BodySkeleton.startGuidedInterview()" style="width: 100%; background: #2e7d32; color: #ffffff; padding: 12px; border-radius: 10px; font-weight: 800; font-size: 0.95rem; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(46, 125, 50, 0.4);">
        Proceed to AI Clinical Interview
      </button>

      <p class="rpd-note" style="color: #64748b; font-size: 0.75rem; margin-top: 0.8rem; text-align: center;">No prior diagnosis required. Symptom identification occurs during the guided interview.</p>
    `;
  },

  selectDisease(diseaseId) {
    if (this.selectedDisease && this.selectedDisease.id === diseaseId) {
      this.selectedDisease = null;
    } else {
      this.selectedDisease = { id: diseaseId, name: this.FALLBACK_DISEASES[diseaseId] || diseaseId };
      if (window.PatientKiosk) PatientKiosk.setSelectedDisease(diseaseId);
    }
    this.renderRegionDiseasePanel();
    this.updateSVGHighlights();
    SwasyaApp.showToast(this.selectedDisease
      ? `Considering "${this.selectedDisease.name}" in your analysis`
      : "Disease selection cleared", "success");
  },

  startGuidedInterview() {
    if (window.PatientKiosk) {
      PatientKiosk.startInterviewWithRegions(Array.from(this.selectedRegions));
    } else {
      SwasyaApp.showToast("Patient intake screen not active", "warning");
    }
  },

  // ------------------------------------------------------------------
  // Animated Explanation ("video") after the interview completes
  // ------------------------------------------------------------------
  buildAnimSkeletonSVG(view, analysis) {
    // Compact, anatomically accurate skeleton used for the explanation video.
    return this.activeView === 'posterior' ? this.posteriorSVG() : this.anteriorSVG();
  },

  // Localized chrome strings for the explanation player so its headings,
  // buttons and narration follow the language picked by the patient in Step 1.
  animUI(lang) {
    const H = {
      English: {
        chapter: 'Chapter', condition: 'Condition identified', mechanism: 'How it works in your body',
        happened: 'What has happened in your body', timeline: 'Step-by-step timeline',
        watch: 'Watch out for these signs', recovery: 'Recovery & next steps',
        replay: 'Replay in English', cont: 'Continue → Records & review'
      },
      Hindi: {
        chapter: 'अध्याय', condition: 'बीमारी की पहचान', mechanism: 'यह आपके शरीर में कैसे होता है',
        happened: 'आपके शरीर में क्या हुआ है', timeline: 'चरण-दर-चरण समयरेखा',
        watch: 'इन संकेतों पर ध्यान दें', recovery: 'ठीक होना और अगले कदम',
        replay: 'हिंदी में दोबारा सुनें', cont: 'आगे बढ़ें → रिकॉर्ड व समीक्षा'
      },
      Kannada: {
        chapter: 'ಅಧ್ಯಾಯ', condition: 'ಕಾಯಿಲೆ ಗುರುತಿಸಲಾಗಿದೆ', mechanism: 'ನಿಮ್ಮ ದೇಹದಲ್ಲಿ ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ',
        happened: 'ನಿಮ್ಮ ದೇಹದಲ್ಲಿ ಏನು ಸಂಭವಿಸಿದೆ', timeline: 'ಹಂತ-ಹಂತದ ಸಮಯರೇಖೆ',
        watch: 'ಈ ಚಿಹ್ನೆಗಳ ಬಗ್ಗೆ ಗಮನಿಸಿ', recovery: 'ಗುಣಮುಖ ಮತ್ತು ಮುಂದಿನ ಹಂತಗಳು',
        replay: 'ಕನ್ನಡದಲ್ಲಿ ಮತ್ತೆ ಕೇಳಿ', cont: 'ಮುಂದುವರಿಸಿ → ದಾಖಲೆಗಳು ಮತ್ತು ಪರಿಶೀಲನೆ'
      },
      Marathi: {
        chapter: 'अध्याय', condition: 'आजार ओळखला गेला', mechanism: 'ते तुमच्या शरीरात कसे कार्य करते',
        happened: 'तुमच्या शरीरात काय झाले', timeline: 'टप्प्याटप्प्याने होणारे बदल',
        watch: 'या लक्षणांकडे लक्ष द्या', recovery: 'बरे होणे आणि पुढील पावले',
        replay: 'मराठीत पुन्हा ऐका', cont: 'पुढे जा → नोंदी आणि पुनरावलोकन'
      },
      Tamil: {
        chapter: 'அத்தியாயம்', condition: 'கண்டறியப்பட்ட நிலை', mechanism: 'உங்கள் உடலில் இது எவ்வாறு செயல்படுகிறது',
        happened: 'உங்கள் உடலில் என்ன நடந்துள்ளது', timeline: 'படிப்படியான காலவரிசை',
        watch: 'இந்த அறிகுறிகளைக் கவனியுங்கள்', recovery: 'குணமடைதல் & அடுத்த படிகள்',
        replay: 'தமிழில் மீண்டும் கேளுங்கள்', cont: 'தொடரவும் → பதிவுகள் & மதிப்பாய்வு'
      },
      Telugu: {
        chapter: 'అధ్యాయం', condition: 'గుర్తించబడిన పరిస్థితి', mechanism: 'మీ శరీరంలో ఇది ఎలా పనిచేస్తుంది',
        happened: 'మీ శరీరంలో ఏమి జరిగింది', timeline: 'దశలవారీ సమయక్రమం',
        watch: 'ఈ సంకేతాలను గమనించండి', recovery: 'కోలుకోవడం & తదుపరి దశలు',
        replay: 'తెలుగులో మళ్లీ వినండి', cont: 'కొనసాగించండి → రికార్డులు & సమీక్ష'
      },
      Bengali: {
        chapter: 'অধ্যায়', condition: 'চিহ্নিত অবস্থা', mechanism: 'এটি আপনার শরীরে কীভাবে কাজ করে',
        happened: 'আপনার শরীরে কী ঘটেছে', timeline: 'ধাপে ধাপে সময়রেখা',
        watch: 'এই লক্ষণগুলির দিকে নজর রাখুন', recovery: 'সুস্থ হওয়া এবং পরবর্তী পদক্ষেপ',
        replay: 'বাংলায় আবার শুনুন', cont: 'এগিয়ে যান → রেকর্ড ও পর্যালোচনা'
      },
      Gujarati: {
        chapter: 'પ્રકરણ', condition: 'ઓળખાયેલ સ્થિતિ', mechanism: 'તે તમારા શરીરમાં કેવી રીતે કાર્ય કરે છે',
        happened: 'તમારા શરીરમાં શું બન્યું છે', timeline: 'પગલાવાર સમયરેખા',
        watch: 'આ ચિહ્નો પર ધ્યાન આપો', recovery: 'સ્વસ્થ થવું અને આગળના પગલાં',
        replay: 'ગુજરાતીમાં ફરી સાંભળો', cont: 'આગળ વધો → રેકોર્ડ અને સમીક્ષા'
      },
      Malayalam: {
        chapter: 'അധ്യായം', condition: 'തിരിച്ചറിഞ്ഞ അവസ്ഥ', mechanism: 'ഇത് നിങ്ങളുടെ ശരീരത്തിൽ എങ്ങനെ പ്രവർത്തിക്കുന്നു',
        happened: 'നിങ്ങളുടെ ശരീരത്തിൽ എന്ത് സംഭവിച്ചു', timeline: 'ഘട്ടം ഘട്ടമായുള്ള സമയക്രമം',
        watch: 'ഈ ലക്ഷണങ്ങൾ ശ്രദ്ധിക്കുക', recovery: 'രോഗമുക്തിയും അടുത്ത ഘട്ടങ്ങളും',
        replay: 'മലയാളത്തിൽ വീണ്ടും കേൾക്കുക', cont: 'തുടരുക → രേഖകളും അവലോകനവും'
      },
      Punjabi: {
        chapter: 'ਅਧਿਆਇ', condition: 'ਪਛਾਣੀ ਗਈ ਸਥਿਤੀ', mechanism: 'ਇਹ ਤੁਹਾਡੇ ਸਰੀਰ ਵਿੱਚ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ',
        happened: 'ਤੁਹਾਡੇ ਸਰੀਰ ਵਿੱਚ ਕੀ ਹੋਇਆ ਹੈ', timeline: 'ਕਦਮ-ਦਰ-ਕਦਮ ਸਮਾਂ-ਰੇਖਾ',
        watch: 'ਇਹਨਾਂ ਸੰਕੇਤਾਂ ਵੱਲ ਧਿਆਨ ਦਿਓ', recovery: 'ਸਿਹਤਯਾਬੀ ਅਤੇ ਅਗਲੇ ਕਦਮ',
        replay: 'ਪੰਜਾਬੀ ਵਿੱਚ ਦੁਬਾਰਾ ਸੁਣੋ', cont: 'ਅੱਗੇ ਵਧੋ → ਰਿਕਾਰਡ ਅਤੇ ਸਮੀਖਿਆ'
      },
      Odia: {
        chapter: 'ଅଧ୍ୟାୟ', condition: 'ଚିହ୍ନଟ ହୋଇଥିବା ରୋଗ', mechanism: 'ଏହା ଆପଣଙ୍କ ଶରୀରରେ କିପରି କାମ କରେ',
        happened: 'ଆପଣଙ୍କ ଶରୀରରେ କ’ଣ ଘଟିଛି', timeline: 'ପର୍ଯ୍ୟାୟକ୍ରମିକ ସମୟସାରଣୀ',
        watch: 'ଏହି ଲକ୍ଷଣଗୁଡ଼ିକ ପ୍ରତି ଧ୍ୟାନ ଦିଅନ୍ତୁ', recovery: 'ଆରୋଗ୍ୟ ଏବଂ ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ',
        replay: 'ଓଡ଼ିଆରେ ପୁଣି ଶୁଣନ୍ତୁ', cont: 'ଆଗକୁ ବଢ଼ନ୍ତୁ → ରେକର୍ଡ ଏବଂ ସମୀକ୍ଷା'
      },
      Assamese: {
        chapter: 'অধ্যায়', condition: 'চিনাক্ত কৰা অৱস্থা', mechanism: 'ই আপোনাৰ শৰীৰত কেনেদৰে কাম কৰে',
        happened: 'আপোনাৰ শৰীৰত কি হৈছে', timeline: 'স্তৰে স্তৰে সময়ৰেখা',
        watch: 'এই লক্ষণসমূহৰ প্ৰতি লক্ষ্য ৰাখক', recovery: 'আৰোগ্য আৰু পৰৱৰ্তী পদক্ষেপ',
        replay: 'অসমীয়াত পুনৰ শুনক', cont: 'আগবাঢ়ক → নথিপত্ৰ আৰু পৰ্যালোচনা'
      },
      Urdu: {
        chapter: 'باب', condition: 'تشخیص شدہ کیفیت', mechanism: 'یہ آپ کے جسم میں کیسے اثر کرتا ہے',
        happened: 'آپ کے جسم میں کیا ہوا ہے', timeline: 'مرحلہ وار ٹائم لائن',
        watch: 'ان علامات پر نظر رکھیں', recovery: 'صحت یابی اور اگلے اقدامات',
        replay: 'اردو میں دوبارہ سنیں', cont: 'آگے بڑھیں → ریکارڈز اور جائزہ'
      },
      Sanskrit: {
        chapter: 'अध्यायः', condition: 'निर्णीता विकृतिः', mechanism: 'इदं शरीरे कथं प्रवर्तते',
        happened: 'भवतः शरीरे किं जातम्', timeline: 'क्रमशः समयरेखा',
        watch: 'एतेषां लक्षणानां विषये सावधानता', recovery: 'स्वास्थ्यलाभः अग्रिमसोपानानि च',
        replay: 'संस्कृतेन पुनः शृणोतु', cont: 'अग्रे गच्छतु → अभिलेखाः समीक्षा च'
      }
    };
    return H[lang] || H.English;
  },

  animScreenHTML(analysis) {
    const anim = analysis.animation || {};
    const isBack = anim.body_view === 'posterior';
    const site = anim.site || (isBack ? [120, 250] : [126, 132]);
    const color = anim.color || '#ef4444';
    const pulseLabel = anim.pulse_label || (this.selectedDisease ? this.selectedDisease.name : 'Affected area');
    const region = anim.region;
    const regionLabel = region ? this.getRegionTitle(region) : 'Body area';
    const organLabel = anim.organ_label || regionLabel;
    const lang = (window.PatientKiosk && PatientKiosk.selectedLanguage) || 'English';
    const U = this.animUI(lang);

    const chapters = [
      { label: U.condition, timeline: false },
      { label: U.mechanism, timeline: false },
      { label: U.happened, timeline: false },
      { label: U.timeline, timeline: true },
      { label: U.watch, timeline: false },
      { label: U.recovery, timeline: false }
    ];

    return `
    <div class="anim-stage" data-view="${isBack ? 'posterior' : 'anterior'}">
      <div class="anim-stage-top">
        <div class="anim-heading">
          <span class="anim-live-dot"></span>
          PATIENT ANATOMY EXPLANATION
        </div>
        <div class="anim-view-toggle">
          <button type="button" class="${isBack ? '' : 'active'}" onclick="BodySkeleton.animFlipView('anterior')">FRONT</button>
          <button type="button" class="${isBack ? 'active' : ''}" onclick="BodySkeleton.animFlipView('posterior')">BACK</button>
        </div>
      </div>

      <div class="anim-body">
        <div class="anim-skeleton-frame">
          <div class="anim-scan-beam"></div>
          <div class="anim-skeleton">
            ${isBack ? this.posteriorSVG() : this.anteriorSVG()}
            <div class="anim-organ-marker" style="left:${site[0]}px;top:${site[1]}px;--organ-color:${color}"></div>
          </div>
          <div class="anim-tag">${regionLabel} · ${organLabel}</div>
        </div>

        <div class="anim-script">
          <div class="anim-script-head">
            <div class="anim-progress"><i></i></div>
            <span class="anim-chapter-label">${U.chapter} <b>1</b> / 6</span>
          </div>
          <div class="anim-chapters">
            ${chapters.map((c, i) => `
              <div class="anim-chapter ${c.timeline ? 'anim-chapter-timeline' : ''}" data-ch="${i}">
                <h4><span>${i + 1}</span> ${c.label}</h4>
                ${c.timeline ? '<ol class="anim-timeline"></ol>' : `<p id="anim-ch${i}-text"></p>`}
              </div>
            `).join('')}
          </div>
          <div class="anim-cta-row">
            <button type="button" class="btn anim-play-btn" onclick="BodySkeleton.animPlay()">${U.replay}</button>
            <button type="button" class="btn btn-primary anim-next-btn" onclick="BodySkeleton.animFinish()">${U.cont}</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  animPlay() {
    const data = this.analysisResult;
    if (!data) return;
    const deep = data.deep || {};
    const stages = Array.isArray(deep.stages) ? deep.stages : [];
    const lang = (window.PatientKiosk && PatientKiosk.selectedLanguage) || 'English';
    const U = this.animUI(lang);
    const total = 6;
    const scripts = [
      data.condition_localized || data.primary_condition,
      deep.mechanism || data.what_happened,
      data.what_happened,
      '',
      deep.watch_for || data.recommended_action,
      ((deep.recovery ? deep.recovery + ' ' : '') + (data.recommended_action || '')).trim()
    ];
    const stage = document.querySelector('.anim-stage .anim-script');
    const chapters = stage ? stage.querySelectorAll('.anim-chapter') : [];
    let ch = 0;

    const step = () => {
      chapters.forEach((c, i) => c.classList.toggle('active', i === ch));
      const progress = stage.querySelector('.anim-progress i');
      if (progress) progress.style.width = ((ch + 1) / total * 100) + '%';
      const label = stage.querySelector('.anim-chapter-label');
      if (label) label.innerHTML = `${U.chapter} <b>${ch + 1}</b> / ${total}`;
      const pulse = document.querySelector('.anim-organ-marker');
      if (pulse) {
        pulse.style.animation = 'none';
        void pulse.offsetWidth;
        pulse.style.animation = '';
      }
      const chapEl = chapters[ch];
      let speechText = scripts[ch] || '';
      if (ch === 3 && chapEl) {
        const tl = chapEl.querySelector('.anim-timeline');
        if (tl) {
          if (stages.length) {
            tl.innerHTML = stages.map((s, i) => `
              <li><b>${i + 1}</b><span><strong>${s.title || ''}</strong>${s.desc ? `<em>${s.desc}</em>` : ''}</span></li>
            `).join('');
          } else {
            tl.innerHTML = `<li class="anim-tl-empty">${deep.mechanism || data.what_happened || ''}</li>`;
          }
          speechText = stages.length ? stages.map(s => s.title).join('. ') : (deep.mechanism || data.what_happened);
        }
      } else if (chapEl) {
        const txt = chapEl.querySelector('p');
        if (txt) txt.textContent = scripts[ch] || '';
      }
      this.speakChapter(speechText || '');
      if (ch < total - 1) { ch++; this.animTimer = setTimeout(step, 9500); }
      else { this.animTimer = null; this.animChapter = total - 1; }
    };

    clearTimeout(this.animTimer);
    this.animChapter = 0;
    step();
  },

  speakChapter(text) {
    if (!text) return;
    // Narrate in the patient's chosen language (same as the chatbot voice).
    if (window.PatientKiosk && PatientKiosk.speakText) PatientKiosk.speakText(text);
    else if (window.SwasyaApp && SwasyaApp.speak) SwasyaApp.speak(text);
  },

  animFlipView(view) {
    this.activeViewBackup = this.activeView;
    this.activeView = view;
    const stage = document.querySelector('.anim-stage');
    if (!stage) return;
    const anim = this.analysisResult && this.analysisResult.animation;
    if (!anim) return;
    const isBack = view === 'posterior';
    stage.setAttribute('data-view', view);
    const btnL = stage.querySelectorAll('.anim-view-toggle button');
    btnL.forEach(b => b.classList.toggle('active', b.textContent.trim().toLowerCase() === view));
    const frame = stage.querySelector('.anim-skeleton');
    if (frame) frame.innerHTML = (isBack ? this.posteriorSVG() : this.anteriorSVG()) +
      `<div class="anim-organ-marker" style="left:${anim.site[0]}px;top:${anim.site[1]}px;--organ-color:${anim.color}"></div>`;
    this.activeView = this.activeViewBackup;
    this.activeViewBackup = null;
  },

  animFinish() {
    clearTimeout(this.animTimer);
    if (window.PatientKiosk) PatientKiosk.finishExplanation();
  },

  cameraStream: null,
  cameraFacingMode: 'user', // laptop/device default

  async openLiveCamera() {
    const modal = document.getElementById('live-camera-modal');
    const video = document.getElementById('live-camera-video');
    const errEl = document.getElementById('live-camera-error');
    if (errEl) errEl.style.display = 'none';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      SwasyaApp.showToast("Direct webcam access not supported in this browser. Opening file upload.", "warning");
      document.getElementById('lesion-photo-input')?.click();
      return;
    }

    if (modal) modal.style.display = 'flex';

    try {
      this.closeLiveCameraTracks();
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: this.cameraFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (e1) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      this.cameraStream = stream;
      if (video) {
        video.srcObject = stream;
        video.play().catch(e => console.warn("Camera video play error:", e));
      }
      SwasyaApp.showToast("Laptop camera active. Position lesion or face in frame.", "info");
    } catch (err) {
      console.error("Camera access error:", err);
      if (errEl) {
        errEl.textContent = "Could not access device camera: " + (err.message || "Permission denied or webcam not detected. Please allow camera permissions in your browser bar.");
        errEl.style.display = 'block';
      }
      SwasyaApp.showToast("Camera access error: " + (err.message || "Permission denied"), "error");
    }
  },

  async switchLiveCameraFacing() {
    this.cameraFacingMode = this.cameraFacingMode === 'user' ? 'environment' : 'user';
    await this.openLiveCamera();
  },

  closeLiveCameraTracks() {
    if (this.cameraStream) {
      try {
        this.cameraStream.getTracks().forEach(track => track.stop());
      } catch(e) {}
      this.cameraStream = null;
    }
    const video = document.getElementById('live-camera-video');
    if (video) video.srcObject = null;
  },

  closeLiveCamera() {
    this.closeLiveCameraTracks();
    const modal = document.getElementById('live-camera-modal');
    if (modal) modal.style.display = 'none';
  },

  captureLivePhoto() {
    const video = document.getElementById('live-camera-video');
    if (!video || !this.cameraStream) {
      SwasyaApp.showToast("No active camera video feed to capture.", "error");
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    this.closeLiveCamera();

    canvas.toBlob((blob) => {
      if (!blob) {
        SwasyaApp.showToast("Failed to process captured image.", "error");
        return;
      }
      const file = new File([blob], `device_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      this.capturedImageFile = file;

      const previewImg = document.getElementById('lesion-preview-img');
      const previewBox = document.getElementById('lesion-preview-box');
      const detectBtn = document.getElementById('btn-run-disease-detect');

      if (previewImg) previewImg.src = canvas.toDataURL('image/jpeg');
      if (previewBox) previewBox.style.display = 'block';
      if (detectBtn) detectBtn.disabled = false;

      SwasyaApp.showToast("Photo captured from laptop camera! Click 'Run AI Disease Detection'.", "success");
    }, 'image/jpeg', 0.92);
  },

  // Manual Camera / Photo Capture & Disease Detection
  handlePhotoSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    this.capturedImageFile = file;
    const previewImg = document.getElementById('lesion-preview-img');
    const previewBox = document.getElementById('lesion-preview-box');
    const detectBtn = document.getElementById('btn-run-disease-detect');

    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg) previewImg.src = e.target.result;
      if (previewBox) previewBox.style.display = 'block';
      if (detectBtn) detectBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  },

  async runDiseaseDetection() {
    if (!this.capturedImageFile) {
      SwasyaApp.showToast("Please capture or select a lesion photo first.", "warning");
      return;
    }

    const locationSelect = document.getElementById('lesion-body-location');
    const bodyLoc = locationSelect ? locationSelect.value : 'general';
    const statusBox = document.getElementById('detection-status-box');
    const resultBox = document.getElementById('detection-result-card');
    const detectBtn = document.getElementById('btn-run-disease-detect');

    if (statusBox) statusBox.style.display = 'block';
    if (resultBox) resultBox.style.display = 'none';
    if (detectBtn) detectBtn.disabled = true;

    const formData = new FormData();
    formData.append('file', this.capturedImageFile);
    formData.append('body_location', bodyLoc);
    if (window.PatientKiosk && PatientKiosk.patientData && PatientKiosk.patientData.id) {
      formData.append('patient_id', PatientKiosk.patientData.id);
    }
    if (window.PatientKiosk && PatientKiosk.createdTriageId) {
      formData.append('triage_id', PatientKiosk.createdTriageId);
    }

    try {
      const res = await SwasyaApp.api('/api/disease/detect', 'POST', formData, true);
      if (statusBox) statusBox.style.display = 'none';
      if (detectBtn) detectBtn.disabled = false;

      if (res && res.success && res.analysis) {
        this.lastDetectedCondition = res.analysis;
        this.renderDetectionResult(res.analysis, res.image_url);
        SwasyaApp.showToast(`AI Vision Analysis: ${res.analysis.primary_condition}`, "success");
      }
    } catch(err) {
      if (statusBox) statusBox.style.display = 'none';
      if (detectBtn) detectBtn.disabled = false;
      SwasyaApp.showToast("Disease detection notice: " + (err.message || err), "error");
    }
  },

  renderDetectionResult(analysis, imageUrl) {
    const resultBox = document.getElementById('detection-result-card');
    if (!resultBox) return;

    const isBodyPart = analysis.is_body_part !== false;
    const isCrit = analysis.severity === 'critical';
    const isHigh = analysis.severity === 'high';
    const isNormal = analysis.severity === 'normal' || (analysis.primary_condition && analysis.primary_condition.toLowerCase().includes('normal'));
    
    let severityColor = '#2e7d32';
    let severityBg = 'rgba(46, 125, 50, 0.12)';
    if (!isBodyPart) {
      severityColor = '#f59e0b';
      severityBg = 'rgba(245, 158, 11, 0.12)';
    } else if (isCrit) {
      severityColor = '#ef4444';
      severityBg = 'rgba(239, 68, 68, 0.12)';
    } else if (isHigh) {
      severityColor = '#f59e0b';
      severityBg = 'rgba(245, 158, 11, 0.12)';
    } else if (isNormal) {
      severityColor = '#10b981';
      severityBg = 'rgba(16, 185, 129, 0.12)';
    }

    const confidencePct = typeof analysis.confidence_pct === 'number' ? analysis.confidence_pct : 85;
    const meterGradient = confidencePct >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : (confidencePct >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)');

    // Automatically highlight detected anatomical region on skeleton map
    if (isBodyPart && analysis.body_location_key && analysis.body_location_key !== 'general') {
      try {
        this.selectedRegions.clear();
        this.selectedRegions.add(analysis.body_location_key);
        this.updateSVGHighlights();
        this.updateSelectedDisplay();
        const sel = document.getElementById('lesion-body-location');
        if (sel) sel.value = analysis.body_location_key;
      } catch(e) {}
    }

    resultBox.style.display = 'block';

    if (!isBodyPart) {
      // Non-anatomical / non-clinical image warning
      resultBox.innerHTML = `
        <div style="background: ${severityBg}; border: 1.5px solid ${severityColor}; border-radius: 12px; padding: 1.15rem; margin-top: 0.85rem; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
            <span style="font-size: 0.72rem; font-weight: 900; text-transform: uppercase; color: #f59e0b; background: #0f172a; padding: 3px 10px; border-radius: 20px; border: 1px solid #f59e0b;">
              ⚠️ UNRECOGNIZED / NON-ANATOMICAL IMAGE
            </span>
            <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">
              Confidence: 0.0%
            </span>
          </div>

          <h4 style="margin: 0 0 6px 0; color: #fcd34d; font-size: 1.05rem; font-weight: 800;">
            ${analysis.primary_condition || 'Non-Anatomical Specimen'}
          </h4>
          <div style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.4; margin-bottom: 0.85rem;">
            ${analysis.clinical_features && analysis.clinical_features.length ? analysis.clinical_features.join('. ') : 'The image does not appear to show a recognizable human anatomical region or dermatological skin lesion.'}
          </div>

          <div style="background: rgba(30, 41, 59, 0.85); padding: 0.75rem; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 0.85rem;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #fbbf24; margin-bottom: 2px;">Guidance for Accurate Analysis:</div>
            <div style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.4;">
              ${analysis.recommended_action || 'Please capture a clear, well-focused close-up photograph of the affected body part or skin lesion under bright lighting.'}
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-secondary" style="flex: 1; font-weight: 800; font-size: 0.88rem; padding: 0.65rem 1rem;" onclick="BodySkeleton.openLiveCamera()">
              📸 Retake Photo with Camera
            </button>
            <button type="button" class="btn btn-outline-light" style="font-weight: 700; font-size: 0.85rem; padding: 0.65rem 1rem;" onclick="document.getElementById('lesion-photo-input').click()">
              Upload Different Image
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Valid human anatomical body part / clinical lesion report
    const detectedPartName = analysis.detected_body_part || analysis.body_location || 'Body Area';

    resultBox.innerHTML = `
      <div style="background: ${severityBg}; border: 1.5px solid ${severityColor}; border-radius: 12px; padding: 1.15rem; margin-top: 0.85rem; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
        <!-- Top Status Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
          <span style="font-size: 0.72rem; font-weight: 900; text-transform: uppercase; color: ${severityColor}; background: #0f172a; padding: 3px 10px; border-radius: 20px; border: 1px solid ${severityColor}; letter-spacing: 0.5px;">
            ● TRIAGE: ${analysis.severity.toUpperCase()}
          </span>
          <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">
            Engine: ${analysis.source || 'Vision AI Model'}
          </span>
        </div>

        <!-- Condition Title -->
        <h4 style="margin: 0 0 4px 0; color: #ffffff; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.3px;">
          ${analysis.primary_condition}
        </h4>

        <!-- Recognized Anatomical Location Badge -->
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.75rem; flex-wrap: wrap;">
          <span style="font-size: 0.78rem; color: #94a3b8;">Recognized Body Part:</span>
          <span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #6ee7b7; padding: 2px 9px; border-radius: 6px; font-weight: 800; font-size: 0.82rem;">
            📍 ${detectedPartName}
          </span>
          ${analysis.body_location && analysis.body_location !== detectedPartName ? `
            <span style="font-size: 0.75rem; color: #64748b;">(Region: ${analysis.body_location})</span>
          ` : ''}
        </div>

        <!-- Confidence Visual Meter -->
        <div style="margin-bottom: 0.85rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">
            <span>AI Diagnostic Confidence Match:</span>
            <span style="color: ${confidencePct >= 80 ? '#34d399' : (confidencePct >= 50 ? '#fbbf24' : '#ef4444')}; font-weight: 900;">${confidencePct}%</span>
          </div>
          <div style="width: 100%; height: 7px; background: #1e293b; border-radius: 10px; overflow: hidden; border: 1px solid #334155;">
            <div style="width: ${confidencePct}%; height: 100%; background: ${meterGradient}; border-radius: 10px; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);"></div>
          </div>
        </div>

        <!-- Clinical Features -->
        <div style="background: rgba(10, 25, 18, 0.6); padding: 0.75rem; border-radius: 8px; border: 1px solid #334155; margin-bottom: 0.85rem;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #66bb6a; text-transform: uppercase; margin-bottom: 4px;">Clinical Morphology & Observed Features:</div>
          <div style="font-size: 0.82rem; color: #e2e8f0; line-height: 1.4;">
            ${analysis.clinical_features && analysis.clinical_features.length ? analysis.clinical_features.join(' • ') : 'Skin surface features consistent with anatomical landmarks and pigmentation.'}
          </div>
        </div>

        <!-- Differential Diagnoses -->
        ${analysis.differentials && analysis.differentials.length > 0 ? `
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 8px; padding: 0.65rem 0.85rem; margin-bottom: 0.85rem;">
          <div style="font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px;">Differential Diagnoses Evaluated:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${analysis.differentials.map(d => `
              <span style="background: #1e293b; color: #cbd5e1; font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; border: 1px solid #475569;">
                ${d.condition}: <strong style="color: #66bb6a;">${d.probability}</strong>
              </span>
            `).join('')}
          </div>
        </div>` : ''}

        <!-- Action Recommendation -->
        <div style="background: rgba(30, 41, 59, 0.8); padding: 0.75rem; border-radius: 8px; border-left: 4px solid #66bb6a; margin-bottom: 1rem;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #66bb6a; margin-bottom: 2px;"> Recommended Clinical Protocol:</div>
          <div style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.4;">
            ${analysis.recommended_action || 'Present to attending medical officer for dermoscopic review and targeted prescription.'}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-primary" style="flex: 1; font-weight: 800; font-size: 0.88rem; padding: 0.65rem 1rem;" onclick="BodySkeleton.applyDiseaseToConsultation()">
            Apply Detected Condition & Proceed to Intake →
          </button>
        </div>

        <div style="font-size: 0.68rem; color: #64748b; text-align: center; margin-top: 0.65rem; font-style: italic;">
          ${analysis.disclaimer || 'AI advisory draft only — requires physician verification.'}
        </div>
      </div>
    `;
  },

  applyDiseaseToConsultation() {
    if (!this.lastDetectedCondition) return;

    const cond = this.lastDetectedCondition.primary_condition;
    const loc = this.lastDetectedCondition.detected_body_part || this.lastDetectedCondition.body_location || 'Body Area';
    const conf = this.lastDetectedCondition.confidence_pct;
    const complaintText = `Clinical exam of ${loc}: ${cond} (${conf}% AI match).`;

    if (window.PatientKiosk) {
      PatientKiosk.collectedComplaint = complaintText;
      PatientKiosk.sendAnswer(complaintText, 'PHOTO_AI');
      SwasyaApp.showToast(`Photo detection applied to clinical case: ${loc}`, "success");
    }
  },



  anteriorSVG() {
    return `<svg id="skeleton-svg-anterior" viewBox="0 0 240 440" style="width: 240px; height: 410px; cursor: pointer; ${this.activeView === 'anterior' ? 'display:block;' : 'display:none;'}">
                    <defs>
                      <radialGradient id="boneShade" cx="40%" cy="40%" r="60%">
                        <stop offset="0%" stop-color="#f8fafc"/>
                        <stop offset="70%" stop-color="#e2e8f0"/>
                        <stop offset="100%" stop-color="#cbd5e1"/>
                      </radialGradient>
                      <filter id="boneGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.5"/>
                      </filter>
                    </defs>
    
                    <!-- Anatomical Human Outline (Faint Guide) -->
                    <path d="M120 18 C102 18 90 32 90 52 C90 68 98 78 105 84 L96 94 C76 100 64 116 58 140 L46 220 C44 234 50 242 56 240 L66 172 L76 162 L76 220 C76 238 86 252 98 258 L86 358 C82 388 88 412 102 418 L114 418 C118 402 116 350 118 290 L122 290 C124 350 122 402 126 418 L138 418 C152 412 158 388 154 358 L142 258 C154 252 164 238 164 220 L164 162 L174 172 L184 240 C190 242 196 234 194 220 L182 140 C176 116 164 100 144 94 L135 84 C142 78 150 68 150 52 C150 32 138 18 120 18 Z" fill="#06170d" stroke="#14532d" stroke-width="1.2" opacity="0.8"/>
    
                    <!-- ================= BONE STRUCTURES: ANTERIOR ================= -->
                    <!-- 1. CRANIUM / SKULL -->
                    <g class="bone-group" id="bone-cranium" filter="url(#boneGlow)">
                      <!-- Cranial Vault (Frontal & Parietal Dome) -->
                      <path class="bone-structure" d="M102 44 C100 24 140 24 138 44 C138 52 135 58 132 60 L131 65 C129 69 111 69 109 65 L108 60 C105 58 102 52 102 44 Z"/>
                      <!-- Eye Orbits -->
                      <ellipse cx="113" cy="44" rx="4.8" ry="5.2" fill="#0a1a10" stroke="#94a3b8" stroke-width="0.8"/>
                      <ellipse cx="127" cy="44" rx="4.8" ry="5.2" fill="#0a1a10" stroke="#94a3b8" stroke-width="0.8"/>
                      <!-- Nasal Aperture (Pyriform) -->
                      <path d="M120 49 L117.5 56 L122.5 56 Z" fill="#0a1a10" stroke="#94a3b8" stroke-width="0.6"/>
                      <!-- Zygomatic Arches -->
                      <path class="bone-line" d="M104 48 C108 52 110 52 112 50"/>
                      <path class="bone-line" d="M136 48 C132 52 130 52 128 50"/>
                      <!-- Maxilla & Teeth -->
                      <path d="M113 59 Q120 61 127 59" stroke="#94a3b8" stroke-width="0.8" fill="none"/>
                      <!-- Mandible (Lower Jaw) -->
                      <path class="bone-structure" d="M109 61 C109 66 114 68 120 68 C126 68 131 66 131 61 L129 60 Q120 62 111 60 Z"/>
                    </g>
    
                    <!-- 2. CERVICAL VERTEBRAE (C1-C7) -->
                    <g class="bone-group" id="bone-cervical">
                      <rect class="bone-structure" x="117" y="70" width="6" height="2.5" rx="1"/>
                      <rect class="bone-structure" x="116.5" y="73.5" width="7" height="2.5" rx="1"/>
                      <rect class="bone-structure" x="116" y="77" width="8" height="2.8" rx="1"/>
                      <rect class="bone-structure" x="115.5" y="80.8" width="9" height="2.8" rx="1"/>
                      <rect class="bone-structure" x="115" y="84.6" width="10" height="3" rx="1"/>
                    </g>
    
                    <!-- 3. CLAVICLES & THORACIC CAGE (RIBS & STERNUM) -->
                    <g class="bone-group" id="bone-thorax" filter="url(#boneGlow)">
                      <!-- Clavicles (S-curve Collar Bones) -->
                      <path d="M115 90 C106 87 92 92 78 94" fill="none" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
                      <path d="M125 90 C134 87 148 92 162 94" fill="none" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
    
                      <!-- Sternum: Manubrium, Body, Xiphoid -->
                      <path class="bone-structure" d="M115 89 L125 89 L123 98 L117 98 Z"/>
                      <rect class="bone-structure" x="117.5" y="99" width="5" height="32" rx="1.5"/>
                      <polygon points="119,132 121,132 120,137" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.6"/>
    
                      <!-- Thoracic Vertebral Column behind sternum -->
                      <line x1="120" y1="90" x2="120" y2="168" stroke="#94a3b8" stroke-width="2.5" stroke-dasharray="3 1.5"/>
    
                      <!-- True & False Anatomical Ribs (10 pairs curving outward) -->
                      <!-- Rib 1 -->
                      <path d="M116 93 C102 91 94 98 104 103 C110 105 116 102 117 100" fill="none" stroke="#e2e8f0" stroke-width="1.8"/>
                      <path d="M124 93 C138 91 146 98 136 103 C130 105 124 102 123 100" fill="none" stroke="#e2e8f0" stroke-width="1.8"/>
                      <!-- Rib 2 -->
                      <path d="M117 99 C98 97 88 107 98 113 C108 117 115 110 117 106" fill="none" stroke="#e2e8f0" stroke-width="1.8"/>
                      <path d="M123 99 C142 97 152 107 142 113 C132 117 125 110 123 106" fill="none" stroke="#e2e8f0" stroke-width="1.8"/>
                      <!-- Rib 3 -->
                      <path d="M117 106 C94 105 84 116 95 122 C105 126 114 118 117 112" fill="none" stroke="#e2e8f0" stroke-width="1.8"/>
                      <path d="M123 106 C146 105 156 116 145 122 C135 126 126 118 123 112" fill="none" stroke="#e2e8f0" stroke-width="1.8"/>
                      <!-- Rib 4 -->
                      <path d="M117 112 C91 113 80 126 92 132 C104 136 113 127 117 119" fill="none" stroke="#e2e8f0" stroke-width="1.8"/>
                      <path d="M123 112 C149 113 160 126 148 132 C136 136 127 127 123 119" fill="none" stroke="#e2e8f0" stroke-width="1.8"/>
                      <!-- Rib 5 -->
                      <path d="M117 119 C89 121 78 136 90 142 C102 146 113 135 117 126" fill="none" stroke="#e2e8f0" stroke-width="1.8"/>
                      <path d="M123 119 C151 121 162 136 150 142 C138 146 127 135 123 126" fill="none" stroke="#e2e8f0" stroke-width="1.8"/>
                      <!-- Rib 6 -->
                      <path d="M117 126 C87 129 76 145 88 152 C100 155 112 143 117 132" fill="none" stroke="#e2e8f0" stroke-width="1.7"/>
                      <path d="M123 126 C153 129 164 145 152 152 C140 155 128 143 123 132" fill="none" stroke="#e2e8f0" stroke-width="1.7"/>
                      <!-- Rib 7 -->
                      <path d="M117 132 C86 137 76 153 88 160 C99 162 110 149 118 138" fill="none" stroke="#e2e8f0" stroke-width="1.6"/>
                      <path d="M123 132 C154 137 164 153 152 160 C141 162 130 149 122 138" fill="none" stroke="#e2e8f0" stroke-width="1.6"/>
                      <!-- Ribs 8, 9, 10 (Costal Arch) -->
                      <path d="M118 138 C90 145 82 159 90 166 C100 167 112 155 117 145" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>
                      <path d="M122 138 C150 145 158 159 150 166 C140 167 128 155 123 145" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>
                      <!-- Floating Ribs 11 & 12 -->
                      <path d="M116 156 C104 160 97 165 95 170" fill="none" stroke="#e2e8f0" stroke-width="1.4"/>
                      <path d="M124 156 C136 160 143 165 145 170" fill="none" stroke="#e2e8f0" stroke-width="1.4"/>
                    </g>
    
                    <!-- 4. LUMBAR VERTEBRAE (L1-L5) -->
                    <g class="bone-group" id="bone-lumbar">
                      <rect class="bone-structure" x="114" y="166" width="12" height="4.5" rx="1.5"/>
                      <rect class="bone-structure" x="113.5" y="172.5" width="13" height="4.5" rx="1.5"/>
                      <rect class="bone-structure" x="113" y="179" width="14" height="4.5" rx="1.5"/>
                      <rect class="bone-structure" x="112.5" y="185.5" width="15" height="4.5" rx="1.5"/>
                      <rect class="bone-structure" x="112" y="192" width="16" height="5" rx="1.5"/>
                    </g>
    
                    <!-- 5. PELVIS (ILIAC CRESTS, SACRUM, ISCHIUM, PUBIS) -->
                    <g class="bone-group" id="bone-pelvis" filter="url(#boneGlow)">
                      <!-- Left Ilium Wing -->
                      <path class="bone-structure" d="M112 200 C101 195 86 198 82 210 C78 224 86 236 94 240 C100 242 106 236 108 228 C109 220 112 206 112 200 Z"/>
                      <!-- Right Ilium Wing -->
                      <path class="bone-structure" d="M128 200 C139 195 154 198 158 210 C162 224 154 236 146 240 C140 242 134 236 132 228 C131 220 128 206 128 200 Z"/>
                      <!-- Sacrum & Coccyx -->
                      <polygon points="115,198 125,198 122,224 118,224" class="bone-structure"/>
                      <polygon points="118.5,224 121.5,224 120,229" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.5"/>
                      <!-- Obturator Foramina (Pelvic holes) -->
                      <ellipse cx="106" cy="241" rx="4.5" ry="4" fill="#0a1a10" stroke="#94a3b8" stroke-width="0.8"/>
                      <ellipse cx="134" cy="241" rx="4.5" ry="4" fill="#0a1a10" stroke="#94a3b8" stroke-width="0.8"/>
                      <!-- Pubic Arch -->
                      <path d="M111 247 C116 243 124 243 129 247" fill="none" stroke="#94a3b8" stroke-width="1.2"/>
                    </g>
    
                    <!-- 6. UPPER EXTREMITIES (SHOULDERS, HUMERUS, RADIUS, ULNA, HANDS) -->
                    <g class="bone-group" id="bone-arms" filter="url(#boneGlow)">
                      <!-- Left Shoulder Joint & Humerus -->
                      <circle cx="76" cy="97" r="4.5" class="bone-structure"/>
                      <path d="M75 101 C74 122 71 142 68 162" fill="none" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>
                      <!-- Left Elbow Joint -->
                      <circle cx="67" cy="166" r="3.8" class="bone-structure"/>
                      <!-- Left Forearm (Radius & Ulna) -->
                      <path d="M65 170 L55 218" stroke="#e2e8f0" stroke-width="2.6" stroke-linecap="round"/>
                      <path d="M69 170 L59 218" stroke="#e2e8f0" stroke-width="2.2" stroke-linecap="round"/>
                      <!-- Left Wrist & Digits -->
                      <ellipse cx="56" cy="223" rx="4" ry="3" class="bone-structure"/>
                      <path d="M54 225 L49 238 M55 225 L52 241 M57 225 L55 242 M58 225 L58 240 M59 225 L61 236" stroke="#e2e8f0" stroke-width="1.3" stroke-linecap="round"/>
    
                      <!-- Right Shoulder Joint & Humerus -->
                      <circle cx="164" cy="97" r="4.5" class="bone-structure"/>
                      <path d="M165 101 C166 122 169 142 172 162" fill="none" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>
                      <!-- Right Elbow Joint -->
                      <circle cx="173" cy="166" r="3.8" class="bone-structure"/>
                      <!-- Right Forearm (Radius & Ulna) -->
                      <path d="M175 170 L185 218" stroke="#e2e8f0" stroke-width="2.6" stroke-linecap="round"/>
                      <path d="M171 170 L181 218" stroke="#e2e8f0" stroke-width="2.2" stroke-linecap="round"/>
                      <!-- Right Wrist & Digits -->
                      <ellipse cx="184" cy="223" rx="4" ry="3" class="bone-structure"/>
                      <path d="M186 225 L191 238 M185 225 L188 241 M183 225 L185 242 M182 225 L182 240 M181 225 L179 236" stroke="#e2e8f0" stroke-width="1.3" stroke-linecap="round"/>
                    </g>
    
                    <!-- 7. LOWER EXTREMITIES (HIPS, FEMUR, PATELLA, TIBIA, FIBULA, FEET) -->
                    <g class="bone-group" id="bone-legs" filter="url(#boneGlow)">
                      <!-- Left Femur (Thigh) -->
                      <circle cx="94" cy="244" r="4.5" class="bone-structure"/>
                      <path d="M94 246 C97 274 102 302 104 332" fill="none" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round"/>
                      <!-- Left Patella (Knee Cap) -->
                      <ellipse cx="104" cy="336" rx="5" ry="5.5" class="bone-structure"/>
                      <!-- Left Lower Leg (Tibia & Fibula) -->
                      <path d="M103 342 L99 402" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>
                      <path d="M96 346 L93 400" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>
                      <!-- Left Foot & Ankle -->
                      <path class="bone-structure" d="M97 404 C94 407 87 415 85 422 L99 422 C102 418 101 410 99 404 Z"/>
    
                      <!-- Right Femur (Thigh) -->
                      <circle cx="146" cy="244" r="4.5" class="bone-structure"/>
                      <path d="M146 246 C143 274 138 302 136 332" fill="none" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round"/>
                      <!-- Right Patella (Knee Cap) -->
                      <ellipse cx="136" cy="336" rx="5" ry="5.5" class="bone-structure"/>
                      <!-- Right Lower Leg (Tibia & Fibula) -->
                      <path d="M137 342 L141 402" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>
                      <path d="M144 346 L147 400" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>
                      <!-- Right Foot & Ankle -->
                      <path class="bone-structure" d="M143 404 C146 407 153 415 155 422 L141 422 C138 418 139 410 141 404 Z"/>
                    </g>
    
                    <!-- ================= INTERACTIVE CLINICAL REGION OVERLAYS ================= -->
                    <!-- 1. HEAD & CRANIUM -->
                    <ellipse class="skel-region" data-region="head" cx="120" cy="48" rx="26" ry="30" onclick="BodySkeleton.toggleRegion('head')">
                      <title>Head & Cranium (Headache, Migraine, Dizziness, Eyes, ENT)</title>
                    </ellipse>
                    <g class="organ-node" data-region="head" onclick="BodySkeleton.toggleRegion('head')">
                      <circle cx="120" cy="44" r="9" fill="#2e7d32" fill-opacity="0.8" stroke="#66bb6a" stroke-width="1.4" />
                      <text x="120" y="48" font-size="9" text-anchor="middle" fill="#fff"></text>
                    </g>
    
                    <!-- 2. THROAT & CERVICAL NECK -->
                    <rect class="skel-region" data-region="throat" x="108" y="72" width="24" height="18" rx="5" onclick="BodySkeleton.toggleRegion('throat')">
                      <title>Throat & Neck (Sore Throat, Thyroid, Cervical Pain, Hoarseness)</title>
                    </rect>
    
                    <!-- 3. CHEST & THORAX -->
                    <path class="skel-region" data-region="chest" d="M84 92 C102 88 138 88 156 92 C166 114 164 142 154 154 C136 160 104 160 86 154 C76 142 74 114 84 92 Z" onclick="BodySkeleton.toggleRegion('chest')">
                      <title>Chest & Thorax (Chest Pain, Heart/Angina, Lungs/Shortness of Breath, Cough)</title>
                    </path>
                    <g class="organ-node" data-region="chest" onclick="BodySkeleton.toggleRegion('chest')">
                      <circle cx="106" cy="126" r="9" fill="#166534" fill-opacity="0.8" stroke="#66bb6a" stroke-width="1.2" />
                      <text x="106" y="130" font-size="9" text-anchor="middle" fill="#fff"></text>
                      <circle cx="126" cy="132" r="9" fill="#dc2626" fill-opacity="0.8" stroke="#f87171" stroke-width="1.2" />
                      <text x="126" y="136" font-size="9" text-anchor="middle" fill="#fff"></text>
                    </g>
    
                    <!-- 4. UPPER ABDOMEN / EPIGASTRIUM -->
                    <path class="skel-region" data-region="upper_abdomen" d="M88 156 C105 160 135 160 152 156 C156 176 152 194 148 200 C136 204 104 204 92 200 C88 194 84 176 88 156 Z" onclick="BodySkeleton.toggleRegion('upper_abdomen')">
                      <title>Upper Abdomen (Acidity, Gastritis, Liver, Gallbladder, Burning)</title>
                    </path>
                    <g class="organ-node" data-region="upper_abdomen" onclick="BodySkeleton.toggleRegion('upper_abdomen')">
                      <circle cx="120" cy="178" r="9" fill="#d97706" fill-opacity="0.85" stroke="#fbbf24" stroke-width="1.2" />
                      <text x="120" y="182" font-size="9" text-anchor="middle" fill="#fff"></text>
                    </g>
    
                    <!-- 5. LOWER ABDOMEN & PELVIS -->
                    <path class="skel-region" data-region="lower_abdomen" d="M90 202 C105 206 135 206 150 202 C154 224 146 246 136 254 C126 258 114 258 104 254 C94 246 86 224 90 202 Z" onclick="BodySkeleton.toggleRegion('lower_abdomen')">
                      <title>Lower Abdomen (Cramps, Diarrhea, Intestines, Urinary, Inguinal)</title>
                    </path>
                    <g class="organ-node" data-region="lower_abdomen" onclick="BodySkeleton.toggleRegion('lower_abdomen')">
                      <circle cx="120" cy="228" r="8" fill="#7c3aed" fill-opacity="0.8" stroke="#c084fc" stroke-width="1.2" />
                      <text x="120" y="231" font-size="8" text-anchor="middle" fill="#fff"></text>
                    </g>
    
                    <!-- 6. ARMS (LEFT & RIGHT) -->
                    <path class="skel-region" data-region="arms" d="M52 108 C66 98 76 104 76 118 L70 188 C66 198 56 198 50 188 Z" onclick="BodySkeleton.toggleRegion('arms')">
                      <title>Right Arm & Forearm</title>
                    </path>
                    <path class="skel-region" data-region="arms" d="M188 108 C174 98 164 104 164 118 L170 188 C174 198 184 198 190 188 Z" onclick="BodySkeleton.toggleRegion('arms')">
                      <title>Left Arm & Forearm</title>
                    </path>
    
                    <!-- 7. HANDS & WRISTS -->
                    <ellipse class="skel-region" data-region="hands" cx="54" cy="228" rx="12" ry="16" onclick="BodySkeleton.toggleRegion('hands')">
                      <title>Right Hand & Wrist (Tingling, Numbness, Pain)</title>
                    </ellipse>
                    <ellipse class="skel-region" data-region="hands" cx="186" cy="228" rx="12" ry="16" onclick="BodySkeleton.toggleRegion('hands')">
                      <title>Left Hand & Wrist</title>
                    </ellipse>
    
                    <!-- 8. THIGHS & UPPER LEGS -->
                    <path class="skel-region" data-region="legs" d="M92 254 C106 254 114 268 112 322 C100 328 88 328 82 322 C78 282 82 264 92 254 Z" onclick="BodySkeleton.toggleRegion('legs')">
                      <title>Right Thigh (Sciatica, Muscle Pain, Femur)</title>
                    </path>
                    <path class="skel-region" data-region="legs" d="M148 254 C134 254 126 268 128 322 C140 328 152 328 158 322 C162 282 158 264 148 254 Z" onclick="BodySkeleton.toggleRegion('legs')">
                      <title>Left Thigh (Sciatica, Muscle Pain, Femur)</title>
                    </path>
    
                    <!-- 9. KNEES & JOINTS -->
                    <ellipse class="skel-region" data-region="knees" cx="102" cy="336" rx="13" ry="11" onclick="BodySkeleton.toggleRegion('knees')">
                      <title>Right Knee Joint (Arthritis, Swelling, Ligament)</title>
                    </ellipse>
                    <ellipse class="skel-region" data-region="knees" cx="138" cy="336" rx="13" ry="11" onclick="BodySkeleton.toggleRegion('knees')">
                      <title>Left Knee Joint</title>
                    </ellipse>
                    <g class="organ-node" data-region="knees" onclick="BodySkeleton.toggleRegion('knees')">
                      <circle cx="102" cy="336" r="7" fill="#059669" fill-opacity="0.85" stroke="#34d399" stroke-width="1" />
                      <circle cx="138" cy="336" r="7" fill="#059669" fill-opacity="0.85" stroke="#34d399" stroke-width="1" />
                    </g>
    
                    <!-- 10. FEET & ANKLES -->
                    <path class="skel-region" data-region="feet" d="M84 358 C92 352 106 352 110 358 L106 422 C92 426 84 422 80 416 Z" onclick="BodySkeleton.toggleRegion('feet')">
                      <title>Right Foot & Ankle (Edema, Sprain, Neuropathy)</title>
                    </path>
                    <path class="skel-region" data-region="feet" d="M156 358 C148 352 134 352 130 358 L134 422 C148 426 156 422 160 416 Z" onclick="BodySkeleton.toggleRegion('feet')">
                      <title>Left Foot & Ankle</title>
                    </path>
                  </svg>`;
  },

  posteriorSVG() {
    return `<svg id="skeleton-svg-posterior" viewBox="0 0 240 440" style="width: 240px; height: 410px; cursor: pointer; ${this.activeView === 'posterior' ? 'display:block;' : 'display:none;'}">
                    <defs>
                      <filter id="boneGlowPost" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.5"/>
                      </filter>
                    </defs>
    
                    <!-- Faint Anatomical Silhouette -->
                    <path d="M120 18 C102 18 90 32 90 52 C90 68 98 78 105 84 L96 94 C76 100 64 116 58 140 L46 220 C44 234 50 242 56 240 L66 172 L76 162 L76 220 C76 238 86 252 98 258 L86 358 C82 388 88 412 102 418 L114 418 C118 402 116 350 118 290 L122 290 C124 350 122 402 126 418 L138 418 C152 412 158 388 154 358 L142 258 C154 252 164 238 164 220 L164 162 L174 172 L184 240 C190 242 196 234 194 220 L182 140 C176 116 164 100 144 94 L135 84 C142 78 150 68 150 52 C150 32 138 18 120 18 Z" fill="#06170d" stroke="#14532d" stroke-width="1.2" opacity="0.8"/>
    
                    <!-- ================= BONE STRUCTURES: POSTERIOR ================= -->
                    <!-- 1. POSTERIOR CRANIUM (OCCIPITAL BONE & SUTURES) -->
                    <g class="bone-group" id="bone-post-cranium" filter="url(#boneGlowPost)">
                      <path class="bone-structure" d="M100 42 C100 22 140 22 140 42 C140 56 136 66 120 68 C104 66 100 56 100 42 Z"/>
                      <!-- Lambdoid Suture Line -->
                      <path class="bone-line" d="M104 50 C112 45 128 45 136 50"/>
                      <!-- External Occipital Protuberance -->
                      <circle cx="120" cy="54" r="2" fill="#cbd5e1"/>
                    </g>
    
                    <!-- 2. POSTERIOR CERVICAL SPINE (SPINOUS PROCESSES C1-C7) -->
                    <g class="bone-group" id="bone-post-cervical">
                      <line x1="120" y1="68" x2="120" y2="92" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>
                      <circle cx="120" cy="74" r="2.2" fill="#94a3b8"/>
                      <circle cx="120" cy="80" r="2.2" fill="#94a3b8"/>
                      <circle cx="120" cy="86" r="2.4" fill="#94a3b8"/>
                      <circle cx="120" cy="91" r="2.8" fill="#94a3b8"/> <!-- C7 vertebra prominens -->
                    </g>
    
                    <!-- 3. SCAPULAE (SHOULDER BLADES) & POSTERIOR RIBS -->
                    <g class="bone-group" id="bone-post-thorax" filter="url(#boneGlowPost)">
                      <!-- Left Scapula with Spine of Scapula -->
                      <path class="bone-structure" d="M82 96 L104 100 L96 142 L80 114 Z"/>
                      <path d="M80 102 L104 105" stroke="#94a3b8" stroke-width="2.2" stroke-linecap="round"/> <!-- Spine of Scapula -->
                      
                      <!-- Right Scapula with Spine of Scapula -->
                      <path class="bone-structure" d="M158 96 L136 100 L144 142 L160 114 Z"/>
                      <path d="M160 102 L136 105" stroke="#94a3b8" stroke-width="2.2" stroke-linecap="round"/>
    
                      <!-- Thoracic Vertebral Column running down midline -->
                      <line x1="120" y1="92" x2="120" y2="170" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round"/>
                      <line x1="120" y1="92" x2="120" y2="170" stroke="#94a3b8" stroke-width="3" stroke-dasharray="3 2"/>
    
                      <!-- Posterior Ribs Articulating with Vertebrae -->
                      <path d="M118 100 C102 98 84 104 80 110" fill="none" stroke="#cbd5e1" stroke-width="1.6"/>
                      <path d="M122 100 C138 98 156 104 160 110" fill="none" stroke="#cbd5e1" stroke-width="1.6"/>
                      <path d="M118 110 C96 108 78 116 76 125" fill="none" stroke="#cbd5e1" stroke-width="1.6"/>
                      <path d="M122 110 C144 108 162 116 164 125" fill="none" stroke="#cbd5e1" stroke-width="1.6"/>
                      <path d="M118 122 C92 122 76 132 76 144" fill="none" stroke="#cbd5e1" stroke-width="1.6"/>
                      <path d="M122 122 C148 122 164 132 164 144" fill="none" stroke="#cbd5e1" stroke-width="1.6"/>
                      <path d="M118 135 C90 137 76 150 78 160" fill="none" stroke="#cbd5e1" stroke-width="1.6"/>
                      <path d="M122 135 C150 137 164 150 162 160" fill="none" stroke="#cbd5e1" stroke-width="1.6"/>
                      <path d="M118 148 C92 152 82 164 84 172" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
                      <path d="M122 148 C148 152 158 164 156 172" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
                    </g>
    
                    <!-- 4. POSTERIOR LUMBAR SPINE & SACRUM -->
                    <g class="bone-group" id="bone-post-lumbar">
                      <line x1="120" y1="170" x2="120" y2="202" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round"/>
                      <circle cx="120" cy="174" r="2.8" fill="#94a3b8"/>
                      <circle cx="120" cy="181" r="2.8" fill="#94a3b8"/>
                      <circle cx="120" cy="188" r="3" fill="#94a3b8"/>
                      <circle cx="120" cy="195" r="3.2" fill="#94a3b8"/>
                    </g>
    
                    <!-- 5. POSTERIOR PELVIS (SACRUM, ILIAC CRESTS, COCCYX) -->
                    <g class="bone-group" id="bone-post-pelvis" filter="url(#boneGlowPost)">
                      <!-- Posterior Ilium Wings -->
                      <path class="bone-structure" d="M112 198 C102 194 86 198 82 210 C78 224 88 238 98 244 L110 230 C111 220 112 204 112 198 Z"/>
                      <path class="bone-structure" d="M128 198 C138 194 154 198 158 210 C162 224 152 238 142 244 L130 230 C129 220 128 204 128 198 Z"/>
                      <!-- Dorsal Sacrum & Foramina -->
                      <polygon points="113,198 127,198 123,228 117,228" class="bone-structure"/>
                      <circle cx="118" cy="206" r="1.2" fill="#0a1a10"/>
                      <circle cx="122" cy="206" r="1.2" fill="#0a1a10"/>
                      <circle cx="118.5" cy="214" r="1.2" fill="#0a1a10"/>
                      <circle cx="121.5" cy="214" r="1.2" fill="#0a1a10"/>
                      <!-- Coccyx -->
                      <polygon points="118.5,228 121.5,228 120,233" fill="#cbd5e1"/>
                    </g>
    
                    <!-- 6. POSTERIOR ARMS & ELBOW (OLECRANON PROCESS) -->
                    <g class="bone-group" id="bone-post-arms" filter="url(#boneGlowPost)">
                      <!-- Left Humerus & Olecranon -->
                      <path d="M75 101 C74 122 71 142 68 162" fill="none" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>
                      <ellipse cx="67" cy="166" rx="4" ry="4.5" class="bone-structure"/> <!-- Olecranon elbow point -->
                      <path d="M66 170 L56 218" stroke="#e2e8f0" stroke-width="2.6" stroke-linecap="round"/>
                      <path d="M70 170 L60 218" stroke="#e2e8f0" stroke-width="2.2" stroke-linecap="round"/>
    
                      <!-- Right Humerus & Olecranon -->
                      <path d="M165 101 C166 122 169 142 172 162" fill="none" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>
                      <ellipse cx="173" cy="166" rx="4" ry="4.5" class="bone-structure"/>
                      <path d="M174 170 L184 218" stroke="#e2e8f0" stroke-width="2.6" stroke-linecap="round"/>
                      <path d="M170 170 L180 218" stroke="#e2e8f0" stroke-width="2.2" stroke-linecap="round"/>
                    </g>
    
                    <!-- 7. POSTERIOR LEGS & CALCANEUS (HEEL) -->
                    <g class="bone-group" id="bone-post-legs" filter="url(#boneGlowPost)">
                      <!-- Posterior Femurs -->
                      <circle cx="94" cy="244" r="4.5" class="bone-structure"/>
                      <path d="M94 246 C97 274 102 302 104 332" fill="none" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round"/>
                      <!-- Popliteal Fossa (Back of Knee) -->
                      <ellipse cx="104" cy="336" rx="6" ry="4" fill="#0a1a10" stroke="#94a3b8" stroke-width="0.8"/>
                      <path d="M103 342 L100 404" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>
                      <path d="M96 346 L94 402" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>
                      <!-- Calcaneus (Heel Bone) -->
                      <path class="bone-structure" d="M97 404 C96 408 93 416 93 422 L103 422 C103 416 100 408 97 404 Z"/>
    
                      <!-- Right Posterior Leg -->
                      <circle cx="146" cy="244" r="4.5" class="bone-structure"/>
                      <path d="M146 246 C143 274 138 302 136 332" fill="none" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round"/>
                      <ellipse cx="136" cy="336" rx="6" ry="4" fill="#0a1a10" stroke="#94a3b8" stroke-width="0.8"/>
                      <path d="M137 342 L140 404" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>
                      <path d="M144 346 L146 402" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>
                      <path class="bone-structure" d="M143 404 C144 408 147 416 147 422 L137 422 C137 416 140 408 143 404 Z"/>
                    </g>
    
                    <!-- ================= POSTERIOR INTERACTIVE REGION OVERLAYS ================= -->
                    <!-- Occiput / Head Back -->
                    <ellipse class="skel-region" data-region="head" cx="120" cy="48" rx="26" ry="28" onclick="BodySkeleton.toggleRegion('head')">
                      <title>Occipital / Back of Head</title>
                    </ellipse>
    
                    <!-- Cervical Spine / Nape -->
                    <rect class="skel-region" data-region="throat" x="108" y="70" width="24" height="22" rx="5" onclick="BodySkeleton.toggleRegion('throat')">
                      <title>Cervical Spine / Neck Stiffness</title>
                    </rect>
    
                    <!-- Upper Back & Shoulder Blades (Scapulae) -->
                    <path class="skel-region" data-region="upper_back" d="M78 96 C100 90 140 90 162 96 C166 136 156 166 148 174 C134 178 106 178 92 174 C84 166 74 136 78 96 Z" onclick="BodySkeleton.toggleRegion('upper_back')">
                      <title>Upper Back & Scapula (Thoracic Spasm, Postural Ache)</title>
                    </path>
    
                    <!-- Lower Back / Lumbar Spine & Kidneys -->
                    <path class="skel-region" data-region="lower_back" d="M86 176 C105 180 135 180 154 176 C158 214 150 240 144 250 C134 256 106 256 96 250 C90 240 82 214 86 176 Z" onclick="BodySkeleton.toggleRegion('lower_back')">
                      <title>Lower Back & Kidneys (Lumbago, Renal Pain, Sciatic Nerve)</title>
                    </path>
    
                    <!-- Back of Arms -->
                    <path class="skel-region" data-region="arms" d="M52 108 C66 98 76 104 76 118 L70 188 C66 198 56 198 50 188 Z" onclick="BodySkeleton.toggleRegion('arms')"></path>
                    <path class="skel-region" data-region="arms" d="M188 108 C174 98 164 104 164 118 L170 188 C174 198 184 198 190 188 Z" onclick="BodySkeleton.toggleRegion('arms')"></path>
    
                    <!-- Gluteal / Thighs Back -->
                    <path class="skel-region" data-region="legs" d="M92 254 C106 254 114 268 112 322 C100 328 88 328 82 322 C78 282 82 264 92 254 Z" onclick="BodySkeleton.toggleRegion('legs')"></path>
                    <path class="skel-region" data-region="legs" d="M148 254 C134 254 126 268 128 322 C140 328 152 328 158 322 C162 282 158 264 148 254 Z" onclick="BodySkeleton.toggleRegion('legs')"></path>
    
                    <!-- Calves & Achilles -->
                    <path class="skel-region" data-region="feet" d="M84 346 C92 340 106 340 110 346 L108 418 C94 424 84 420 80 412 Z" onclick="BodySkeleton.toggleRegion('feet')"></path>
                    <path class="skel-region" data-region="feet" d="M156 346 C148 340 134 340 130 346 L132 418 C146 424 156 420 160 412 Z" onclick="BodySkeleton.toggleRegion('feet')"></path>
                  </svg>`;
  },

  leftLateralSVG() {
    return `<svg id="skeleton-svg-left" viewBox="0 0 240 440" style="width: 240px; height: 410px; cursor: pointer; ${this.activeView === 'left' ? 'display:block;' : 'display:none;'}">
      <defs>
        <filter id="boneGlowLeft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <!-- Faint Anatomical Outline (Left Side Profile) -->
      <path d="M120 18 C110 18 100 30 100 50 C100 70 105 80 110 85 L108 95 C100 105 95 120 95 140 L90 220 C88 240 92 250 100 255 L95 350 C92 380 95 410 100 420 L110 420 C115 410 115 380 115 350 L120 255 C125 250 130 240 130 220 L135 140 C135 120 130 105 120 95 L115 85 C120 80 125 70 125 50 C125 30 130 18 120 18 Z" fill="#06170d" stroke="#14532d" stroke-width="1.2" opacity="0.8"/>

      <!-- BONE STRUCTURES -->
      <g filter="url(#boneGlowLeft)">
        <!-- Skull Profile -->
        <path d="M105 45 C105 25 125 25 125 45 C125 55 120 65 115 65 L112 60 C108 60 105 55 105 45 Z" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>
        <ellipse cx="110" cy="45" rx="3" ry="4" fill="#0a1a10" stroke="rgba(46,125,50,0.6)" stroke-width="0.8"/> <!-- Eye Orbit -->
        
        <!-- Cervical Spine Profile -->
        <path d="M118 65 Q115 75 118 85" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="4" stroke-linecap="round"/>
        
        <!-- Thoracic Spine Profile -->
        <path d="M118 85 Q125 130 118 170" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="5" stroke-linecap="round"/>
        
        <!-- Lumbar Spine Profile -->
        <path d="M118 170 Q112 185 118 200" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="6" stroke-linecap="round"/>

        <!-- Ribcage Profile -->
        <path d="M118 90 Q105 110 110 130" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>
        <path d="M119 100 Q102 120 108 140" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>
        <path d="M120 110 Q100 130 105 150" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>
        <path d="M121 120 Q102 140 106 160" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>
        <path d="M120 130 Q105 150 110 170" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>

        <!-- Sternum Profile -->
        <path d="M108 90 L103 135" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="3"/>

        <!-- Pelvis Profile -->
        <path d="M118 200 C105 205 105 235 118 240 L122 220 Z" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>

        <!-- Left Arm Profile -->
        <circle cx="115" cy="95" r="4" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)"/>
        <path d="M115 95 L110 160" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="4" stroke-linecap="round"/> <!-- Humerus -->
        <circle cx="110" cy="160" r="3" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)"/>
        <path d="M110 160 L105 210" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="3" stroke-linecap="round"/> <!-- Radius/Ulna -->
        <ellipse cx="105" cy="215" rx="3" ry="4" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)"/> <!-- Hand -->

        <!-- Left Leg Profile -->
        <circle cx="112" cy="240" r="4.5" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)"/>
        <path d="M112 240 Q115 285 110 330" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="6" stroke-linecap="round"/> <!-- Femur -->
        <ellipse cx="106" cy="330" rx="2.5" ry="4" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)"/> <!-- Patella -->
        <path d="M110 330 L105 400" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="4.5" stroke-linecap="round"/> <!-- Tibia/Fibula -->
        <path d="M105 400 C100 405 95 415 95 420 L110 420 C110 415 112 405 105 400 Z" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)" stroke-width="1.5"/> <!-- Foot -->
      </g>
      
      <!-- INTERACTIVE REGION OVERLAYS (Left View) -->
      <ellipse class="skel-region" data-region="head" cx="115" cy="45" rx="20" ry="25" onclick="BodySkeleton.toggleRegion('head')"></ellipse>
      <rect class="skel-region" data-region="throat" x="105" y="70" width="20" height="18" rx="5" onclick="BodySkeleton.toggleRegion('throat')"></rect>
      <path class="skel-region" data-region="chest" d="M100 90 L125 90 L125 155 L100 155 Z" onclick="BodySkeleton.toggleRegion('chest')"></path>
      <path class="skel-region" data-region="upper_abdomen" d="M100 155 L125 155 L125 200 L100 200 Z" onclick="BodySkeleton.toggleRegion('upper_abdomen')"></path>
      <path class="skel-region" data-region="lower_abdomen" d="M100 200 L125 200 L125 255 L100 255 Z" onclick="BodySkeleton.toggleRegion('lower_abdomen')"></path>
      <path class="skel-region" data-region="arms" d="M105 95 L115 95 L110 210 L100 210 Z" onclick="BodySkeleton.toggleRegion('arms')"></path>
      <ellipse class="skel-region" data-region="hands" cx="105" cy="220" rx="8" ry="12" onclick="BodySkeleton.toggleRegion('hands')"></ellipse>
      <path class="skel-region" data-region="upper_back" d="M125 90 L135 90 L135 170 L125 170 Z" onclick="BodySkeleton.toggleRegion('upper_back')"></path>
      <path class="skel-region" data-region="lower_back" d="M125 170 L135 170 L135 255 L125 255 Z" onclick="BodySkeleton.toggleRegion('lower_back')"></path>
      <path class="skel-region" data-region="legs" d="M100 240 L125 240 L120 325 L105 325 Z" onclick="BodySkeleton.toggleRegion('legs')"></path>
      <ellipse class="skel-region" data-region="knees" cx="110" cy="330" rx="10" ry="10" onclick="BodySkeleton.toggleRegion('knees')"></ellipse>
      <path class="skel-region" data-region="feet" d="M95 400 L115 400 L115 425 L95 425 Z" onclick="BodySkeleton.toggleRegion('feet')"></path>
    </svg>`;
  },

  rightLateralSVG() {
    return `<svg id="skeleton-svg-right" viewBox="0 0 240 440" style="width: 240px; height: 410px; cursor: pointer; ${this.activeView === 'right' ? 'display:block;' : 'display:none;'}">
      <defs>
        <filter id="boneGlowRight" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <!-- Mirror of Left Side -->
      <path d="M120 18 C130 18 140 30 140 50 C140 70 135 80 130 85 L132 95 C140 105 145 120 145 140 L150 220 C152 240 148 250 140 255 L145 350 C148 380 145 410 140 420 L130 420 C125 410 125 380 125 350 L120 255 C115 250 110 240 110 220 L105 140 C105 120 110 105 120 95 L125 85 C120 80 115 70 115 50 C115 30 110 18 120 18 Z" fill="#06170d" stroke="#14532d" stroke-width="1.2" opacity="0.8"/>

      <!-- BONE STRUCTURES -->
      <g filter="url(#boneGlowRight)">
        <!-- Skull Profile -->
        <path d="M135 45 C135 25 115 25 115 45 C115 55 120 65 125 65 L128 60 C132 60 135 55 135 45 Z" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>
        <ellipse cx="130" cy="45" rx="3" ry="4" fill="#0a1a10" stroke="rgba(46,125,50,0.6)" stroke-width="0.8"/>
        
        <!-- Spine Profile -->
        <path d="M122 65 Q125 75 122 85" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="4" stroke-linecap="round"/>
        <path d="M122 85 Q115 130 122 170" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="5" stroke-linecap="round"/>
        <path d="M122 170 Q128 185 122 200" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="6" stroke-linecap="round"/>

        <!-- Ribcage Profile -->
        <path d="M122 90 Q135 110 130 130" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>
        <path d="M121 100 Q138 120 132 140" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>
        <path d="M120 110 Q140 130 135 150" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>
        <path d="M119 120 Q138 140 134 160" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>
        <path d="M120 130 Q135 150 130 170" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>

        <!-- Sternum Profile -->
        <path d="M132 90 L137 135" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="3"/>

        <!-- Pelvis Profile -->
        <path d="M122 200 C135 205 135 235 122 240 L118 220 Z" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)" stroke-width="2"/>

        <!-- Right Arm Profile -->
        <circle cx="125" cy="95" r="4" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)"/>
        <path d="M125 95 L130 160" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="130" cy="160" r="3" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)"/>
        <path d="M130 160 L135 210" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="135" cy="215" rx="3" ry="4" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)"/>

        <!-- Right Leg Profile -->
        <circle cx="128" cy="240" r="4.5" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)"/>
        <path d="M128 240 Q125 285 130 330" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="6" stroke-linecap="round"/>
        <ellipse cx="134" cy="330" rx="2.5" ry="4" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)"/>
        <path d="M130 330 L135 400" fill="none" stroke="rgba(46,125,50,0.6)" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M135 400 C140 405 145 415 145 420 L130 420 C130 415 128 405 135 400 Z" fill="rgba(46,125,50,0.08)" stroke="rgba(46,125,50,0.6)" stroke-width="1.5"/>
      </g>
      
      <!-- INTERACTIVE REGION OVERLAYS (Right View) -->
      <ellipse class="skel-region" data-region="head" cx="125" cy="45" rx="20" ry="25" onclick="BodySkeleton.toggleRegion('head')"></ellipse>
      <rect class="skel-region" data-region="throat" x="115" y="70" width="20" height="18" rx="5" onclick="BodySkeleton.toggleRegion('throat')"></rect>
      <path class="skel-region" data-region="chest" d="M115 90 L140 90 L140 155 L115 155 Z" onclick="BodySkeleton.toggleRegion('chest')"></path>
      <path class="skel-region" data-region="upper_abdomen" d="M115 155 L140 155 L140 200 L115 200 Z" onclick="BodySkeleton.toggleRegion('upper_abdomen')"></path>
      <path class="skel-region" data-region="lower_abdomen" d="M115 200 L140 200 L140 255 L115 255 Z" onclick="BodySkeleton.toggleRegion('lower_abdomen')"></path>
      <path class="skel-region" data-region="arms" d="M125 95 L135 95 L140 210 L130 210 Z" onclick="BodySkeleton.toggleRegion('arms')"></path>
      <ellipse class="skel-region" data-region="hands" cx="135" cy="220" rx="8" ry="12" onclick="BodySkeleton.toggleRegion('hands')"></ellipse>
      <path class="skel-region" data-region="upper_back" d="M105 90 L115 90 L115 170 L105 170 Z" onclick="BodySkeleton.toggleRegion('upper_back')"></path>
      <path class="skel-region" data-region="lower_back" d="M105 170 L115 170 L115 255 L105 255 Z" onclick="BodySkeleton.toggleRegion('lower_back')"></path>
      <path class="skel-region" data-region="legs" d="M115 240 L140 240 L135 325 L120 325 Z" onclick="BodySkeleton.toggleRegion('legs')"></path>
      <ellipse class="skel-region" data-region="knees" cx="130" cy="330" rx="10" ry="10" onclick="BodySkeleton.toggleRegion('knees')"></ellipse>
      <path class="skel-region" data-region="feet" d="M125 400 L145 400 L145 425 L125 425 Z" onclick="BodySkeleton.toggleRegion('feet')"></path>
    </svg>`;
  },

  renderSkeletonContainer() {
    return `
      <div class="anatomical-console" style="background: #090e17; border: 1px solid #1e293b; border-radius: 18px; margin-bottom: 1.5rem; overflow: hidden; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.5);">
        <!-- Top Console Header Bar -->
        <div style="background: linear-gradient(180deg, #0f172a 0%, #090e17 100%); border-bottom: 1px solid #1e293b; padding: 0.9rem 1.4rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; animation: pulse-dot 2s infinite;"></div>
            <div>
              <div style="font-weight: 800; font-size: 1rem; color: #f8fafc; display: flex; align-items: center; gap: 0.5rem; letter-spacing: -0.2px;">
                <span>Body-Map Diagnostic Console</span>
                <span class="badge" style="background: rgba(46, 125, 50, 0.25); color: #66bb6a; border: 1px solid #2e7d32; font-size: 0.68rem; font-weight: 800;">REAL-TIME</span>
              </div>
              <div style="font-size: 0.75rem; color: #94a3b8;">
                Tap the location of your pain on the front or back skeleton. The system deep-analyzes the area and runs an AI interview that follows your answers.
              </div>
            </div>
          </div>

          <!-- Anterior / Posterior Segmented View Toggle -->
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <div class="skeleton-view-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 0;">
              <button type="button" class="btn btn-sm skeleton-view-tab ${this.activeView === 'anterior' ? 'active' : ''}" data-view="anterior" style="background: ${this.activeView === 'anterior' ? '#2e7d32' : 'transparent'}; border: 1px solid #334155; padding: 5px 14px; font-size: 0.8rem; font-weight: 800; color: #f8fafc; border-radius: 8px; transition: all 0.2s; cursor: pointer;" onclick="BodySkeleton.switchView('anterior')">
                Front View
              </button>
              <button type="button" class="btn btn-sm skeleton-view-tab ${this.activeView === 'posterior' ? 'active' : ''}" data-view="posterior" style="background: ${this.activeView === 'posterior' ? '#2e7d32' : 'transparent'}; border: 1px solid #334155; padding: 5px 14px; font-size: 0.8rem; font-weight: 800; color: #f8fafc; border-radius: 8px; transition: all 0.2s; cursor: pointer;" onclick="BodySkeleton.switchView('posterior')">
                Back View
              </button>
            </div>
          </div>
        </div>

        <!-- Main Body: 3-Panel Grid (Scanner | Deep Analysis | Vision AI Camera) -->
        <div style="display: grid; grid-template-columns: 1.55fr 1.45fr 1fr; gap: 1.5rem; padding: 1.5rem; background: radial-gradient(circle at center, #0f172a 0%, #090e17 100%);">
          
          <!-- LEFT: MUSCULAR ANATOMY SCANNER VIEWPORT -->
          <div style="display: flex; flex-direction: column; align-items: center; border-right: 1px solid #1e293b; padding-right: 1.5rem;">
            
            <!-- Viewport Title & Legend -->
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #66bb6a; text-transform: uppercase; letter-spacing: 0.8px;">
                Muscular Anatomy Scanner
              </span>
              <span style="font-size: 0.7rem; color: #64748b; font-family: monospace;">
                Click pain areas to map
              </span>
            </div>

            <!-- MUSCULAR BODY VIEWPORT CONTAINER -->
            <div id="muscular-viewport" style="position: relative; width: 280px; height: 430px; background: #031008; border: 1.5px solid #1b4332; border-radius: 16px; display: flex; justify-content: center; align-items: center; box-shadow: inset 0 0 30px rgba(0,0,0,0.7); overflow: hidden;">
              
              <!-- Reticle Corner Markers -->
              <div style="position: absolute; top: 8px; left: 8px; color: #2e7d32; font-size: 0.8rem; font-family: monospace; pointer-events: none; z-index: 5;">⌜</div>
              <div style="position: absolute; top: 8px; right: 8px; color: #2e7d32; font-size: 0.8rem; font-family: monospace; pointer-events: none; z-index: 5;">⌝</div>
              <div style="position: absolute; bottom: 8px; left: 8px; color: #2e7d32; font-size: 0.8rem; font-family: monospace; pointer-events: none; z-index: 5;">⌞</div>
              <div style="position: absolute; bottom: 8px; right: 8px; color: #2e7d32; font-size: 0.8rem; font-family: monospace; pointer-events: none; z-index: 5;">⌟</div>

              <!-- High-Resolution Ultra-Fast Muscular Model Image -->
              <img id="muscular-anatomy-image" src="/images/muscular_anatomy.webp" onerror="this.onerror=null; this.src='/images/muscular_anatomy.png';" alt="Muscular Anatomy Model" loading="eager" fetchpriority="high" style="width: 100%; height: 100%; object-fit: contain; object-position: ${this.activeView === 'posterior' ? 'right 15%' : 'left center'}; transition: all 0.35s ease; filter: contrast(1.06) brightness(1.02);" />

              <!-- Front View Interactive Hotspot Overlay -->
              <div id="muscular-hotspots-front" style="position: absolute; inset: 0; pointer-events: auto; z-index: 4; ${this.activeView === 'anterior' ? 'display: block;' : 'display: none;'}">
                <div class="skel-region muscular-hotspot" data-region="head" onclick="BodySkeleton.toggleRegion('head')" title="Head & Cranium" style="position: absolute; top: 1%; left: 24%; width: 28%; height: 12%; border-radius: 50% 50% 40% 40%;">
                  <span class="hotspot-badge">Head</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="throat" onclick="BodySkeleton.toggleRegion('throat')" title="Throat & Neck (Sternocleidomastoid)" style="position: absolute; top: 13%; left: 30%; width: 16%; height: 6%; border-radius: 6px;">
                  <span class="hotspot-badge">Neck</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="chest" onclick="BodySkeleton.toggleRegion('chest')" title="Chest & Thorax (Pectoralis Major)" style="position: absolute; top: 19%; left: 19%; width: 38%; height: 10%; border-radius: 10px;">
                  <span class="hotspot-badge">Chest</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="upper_abdomen" onclick="BodySkeleton.toggleRegion('upper_abdomen')" title="Upper Abdomen (Epigastrium)" style="position: absolute; top: 29%; left: 25%; width: 26%; height: 8%; border-radius: 8px;">
                  <span class="hotspot-badge">Upper Abdomen</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="lower_abdomen" onclick="BodySkeleton.toggleRegion('lower_abdomen')" title="Lower Abdomen & Pelvis" style="position: absolute; top: 37%; left: 25%; width: 26%; height: 10%; border-radius: 8px;">
                  <span class="hotspot-badge">Lower Abdomen</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="arms" onclick="BodySkeleton.toggleRegion('arms')" title="Arm (Biceps)" style="position: absolute; top: 19%; left: 6%; width: 14%; height: 26%; border-radius: 12px;">
                  <span class="hotspot-badge">Arm</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="arms" onclick="BodySkeleton.toggleRegion('arms')" title="Arm (Biceps)" style="position: absolute; top: 19%; left: 56%; width: 14%; height: 26%; border-radius: 12px;">
                  <span class="hotspot-badge">Arm</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="hands" onclick="BodySkeleton.toggleRegion('hands')" title="Hand & Wrist" style="position: absolute; top: 46%; left: 4%; width: 12%; height: 11%; border-radius: 8px;">
                  <span class="hotspot-badge">Hand</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="hands" onclick="BodySkeleton.toggleRegion('hands')" title="Hand & Wrist" style="position: absolute; top: 46%; left: 60%; width: 12%; height: 11%; border-radius: 8px;">
                  <span class="hotspot-badge">Hand</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="legs" onclick="BodySkeleton.toggleRegion('legs')" title="Legs & Thighs (Quadriceps)" style="position: absolute; top: 47%; left: 19%; width: 38%; height: 19%; border-radius: 12px;">
                  <span class="hotspot-badge">Thighs</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="knees" onclick="BodySkeleton.toggleRegion('knees')" title="Knees & Patella" style="position: absolute; top: 66%; left: 21%; width: 34%; height: 7%; border-radius: 10px;">
                  <span class="hotspot-badge">Knees</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="legs" onclick="BodySkeleton.toggleRegion('legs')" title="Lower Legs & Calves (Tibialis)" style="position: absolute; top: 73%; left: 20%; width: 36%; height: 16%; border-radius: 12px;">
                  <span class="hotspot-badge">Lower Legs</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="feet" onclick="BodySkeleton.toggleRegion('feet')" title="Feet & Ankles" style="position: absolute; top: 89%; left: 18%; width: 40%; height: 10%; border-radius: 8px;">
                  <span class="hotspot-badge">Feet</span>
                </div>
              </div>

              <!-- Back View Interactive Hotspot Overlay -->
              <div id="muscular-hotspots-back" style="position: absolute; inset: 0; pointer-events: auto; z-index: 4; ${this.activeView === 'posterior' ? 'display: block;' : 'display: none;'}">
                <div class="skel-region muscular-hotspot" data-region="upper_back" onclick="BodySkeleton.toggleRegion('upper_back')" title="Upper Back & Shoulders (Trapezius)" style="position: absolute; top: 5%; left: 63%; width: 32%; height: 14%; border-radius: 12px;">
                  <span class="hotspot-badge">Upper Back</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="lower_back" onclick="BodySkeleton.toggleRegion('lower_back')" title="Lower Back & Spine (Latissimus)" style="position: absolute; top: 19%; left: 65%; width: 28%; height: 12%; border-radius: 10px;">
                  <span class="hotspot-badge">Lower Back</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="lower_back" onclick="BodySkeleton.toggleRegion('lower_back')" title="Gluteal Region (Gluteus Maximus)" style="position: absolute; top: 31%; left: 65%; width: 28%; height: 12%; border-radius: 10px;">
                  <span class="hotspot-badge">Gluteus</span>
                </div>
                <div class="skel-region muscular-hotspot" data-region="legs" onclick="BodySkeleton.toggleRegion('legs')" title="Posterior Thighs & Calves (Hamstrings/Calf)" style="position: absolute; top: 43%; left: 64%; width: 30%; height: 35%; border-radius: 12px;">
                  <span class="hotspot-badge">Back of Legs</span>
                </div>
              </div>

            </div>

            <!-- Selected Regions Tray -->
            <div style="width: 100%; margin-top: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <span style="font-size: 0.8rem; font-weight: 800; color: #f8fafc;">
                  Mapped Anatomical Regions (<span id="skeleton-selected-count" style="color: #66bb6a;">0</span>):
                </span>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 8px; background: #1e293b; color: #94a3b8; border-color: #334155;" onclick="BodySkeleton.clearSelection()">
                  Clear
                </button>
              </div>
              <div id="skeleton-selected-chips" style="min-height: 42px; background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 6px; display: flex; flex-wrap: wrap; align-items: center;">
                <span style="color: #64748b; font-size: 0.8rem; font-style: italic;">Tap on any muscle group or area on the anatomy model to highlight symptom location.</span>
              </div>
              <button type="button" class="btn btn-primary btn-sm" id="btn-apply-skeleton-complaint" style="width: 100%; margin-top: 0.65rem; font-weight: 800; padding: 0.55rem; background: linear-gradient(90deg,#10b981,#2e7d32); border: none;" disabled onclick="BodySkeleton.startGuidedInterview()">
                Start AI-Guided Symptom Check on selected areas
              </button>
            </div>
          </div>

          <!-- MIDDLE: DEEP ANALYSIS PANEL (region -> disease, patient-driven) -->
          <div style="display: flex; flex-direction: column; border-right: 1px solid #1e293b; padding-right: 1.2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #86efac; text-transform: uppercase; letter-spacing: 0.8px;">
                Targeted Intake Analysis
              </span>
              <span style="font-size: 0.7rem; color: #64748b; font-family: monospace;">AI Intake</span>
            </div>
            <div id="region-disease-panel" class="rpd">
              <div class="rpd-empty">
                <div style="font-size: 1.8rem; color: #4ade80; margin-bottom: 0.5rem; font-weight: 900;">+</div>
                <strong>Targeted Body-Map Intake</strong>
                <p>Tap an area on the muscular anatomy model. The system prepares a guided AI interview that addresses your pain locations.</p>
              </div>
            </div>
          </div>

          <!-- RIGHT: CLINICAL VISION AI & CAMERA LESION SCREENING -->
          <div style="display: flex; flex-direction: column;">
            <!-- Panel Header -->
            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.85rem;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #2e7d32, #10b981); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 800; color: #fff;">
                AI
              </div>
              <div>
                <div style="font-weight: 800; font-size: 1rem; color: #ffffff; letter-spacing: -0.2px;">Camera Photo & Lesion AI Screening</div>
                <div style="font-size: 0.75rem; color: #94a3b8;">Snap or upload a photo of rash, lesion, or wound for AI disease classification.</div>
              </div>
            </div>

            <!-- Viewfinder / Dropzone Box -->
            <div style="position: relative; background: #0f172a; border: 2px dashed #334155; border-radius: 16px; padding: 1.5rem 1rem; text-align: center; margin-bottom: 1rem; transition: border-color 0.2s;">
              <input type="file" id="lesion-photo-input" accept="image/*" capture="environment" style="display: none;" onchange="BodySkeleton.handlePhotoSelect(event)">
              
              <!-- Viewfinder Reticle Corners -->
              <div style="position: absolute; top: 10px; left: 10px; color: #66bb6a; font-size: 1rem; font-family: monospace;">⌜</div>
              <div style="position: absolute; top: 10px; right: 10px; color: #66bb6a; font-size: 1rem; font-family: monospace;">⌝</div>
              <div style="position: absolute; bottom: 10px; left: 10px; color: #66bb6a; font-size: 1rem; font-family: monospace;">⌞</div>
              <div style="position: absolute; bottom: 10px; right: 10px; color: #66bb6a; font-size: 1rem; font-family: monospace;">⌟</div>

              <div style="font-weight: 800; color: #f8fafc; font-size: 0.95rem; margin-bottom: 0.35rem; margin-top: 0.5rem;">
                Capture or Upload Clinical Photo
              </div>
              <div style="font-size: 0.75rem; color: #94a3b8; max-width: 320px; margin: 0 auto 1rem auto; line-height: 1.4;">
                Clear close-up of skin eruptions, insect bites, erythema, fungal lesions, or surgical incisions.
              </div>

              <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary btn-sm" style="font-weight: 800; display: flex; align-items: center; gap: 6px; padding: 0.55rem 1.15rem;" onclick="BodySkeleton.openLiveCamera()">
                  Open Device Camera
                </button>
                <button type="button" class="btn btn-secondary btn-sm" style="font-weight: 800; display: flex; align-items: center; gap: 6px; background: #1e293b; color: #f8fafc; border-color: #475569; padding: 0.55rem 1.15rem;" onclick="document.getElementById('lesion-photo-input').click()">
                  Select Image File
                </button>
              </div>
            </div>

            <!-- Image Preview Box -->
            <div id="lesion-preview-box" style="display: none; margin-bottom: 1rem; background: #0f172a; border: 1px solid #1e293b; border-radius: 14px; padding: 1rem; text-align: center;">
              <div style="position: relative; display: inline-block; margin-bottom: 0.75rem;">
                <img id="lesion-preview-img" src="" style="max-height: 160px; max-width: 100%; border-radius: 10px; border: 2px solid #2e7d32; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: block;" />
                <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(15, 23, 42, 0.85); color: #66bb6a; font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid #2e7d32;">
                  High-Res Specimen
                </div>
              </div>
              
              <!-- Location Select for Context -->
              <div style="display: flex; align-items: center; justify-content: center; gap: 0.65rem; margin-bottom: 0.85rem;">
                <label style="font-size: 0.8rem; font-weight: 700; color: #cbd5e1;">Target Anatomical Location:</label>
                <select id="lesion-body-location" class="form-select" style="font-size: 0.8rem; padding: 5px 10px; width: auto; background: #1e293b; color: #fff; border-color: #475569;">
                  <option value="auto" selected>✨ Auto-Detect Anatomical Part from Photo</option>
                  <option value="head">Face / Head / Neck</option>
                  <option value="hands">Hands / Palm / Fingers</option>
                  <option value="arms">Arms / Elbows / Forearms</option>
                  <option value="chest">Chest / Trunk</option>
                  <option value="abdomen">Abdomen / Stomach</option>
                  <option value="upper_back">Upper Back</option>
                  <option value="lower_back">Lower Back</option>
                  <option value="legs">Legs / Thighs / Shins</option>
                  <option value="knees">Knees / Joints</option>
                  <option value="feet">Feet / Ankles / Soles</option>
                </select>
              </div>

              <button type="button" class="btn btn-success" id="btn-run-disease-detect" style="width: 100%; font-weight: 800; padding: 0.7rem;" onclick="BodySkeleton.runDiseaseDetection()">
                 Analyze Image with AI Clinical Model (Hugging Face / Vision AI)
              </button>
            </div>

            <!-- Analyzing Status Radar Box -->
            <div id="detection-status-box" style="display: none; padding: 1.25rem; text-align: center; background: #0f172a; border: 1px solid #2e7d32; border-radius: 12px; margin-bottom: 1rem;">
              <div style="font-weight: 800; color: #66bb6a; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span class="status-dot"></span> Analyzing Dermatological Features with AI...
              </div>
              <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">
                Checking erythema index, edge irregularity, dermatological textures, and local epidemiological patterns.
              </div>
            </div>

            <!-- Detection Result Display Card -->
            <div id="detection-result-card" style="display: none;"></div>

          </div>

        </div>
      </div>
    `;
  },

  bindEvents() {
    // Dynamic styling for interactive SVG regions & Organ Nodes
    if (!document.getElementById('body-skeleton-styles')) {
      const style = document.createElement('style');
      style.id = 'body-skeleton-styles';
      style.textContent = `
        .skel-region {
          fill: #334155;
          opacity: 0.25;
          stroke: #475569;
          stroke-width: 1.2;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .skel-region:hover {
          fill: #4ade80 !important;
          opacity: 0.75 !important;
          stroke: #66bb6a !important;
          stroke-width: 2 !important;
          filter: drop-shadow(0 0 10px rgba(76, 175, 80, 0.9));
        }
        .skel-region.active-selected {
          fill: #2e7d32 !important;
          opacity: 0.9 !important;
          stroke: #ffffff !important;
          stroke-width: 2.5 !important;
          filter: drop-shadow(0 0 12px rgba(46, 125, 50, 1));
          animation: skelPulseGlow 2s infinite ease-in-out;
        }
        .organ-node {
          cursor: pointer;
          transition: transform 0.2s ease, filter 0.2s ease;
        }
        .organ-node:hover {
          transform: scale(1.25);
          filter: drop-shadow(0 0 8px #66bb6a);
        }
        .organ-node.active-selected {
          animation: organPulse 1.8s infinite;
        }
        @keyframes organPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px #00897b); }
          50% { transform: scale(1.2); filter: drop-shadow(0 0 14px #66bb6a); }
        }
      `;
      document.head.appendChild(style);
    }
  }
};

window.BodySkeleton = BodySkeleton;
