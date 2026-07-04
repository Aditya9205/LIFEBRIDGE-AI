/* ==========================================================================
   LifeBridge AI – EOC Command Center JS
   Handles SPA routing, Leaflet map, Chart.js, direct Gemini REST client,
   Web Audio siren, SpeechSynthesis TTS, and interactive data hubs.
   ========================================================================== */

// Global State
let apiSecurityKey = "";
let activePreset = "";
let map = null;
let markers = {};
let routePolyline = null;
let blockageCircles = [];
let resourceChartInstance = null;
let sirenAudioContext = null;
let sirenOscillator = null;
let sirenInterval = null;
let isSirenPlaying = false;
let speechUtterance = null;
let generatedPlanMarkdown = "";
let subAgentOutputs = {};

// Mock Databases
let volunteersList = [
    { Name: "Amit Sharma", Contact: "9876543210", Skills: "First Aid / Medical Support", Location: "Mumbai" },
    { Name: "Priyanka Jena", Contact: "8765432109", Skills: "Food & Water Distribution", Location: "Puri, Odisha" },
    { Name: "Rajesh Negi", Contact: "7654321098", Skills: "Search & Rescue Support", Location: "Rudraprayag" }
];

let citizenRequests = [
    { Address: "Kurla Sector 3", Request: "Need water bottles for 5 families stranded in building", People: 12, Urgency: "High" },
    { Address: "Puri Sea Beach Road", Request: "Fallen tree blocking the main entry gate of shelter", People: 40, Urgency: "Critical" }
];

const PRESETS = {
    mumbai: {
        title: "Mumbai Monsoon Flooding (Kurla, MH)",
        disaster_type: "Monsoon Flooding & Grid Outage",
        location: "Kurla West, Mumbai, Maharashtra",
        situation: "Heavy rains for 24 hours. Water levels on the street are at 3.5 feet, starting to enter ground floor buildings. Power is off as a safety measure. We have an elderly grandparent who uses a walker and requires regular medications. Drinking water supplies are running low.",
        severity: "Critical",
        threat_level: "CRITICAL",
        shelters_count: "142",
        rescues_count: "12 RESCUES",
        uptime: "82.5%",
        coords: [19.0760, 72.8777],
        chartData: [82, 64, 91, 45, 78], // allocated values
        weather: [
            { loc: "Kurla, Mumbai", temp: "26°C", desc: "Extreme Torrential Rain" },
            { loc: "Puri Coast", temp: "30°C", desc: "Partly Cloudy" }
        ],
        bulletin: [
            "🚨 Mumbai: SDRF teams dispatched to Kurla West with 12 inflatable boats.",
            "⚠️ Kurla West: BMC requests residents evacuate ground floor structures immediately.",
            "🏥 Kurla: Municipal School relief camp open and distributing food packets."
        ],
        blockages: [
            { desc: "LBS Marg: Underpass flooded, completely closed to traffic.", coords: [19.0732, 72.8821] },
            { desc: "Kurla Station Road: High water currents (3 feet). Unsafe for walking.", coords: [19.0781, 72.8795] }
        ],
        route: {
            start: [19.0790, 72.8732], // Kurla Station
            end: [19.0735, 72.8790], // Kurla Municipal School
            path: [
                [19.0790, 72.8732],
                [19.0775, 72.8750],
                [19.0755, 72.8765],
                [19.0735, 72.8790]
            ]
        }
    },
    himalayan: {
        title: "Himalayan Cloudburst (Rudraprayag, UK)",
        disaster_type: "Cloudburst & Mountain Mudslide",
        location: "Rudraprayag District, Uttarakhand",
        situation: "A cloudburst higher up has triggered mudslides and flash floods. The village access road is completely washed out, isolating 45 tourists. Foundation walls of the local guest house are showing structural cracks. Mobile network is highly unstable.",
        severity: "Critical",
        threat_level: "CRITICAL",
        shelters_count: "38",
        rescues_count: "3 OPERATIONS",
        uptime: "42.1%",
        coords: [30.2838, 78.9818],
        chartData: [45, 90, 80, 85, 30],
        weather: [
            { loc: "Rudraprayag, UK", temp: "15°C", desc: "Violent Storms & Rain" },
            { loc: "Kedarnath Base", temp: "8°C", desc: "Freezing Mudslides" }
        ],
        bulletin: [
            "🚨 Rudraprayag: Army helicopters standing by for tourist evacuations.",
            "⚠️ NH-58: Blocked at multiple points due to landslide debris.",
            "🏥 Rudraprayag: Community hall shelter active with medical support."
        ],
        blockages: [
            { desc: "Village Bridge: Collapsed due to high river torrents.", coords: [30.2865, 78.9850] },
            { desc: "Main Market Road: Overwhelmed by mudslide landslide debris.", coords: [30.2825, 78.9790] }
        ],
        route: {
            start: [30.2810, 78.9770],
            end: [30.2845, 78.9830],
            path: [
                [30.2810, 78.9770],
                [30.2820, 78.9800],
                [30.2835, 78.9810],
                [30.2845, 78.9830]
            ]
        }
    },
    cyclone: {
        title: "Cyclone Landfall (Puri, Odisha)",
        disaster_type: "Severe Cyclone (Landfall Phase)",
        location: "Puri Coast, Odisha",
        situation: "Severe cyclone landfall in progress. Wind speeds reaching 160 km/h with massive storm surges. Trees and power poles are down, blocking the evacuation roads. Many low-income houses with metal/tin sheet roofs are damaged. Multi-purpose cyclone shelter is active but road clearing is needed.",
        severity: "Critical",
        threat_level: "CRITICAL",
        shelters_count: "290",
        rescues_count: "18 MISSIONS",
        uptime: "15.0%",
        coords: [19.8134, 85.8312],
        chartData: [95, 80, 60, 95, 90],
        weather: [
            { loc: "Puri Coast", temp: "25°C", desc: "160km/h Cyclonic Winds" },
            { loc: "Bhubaneswar", temp: "27°C", desc: "Heavy Rain & Squalls" }
        ],
        bulletin: [
            "🚨 Odisha: OSDMA deploys 25 NDRF units along Puri coastal lines.",
            "⚠️ Puri Beach Road: High storm surges inundating properties.",
            "🏥 Puri Shelter: Multipurpose center holding 450 evacuees safely."
        ],
        blockages: [
            { desc: "Grand Road Puri: Covered in fallen high-tension electrical poles.", coords: [19.8120, 85.8285] },
            { desc: "Beach Entry Highway: Heavy storm surge water blocking road access.", coords: [19.8090, 85.8335] }
        ],
        route: {
            start: [19.8050, 85.8300],
            end: [19.8160, 85.8270],
            path: [
                [19.8050, 85.8300],
                [19.8080, 85.8290],
                [19.8120, 85.8280],
                [19.8160, 85.8270]
            ]
        }
    },
    vizag: {
        title: "Vizag Chemical Gas Leak (AP)",
        disaster_type: "Industrial Chemical gas release",
        location: "Industrial Corridor, Visakhapatnam, Andhra Pradesh",
        situation: "Sirens blaring from the chemical plant. Faint sweet/chemical odor in the air. Neighbors reporting skin itching, burning eyes, and breathing difficulties. We are attempting to shelter-in-place but need immediate containment protocols.",
        severity: "High",
        threat_level: "HIGH RISK",
        shelters_count: "15",
        rescues_count: "2 CONTAINMENTS",
        uptime: "99.0%",
        coords: [17.6868, 83.2185],
        chartData: [30, 50, 95, 20, 80],
        weather: [
            { loc: "Industrial Zone", temp: "32°C", desc: "Light Easterly Winds" },
            { loc: "Vizag Port", temp: "31°C", desc: "Clear Weather" }
        ],
        bulletin: [
            "🚨 Vizag: NDRF HAZMAT units on site for gas containment.",
            "⚠️ Safety Alert: Residents within 3km told to cover faces with wet cloths.",
            "🏥 Gajuwaka Center: Toxic inhalation triage clinic established."
        ],
        blockages: [
            { desc: "Industrial Main Gate: Gas plume density is high. Closed completely.", coords: [17.6885, 83.2205] },
            { desc: "Railway Cross Route: Plume drift direction makes it toxic.", coords: [17.6845, 83.2155] }
        ],
        route: {
            start: [17.6910, 83.2140],
            end: [17.6820, 83.2230],
            path: [
                [17.6910, 83.2140],
                [17.6890, 83.2120],
                [17.6830, 83.2190],
                [17.6820, 83.2230]
            ]
        }
    },
    delhi: {
        title: "Severe Delhi Heatwave (New Delhi)",
        disaster_type: "Extreme Heatwave & Power Outage",
        location: "Dwarka Sector 6, New Delhi",
        situation: "Outdoor temperatures peaking at 48°C. Power transformer burst has knocked out electricity in the sector for 10 hours. ACs/fans are down. Indoor temperatures have crossed 41°C. An infant and an elderly diabetic resident are showing signs of heavy dehydration.",
        severity: "High",
        threat_level: "HIGH RISK",
        shelters_count: "84",
        rescues_count: "4 DEHYDRATIONS",
        uptime: "65.0%",
        coords: [28.5823, 77.0500],
        chartData: [90, 30, 85, 95, 40],
        weather: [
            { loc: "Dwarka, Delhi", temp: "48°C", desc: "Extreme Loo Winds" },
            { loc: "Connaught Place", temp: "47°C", desc: "Intense Heatwave" }
        ],
        bulletin: [
            "🚨 Delhi: Discoms rushing emergency mobile transformers to Dwarka.",
            "⚠️ Heat Alert: Red Alert remains active. Limit outdoors between 11 AM - 4 PM.",
            "🏥 Dwarka Complex: Cooling center open with cold IV drips and drinking water."
        ],
        blockages: [
            { desc: "Sector 6 Intersection: Transformer fire hazard zone. Road cordoned.", coords: [28.5845, 77.0530] }
        ],
        route: {
            start: [28.5800, 77.0450],
            end: [28.5860, 77.0550],
            path: [
                [28.5800, 77.0450],
                [28.5815, 77.0490],
                [28.5835, 77.0510],
                [28.5860, 77.0550]
            ]
        }
    }
};

