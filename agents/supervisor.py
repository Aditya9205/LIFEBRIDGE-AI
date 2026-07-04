"""
LifeBridge AI – Supervisor Agent
Coordinates the specialized agents (Assessment, Medical, Resource, Shelter, Communication)
and synthesizes the final Emergency Operations Center Action Plan.
"""

import json
import logging
from typing import Dict, List, Any
from utils.gemini_client import GeminiClient
from agents.assessment import DisasterAssessmentAgent
from agents.medical import MedicalAgent
from agents.resource import ResourceAgent
from agents.shelter import ShelterResourcesAgent
from agents.communication import CommunicationAgent

logger = logging.getLogger("LifeBridgeAI.Supervisor")

class SupervisorAgent:
    """
    Supervisor Agent coordinates the specialized sub-agents and compiles a unified plan.
    """
    def __init__(self, client: GeminiClient):
        self.client = client
        self.agents = {
            "assessment": DisasterAssessmentAgent(client),
            "medical": MedicalAgent(client),
            "resource": ResourceAgent(client),
            "shelter": ShelterResourcesAgent(client),
            "communication": CommunicationAgent(client)
        }

    def determine_relevant_agents(self, disaster_type: str, location: str, situation: str) -> List[str]:
        """
        Determines which specialized agents to invoke based on user input.
        Returns a list of agent keys (e.g. ['assessment', 'medical', ...]).
        """
        system_instruction = """
You are the Supervisor Agent of "LifeBridge AI" (localized for India).
Your job is to read the user's disaster details and select which of the following specialized sub-agents are needed to resolve their request:
- "assessment": Needed to identify disaster type, severity, and risk indicators.
- "medical": Needed to provide critical medical/first-aid steps, hygiene advice, and medical checklists.
- "resource": Needed to calculate food, water, tools, clothing, and survival resources.
- "shelter": Needed to find shelter categories, evacuation rules, and paperwork to gather.
- "communication": Needed to formulate SMS drafts and SOS templates.

Output Format:
You MUST respond with a JSON array of strings containing the keys of the chosen agents. Example:
["assessment", "medical", "resource", "shelter", "communication"]

Select only the agents that are relevant. In almost all active crises, all five are highly relevant.
"""
        prompt = f"""
Disaster Type: {disaster_type}
Location: {location}
Situation: {situation}

Which agents should be invoked? Answer in raw JSON array format.
"""
        all_keys = list(self.agents.keys())
        try:
            response = self.client.query(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=0.0,
                json_output=True
            )
            # Try to parse response
            cleaned_response = response.strip()
            # Strip markdown code block wrappers if any
            if cleaned_response.startswith("```"):
                lines = cleaned_response.splitlines()
                content_lines = []
                for line in lines:
                    if not line.startswith("```"):
                        content_lines.append(line)
                cleaned_response = "".join(content_lines)
            
            selected = json.loads(cleaned_response)
            if isinstance(selected, list):
                valid_selected = [k for k in selected if k in all_keys]
                if valid_selected:
                    logger.info(f"Supervisor dynamically selected agents: {valid_selected}")
                    return valid_selected
        except Exception as e:
            logger.error(f"Supervisor failed to parse dynamic selection JSON: {str(e)}. Defaulting to all agents.")
            
        return all_keys

    def execute_agents(self, disaster_type: str, location: str, situation: str, selected_agents: List[str], progress_callback=None) -> Dict[str, str]:
        """
        Runs the selected sub-agents sequentially.
        """
        reports = {}
        for agent_key in selected_agents:
            agent = self.agents[agent_key]
            if progress_callback:
                progress_callback(agent.name, "running")
            try:
                reports[agent_key] = agent.run(disaster_type, location, situation)
                if progress_callback:
                    progress_callback(agent.name, "completed")
            except Exception as e:
                logger.error(f"Error running agent {agent_key}: {str(e)}")
                reports[agent_key] = f"Error: Agent failed to execute: {str(e)}"
                if progress_callback:
                    progress_callback(agent.name, "failed")
        return reports

    def synthesize_final_plan(self, disaster_type: str, location: str, situation: str, reports: Dict[str, str]) -> str:
        """
        Synthesizes the individual reports from the sub-agents into a unified, clean Emergency Action Plan.
        """
        system_instruction = """
You are the Supervisor Agent of "LifeBridge AI" (localized for India). Your role is to compile and synthesize the individual expert analyses from specialized sub-agents into a single, cohesive, high-impact Emergency Operations Plan.

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
- Avoid introducing any placeholder values (e.g. "[Insert Local Number Here]").
"""
        
        reports_context = ""
        for key, report in reports.items():
            reports_context += f"=== REPORT FROM {self.agents[key].name} ===\n{report}\n\n"
            
        prompt = f"""
Disaster Context:
- Type: {disaster_type}
- Location: {location}
- Situation: {situation}

Here are the specialized reports from the sub-agents:
{reports_context}

Please synthesize these reports into the final cohesive Emergency Operations Plan.
"""
        return self.client.query(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.3
        )
