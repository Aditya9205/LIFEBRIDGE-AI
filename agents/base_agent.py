"""
LifeBridge AI – Base Agent
Defines the base class for all specialized agents.
"""

from typing import Optional
from utils.gemini_client import GeminiClient

class BaseAgent:
    """
    Base Agent class that communicates with the Gemini Client.
    """
    def __init__(self, name: str, role: str, system_instructions: str, client: GeminiClient):
        """
        Initializes the agent.
        
        Args:
            name: Human-readable name of the agent.
            role: Brief description of the agent's responsibilities.
            system_instructions: The detailed system instructions defining behavior and formatting.
            client: An instance of GeminiClient.
        """
        self.name = name
        self.role = role
        self.system_instructions = system_instructions
        self.client = client

    def get_prompt(self, disaster_type: str, location: str, situation: str) -> str:
        """
        Formats the standard input prompt for the agent.
        """
        return f"""
DISASTER ANALYSIS REQUEST:
Disaster Type: {disaster_type}
Location: {location}
Current Situation & Details: {situation}

Based on this emergency input, perform your specialized agent analysis.
Provide a clear, detailed, and structured response in Markdown. Do not include placeholders.
"""

    def run(self, disaster_type: str, location: str, situation: str) -> str:
        """
        Runs the agent against the Gemini API client.
        """
        prompt = self.get_prompt(disaster_type, location, situation)
        return self.client.query(
            prompt=prompt,
            system_instruction=self.system_instructions,
            temperature=0.2
        )