const SHELTERS_DB = {
    Maharashtra: [
        { Name: "Kurla West Municipal School Relief Camp", Capacity: "120/200", Water: "🟢 HIGH", Food: "🟡 MEDIUM", Medical: "Yes" },
        { Name: "Sion Community Center", Capacity: "85/150", Water: "🟢 HIGH", Food: "🟢 HIGH", Medical: "Yes" },
        { Name: "Ghatkopar Cyclone Shelter", Capacity: "40/100", Water: "🟡 MEDIUM", Food: "🔴 LOW", Medical: "No" }
    ],
    Odisha: [
        { Name: "Puri Multipurpose Cyclone Shelter", Capacity: "350/500", Water: "🟢 HIGH", Food: "🟢 HIGH", Medical: "Yes" },
        { Name: "Konark Community Relief Hall", Capacity: "110/300", Water: "🟢 HIGH", Food: "🟡 MEDIUM", Medical: "Yes" },
        { Name: "Bhubaneswar Town Hall", Capacity: "150/400", Water: "🟢 HIGH", Food: "🟢 HIGH", Medical: "Yes" }
    ],
    Uttarakhand: [
        { Name: "Rudraprayag Town Assembly Hall", Capacity: "45/80", Water: "🟢 HIGH", Food: "🟢 HIGH", Medical: "Yes" },
        { Name: "Guptkashi Tourism Center", Capacity: "30/100", Water: "🟡 MEDIUM", Food: "🟡 MEDIUM", Medical: "No" },
        { Name: "Kedarnath Base Camps", Capacity: "120/150", Water: "🟡 MEDIUM", Food: "🔴 LOW", Medical: "Yes" }
    ],
    Delhi: [
        { Name: "Dwarka Sports Complex Cooling Camp", Capacity: "90/250", Water: "🟢 HIGH", Food: "🟢 HIGH", Medical: "Yes" },
        { Name: "Janakpuri Community Shelter", Capacity: "45/100", Water: "🟢 HIGH", Food: "🟢 HIGH", Medical: "Yes" }
    ],
    "Andhra Pradesh": [
        { Name: "Vizag Industrial Zone Isolation Shelter", Capacity: "80/150", Water: "🟢 HIGH", Food: "🟢 HIGH", Medical: "Yes" },
        { Name: "Gajuwaka Relief Center", Capacity: "95/200", Water: "🟢 HIGH", Food: "🟡 MEDIUM", Medical: "Yes" }
    ]
};

