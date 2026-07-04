"""
LifeBridge AI – Emergency Operations Center (EOC) Dashboard
Redesigned dashboard for the "Agents for Good" track. Localized for India.
"""

# pyrefly: ignore [missing-import]
import streamlit as st
import os
import re
import urllib.parse
import json
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

# pyrefly: ignore [missing-import]
import folium
from streamlit_folium import st_folium

from utils.gemini_client import GeminiClient
from agents.supervisor import SupervisorAgent

# Load environment variables
load_dotenv()

# App Configuration
st.set_page_config(
    page_title="LifeBridge AI - EOC Command Center",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom EOC Dark Futuristic Styling 
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Outfit:wght@300;400;600;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Outfit', sans-serif;
        background-color: #0b0d17;
    }
    
    .eoc-header-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 2.5rem;
        font-weight: 700;
        letter-spacing: 2px;
        background: linear-gradient(90deg, #00f2fe, #4facfe);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0px;
    }
    
    .ticker-bar {
        background-color: #1a0f1a;
        border: 1px solid #ff0055;
        border-radius: 6px;
        padding: 8px 15px;
        color: #ff3366;
        font-weight: bold;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
        margin-bottom: 20px;
        animation: blink 2.5s infinite;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    @keyframes blink {
        0% { border-color: #ff0055; box-shadow: 0 0 5px #ff0055; }
        50% { border-color: #330011; box-shadow: 0 0 0px #000; }
        100% { border-color: #ff0055; box-shadow: 0 0 5px #ff0055; }
    }
    
    .eoc-card {
        background-color: #121626;
        border: 1px solid #1f293d;
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 15px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    }
    
    .eoc-card-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 1rem;
        font-weight: 700;
        color: #00f2fe;
        margin-bottom: 15px;
        border-bottom: 1px solid #1f293d;
        padding-bottom: 5px;
    }
    
    .metric-value {
        font-size: 2.2rem;
        font-weight: 700;
        font-family: 'Orbitron', sans-serif;
        color: #ffffff;
    }
    
    .metric-label {
        font-size: 0.85rem;
        color: #8c97ad;
        text-transform: uppercase;
        margin-top: 5px;
    }
    
    /* Custom status indicators for agents */
    .agent-box {
        background-color: #171d33;
        border: 1px solid #232c4d;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .status-badge {
        font-family: 'Orbitron', sans-serif;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: bold;
        text-transform: uppercase;
    }
    
    .badge-pending { background-color: #2b3554; color: #a1b0d4; }
    .badge-running { background-color: #bfa100; color: #ffffff; animation: pulse-glow 1.5s infinite; }
    .badge-completed { background-color: #00875a; color: #ffffff; }
    .badge-failed { background-color: #de350b; color: #ffffff; }
    .badge-skipped { background-color: #3b4252; color: #d8dee9; }
    
    @keyframes pulse-glow {
        0% { transform: scale(0.98); opacity: 0.8; }
        50% { transform: scale(1.02); opacity: 1; }
        100% { transform: scale(0.98); opacity: 0.8; }
    }
</style>
""", unsafe_allow_html=True)

# Helper function to parse markdown checkboxes
def parse_checklist_items(text: str) -> list:
    """Extract lines like '- [ ] Item Description' from text."""
    pattern = r'^\s*-\s*\[\s*\]\s*(.*)$'
    items = []
    if not text:
        return items
    for line in text.splitlines():
        match = re.match(pattern, line)
        if match:
            items.append(match.group(1).strip())
    return items

# Indian Presets
PRESETS = {
    "Select emergency template...": {
        "disaster_type": "",
        "location": "",
        "situation": "",
        "severity": "High"
    },
    "Mumbai Monsoon Flooding (Kurla, MH)": {
        "disaster_type": "Monsoon Flooding & Grid Outage",
        "location": "Kurla West, Mumbai, Maharashtra",
        "situation": "Heavy rains for 24 hours. Water levels on the street are at 3.5 feet, starting to enter ground floor buildings. Power is off as a safety measure. We have an elderly grandparent who uses a walker and requires regular medications. Drinking water supplies are running low.",
        "severity": "Critical"
    },
    "Himalayan Cloudburst (Rudraprayag, UK)": {
        "disaster_type": "Cloudburst & Mountain Mudslide",
        "location": "Rudraprayag District, Uttarakhand",
        "situation": "A cloudburst higher up has triggered mudslides and flash floods. The village access road is completely washed out, isolating 45 tourists. Foundation walls of the local guest house are showing structural cracks. Mobile network is highly unstable.",
        "severity": "Critical"
    },
    "Cyclone Landfall (Puri, Odisha)": {
        "disaster_type": "Severe Cyclone (Landfall Phase)",
        "location": "Puri Coast, Odisha",
        "situation": "Severe cyclone landfall in progress. Wind speeds reaching 160 km/h with massive storm surges. Trees and power poles are down, blocking the evacuation roads. Many low-income houses with metal/tin sheet roofs are damaged. Multi-purpose cyclone shelter is active but road clearing is needed.",
        "severity": "Critical"
    },
    "Vizag Gas Leak (Industrial Area, AP)": {
        "disaster_type": "Industrial Chemical gas release",
        "location": "Industrial Corridor, Visakhapatnam, Andhra Pradesh",
        "situation": "Sirens blaring from the chemical plant. Faint sweet/chemical odor in the air. Neighbors reporting skin itching, burning eyes, and breathing difficulties. We are attempting to shelter-in-place but need immediate containment protocols.",
        "severity": "High"
    },
    "Severe Delhi Heatwave (Dwarka, New Delhi)": {
        "disaster_type": "Extreme Heatwave & Power Outage",
        "location": "Dwarka Sector 6, New Delhi",
        "situation": "Outdoor temperatures peaking at 48°C. Power transformer burst has knocked out electricity in the sector for 10 hours. ACs/fans are down. Indoor temperatures have crossed 41°C. An infant and an elderly diabetic resident are showing signs of heavy dehydration.",
        "severity": "High"
    }
}

# Sidebar Navigation Panel
with st.sidebar:
    st.markdown("""
    <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 3rem;">🛡️</span>
        <h3 style="font-family: 'Orbitron', sans-serif; color: #00f2fe; margin-top: 10px;">LIFEBRIDGE AI</h3>
        <p style="color: #6a7791; font-size: 0.8rem;">Emergency Operations Center</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Credentials Config
    st.markdown("### 🛠️ EOC Configuration")
    env_key = os.getenv("GEMINI_API_KEY", "")
    api_key_input = st.text_input(
        "Gemini API Security Key",
        value=env_key,
        type="password",
        help="Specify Gemini API Key to activate AI responses."
    )
    if api_key_input:
        os.environ["GEMINI_API_KEY"] = api_key_input
        
    st.markdown("---")
    
    # Navigation Select
    st.markdown("### 🗺️ Navigation Menu")
    page = st.selectbox(
        "Select Command Module",
        options=[
            "📊 EOC Dashboard",
            " Live Disaster Map",
            "🤖 AI Crisis Assistant",
            "🏥 Shelters & Resources",
            "📞 Emergency Helpline",
            "🤝 Volunteer Hub"
        ]
    )
    
    st.markdown("---")
    
    # Presets Quick-Select
    st.markdown("### 📋 EOC Incident Presets")
    preset_select = st.selectbox("Load Incident Template", options=list(PRESETS.keys()))
    preset_data = PRESETS[preset_select]

# Top Alert Bar (Always visible)
alert_text = "EOC ALERTS: SYSTEM ONLINE. STANDBY FOR COORDINATION."
if preset_select != "Select emergency template...":
    alert_text = f"ACTIVE EVENT WARNING: {preset_select.upper()} — THREAT PROTOCOLS TRIGGERED."

st.markdown(f"""
<div class="ticker-bar">
    <span>⚠️</span>
    <marquee scrollamount="4">{alert_text} — DIAL 112 FOR EMERGENCY DISPATCH — INSTRUCTIONS ARE UPDATING IN REAL-TIME.</marquee>
</div>
""", unsafe_allow_html=True)

# ----------------- PAGE 1: EOC DASHBOARD -----------------
if page == "📊 EOC Dashboard":
    st.markdown('<div class="eoc-header-title">EOC COMMAND DASHBOARD</div>', unsafe_allow_html=True)
    st.markdown("<p style='color: #6a7791;'>Operational statistics and active threat feeds across regional command zones.</p>", unsafe_allow_html=True)
    st.markdown("---")
    
    # Quick Statistics Cards Row
    col_t1, col_t2, col_t3, col_t4 = st.columns(4)
    with col_t1:
        st.markdown("""
        <div class="eoc-card">
            <div class="metric-value" style="color: #ff3366;">CRITICAL</div>
            <div class="metric-label">Active Threat Level</div>
        </div>
        """, unsafe_allow_html=True)
    with col_t2:
        st.markdown("""
        <div class="eoc-card">
            <div class="metric-value" style="color: #00ff66;">142</div>
            <div class="metric-label">Active Multipurpose Shelters</div>
        </div>
        """, unsafe_allow_html=True)
    with col_t3:
        st.markdown("""
        <div class="eoc-card">
            <div class="metric-value" style="color: #ffcc00;">7 RESCUES</div>
            <div class="metric-label">NDRF Operations In Progress</div>
        </div>
        """, unsafe_allow_html=True)
    with col_t4:
        st.markdown("""
        <div class="eoc-card">
            <div class="metric-value" style="color: #00f2fe;">89.2%</div>
            <div class="metric-label">Telecom Network Uptime</div>
        </div>
        """, unsafe_allow_html=True)

    col_details, col_feed = st.columns([2, 1])
    
    with col_details:
        st.markdown('<div class="eoc-card">', unsafe_allow_html=True)
        st.markdown('<div class="eoc-card-title">🛡️ EOC Command Center Details</div>', unsafe_allow_html=True)
        st.markdown("""
        The **LifeBridge AI Command Center** coordinates specialized sub-agents to synthesize custom action guidelines.
        
        * Use the **Sidebar Menu** to toggle pages.
        * Choose a **Preset Incident Template** to load test scenarios (e.g. Mumbai Monsoon Floods, Vizag Gas Leak).
        * Navigate to **🤖 AI Crisis Assistant** to invoke the Supervisor and generate a tailored emergency management strategy.
        * Check ** Live Disaster Map** to view relief markers and localized hazard warnings in real-time.
        """)
        st.markdown('</div>', unsafe_allow_html=True)
        
        # Simulated resources status chart
        st.markdown('<div class="eoc-card">', unsafe_allow_html=True)
        st.markdown('<div class="eoc-card-title">📈 Regional Resource Allocation Status</div>', unsafe_allow_html=True)
        
        res_data = pd.DataFrame({
            "Resource Type": ["Drinking Water (L)", "Food Packets", "Medical Kits", "Blankets", "Boats/Vehicles"],
            "Allocated (%)": [82, 64, 91, 45, 78],
            "Buffer Reserve (%)": [18, 36, 9, 55, 22]
        })
        st.bar_chart(res_data, x="Resource Type", y=["Allocated (%)", "Buffer Reserve (%)"], color=["#4facfe", "#ff3366"])
        st.markdown('</div>', unsafe_allow_html=True)
        
    with col_feed:
        st.markdown('<div class="eoc-card">', unsafe_allow_html=True)
        st.markdown('<div class="eoc-card-title">⚡ Live Incident Bulletin Feed</div>', unsafe_allow_html=True)
        
        # Mock feeds with timestamps
        current_time = datetime.now().strftime("%H:%M")
        st.markdown(f"""
        * `[{current_time}]` 🚨 **Mumbai**: SDRF teams dispatched to Kurla West with 12 inflatable boats.
        * `[13:12]` ⚠️ **Odisha Puri**: Coastal evacuation warnings broadcast via local radio and SMS towers.
        * `[12:45]` 🏥 **Uttarakhand**: Multipurpose community center shelters opened in Rudraprayag.
        * `[11:30]` 🏥 **Vizag**: NDRF teams establishing a 2km hazard containment ring.
        * `[10:15]` 🫗 **Delhi**: Water tankers dispatched to Dwarka Sector 6 to combat dry grid conditions.
        """)
        st.markdown('</div>', unsafe_allow_html=True)

# ----------------- PAGE 2: LIVE DISASTER MAP -----------------
elif page == " Live Disaster Map":
    st.markdown('<div class="eoc-header-title">LIVE EOC HAZARD & SHELTER MAP</div>', unsafe_allow_html=True)
    st.markdown("<p style='color: #6a7791;'>Interactive map visualization displaying rescue locations, active warning zones, and shelter points.</p>", unsafe_allow_html=True)
    st.markdown("---")
    
    # Coordinates of India Presets
    # 1. Mumbai: 19.0760, 72.8777
    # 2. Puri: 19.8134, 85.8312
    # 3. Rudraprayag: 30.2838, 78.9818
    # 4. Vizag: 17.6868, 83.2185
    # 5. Delhi: 28.5823, 77.0500
    
    map_center = [20.5937, 78.9629] # Center of India
    zoom_level = 5
    
    # If a preset is chosen, let's zoom in on that area!
    preset_coords = {
        "Mumbai Monsoon Flooding (Kurla, MH)": [19.0760, 72.8777],
        "Himalayan Cloudburst (Rudraprayag, UK)": [30.2838, 78.9818],
        "Cyclone Landfall (Puri, Odisha)": [19.8134, 85.8312],
        "Vizag Gas Leak (Industrial Area, AP)": [17.6868, 83.2185],
        "Severe Delhi Heatwave (Dwarka, New Delhi)": [28.5823, 77.0500]
    }
    
    if preset_select in preset_coords:
        map_center = preset_coords[preset_select]
        zoom_level = 10
        
    m = folium.Map(location=map_center, zoom_start=zoom_level, tiles="CartoDB dark_matter")
    
    # Add Markers for each scenario
    folium.Marker(
        location=[19.0760, 72.8777],
        popup="<b>Mumbai command</b><br>Kurla Flood Relief Shelter Active<br>Capacity: 120/200",
        tooltip="Mumbai Command (Flood Shelter)",
        icon=folium.Icon(color="red", icon="info-sign")
    ).add_to(m)
    
    folium.Marker(
        location=[30.2838, 78.9818],
        popup="<b>Uttarakhand Command</b><br>Rudraprayag Hilly Assembly Point<br>Capacity: 45/80",
        tooltip="Uttarakhand Command (Landslide Assembly)",
        icon=folium.Icon(color="orange", icon="info-sign")
    ).add_to(m)
    
    folium.Marker(
        location=[19.8134, 85.8312],
        popup="<b>Odisha Command</b><br>Puri Multipurpose Cyclone Shelter<br>Capacity: 350/500",
        tooltip="Puri Cyclone Shelter",
        icon=folium.Icon(color="green", icon="home")
    ).add_to(m)
    
    folium.Marker(
        location=[17.6868, 83.2185],
        popup="<b>Vizag Command</b><br>Chemical Evacuation Hub<br>Capacity: 80/150",
        tooltip="Vizag Gas Release Shelter",
        icon=folium.Icon(color="purple", icon="warning")
    ).add_to(m)
    
    folium.Marker(
        location=[28.5823, 77.0500],
        popup="<b>Delhi Command</b><br>Cooling Center & Dehydration Ward<br>Active",
        tooltip="Delhi Command Cooling Center",
        icon=folium.Icon(color="blue", icon="tint")
    ).add_to(m)
    
    # Render map
    st_folium(m, width="100%", height=600)
    
    st.info("💡 Pro-Tip: Select an incident template in the sidebar to automatically center and zoom the command map on that event zone.")

# ----------------- PAGE 3: AI CRISIS ASSISTANT -----------------
elif page == "🤖 AI Crisis Assistant":
    st.markdown('<div class="eoc-header-title">EOC AI COMMAND ASSISTANT</div>', unsafe_allow_html=True)
    st.markdown("<p style='color: #6a7791;'>Invoke LifeBridge AI's modular agents to generate a detailed Emergency Action Plan.</p>", unsafe_allow_html=True)
    st.markdown("---")
    
    col_form, col_status_panel = st.columns([2, 1])
    
    # Initialize session states
    if "agent_status" not in st.session_state:
        st.session_state.agent_status = {}
    if "execution_results" not in st.session_state:
        st.session_state.execution_results = None
    if "final_synthesis" not in st.session_state:
        st.session_state.final_synthesis = None

    with col_form:
        st.markdown("### 📥 Dispatch Details")
        
        # Load preset details or defaults
        default_disaster = preset_data["disaster_type"]
        default_location = preset_data["location"]
        default_situation = preset_data["situation"]
        default_severity = preset_data["severity"]
        
        disaster_type = st.text_input(
            "Disaster Event Type",
            value=default_disaster,
            placeholder="e.g. Cyclone Landfall, Monsoon Flooding..."
        )
        
        location = st.text_input(
            "Incident Location",
            value=default_location,
            placeholder="e.g. Kurla, Mumbai, Maharashtra..."
        )
        
        situation = st.text_area(
            "Crisis Description & Intel",
            value=default_situation,
            placeholder="Specify entrapment details, power statuses, injuries, and logistics...",
            height=130
        )
        
        col_sev, col_btn = st.columns([1, 1])
        with col_sev:
            severity = st.selectbox(
                "Assessment Severity Scale",
                options=["Low", "Medium", "High", "Critical"],
                index=["Low", "Medium", "High", "Critical"].index(default_severity)
            )
        with col_btn:
            st.write("")
            st.write("")
            run_assistant = st.button("🚨 Compile Emergency Action Plan", use_container_width=True)

    with col_status_panel:
        st.markdown("### 🤖 Agent Orchestration Flow")
        status_box = st.empty()
        
        def display_agent_states(states):
            agents_list = {
                "supervisor": "Supervisor Agent",
                "assessment": "Disaster Assessment Agent",
                "medical": "Medical Agent",
                "resource": "Resource Agent",
                "shelter": "Shelter Agent",
                "communication": "Communication Agent"
            }
            
            box_html = ""
            for key, name in agents_list.items():
                state = states.get(key, "Pending")
                if state == "Pending":
                    badge_class = "badge-pending"
                elif state == "Running":
                    badge_class = "badge-running"
                elif state == "Completed":
                    badge_class = "badge-completed"
                elif state == "Failed":
                    badge_class = "badge-failed"
                else:
                    badge_class = "badge-skipped"
                
                box_html += f"""
                <div class="agent-box">
                    <span style="font-weight: 600; color: #e1e7f0; font-size: 0.95rem;">{name}</span>
                    <span class="status-badge {badge_class}">{state}</span>
                </div>
                """
            status_box.markdown(f'<div style="margin-top: 10px;">{box_html}</div>', unsafe_allow_html=True)
            
        display_agent_states(st.session_state.agent_status)

    if run_assistant:
        if not disaster_type or not location or not situation:
            st.error("⚠️ Incomplete Details. Please fill in Disaster Type, Location, and Situation.")
        elif not api_key_input:
            st.error("🔑 API Security Key Required. Provide your Gemini key in the sidebar configuration.")
        else:
            st.session_state.agent_status = {
                "supervisor": "Running",
                "assessment": "Pending",
                "medical": "Pending",
                "resource": "Pending",
                "shelter": "Pending",
                "communication": "Pending"
            }
            display_agent_states(st.session_state.agent_status)
            
            try:
                # Initialize Gemini and Supervisor
                client = GeminiClient(api_key=api_key_input)
                supervisor = SupervisorAgent(client)
                
                # 1. Determine relevant agents
                st.session_state.agent_status["supervisor"] = "Running"
                display_agent_states(st.session_state.agent_status)
                
                selected_agents = supervisor.determine_relevant_agents(disaster_type, location, situation)
                
                # Update skipped states
                for key in st.session_state.agent_status.keys():
                    if key != "supervisor" and key not in selected_agents:
                        st.session_state.agent_status[key] = "Skipped"
                display_agent_states(st.session_state.agent_status)
                
                # Callback to render visual EOC progress
                def progress_cb(agent_name, status):
                    agent_key = None
                    for key, obj in supervisor.agents.items():
                        if obj.name == agent_name:
                            agent_key = key
                            break
                    if agent_key:
                        if status == "running":
                            st.session_state.agent_status[agent_key] = "Running"
                        elif status == "completed":
                            st.session_state.agent_status[agent_key] = "Completed"
                        elif status == "failed":
                            st.session_state.agent_status[agent_key] = "Failed"
                        display_agent_states(st.session_state.agent_status)
                
                # 2. Run selected agents
                reports = supervisor.execute_agents(
                    disaster_type=disaster_type,
                    location=location,
                    situation=situation,
                    selected_agents=selected_agents,
                    progress_callback=progress_cb
                )
                st.session_state.execution_results = reports
                
                # 3. Supervisor Synthesizes reports
                st.session_state.agent_status["supervisor"] = "Running"
                display_agent_states(st.session_state.agent_status)
                
                synthesis = supervisor.synthesize_final_plan(disaster_type, location, situation, reports)
                st.session_state.final_synthesis = synthesis
                
                st.session_state.agent_status["supervisor"] = "Completed"
                display_agent_states(st.session_state.agent_status)
                
            except Exception as e:
                st.session_state.agent_status["supervisor"] = "Failed"
                display_agent_states(st.session_state.agent_status)
                st.error(f"EOC Compilation Failed: {str(e)}")

    # Render results
    if st.session_state.final_synthesis:
        st.markdown("---")
        st.markdown("## 🛡️ EOC ACTION PLATFORM OUTPUT")
        
        tab_plan, tab_checks, tab_comms, tab_logs, tab_tts = st.tabs([
            "🛡️ EOC Incident Plan",
            "🎒 Logistical Checklists",
            "💬 Message Templates",
            "🤖 Sub-Agent Logs",
            "🔊 EOC Broadcast (TTS)"
        ])
        
        with tab_plan:
            st.markdown(st.session_state.final_synthesis)
            
            # Export Plan
            st.markdown("---")
            combined_md = f"""# EOC COMMAND ACTION PLAN
Disaster: {disaster_type}
Location: {location}
Severity: {severity}

=========================================
EOC SYNTHESIS
=========================================
{st.session_state.final_synthesis}
"""
            for k, val in st.session_state.execution_results.items():
                combined_md += f"\n\n## {k.upper()} REPORT\n{val}"
                
            st.download_button(
                label="💾 Export Action Plan (Markdown)",
                data=combined_md,
                file_name=f"eoc_incident_plan_{location.replace(' ', '_')}.md",
                mime="text/markdown",
                use_container_width=True
            )
            
        with tab_checks:
            st.subheader("🎒 Interactive EOC Checklist")
            
            # Try to grab lists from resource/medical
            res_rep = st.session_state.execution_results.get("resource", "")
            med_rep = st.session_state.execution_results.get("medical", "")
            
            combined_checklist = parse_checklist_items(res_rep) + parse_checklist_items(med_rep)
            
            if combined_checklist:
                st.info("Check off supplies and medical items as they are collected/packed:")
                for index, item in enumerate(combined_checklist):
                    st.checkbox(item, key=f"eoc_check_{index}")
            else:
                st.warning("No standard checkboxes could be parsed from the reports. Here is the raw resource report:")
                st.markdown(res_rep)
                
        with tab_comms:
            st.subheader("💬 Pre-Formatted SOS Alerts")
            comm_report = st.session_state.execution_results.get("communication", "")
            st.markdown(comm_report)
            
        with tab_logs:
            st.subheader("🤖 Sub-Agent Reports")
            for key, val in st.session_state.execution_results.items():
                name = key.capitalize() + " Agent"
                if key == "assessment":
                    name = "Disaster Assessment Agent"
                elif key == "medical":
                    name = "Medical Agent"
                elif key == "resource":
                    name = "Resource Agent"
                elif key == "shelter":
                    name = "Shelter Agent"
                elif key == "communication":
                    name = "Communication Agent"
                    
                with st.expander(f"🔍 View {name} raw output"):
                    st.markdown(val)
                    
        with tab_tts:
            st.subheader("🔊 Audio Broadcast System")
            st.markdown("Broadcast EOC instructions via Voice Reader:")
            
            clean_tts = re.sub(r'[*#_`\-]', ' ', st.session_state.final_synthesis)
            shortened_tts = clean_tts[:2500] + " ... End of incident plan."
            encoded_tts = urllib.parse.quote(shortened_tts)
            
            tts_script = f"""
            <div style="background-color: #121626; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #1f293d;">
                <p style="color: #ffffff; margin-bottom: 15px;">🔊 <b>EOC Broadcast Voice Guide</b></p>
                <div style="display: flex; justify-content: center; gap: 15px;">
                    <button onclick="speak()" style="background-color: #00f2fe; color: black; border: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; cursor: pointer;">🔊 Broadcast</button>
                    <button onclick="stop()" style="background-color: #ff3366; color: white; border: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; cursor: pointer;">🛑 Stop</button>
                </div>
                <script>
                    var msg = new SpeechSynthesisUtterance();
                    msg.text = decodeURIComponent("{encoded_tts}");
                    msg.rate = 1.0;
                    
                    function speak() {{
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(msg);
                    }}
                    function stop() {{
                        window.speechSynthesis.cancel();
                    }}
                </script>
            </div>
            """
            st.components.v1.html(tts_script, height=180)

# ----------------- PAGE 4: SHELTERS & RESOURCES -----------------
elif page == "🏥 Shelters & Resources":
    st.markdown('<div class="eoc-header-title">🏥 SHELTER & RESOURCE INVENTORY</div>', unsafe_allow_html=True)
    st.markdown("<p style='color: #6a7791;'>Simulated live database of designated disaster shelters, current occupancy rates, and resources.</p>", unsafe_allow_html=True)
    st.markdown("---")
    
    # Mock database
    states_data = {
        "Maharashtra": [
            {"Name": "Kurla West Municipal School Relief Camp", "Capacity": "120/200", "Water Resource": "🟢 HIGH", "Food Kits": "🟡 MEDIUM", "Medical Officer": "Yes"},
            {"Name": "Sion Community Center", "Capacity": "85/150", "Water Resource": "🟢 HIGH", "Food Kits": "🟢 HIGH", "Medical Officer": "Yes"},
            {"Name": "Ghatkopar Cyclone Shelter", "Capacity": "40/100", "Water Resource": "🟡 MEDIUM", "Food Kits": "🔴 LOW", "Medical Officer": "No"}
        ],
        "Odisha": [
            {"Name": "Puri Multipurpose Cyclone Shelter", "Capacity": "350/500", "Water Resource": "🟢 HIGH", "Food Kits": "🟢 HIGH", "Medical Officer": "Yes"},
            {"Name": "Konark Community Relief Hall", "Capacity": "110/300", "Water Resource": "🟢 HIGH", "Food Kits": "🟡 MEDIUM", "Medical Officer": "Yes"},
            {"Name": "Bhubaneswar Town Hall", "Capacity": "150/400", "Water Resource": "🟢 HIGH", "Food Kits": "🟢 HIGH", "Medical Officer": "Yes"}
        ],
        "Uttarakhand": [
            {"Name": "Rudraprayag Town Assembly Hall", "Capacity": "45/80", "Water Resource": "🟢 HIGH", "Food Kits": "🟢 HIGH", "Medical Officer": "Yes"},
            {"Name": "Guptkashi Tourism Center", "Capacity": "30/100", "Water Resource": "🟡 MEDIUM", "Food Kits": "🟡 MEDIUM", "Medical Officer": "No"},
            {"Name": "Kedarnath Base Camps", "Capacity": "120/150", "Water Resource": "🟡 MEDIUM", "Food Kits": "🔴 LOW", "Medical Officer": "Yes"}
        ],
        "Delhi": [
            {"Name": "Dwarka Sports Complex Cooling Camp", "Capacity": "90/250", "Water Resource": "🟢 HIGH", "Food Kits": "🟢 HIGH", "Medical Officer": "Yes"},
            {"Name": "Janakpuri Community Shelter", "Capacity": "45/100", "Water Resource": "🟢 HIGH", "Food Kits": "🟢 HIGH", "Medical Officer": "Yes"}
        ],
        "Andhra Pradesh": [
            {"Name": "Vizag Industrial Zone Isolation Shelter", "Capacity": "80/150", "Water Resource": "🟢 HIGH", "Food Kits": "🟢 HIGH", "Medical Officer": "Yes"},
            {"Name": "Gajuwaka Relief Center", "Capacity": "95/200", "Water Resource": "🟢 HIGH", "Food Kits": "🟡 MEDIUM", "Medical Officer": "Yes"}
        ]
    }
    
    selected_state = st.selectbox("Filter by State Zone", options=list(states_data.keys()))
    
    st.subheader(f"📋 Shelter Status: {selected_state}")
    df_shelters = pd.DataFrame(states_data[selected_state])
    st.dataframe(df_shelters, use_container_width=True)
    
    st.markdown("---")
    
    # Request resources form
    st.subheader("📦 Request Resource Allocation")
    st.info("EOC Dispatchers will verify and route supplies to your location.")
    
    col_r1, col_r2 = st.columns(2)
    with col_r1:
        req_shelter = st.selectbox("Target Shelter Location", options=[s["Name"] for s in states_data[selected_state]])
        req_type = st.selectbox("Resource Category Needed", options=["Drinking Water Tanks", "Dry Ration Packs", "Trauma Medical Supplies", "Blankets & Linens", "Generators / Battery Banks"])
    with col_r2:
        req_qty = st.number_input("Required Quantity (units)", min_value=1, value=50)
        req_urgency = st.selectbox("Urgency Priority", options=["Routine", "High Priority", "CRITICAL / LIFE THREAT"])
        
    submit_req = st.button("🚀 Dispatch Resource Request")
    if submit_req:
        st.success(f"SUCCESS: Request for **{req_qty} units** of **{req_type}** for **{req_shelter}** submitted to EOC Dispatch queue. [Priority: {req_urgency}]")

# ----------------- PAGE 5: EMERGENCY HELPLINE -----------------
elif page == "📞 Emergency Helpline":
    st.markdown('<div class="eoc-header-title">📞 EMERGENCY HELPLINES & DIRECTORY</div>', unsafe_allow_html=True)
    st.markdown("<p style='color: #6a7791;'>National and state-wise emergency contacts for rapid dispatch.</p>", unsafe_allow_html=True)
    st.markdown("---")
    
    # Helplines details
    col_n1, col_n2 = st.columns(2)
    
    with col_n1:
        st.subheader("🚨 Unified National Dispatch")
        st.markdown("""
        <div class="eoc-card" style="border-left: 5px solid #ff3366;">
            <div style="font-size: 1.4rem; font-weight: bold; color: #ff3366;">Unified Emergency Number: 112</div>
            <p style="font-size: 0.9rem; color: #8c97ad; margin-top:5px;">Dial 112 for all police, fire, health, and disaster support lines in India.</p>
        </div>
        """, unsafe_allow_html=True)
        
        st.subheader("🏢 Central Agencies")
        st.markdown("""
        * **NDMA Helpline**: 011-26701728, 1078
        * **NDRF Control Room**: 9711077372, 011-24363260
        * **Indian Meteorological Department (IMD)**: 1800-180-1717
        * **National Highway Emergency Number**: 1033
        """)
        
    with col_n2:
        st.subheader("📞 State Disaster Management Control Rooms")
        st.info("Call the universal State Disaster Helpline 1070 or District Disaster Helpline 1077 from any local phone.")
        
        st.markdown("""
        * **Maharashtra SDMA**: 022-22027990
        * **Odisha SDMA (OSDMA)**: 0674-2395398
        * **Uttarakhand SDMA**: 0135-2710334, 9557444486
        * **Delhi SDMA**: 011-22424006
        * **Andhra Pradesh SDMA**: 08645-246600
        """)

# ----------------- PAGE 6: VOLUNTEER HUB -----------------
elif page == "🤝 Volunteer Hub":
    st.markdown('<div class="eoc-header-title">🤝 VOLUNTEER HUB</div>', unsafe_allow_html=True)
    st.markdown("<p style='color: #6a7791;'>Register to offer disaster support or request local community help.</p>", unsafe_allow_html=True)
    st.markdown("---")
    
    # Setup session lists for simulator
    if "volunteers_list" not in st.session_state:
        st.session_state.volunteers_list = [
            {"Name": "Amit Sharma", "Contact": "9876543210", "Skills": "First Aid / Medical", "Location": "Mumbai"},
            {"Name": "Priyanka Jena", "Contact": "8765432109", "Skills": "Food & Water Distribution", "Location": "Puri, Odisha"},
            {"Name": "Rajesh Negi", "Contact": "7654321098", "Skills": "Search & Rescue", "Location": "Rudraprayag"}
        ]
    if "help_requests" not in st.session_state:
        st.session_state.help_requests = [
            {"Address": "Kurla Sector 3", "Request": "Need water bottles for 5 families stranded in building", "People": 12, "Urgency": "High"},
            {"Address": "Puri Sea Beach Road", "Request": "Fallen tree blocking the main entry gate of shelter", "People": 40, "Urgency": "Critical"}
        ]

    tab_vol, tab_help = st.tabs(["🙋 Register as Volunteer", "🚨 Citizen Help Requests"])
    
    with tab_vol:
        col_vf, col_vl = st.columns([1, 1])
        
        with col_vf:
            st.subheader("📝 Registration Form")
            v_name = st.text_input("Full Name")
            v_phone = st.text_input("Mobile Number")
            v_skills = st.selectbox("Core Skill Area", options=["First Aid / Medical Support", "Food & Water Distribution", "Search & Rescue Support", "Shelter Management", "HAM Radio / Communications"])
            v_loc = st.text_input("City / District")
            
            submit_vol = st.button("🙋 Submit Volunteer Application")
            if submit_vol:
                if v_name and v_phone and v_loc:
                    st.session_state.volunteers_list.append({
                        "Name": v_name,
                        "Contact": v_phone,
                        "Skills": v_skills,
                        "Location": v_loc
                    })
                    st.success(f"Thank you, {v_name}! You have been registered in the EOC Volunteer Database.")
                else:
                    st.error("Please fill in Name, Mobile, and Location details.")
                    
        with col_vl:
            st.subheader("📋 Registered EOC Volunteers")
            df_vols = pd.DataFrame(st.session_state.volunteers_list)
            st.dataframe(df_vols, use_container_width=True)
            
    with tab_help:
        col_hf, col_hl = st.columns([1, 1])
        
        with col_hf:
            st.subheader("🚨 Submit Local Help Request")
            h_addr = st.text_input("Exact Address / Location Details")
            h_req = st.text_area("What is needed? (e.g. food, medical help, evacuation)")
            h_count = st.number_input("Headcount (number of people)", min_value=1, value=4)
            h_urgency = st.selectbox("Request Urgency", options=["Low", "Medium", "High", "Critical"])
            
            submit_help = st.button("🚨 Broadcast Help Request")
            if submit_help:
                if h_addr and h_req:
                    st.session_state.help_requests.append({
                        "Address": h_addr,
                        "Request": h_req,
                        "People": h_count,
                        "Urgency": h_urgency
                    })
                    st.success("Help request broadcasted to the EOC Feed! NDRF and local volunteer teams have been alerted.")
                else:
                    st.error("Please fill in Address and Request details.")
                    
        with col_hl:
            st.subheader("📋 Active EOC Citizen Requests")
            df_reqs = pd.DataFrame(st.session_state.help_requests)
            st.dataframe(df_reqs, use_container_width=True)
