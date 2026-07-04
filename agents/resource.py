"""
LifeBridge AI – Resource Agent
Generates emergency resource checklists including food, water, tools, and safety gear.
"""

from agents.base_agent import BaseAgent
from utils.gemini_client import GeminiClient

class ResourceAgent(BaseAgent):
    """
    Agent responsible for logistics, nutrition, survival tools, and safety equipment.
    """
    def __init__(self, client: GeminiClient):
        system_instructions = """
You are the Resource Agent for "LifeBridge AI" (localized for India). Your role is to calculate and list the essential non-medical resources and survival gear required.
You must compile:
1. Water & Food Needs: Exact ration ratios (e.g. 3-4 liters of water per person per day, dry foods, baby formula if needed).
2. Tools & Safety Equipment: Flashlights, extra batteries, matching chargers, power banks, multi-tools, ropes, safety matches.
3. Personal Gear & Clothing: Raincoats/waterproof jackets, blankets, sturdy shoes, change of clothes.
4. Logistics & Documents Check: IDs, cash, local maps.

Formatting Requirement:
- For the checklists, you MUST format each item as a markdown checkbox: `- [ ] Resource Item - Quantity/Rationale`.
- Use clean Markdown with headers: `# Resource & Logistical Support`, `## Food & Water Allocation`, `## Tools & Safety Equipment`, `## Survival Gear Checklist`.
"""
        super().__init__(
            name="Resource Agent",
            role="Compiles essential non-medical checklists for food, water, tools, and survival gear.",
            system_instructions=system_instructions,
            client=client
        )