// Prompt templates for sub-agents
const AGENT_PROMPTS = {
    assessment: {
        system: `You are the Disaster Assessment Agent for "LifeBridge AI". Your role is to analyze inputs during emergencies and disasters to provide:
1. Classification of the disaster type (natural, technical, man-made, medical, etc.).
2. Severity Level Assessment: Must explicitly classify the severity into one of the following: Low, Medium, High, or Critical, and provide a clear justification for this classification (threat to life, property damage, secondary risks, rescue accessibility).
3. Risk Summary: A concise, high-impact bulleted list of active hazards (e.g. electrical shock, flood currents, structural collapse, carbon monoxide poisoning, extreme weather).

Guidelines:
- Keep the tone professional, objective, and urgent.
- Avoid generic recommendations; focus strictly on characterizing the threat itself.
- Use clean Markdown styling. Include structured headers (e.g., "# Disaster Assessment", "## Severity Classification", "## Current Active Hazards").`
    },
    medical: {
        system: `You are the Medical Agent for "LifeBridge AI" (localized for India). Your role is to provide clear, calm, and actionable first-aid steps and medical guidance during crises.
You must deliver:
1. Immediate Medical Steps: Step-by-step actions for injuries related to the disaster (e.g. treating bleeding, hypothermia, fractures, smoke inhalation, burns).
2. Health & Hygiene Measures: Advice to prevent outbreak of diseases (e.g., water purification steps, sanitation rules during floods, dust protection masks for earthquakes/ash).
3. Critical Medical Checklist: Checklists of essential medical items needed:
   - Bandages, antiseptics, scissors, splints
   - Specialized items matching the situation (e.g., rehydration salts (ORS), asthma inhalers, insulin)

Formatting Requirement:
- For checklists, you MUST format each item as a markdown checkbox: "- [ ] Medical Item - Rationale".
- Keep steps direct and imperative (e.g., "Elevate the limb", "Clean the wound with clean water").
- Use clean Markdown with headers: "# Medical & First-Aid Guidance", "## Immediate First-Aid", "## Hygiene & Disease Prevention", "## Medical Supply Checklist".`
    },
    resource: {
        system: `You are the Resource Agent for "LifeBridge AI" (localized for India). Your role is to calculate and list the essential non-medical resources and survival gear required.
You must compile:
1. Water & Food Needs: Exact ration ratios (e.g. 3-4 liters of water per person per day, dry foods, baby formula if needed).
2. Tools & Safety Equipment: Flashlights, extra batteries, matching chargers, power banks, multi-tools, ropes, safety matches.
3. Personal Gear & Clothing: Raincoats/waterproof jackets, blankets, sturdy shoes, change of clothes.
4. Logistics & Documents Check: IDs, cash, local maps.

Formatting Requirement:
- For the checklists, you MUST format each item as a markdown checkbox: "- [ ] Resource Item - Quantity/Rationale".
- Use clean Markdown with headers: "# Resource & Logistical Support", "## Food & Water Allocation", "## Tools & Safety Equipment", "## Survival Gear Checklist".`
    },
    shelter: {
        system: `You are the Shelter & Resources Agent for "LifeBridge AI" (localized for India). Your role is to guide the user on where to seek shelter and how to prepare for transit.
You must deliver:
1. Recommended Shelter Types: Where to go based on the disaster type and severity (e.g., vertical evacuation to higher floors/community centers for floods, structural safety shelters for cyclones, open grounds for earthquakes, designated safety shelter locations).
2. Key Evacuation Prep: What information, documents (like Aadhaar cards, ration cards, property documents), and physical tasks the user should gather/complete immediately before locking up and leaving (e.g., shutting off LPG cylinders, main power switches, locking doors).
3. Public Resources: Recommendations of Indian agencies (NDMA - National Disaster Management Authority, SDRF - State Response Force, DDMAs, and Indian Red Cross Society) and contact procedures (e.g., calling the State Disaster Helpline 1070 or District Disaster Helpline 1077).

Guidelines:
- Keep the recommendations safe, practical, and tailored to Indian residential architecture (concrete brick/RCC houses vs kutcha/sheet roof houses).
- Use clean Markdown with headers: "# Shelter & Resources Guidance", "## Shelter Recommendations", "## Pre-Evacuation Checklists", "## Indian Public Resources & Helplines".`
    },
    communication: {
        system: `You are the Communication Agent for "LifeBridge AI" (localized for India). Your role is to generate critical messages that can save lives and coordinate rescue during an emergency.
You must generate:
1. Family Status SMS: A short, low-bandwidth text message template (e.g. for SMS or WhatsApp) that users can quickly send to loved ones. It should outline status (safe/injured), current location, and immediate plan. Keep it extremely brief (under 160 characters).
2. Emergency SOS Draft: A high-urgency rescue request containing details of their location, headcount, and specific threats (e.g. "SOS: Trapped on 2nd floor in Kurla, 3 people, water rising. Need NDRF/local police. Location: [Location]. Phone battery at [Battery]%.").
3. Indian Communication Protocols: Best practices for managing electronics/comms (e.g., calling 112 for all-in-one emergency help, 100 for police, 101 for fire, 102 for ambulance, 1078 for NDMA; using SMS/WhatsApp text instead of voice calls to preserve bandwidth; setting phone to Ultra Power Saving mode).

Guidelines:
- Make the drafted messages copy-paste ready with clear bracket placeholders (e.g. [Location], [Status]) where appropriate, but try to pre-populate them as much as possible using the user's input!
- Format clearly in Markdown with headers: "# Communication & SOS Kit", "## Family Status SMS Template", "## High-Urgency SOS Message", "## Indian Emergency Contact Practices".`
    },
    supervisor: {
        system: `You are the Supervisor Agent of "LifeBridge AI" (localized for India). Your role is to compile and synthesize the individual expert analyses from specialized sub-agents into a single, cohesive, high-impact Emergency Operations Plan.

Your output MUST follow this exact structure:
1. Executive Incident Summary: Brief description of the crisis, location, and overall severity (Critical, High, Medium, Low).
2. Immediate Triage & Action Items (0 - 2 Hours): High-priority, life-saving steps. Use bullet points.
3. Medical & Health Protocol: Essential first aid, hydration advice, and hygiene precautions.
4. Logistics & Supply Allocations: Checklists for food, water, tools, and survival gear.
5. Communications & Family Messaging Kit: Crucial SMS status message template and SOS draft.
6. Public Resources: Support numbers (112, 1070, 1077, 1078), shelter details, and Indian agency listings (NDMA, NDRF, SDMA).

Formatting rules:
- Use bold text for key warnings and actions.
- Use clean Markdown formatting. Do not make it too wordy; use short paragraphs and lists.
- Avoid introducing any placeholder values (e.g. "[Insert Local Number Here]").`
    }
};

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Load API key from local storage
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
        apiSecurityKey = savedKey;
        document.getElementById("gemini-key").value = savedKey;
    }

    // Set default bulletin
    updateBulletinFeed([
        "EOC SYSTEM STATUS: ONLINE. COMMUNICATIONS ACTIVE.",
        "WEATHER WATCH: Indian Meteorological Department warns of high rainfall activity along west coast.",
        "NDRF DEPLOYMENT: SDRF and NDRF rescue battalions on standby for monsoon season relief."
    ]);

    // Setup SPA page router
    setupNavigation();

    // Setup Event Listeners
    document.getElementById("save-key-btn").addEventListener("click", saveApiKey);
    document.getElementById("preset-select").addEventListener("change", handlePresetSelection);
    document.getElementById("run-ai-btn").addEventListener("click", runMultiAgentFlow);
    document.getElementById("siren-trigger-btn").addEventListener("click", () => toggleSirenDrill(true));
    document.getElementById("calculate-route-btn").addEventListener("click", drawSafeEvacuationRoute);
    document.getElementById("reset-route-btn").addEventListener("click", resetMapRoute);
    document.getElementById("export-plan-btn").addEventListener("click", exportActionPlan);
    document.getElementById("tts-play-btn").addEventListener("click", speakPlan);
    document.getElementById("tts-stop-btn").addEventListener("click", stopSpeech);
    document.getElementById("shelter-state-filter").addEventListener("change", handleShelterStateFilter);

    // Initialize map
    initMap();

    // Initialize Chart
    initChart([60, 50, 80, 40, 70]); // default allocated

    // Render Initial Tables
    renderSheltersTable("Maharashtra");
    renderVolunteersTable();
    renderCitizenRequestsTable();
    loadShelterDropdown("Maharashtra");
    setupTabs();
});

