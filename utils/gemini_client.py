"""
LifeBridge AI – Gemini API Client Utility
Provides a clean interface to query Google Gemini models with error handling.
"""

import os
import logging
from typing import Optional, Dict, Any, List

# Configure logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("LifeBridgeAI.GeminiClient")

class GeminiClient:
    """
    Wrapper for Google GenAI Client to perform model queries.
    """
    def __init__(self, api_key: Optional[str] = None):
        """
        Initializes the client.
        Prioritizes:
        1. Explicitly passed api_key parameter
        2. GEMINI_API_KEY environment variable
        """
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initializes the official google-genai Client."""
        if not self.api_key:
            logger.warning("No Gemini API key provided. Client initialized in unauthenticated state.")
            return

        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
            logger.info("google-genai client successfully initialized.")
        except ImportError:
            logger.error("Failed to import 'google-genai' SDK. Please ensure it is installed.")
        except Exception as e:
            logger.error(f"Error initializing Gemini client: {str(e)}")

    def is_configured(self) -> bool:
        """Checks if the client is ready to make API calls."""
        return self.client is not None

    def query(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: str = "gemini-2.5-flash",
        temperature: float = 0.2,
        json_output: bool = False
    ) -> str:
        """
        Queries Gemini API.
        
        Args:
            prompt: The main user prompt.
            system_instruction: Guidelines defining the agent's behavior.
            model: The Gemini model identifier (default: gemini-2.5-flash).
            temperature: Sampling temperature.
            json_output: Force the model to output valid JSON.
            
        Returns:
            The text response from the model.
        """
        if not self.client:
            # Re-check API key in case it was updated later
            self.api_key = self.api_key or os.environ.get("GEMINI_API_KEY")
            self._initialize_client()
            if not self.client:
                raise ValueError("Gemini API key is not configured. Please supply a valid key in the app sidebar or .env file.")

        try:
            from google.genai import types
            
            # Setup configuration
            config_params = {}
            if system_instruction:
                config_params["system_instruction"] = system_instruction
            if temperature is not None:
                config_params["temperature"] = temperature
            if json_output:
                config_params["response_mime_type"] = "application/json"

            config = types.GenerateContentConfig(**config_params) if config_params else None

            # Generate content
            response = self.client.models.generate_content(
                model=model,
                contents=prompt,
                config=config
            )
            
            if response and response.text:
                return response.text.strip()
            else:
                return "Error: Received empty response from the AI model."

        except Exception as e:
            logger.error(f"Error querying Gemini API model {model}: {str(e)}")
            raise RuntimeError(f"Gemini API request failed: {str(e)}")
