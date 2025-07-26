
# Lumo API 🤖🧠

Copyright @Carlostkd

Welcome to **Lumo API**! 🚀 A powerful and flexible API for interacting with the Lumo AI powered by Proton. 

This API allows you to integrate Proton Lumo Assistante in any of your Projects - web apps or mobile apps. 🎉

## Key Features ✨

- **Send Prompts**: Send messages to Lumo and receive responses to interact with Proton Lumo.
- **Web Search Toggle**: Enable or disable the web search functionality when needed. 🔍
- **Secure API**: Authentication via token security to make sure only authorized users can send requests. 🔑
- **Turn on/off Ghost mode**:👻 No one can sees you
- **Start Fresh**:💬 Start a new chat when you want

## Installation 🛠️

### 1. Clone this repository:
```bash
git clone https://github.com/carlostkd/lumo-api.git
cd lumo-api
```

### 2. Install dependencies:
```bash
npm init -y

npm install express puppeteer-core puppeteer body-parser cors

run the app

node index.js

```

### 3. Set up your token:
In `index.js`, replace `YOUR_SECRET_TOKEN_HERE` with your secret token for API authentication.

### 4. Run the server:
```bash
node index.js

and wait until you see "login detected"
```

The server will be running on `http://localhost:3000`.

## Usage 🏄‍♂️

### Sending a Prompt to Lumo

You can send a prompt using `curl`:

```bash
curl -X POST http://localhost:3000/api/send-prompt   
-H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE"   
-H "Content-Type: application/json"   
-d '{"prompt": "What is the weather in Zurich?"}'
```

You’ll receive a response from the Lumo bot, like:

```json
"The weather in Zurich is clear skies with a temperature of 15°C."
```

### Enabling Web Search

To enable web search (useful for weather, news, etc.):

```bash
curl -X POST http://localhost:3000/api/set-websearch   
-H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE"   
-H "Content-Type: application/json"   
-d '{"enabled": true}'
```

### Disabling Web Search

To disable web search:

```bash
curl -X POST http://localhost:3000/api/set-websearch   
-H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE"   
-H "Content-Type: application/json"   
-d '{"enabled": false}'
```

### Enabling Ghost mode

To enable Ghost Mode :

```bash
curl -X POST http://localhost:3000/api/set-ghostmode \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}' 
```

### Disabling Ghost mode

To disable Ghost Mode:

```bash
curl -X POST http://localhost:3000/api/set-ghostmode \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
 ```

### Start New Chat

To start a new chat:

```bash
curl -X POST http://localhost:3000/api/start-new-chat \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -H "Content-Type: application/json"
 ```

## Troubleshooting ⚠️

- **Issue**: No response after sending a prompt.
  - **Solution**: Make sure you're logged in manually in the browser window launched by Puppeteer.

- **Issue**: Invalid token errors.
  - **Solution**: Ensure you are passing the correct token in the `Authorization` header.

## Contributing 💡

If you'd like to contribute to this project, feel free to fork it, make changes, and open a pull request! 

Any improvement, whether big or small, is welcome. 🌱

```
added python UI Interface
```