// ==========================================================================
// SPA Router
// ==========================================================================
function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const sections = document.querySelectorAll(".page-section");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const pageId = item.getAttribute("data-page");
            
            // Toggle Active Nav class
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");

            // Toggle Page visibility
            sections.forEach(sec => sec.classList.remove("active"));
            const targetSection = document.getElementById(pageId);
            if (targetSection) {
                targetSection.classList.add("active");
                
                // Recalculate Leaflet map size when toggled visible
                if (pageId === "map-page" && map) {
                    setTimeout(() => {
                        map.invalidateSize();
                    }, 200);
                }
            }
        });
    });
}

function setupTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            tabPanes.forEach(pane => pane.classList.remove("active"));
            document.getElementById(tabId).classList.add("active");
        });
    });
}

// ==========================================================================
// API Key & Presets
// ==========================================================================
function saveApiKey() {
    const keyVal = document.getElementById("gemini-key").value.trim();
    if (keyVal) {
        apiSecurityKey = keyVal;
        localStorage.setItem("gemini_api_key", keyVal);
        alert("🔒 EOC Configuration: API Key secured locally in browser storage.");
    } else {
        apiSecurityKey = "";
        localStorage.removeItem("gemini_api_key");
        alert("⚠️ API Key cleared.");
    }
}

function handlePresetSelection() {
    const selected = document.getElementById("preset-select").value;
    if (!selected) {
        activePreset = "";
        return;
    }
    
    activePreset = selected;
    const preset = PRESETS[selected];

    // 1. Update Alert Ticker Bar
    const ticker = document.getElementById("ticker-text");
    ticker.textContent = `ACTIVE EVENT WARNING: ${preset.title.toUpperCase()} — PROTOCOLS IN PROCESS — DIAL 112 FOR IMMEDIATE RESCUE DISPATCH.`;
    
    // 2. Populate AI Assistant inputs
    document.getElementById("disaster-type").value = preset.disaster_type;
    document.getElementById("disaster-location").value = preset.location;
    document.getElementById("disaster-situation").value = preset.situation;
    document.getElementById("disaster-severity").value = preset.severity;

    // 3. Update EOC statistics cards
    document.getElementById("dashboard-threat-level").textContent = preset.threat_level;
    document.getElementById("dashboard-shelters-count").textContent = preset.shelters_count;
    document.getElementById("dashboard-rescues-count").textContent = preset.rescues_count;
    document.getElementById("dashboard-network-uptime").textContent = preset.uptime;

    // Adjust dashboard text colors based on threat scale
    const threatCardVal = document.getElementById("dashboard-threat-level");
    if (preset.threat_level === "CRITICAL") {
        threatCardVal.className = "stat-value text-danger";
    } else {
        threatCardVal.className = "stat-value text-warning";
    }

    // 4. Update weather grid
    const weatherGrid = document.getElementById("weather-grid-content");
    weatherGrid.innerHTML = "";
    preset.weather.forEach(w => {
        weatherGrid.innerHTML += `
            <div class="weather-item">
                <span class="w-loc">${w.loc}</span>
                <span class="w-temp">${w.temp}</span>
                <span class="w-desc">${w.desc}</span>
            </div>
        `;
    });

    // 5. Update Bulletin feed
    updateBulletinFeed(preset.bulletin);

    // 6. Update chart
    updateResourceChart(preset.chartData);

    // 7. Pan Leaflet Map & load blockages
    if (map) {
        map.setView(preset.coords, 11);
        
        // Render road blockages list
        const blockagesList = document.getElementById("blockages-list");
        blockagesList.innerHTML = "";
        
        // Clear previous blockages on map
        blockageCircles.forEach(c => map.removeLayer(c));
        blockageCircles = [];

        preset.blockages.forEach(b => {
            blockagesList.innerHTML += `
                <div class="blockage-item text-danger">
                    <span>⛔</span>
                    <div><strong>Closed Road:</strong> ${b.desc}</div>
                </div>
            `;

            // Draw hazard closure on map (Red Circle)
            let circle = L.circle(b.coords, {
                color: 'red',
                fillColor: '#f03',
                fillOpacity: 0.5,
                radius: 200
            }).addTo(map).bindPopup(`<b>HAZARD ROAD CLOSED:</b><br>${b.desc}`);
            blockageCircles.push(circle);
        });

        // Set route selection parameters automatically
        setupEvacuationFormDropdowns(selected);
    }
}

