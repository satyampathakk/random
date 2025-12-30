from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
import asyncio
from dataclasses import dataclass, field
from typing import Optional
import uuid
import random

app = FastAPI(title="Random Chat")

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# Bot names and conversation starters
BOT_NAMES = [
    "Priya", "Rahul", "Ananya", "Arjun", "Sneha", "Vikram", "Kavya", "Aditya",
    "Neha", "Rohan", "Ishita", "Karan", "Divya", "Amit", "Pooja", "Varun",
    "Alex", "Emma", "Ryan", "Sophie", "Mike", "Lisa", "David", "Sarah"
]

BOT_MESSAGES = [
    # Greetings
    ["Hey! How are you? 😊", "Hi there! Where are you from?", "Hello! Nice to meet you!"],
    # Questions
    ["What do you do?", "Are you a student or working?", "What's your hobby?"],
    ["Which city are you from?", "How's the weather there?", "What time is it for you?"],
    ["Do you like music?", "What kind of movies do you watch?", "Are you into gaming?"],
    ["Have you used this site before?", "Found any interesting people here?"],
    # Casual chat
    ["That's cool!", "Nice! Tell me more", "Interesting 🤔", "Haha really?"],
    ["I'm just chilling at home", "Bored at work lol", "Can't sleep, so here I am"],
    ["What are your plans for the weekend?", "Done with dinner?", "Watching anything good lately?"],
    # Indian specific
    ["Which state are you from?", "Do you speak Hindi?", "Cricket fan? 🏏"],
    ["IPL is so exciting this year!", "Bollywood or Hollywood?", "Favorite food?"],
]

BOT_RESPONSES = {
    "hi": ["Hey! What's up?", "Hello! How are you doing?", "Hi! Nice to meet you 😊"],
    "hello": ["Hey there!", "Hi! How's it going?", "Hello! Where are you from?"],
    "how are you": ["I'm good! You?", "Doing great, thanks! What about you?", "Pretty good! Just relaxing"],
    "fine": ["That's good to hear!", "Nice! So what do you do?", "Cool! Where are you from?"],
    "good": ["Awesome!", "Great to hear that!", "Nice! What are you up to?"],
    "name": ["I told you, I'm {name}! 😄", "It's {name}, remember?", "{name} here!"],
    "age": ["I'm in my 20s", "Old enough 😅", "Let's just say I'm young lol"],
    "from": ["I'm from India, you?", "Mumbai! What about you?", "Delhi side, wbu?"],
    "india": ["Oh nice! Which city?", "Same here! 🇮🇳", "India is great!"],
    "student": ["Yeah I'm studying", "Working actually", "Just graduated recently"],
    "work": ["I work in IT", "Software developer here", "Just a regular job"],
    "hobby": ["I love music and movies", "Gaming mostly", "Reading and Netflix"],
    "music": ["I like Bollywood songs", "Arijit Singh fan!", "All kinds actually"],
    "movie": ["Love action movies", "Watched any good ones lately?", "I'm into thrillers"],
    "cricket": ["Big fan! 🏏", "IPL is life!", "Who's your favorite player?"],
    "food": ["I love biryani!", "Pizza anytime", "Anything spicy works for me"],
    "bye": ["Bye! Nice talking to you!", "See you around! 👋", "Take care!"],
    "default": ["That's interesting!", "Tell me more", "Haha nice", "Oh really?", "Cool!", "I see", "Makes sense", "Yeah totally"]
}

@dataclass
class User:
    websocket: WebSocket
    nickname: str
    user_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    partner_id: Optional[str] = None
    mode: str = "text"
    is_bot: bool = False
    bot_task: Optional[asyncio.Task] = None

class ConnectionManager:
    def __init__(self):
        self.users: dict[str, User] = {}
        self.text_queue: list[str] = []
        self.video_queue: list[str] = []
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, nickname: str, mode: str) -> User:
        await websocket.accept()
        user = User(websocket=websocket, nickname=nickname, mode=mode)
        self.users[user.user_id] = user
        return user

    def disconnect(self, user_id: str):
        if user_id in self.users:
            user = self.users[user_id]
            if user.bot_task:
                user.bot_task.cancel()
            queue = self.video_queue if user.mode == "video" else self.text_queue
            if user_id in queue:
                queue.remove(user_id)
            del self.users[user_id]

    async def find_partner(self, user: User) -> Optional[User]:
        async with self.lock:
            queue = self.video_queue if user.mode == "video" else self.text_queue
            
            for partner_id in queue:
                if partner_id != user.user_id and partner_id in self.users:
                    partner = self.users[partner_id]
                    if partner.partner_id is None:
                        queue.remove(partner_id)
                        user.partner_id = partner_id
                        partner.partner_id = user.user_id
                        return partner
            
            if user.user_id not in queue:
                queue.append(user.user_id)
            return None

    async def send_to_partner(self, user: User, message: dict):
        if user.partner_id and user.partner_id in self.users:
            partner = self.users[user.partner_id]
            await partner.websocket.send_json(message)

    async def disconnect_partner(self, user: User):
        if user.partner_id and user.partner_id in self.users:
            partner = self.users[user.partner_id]
            if partner.bot_task:
                partner.bot_task.cancel()
            partner.partner_id = None
            if not partner.is_bot:
                await partner.websocket.send_json({"type": "partner_disconnected"})
        user.partner_id = None
        if user.bot_task:
            user.bot_task.cancel()
            user.bot_task = None

manager = ConnectionManager()

def get_bot_response(message: str, bot_name: str) -> str:
    """Get a contextual bot response based on user message"""
    msg_lower = message.lower()
    
    for keyword, responses in BOT_RESPONSES.items():
        if keyword in msg_lower:
            response = random.choice(responses)
            return response.replace("{name}", bot_name)
    
    return random.choice(BOT_RESPONSES["default"])

