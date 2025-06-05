# Karaoke Signaling Server

This is the WebRTC signaling server for the karaoke application. It handles WebSocket connections and WebRTC signaling between participants.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure your environment variables:
```bash
cp .env.example .env
```

3. Build the server:
```bash
npm run build
```

4. Start the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

## Deployment

### Railway
1. Create a new project on Railway
2. Connect your GitHub repository
3. Add environment variables from `.env`
4. Deploy

### Heroku
1. Create a new Heroku app
2. Set up environment variables:
```bash
heroku config:set ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
```
3. Deploy:
```bash
git push heroku main
```

### DigitalOcean
1. Create a new Droplet
2. Install Node.js and npm
3. Clone the repository
4. Set up environment variables
5. Build and start the server
6. Set up PM2 for process management:
```bash
npm install -g pm2
pm2 start dist/index.js --name karaoke-signaling
```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS
- `TURN_USERNAME`: (Optional) TURN server username
- `TURN_CREDENTIAL`: (Optional) TURN server credential

## Health Check

The server provides a health check endpoint at `/health` that returns a 200 status code when the server is running properly.

## Error Handling

The server includes comprehensive error handling for:
- WebSocket connections
- Room management
- WebRTC signaling
- Uncaught exceptions
- Unhandled rejections 