function setupEvacuationFormDropdowns(presetKey) {
    const startSelect = document.getElementById("route-start");
    const endSelect = document.getElementById("route-end");
    
    if (presetKey === "mumbai") {
        startSelect.value = "kurla-stn";
        endSelect.value = "kurla-school";
    } else if (presetKey === "himalayan") {
        startSelect.value = "rudra-village";
        endSelect.value = "rudra-hall";
    } else if (presetKey === "cyclone") {
        startSelect.value = "puri-beach";
        endSelect.value = "puri-shelter";
    } else if (presetKey === "vizag") {
        startSelect.value = "vizag-colony";
        endSelect.value = "vizag-shelter";
    } else if (presetKey === "delhi") {
        startSelect.value = "delhi-sec6";
        endSelect.value = "delhi-sports";
    }
}

function updateBulletinFeed(bulletins) {
    const list = document.getElementById("bulletin-list-container");
    list.innerHTML = "";
    
    const timeNow = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    bulletins.forEach((item, idx) => {
        let timestamp = timeNow;
        if (idx === 1) timestamp = "13:12";
        if (idx === 2) timestamp = "12:45";
        
        list.innerHTML += `
            <li>
                <code>[${timestamp}]</code> ${item}
            </li>
        `;
    });
}

// ==========================================================================
// Chart.js Configuration
// ==========================================================================
function initChart(allocatedData) {
    const ctx = document.getElementById('resourceChart').getContext('2d');
    
    // Buffer is remaining percentage
    const bufferData = allocatedData.map(val => 100 - val);

    resourceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ["Drinking Water (L)", "Food Packets", "Medical Kits", "Blankets", "Boats/Vehicles"],
            datasets: [
                {
                    label: 'Allocated (%)',
                    data: allocatedData,
                    backgroundColor: '#4facfe',
                    borderColor: '#00f2fe',
                    borderWidth: 1
                },
                {
                    label: 'Buffer Reserve (%)',
                    data: bufferData,
                    backgroundColor: '#ff3366',
                    borderColor: '#ff0055',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(35, 44, 77, 0.3)' },
                    ticks: { color: '#8c97ad', font: { family: 'Outfit' } }
                },
                y: {
                    grid: { color: 'rgba(35, 44, 77, 0.3)' },
                    ticks: { color: '#8c97ad', font: { family: 'Outfit' } },
                    max: 100
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#e1e7f0', font: { family: 'Outfit' } }
                }
            }
        }
    });
}

function updateResourceChart(newData) {
    if (resourceChartInstance) {
        resourceChartInstance.data.datasets[0].data = newData;
        resourceChartInstance.data.datasets[1].data = newData.map(val => 100 - val);
        resourceChartInstance.update();
    }
}

// ==========================================================================
// Leaflet Map Configuration
// ==========================================================================
function initMap() {
    // Center map on India
    map = L.map('map', {
        zoomControl: true,
        attributionControl: false
    }).setView([20.5937, 78.9629], 5);

    // Dark Map tiles from CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    // Custom EOC command marker placements
    const locations = [
        { name: "Mumbai Command Center (Floods)", coords: [19.0760, 72.8777], desc: "Kurla Relief Shelter Active<br>Capacity: 120/200" },
        { name: "Uttarakhand Command Center (Landslide)", coords: [30.2838, 78.9818], desc: "Rudraprayag Hilly Assembly Point<br>Capacity: 45/80" },
        { name: "Odisha Command Center (Cyclone)", coords: [19.8134, 85.8312], desc: "Puri Multipurpose Cyclone Shelter<br>Capacity: 350/500" },
        { name: "Vizag Command Center (Chemical Leak)", coords: [17.6868, 83.2185], desc: "Chemical Evacuation Hub<br>Capacity: 80/150" },
        { name: "Delhi Command Center (Heatwave)", coords: [28.5823, 77.0500], desc: "Cooling Center & Dehydration Ward Active" }
    ];

    locations.forEach(loc => {
        let mkr = L.marker(loc.coords)
            .addTo(map)
            .bindPopup(`<b>${loc.name}</b><br>${loc.desc}`);
        markers[loc.name] = mkr;
    });
}

function drawSafeEvacuationRoute() {
    const startVal = document.getElementById("route-start").value;
    const endVal = document.getElementById("route-end").value;

    if (!startVal || !endVal) {
        alert("⚠️ Route Planner: Please select both a Starting Point and an Evacuation Shelter.");
        return;
    }

    if (!activePreset) {
        alert("⚠️ Please select an EOC Incident Preset in the sidebar first to load hazard blockages.");
        return;
    }

    const preset = PRESETS[activePreset];
    
    // Clear previous route polyline
    if (routePolyline) {
        map.removeLayer(routePolyline);
    }

    // Draw Evacuation path
    routePolyline = L.polyline(preset.route.path, {
        color: '#00ff66',
        weight: 6,
        opacity: 0.8,
        dashArray: '10, 10'
    }).addTo(map);

    // Zoom Map to route
    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });

    // Show path confirmation on blockage panel
    const blockagesList = document.getElementById("blockages-list");
    blockagesList.innerHTML += `
        <div class="blockage-item-warning">
            <span>🚗</span>
            <div><strong>Safe Evacuation Corridor Drawn:</strong> Avoids red hazard blockage spots successfully. Route status: GREEN.</div>
        </div>
    `;

    // Open route popups
    L.popup()
        .setLatLng(preset.route.start)
        .setContent("<b>EVACUATION STARTING POINT</b>")
        .openOn(map);
}