async def run_bot_conversation(user: User, bot_name: str):
    """Simulate a bot conversation with typing delays"""
    try:
        # Wait a bit then send first message
        await asyncio.sleep(random.uniform(2, 4))
        
        # Send typing indicator
        await user.websocket.send_json({"type": "typing"})
        await asyncio.sleep(random.uniform(1, 2))
        await user.websocket.send_json({"type": "stop_typing"})
        
        # Send greeting
        greeting = random.choice(BOT_MESSAGES[0])
        await user.websocket.send_json({
            "type": "chat_message",
            "nickname": bot_name,
            "message": greeting
        })
        
        # Continue conversation with random messages
        message_count = 0
        while message_count < 3:
            await asyncio.sleep(random.uniform(8, 15))
            
            if not user.partner_id:
                break
                
            # Send typing
            await user.websocket.send_json({"type": "typing"})
            await asyncio.sleep(random.uniform(1.5, 3))
            await user.websocket.send_json({"type": "stop_typing"})
            
            # Pick a random follow-up message
            category = random.choice(BOT_MESSAGES[1:])
            msg = random.choice(category)
            
            await user.websocket.send_json({
                "type": "chat_message",
                "nickname": bot_name,
                "message": msg
            })
            message_count += 1
            
    except asyncio.CancelledError:
        pass
    except Exception:
        pass

async def handle_bot_reply(user: User, user_message: str, bot_name: str):
    """Handle bot reply to user message"""
    try:
        # Typing delay
        await asyncio.sleep(random.uniform(1, 2))
        await user.websocket.send_json({"type": "typing"})
        
        # Think time based on message length
        think_time = min(len(user_message) * 0.05 + random.uniform(1, 2), 4)
        await asyncio.sleep(think_time)
        
        await user.websocket.send_json({"type": "stop_typing"})
        
        # Get contextual response
        response = get_bot_response(user_message, bot_name)
        
        await user.websocket.send_json({
            "type": "chat_message",
            "nickname": bot_name,
            "message": response
        })
    except Exception:
        pass

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/online-count")
async def online_count():
    return {"count": len(manager.users)}

@app.websocket("/ws/{nickname}/{mode}")
async def websocket_endpoint(websocket: WebSocket, nickname: str, mode: str):
    user = await manager.connect(websocket, nickname, mode)
    bot_name = None
    
    try:
        await websocket.send_json({
            "type": "connected",
            "user_id": user.user_id,
            "message": "Connected! Looking for a partner..."
        })
        
        partner = await manager.find_partner(user)
        
        if partner:
            await websocket.send_json({
                "type": "partner_found",
                "partner_nickname": partner.nickname,
                "initiator": True
            })
            await partner.websocket.send_json({
                "type": "partner_found",
                "partner_nickname": user.nickname,
                "initiator": False
            })
        else:
            # No real partner found - connect to bot after delay (only for text mode)
            if mode == "text":
                await asyncio.sleep(random.uniform(3, 6))
                
                # Check again if real partner found
                if not user.partner_id:
                    bot_name = random.choice(BOT_NAMES)
                    user.partner_id = f"bot_{uuid.uuid4()}"
                    user.is_bot = False
                    
                    await websocket.send_json({
                        "type": "partner_found",
                        "partner_nickname": bot_name,
                        "initiator": False
                    })
                    
                    # Start bot conversation
                    user.bot_task = asyncio.create_task(run_bot_conversation(user, bot_name))
        
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "chat_message":
                message = data.get("message", "")
                
                # Check if chatting with bot
                if user.partner_id and user.partner_id.startswith("bot_") and bot_name:
                    asyncio.create_task(handle_bot_reply(user, message, bot_name))
                else:
                    await manager.send_to_partner(user, {
                        "type": "chat_message",
                        "nickname": user.nickname,
                        "message": message
                    })
            
            elif msg_type == "typing":
                if not (user.partner_id and user.partner_id.startswith("bot_")):
                    await manager.send_to_partner(user, {"type": "typing"})
            
            elif msg_type == "stop_typing":
                if not (user.partner_id and user.partner_id.startswith("bot_")):
                    await manager.send_to_partner(user, {"type": "stop_typing"})
            
            elif msg_type in ["offer", "answer", "ice_candidate"]:
                await manager.send_to_partner(user, data)
            
            elif msg_type == "next":
                await manager.disconnect_partner(user)
                user.partner_id = None
                bot_name = None
                
                await websocket.send_json({
                    "type": "searching",
                    "message": "Looking for a new partner..."
                })
                
                partner = await manager.find_partner(user)
                
                if partner:
                    await websocket.send_json({
                        "type": "partner_found",
                        "partner_nickname": partner.nickname,
                        "initiator": True
                    })
                    await partner.websocket.send_json({
                        "type": "partner_found",
                        "partner_nickname": user.nickname,
                        "initiator": False
                    })
                else:
                    # Connect to bot if no real user (text mode only)
                    if mode == "text":
                        await asyncio.sleep(random.uniform(2, 5))
                        
                        if not user.partner_id:
                            bot_name = random.choice(BOT_NAMES)
                            user.partner_id = f"bot_{uuid.uuid4()}"
                            
                            await websocket.send_json({
                                "type": "partner_found",
                                "partner_nickname": bot_name,
                                "initiator": False
                            })
                            
                            user.bot_task = asyncio.create_task(run_bot_conversation(user, bot_name))
    
    except WebSocketDisconnect:
        await manager.disconnect_partner(user)
        manager.disconnect(user.user_id)
    except Exception as e:
        print(f"Error: {e}")
        await manager.disconnect_partner(user)
        manager.disconnect(user.user_id)
