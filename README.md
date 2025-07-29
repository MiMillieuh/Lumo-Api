
# Lumo API 🧠 

<img src="https://pmecdn.protonweb.com/image-transformation/?s=s&image=Lumo_OG_b782facdaf.png" width="300" height="150" />


Copyright @Carlostkd

warning ⚠️ If you have installed the previous version to use the upload/delete files you need to install the multer:

npm install multer

## warning ⚠️ chat loggin function logs the Ghost chats too useful to keep saved chats on your end but not online.


Welcome to **Lumo API**! 🚀 A powerful and flexible API for interacting with the Lumo AI powered by Proton. 

This API allows you to integrate Proton Lumo Assistante in any of your Projects - web apps or mobile apps. 🎉

## Key Features ✨

- **Send Prompts**: Send messages to Lumo and receive responses to interact with Proton Lumo.
- **Web Search Toggle**: Enable or disable the web search functionality when needed. 🔍
- **Secure API**: Authentication via token security to make sure only authorized users can send requests. 🔑
- **Turn on/off Ghost mode**:👻 No one can sees you
- **Start Fresh**:💬 Start a new chat when you want
- **Upload and delete files**:💬 Always like a pro
- **Chat Logging**:💬 Gives you full controle of yours chat
- **Help Function**: List all available commands

## Installation 🛠️

### 1. Clone this repository:
```bash
git clone https://github.com/carlostkd/lumo-api.git
cd lumo-api
```

### 2. Install dependencies:
```bash
npm init -y

npm install express puppeteer-core puppeteer body-parser cors multer


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

You’ll receive a response from the Lumo like:

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

### Upload Files (max 10 dont know the real limit of Lumo...)

Upload file or multi files:

```bash
curl -X POST http://localhost:3000/api/upload-file \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -F "files=@./test.html" \            
  -F "files=@./test2.txt" \
  -F "files=@./test3.txt"
 ```

```bash
curl -X POST http://localhost:3000/api/upload-file \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -F "files=@./test.html"            
```

### Delete Files

To delete one by one or all:

```bash
curl -X POST http://localhost:3000/api/remove-file \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"mode":"all"}'
 ```

```bash
curl -X POST http://localhost:3000/api/remove-file \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"mode":"single"}'
 ```

### Enable chat Logging

Enable Loggin and choose the format (json is default available is txt and csv):

```bash
curl -X POST http://localhost:3000/api/set-save-chat \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "format": "csv"}'
```

### Disable chat Logging

Chat logs are saved when you START A NEW CHAT you can always disable:

```bash
curl -X POST http://localhost:3000/api/set-save-chat \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```


### Show all available commands

```bash
curl http://localhost:3000/api/help
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