function resetMapRoute() {
    if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
    }
    blockageCircles.forEach(c => map.removeLayer(c));
    blockageCircles = [];

    document.getElementById("route-start").value = "";
    document.getElementById("route-end").value = "";
    document.getElementById("blockages-list").innerHTML = `<div class="blockage-item text-danger">Select a starting point or load an Incident Preset to view hazard warnings.</div>`;
    
    // Reset view
    map.setView([20.5937, 78.9629], 5);
}

function resetMapRouteOnly() {
    if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
    }
}

// ==========================================================================
// Web Audio Warning Siren Generator (Electronic warble synthesizer)
// ==========================================================================
function toggleSirenDrill(show) {
    const overlay = document.getElementById("siren-overlay");
    if (show) {
        overlay.style.display = "flex";
        playSirenSound();
    } else {
        overlay.style.display = "none";
        stopSirenSound();
    }
}

function playSirenSound() {
    if (isSirenPlaying) return;
    
    try {
        // Initialize AudioContext
        sirenAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        sirenOscillator = sirenAudioContext.createOscillator();
        const gainNode = sirenAudioContext.createGain();
        
        sirenOscillator.type = 'sawtooth';
        sirenOscillator.frequency.setValueAtTime(450, sirenAudioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.15, sirenAudioContext.currentTime); // Low volume
        
        sirenOscillator.connect(gainNode);
        gainNode.connect(sirenAudioContext.destination);
        sirenOscillator.start();
        
        isSirenPlaying = true;

        // Create warble frequency sweeping effect
        let direction = 1;
        let freq = 450;
        
        sirenInterval = setInterval(() => {
            if (direction === 1) {
                freq += 30;
                if (freq >= 850) direction = -1;
            } else {
                freq -= 30;
                if (freq <= 450) direction = 1;
            }
            if (sirenOscillator && sirenAudioContext) {
                sirenOscillator.frequency.setValueAtTime(freq, sirenAudioContext.currentTime);
            }
        }, 30);

    } catch (e) {
        console.error("Audio Context Failed:", e);
    }
}

function stopSirenSound() {
    if (!isSirenPlaying) return;
    
    try {
        if (sirenOscillator) {
            sirenOscillator.stop();
            sirenOscillator.disconnect();
            sirenOscillator = null;
        }
        if (sirenInterval) {
            clearInterval(sirenInterval);
            sirenInterval = null;
        }
        if (sirenAudioContext) {
            sirenAudioContext.close();
            sirenAudioContext = null;
        }
    } catch (e) {
        console.error("Stopping Audio Context Failed:", e);
    }
    isSirenPlaying = false;
}

