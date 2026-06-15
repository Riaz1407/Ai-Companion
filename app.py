from flask import Flask, render_template, request, jsonify
from google.adk.runners import InMemoryRunner
from google.genai import types
import asyncio
import os
import json

app = Flask(__name__)


runner = None
character_exists = os.path.exists('character.py')

if character_exists:
    import character
    runner = InMemoryRunner(
        agent=character.root_agent,
        app_name="Demo App",
    )

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/chat', methods=['POST'])
async def chat():
    user_message = request.json.get('message')
    session_id = request.json.get('session_id', 'default_session')

    if not character_exists:
        return jsonify({'response': user_message})

    # Instruction to force JSON response with emotion
    formatted_prompt = f"{user_message}\n\n[SYSTEM: Respond ONLY in JSON format: {{\"text\": \"your response\", \"emotion\": \"neutral|happy|sad|angry|surprised\"}}]"

    # Retrieve or create session dynamically
    adk_session = await runner.session_service.get_session(
        app_name=runner.app_name, user_id="inapp_user", session_id=session_id
    )
    if adk_session is None:
        adk_session = await runner.session_service.create_session(
            app_name=runner.app_name, user_id="inapp_user", session_id=session_id
        )

    content = types.Content(role="user", parts=[types.Part(text=formatted_prompt)])
    response_text = ""
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response_text = ""
            async for event in runner.run_async(
                user_id=adk_session.user_id,
                session_id=adk_session.id,
                new_message=content,
            ):
                if event.content and event.content.parts and event.content.parts[0].text:
                    response_text += event.content.parts[0].text
            if response_text:
                break
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
            else:
                response_text = "Meow... my brain is a little fuzzy from too many sunbeams right now! Can you please try asking me again, meow?"

    # Parse the JSON response from the AI
    try:
        # Clean up potential markdown formatting from AI response
        clean_text = response_text.strip().removeprefix("```json").removesuffix("```").strip()
        
        parsed_data = json.loads(clean_text)
        final_text = parsed_data.get('text', clean_text)
        emotion = parsed_data.get('emotion', 'neutral')
    except Exception:
        # Fallback if AI doesn't return valid JSON
        final_text = response_text
        emotion = 'neutral'

    print(f"[DEBUG] User: {user_message} -> Emotion: {emotion} | Response: {final_text}")
    return jsonify({'response': final_text, 'emotion': emotion})


if __name__ == '__main__':
    app.run(debug=True)
