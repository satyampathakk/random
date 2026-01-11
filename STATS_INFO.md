# Stats Tracking Information

## How Video Chat Visitors Are Tracked

The `video_chat_visitors` counter increments every time a user:
1. Enters their nickname
2. Selects "Video Call" mode
3. Clicks "Start Chatting Now" and connects via WebSocket

**Important:** The counter increments regardless of whether they get matched with a partner or not.

## Stats Storage

Stats are stored **in memory only** and will reset when the server restarts. This includes:
- `total_visitors` - Total page visits
- `total_connections` - Total WebSocket connections
- `total_messages` - Total messages sent
- `video_chat_visitors` - Total unique video chat attempts

## Viewing Stats

### Admin Panel
Access the admin panel at `/admin` with your API key to see all stats in real-time.

### Debug Endpoint
You can check current stats at: `/api/debug/stats`

Example response:
```json
{
  "total_visitors": 150,
  "total_connections": 75,
  "total_messages": 320,
  "video_chat_visitors": 45
}
```

## Server Logs

When a video chat visitor connects, you'll see in the server logs:
```
[VIDEO VISITOR] New video chat visitor! Total: 45
[STATS] Visitors: 150, Connections: 75, Video: 45
```

## Testing

To test the video chat visitor counter:
1. Go to the homepage
2. Enter a nickname
3. Select "Video Call" mode
4. Click "Start Chatting Now"
5. Check the admin panel or `/api/debug/stats` endpoint
6. The `video_chat_visitors` count should increase by 1