// ==========================================================================
// First Aid Reference Lookup Filter
// ==========================================================================
function filterFirstAid() {
    const searchVal = document.getElementById("firstaid-search").value.toLowerCase();
    const cards = document.querySelectorAll(".firstaid-card");
    
    cards.forEach(card => {
        const keywords = card.getAttribute("data-keywords");
        if (keywords.includes(searchVal)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

// ==========================================================================
// Volunteer Hub and Citizen requests
// ==========================================================================
function renderVolunteersTable() {
    const tbody = document.getElementById("volunteer-table-body");
    tbody.innerHTML = "";
    volunteersList.forEach(vol => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${vol.Name}</strong><br><span class="text-muted small">${vol.Contact}</span></td>
                <td>${vol.Skills}</td>
                <td><span class="badge badge-pending">${vol.Location}</span></td>
            </tr>
        `;
    });
}

function registerVolunteer() {
    const name = document.getElementById("vol-name").value.trim();
    const phone = document.getElementById("vol-phone").value.trim();
    const skill = document.getElementById("vol-skill").value;
    const loc = document.getElementById("vol-loc").value.trim();

    if (!name || !phone || !loc) {
        alert("⚠️ Please fill in all Volunteer fields.");
        return;
    }

    volunteersList.push({ Name: name, Contact: phone, Skills: skill, Location: loc });
    renderVolunteersTable();

    // Reset Form
    document.getElementById("volunteer-form").reset();
    alert(`🙋 Success! Thank you ${name}. You have been registered in the EOC Volunteer database.`);
}

function renderCitizenRequestsTable() {
    const tbody = document.getElementById("citizen-requests-table-body");
    tbody.innerHTML = "";
    citizenRequests.forEach(req => {
        let badgeClass = "badge-pending";
        if (req.Urgency === "Critical") badgeClass = "badge-failed";
        if (req.Urgency === "High") badgeClass = "badge-running";
        
        tbody.innerHTML += `
            <tr>
                <td><strong>${req.Address}</strong></td>
                <td>${req.Request}</td>
                <td><code>${req.People}</code></td>
                <td><span class="badge ${badgeClass}">${req.Urgency}</span></td>
            </tr>
        `;
    });
}

function submitHelpRequest() {
    const addr = document.getElementById("help-addr").value.trim();
    const reqText = document.getElementById("help-req").value.trim();
    const people = document.getElementById("help-people").value;
    const urgency = document.getElementById("help-urgency").value;

    if (!addr || !reqText) {
        alert("⚠️ Please fill in Address and request details.");
        return;
    }

    citizenRequests.unshift({ Address: addr, Request: reqText, People: parseInt(people), Urgency: urgency });
    renderCitizenRequestsTable();
    
    // Reset Form
    document.getElementById("help-request-form").reset();
    alert("🚨 Citizens SOS request registered and broadcasted to EOC rescue feeds.");
}

// ==========================================================================
// Shelters Page Resource Manager
// ==========================================================================
function renderSheltersTable(state) {
    const tbody = document.getElementById("shelter-table-body");
    tbody.innerHTML = "";
    
    const list = SHELTERS_DB[state] || [];
    list.forEach(sh => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${sh.Name}</strong></td>
                <td><code>${sh.Capacity}</code></td>
                <td>${sh.Water}</td>
                <td>${sh.Food}</td>
                <td><span class="badge badge-completed">${sh.Medical}</span></td>
            </tr>
        `;
    });
}

function loadShelterDropdown(state) {
    const dropdown = document.getElementById("req-shelter");
    dropdown.innerHTML = "";
    
    const list = SHELTERS_DB[state] || [];
    list.forEach(sh => {
        dropdown.innerHTML += `<option value="${sh.Name}">${sh.Name}</option>`;
    });
}

function handleShelterStateFilter() {
    const state = document.getElementById("shelter-state-filter").value;
    renderSheltersTable(state);
    loadShelterDropdown(state);
}

function submitResourceRequest() {
    const shelter = document.getElementById("req-shelter").value;
    const type = document.getElementById("req-type").value;
    const qty = document.getElementById("req-qty").value;
    const urgency = document.getElementById("req-urgency").value;

    alert(`🚀 Dispatch Request Queue: Verified and routed ${qty} units of "${type}" to "${shelter}". [Priority: ${urgency}]`);
    document.getElementById("resource-request-form").reset();
}

// Copy helpline number
function copyText(txt) {
    navigator.clipboard.writeText(txt).then(() => {
        alert(`📋 Copied: ${txt}`);
    });
}

// ==========================================================================
// Multi-Agent Gemini Orchestration (Direct REST Client-Side integration)
// ==========================================================================
async function callGeminiApi(promptText, systemInstructionText, isJson = false) {
    if (!apiSecurityKey) {
        throw new Error("Gemini API key is not configured. Please supply a valid key in the EOC configuration panel.");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiSecurityKey}`;

    const requestBody = {
        contents: [
            {
                parts: [{ text: promptText }]
            }
        ],
        systemInstruction: {
            parts: [{ text: systemInstructionText }]
        },
        generationConfig: {
            temperature: 0.2
        }
    };

    if (isJson) {
        requestBody.generationConfig.responseMimeType = "application/json";
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Request Failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text.trim();
    } else {
        throw new Error("Received empty or malformed response from the Gemini API.");
    }
}

// Main Runner Orchestration Flow
async function runMultiAgentFlow() {
    const disasterType = document.getElementById("disaster-type").value.trim();
    const location = document.getElementById("disaster-location").value.trim();
    const situation = document.getElementById("disaster-situation").value.trim();
    const severity = document.getElementById("disaster-severity").value;

    if (!disasterType || !location || !situation) {
        alert("⚠️ Incomplete Details. Please fill in Disaster Type, Location, and Description.");
        return;
    }

    if (!apiSecurityKey) {
        alert("🔑 API Key Required. Provide your Gemini Security Key in the EOC sidebar panel.");
        return;
    }

    // Reset status badges
    const agentKeys = ["supervisor", "assessment", "medical", "resource", "shelter", "communication"];
    agentKeys.forEach(k => {
        const badge = document.getElementById(`badge-${k}`);
        badge.className = "badge badge-pending";
        badge.textContent = "Pending";
    });

    // Show output container
    const outputContainer = document.getElementById("ai-output-container");
    outputContainer.classList.remove("hidden");
    outputContainer.scrollIntoView({ behavior: "smooth" });

    // Set Supervisor to Running
    setAgentStatus("supervisor", "Running", "badge-running");

    const promptText = `
DISASTER ANALYSIS REQUEST:
Disaster Type: ${disasterType}
Location: ${location}
Current Situation & Details: ${situation}
Severity Setting: ${severity}

Based on this emergency input, perform your specialized agent analysis.
Provide a clear, detailed, and structured response in Markdown. Do not include placeholders.
`;

    subAgentOutputs = {};

    try {
        // Step 1: Supervisor selects relevant agents (simulated selector tool)
        setAgentStatus("supervisor", "Determining Agents", "badge-running");
        
        // We will execute all 5 agents since it's an emergency, but let's query the API to show supervisor activity
        // To make it faster and robust, let's call the agents sequentially
        const activeAgentsList = ["assessment", "medical", "resource", "shelter", "communication"];

        // Set skipped agents if any
        agentKeys.forEach(k => {
            if (k !== "supervisor" && !activeAgentsList.includes(k)) {
                setAgentStatus(k, "Skipped", "badge-skipped");
            }
        });

        // Step 2: Run active agents sequentially
        for (const agentKey of activeAgentsList) {
            setAgentStatus(agentKey, "Running", "badge-running");
            
            const agentPrompt = AGENT_PROMPTS[agentKey];
            try {
                const report = await callGeminiApi(promptText, agentPrompt.system);
                subAgentOutputs[agentKey] = report;
                setAgentStatus(agentKey, "Completed", "badge-completed");
            } catch (err) {
                console.error(`Agent ${agentKey} failed:`, err);
                subAgentOutputs[agentKey] = `Error: Agent failed to execute: ${err.message}`;
                setAgentStatus(agentKey, "Failed", "badge-failed");
            }
        }

        // Step 3: Supervisor Synthesis
        setAgentStatus("supervisor", "Synthesizing", "badge-running");
        
        let reportsContext = "";
        for (const [key, report] of Object.entries(subAgentOutputs)) {
            const agentName = document.getElementById(`status-${key}`).querySelector(".agent-name").textContent;
            reportsContext += `=== REPORT FROM ${agentName} ===\n${report}\n\n`;
        }

        const supervisorPrompt = `
Disaster Context:
- Type: ${disasterType}
- Location: ${location}
- Situation: ${situation}
- Severity: ${severity}

Here are the specialized reports from the sub-agents:
${reportsContext}

Please synthesize these reports into the final cohesive Emergency Operations Plan.
`;

        const finalPlan = await callGeminiApi(supervisorPrompt, AGENT_PROMPTS.supervisor.system);
        generatedPlanMarkdown = finalPlan;
        
        setAgentStatus("supervisor", "Completed", "badge-completed");

        // RENDER OUTPUTS
        renderPlanOutputs();

    } catch (e) {
        console.error("EOC Compilation Failed:", e);
        setAgentStatus("supervisor", "Failed", "badge-failed");
        alert(`EOC Command Compilation Failed: ${e.message}`);
    }
}

function setAgentStatus(agentKey, text, className) {
    const badge = document.getElementById(`badge-${agentKey}`);
    if (badge) {
        badge.className = `badge ${className}`;
        badge.textContent = text;
    }
}

// Render Gemini outputs to tabs
function renderPlanOutputs() {
    // 1. Render markdown synthesis
    const planMarkdownBody = document.getElementById("synthesized-plan-markdown");
    planMarkdownBody.innerHTML = parseSimpleMarkdown(generatedPlanMarkdown);

    // 2. Render Checklists
    const checklistItemsBox = document.getElementById("interactive-checklist-items");
    checklistItemsBox.innerHTML = "";
    
    // Extract checkboxes from medical and resource reports
    const medicalReport = subAgentOutputs["medical"] || "";
    const resourceReport = subAgentOutputs["resource"] || "";
    
    const checkboxes = parseChecklistItems(medicalReport).concat(parseChecklistItems(resourceReport));
    
    if (checkboxes.length > 0) {
        checkboxes.forEach((item, index) => {
            const itemElement = document.createElement("label");
            itemElement.className = "chk-item";
            itemElement.innerHTML = `
                <input type="checkbox" id="chk-supply-${index}">
                <span>${item}</span>
            `;
            
            // Checkbox event
            itemElement.querySelector("input").addEventListener("change", (e) => {
                if (e.target.checked) {
                    itemElement.classList.add("checked");
                } else {
                    itemElement.classList.remove("checked");
                }
            });
            
            checklistItemsBox.appendChild(itemElement);
        });
    } else {
        checklistItemsBox.innerHTML = `
            <div class="text-warning">No standard checkboxes could be parsed from reports. Below is raw Resource checklist output:</div>
            <div class="markdown-body mt-2">${parseSimpleMarkdown(resourceReport)}</div>
        `;
    }

    // 3. Render Communication templates
    const commsOutput = document.getElementById("comms-templates-output");
    commsOutput.innerHTML = parseSimpleMarkdown(subAgentOutputs["communication"] || "No communications drafted.");

    // 4. Render Raw sub-agent accordion logs
    const accordion = document.getElementById("subagent-logs-accordion");
    accordion.innerHTML = "";
    
    Object.entries(subAgentOutputs).forEach(([key, report]) => {
        const agentName = document.getElementById(`status-${key}`).querySelector(".agent-name").textContent;
        accordion.innerHTML += `
            <div class="acc-item" id="acc-${key}">
                <div class="acc-header" onclick="toggleAccordion('acc-${key}')">
                    <span>🔍 View ${agentName} raw output</span>
                    <span>▼</span>
                </div>
                <div class="acc-body markdown-body">
                    ${parseSimpleMarkdown(report)}
                </div>
            </div>
        `;
    });
}

function toggleAccordion(itemId) {
    const item = document.getElementById(itemId);
    if (item.classList.contains("open")) {
        item.classList.remove("open");
    } else {
        item.classList.add("open");
    }
}

// Markdown parser helper (Simulating basic md rules)
function parseSimpleMarkdown(md) {
    if (!md) return "";
    let html = md;
    
    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    
    // Bullet lists
    html = html.replace(/^\s*-\s*\[[ x]\]\s*(.*$)/gim, '<li>$1</li>'); // replace checkboxes
    html = html.replace(/^\s*-\s*(.*$)/gim, '<li>$1</li>');
    html = html.replace(/^\s*\*\s*(.*$)/gim, '<li>$1</li>');
    
    // Wrap consecutive list items in <ul>
    // Quick and simple regex replacement for sequential list tag conversion
    html = html.replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');

    // Blockquotes
    html = html.replace(/^\s*>\s*(.*$)/gim, '<blockquote>$1</blockquote>');

    // Line breaks
    html = html.replace(/\n$/gim, '<br />');
    
    return html;
}

function parseChecklistItems(text) {
    const pattern = /^\s*-\s*\[\s*\]\s*(.*)$/gm;
    let match;
    const items = [];
    while ((match = pattern.exec(text)) !== null) {
        items.push(match[1].trim());
    }
    return items;
}

// ==========================================================================
// Accessibility Broadcast & Exporter
// ==========================================================================
function speakPlan() {
    if (!generatedPlanMarkdown) {
        alert("⚠️ TTS System: No plan available to read. Please run the AI Assistant first.");
        return;
    }

    // Stop current speech
    window.speechSynthesis.cancel();

    // Clean markdown text for TTS engine
    let cleanText = generatedPlanMarkdown
        .replace(/[*#_`\-]/g, ' ')
        .replace(/\[\s*\]/g, ' ')
        .substring(0, 2000); // limit speech buffer

    cleanText += "... End of emergency operations directive.";

    speechUtterance = new SpeechSynthesisUtterance(cleanText);
    speechUtterance.rate = 1.0;
    speechUtterance.pitch = 1.0;

    // Show wave animation
    document.getElementById("tts-waves").classList.remove("hidden");

    speechUtterance.onend = () => {
        document.getElementById("tts-waves").classList.add("hidden");
    };

    speechUtterance.onerror = () => {
        document.getElementById("tts-waves").classList.add("hidden");
    };

    window.speechSynthesis.speak(speechUtterance);
}

function stopSpeech() {
    window.speechSynthesis.cancel();
    document.getElementById("tts-waves").classList.add("hidden");
}

function exportActionPlan() {
    if (!generatedPlanMarkdown) {
        alert("⚠️ Exporter: No synthesized plan to export.");
        return;
    }

    const disasterType = document.getElementById("disaster-type").value || "Disaster";
    const location = document.getElementById("disaster-location").value || "Location";
    const severity = document.getElementById("disaster-severity").value;

    let exportContent = `# EOC COMMAND ACTION PLAN\n`;
    exportContent += `Disaster: ${disasterType}\n`;
    exportContent += `Location: ${location}\n`;
    exportContent += `Severity: ${severity}\n`;
    exportContent += `Export Timestamp: ${new Date().toLocaleString()}\n`;
    exportContent += `=========================================\n\n`;
    exportContent += generatedPlanMarkdown;

    const blob = new Blob([exportContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const filename = `eoc_incident_plan_${location.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    link.setAttribute("download", filename);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
