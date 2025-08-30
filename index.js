const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const axios = require('axios');
//upload files 
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// envolving function
let responseParts = [];
let currentDialogueContext = "";
let isDialogueActive = false;
//hmas api
// External modules
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
const YAML = require('yaml');            // yaml responses

// format types according to Hmas
const FORMAT_JSON = 'json';
const FORMAT_YAML = 'yaml';
const FORMAT_HTML = 'html';
const FORMAT_TXT  = 'txt';

// MIME types
const CONTENT_TYPE_JSON  = 'application/json';
const CONTENT_TYPE_YAML  = 'application/x-yaml';
const CONTENT_TYPE_HTML  = 'text/html';
const CONTENT_TYPE_PLAIN = 'text/plain';



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    //  uploads directory exists?
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // keep the original filename and ext
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

module.exports = upload;

// Global chat logging config
const chatLogging = {
  enabled: false,
  format: 'json', // default format
  log: [],
  backupInterval: 10000, // every 10 seconds
  backupFile: path.join(__dirname, 'chatlogs', 'chatlog.backup.json')
};

function saveChatLog(log, format) {
  if (!log.length) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `chatlog-${timestamp}.${format}`;
  const filepath = path.join(__dirname, 'chatlogs', filename);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(filepath), { recursive: true });

  let content;

  switch(format) {
    case 'json':
      content = JSON.stringify(log, null, 2);
      break;
    case 'txt':
      content = log.map(entry => `Prompt: ${entry.prompt}\nResponse: ${entry.response}\n\n`).join('');
      break;
    case 'csv':
      content = 'Prompt,Response\n' + log.map(entry => {
        // Escape quotes for CSV compliance
        const p = `"${entry.prompt.replace(/"/g, '""')}"`;
        const r = `"${entry.response.replace(/"/g, '""')}"`;
        return `${p},${r}`;
      }).join('\n');
      break;
    default:
      content = JSON.stringify(log, null, 2);
  }

  fs.writeFileSync(filepath, content);
  console.log(`✅ Chat log saved to ${filepath}`);
}

// save backup log in case of crash
setInterval(() => {
  if (!chatLogging.enabled || !chatLogging.log.length) return;

  try {
    fs.mkdirSync(path.dirname(chatLogging.backupFile), { recursive: true });
    fs.writeFileSync(chatLogging.backupFile, JSON.stringify(chatLogging.log, null, 2));
    console.log('💾 Chat log backup saved.');
  } catch (err) {
    console.error('❌ Failed to write chat log backup:', err);
  }
}, chatLogging.backupInterval);

app.use(cors());
app.use(bodyParser.json());

const SECRET_TOKEN = 'YOUR_SECRET_TOKEN_HERE';
let browser, page;
let loggedIn = false;
let webSearchEnabled = false;

async function launchBrowser() {
  console.log('Launching Puppeteer...');
  
  // Create user data directory for persistent sessions
  const userDataDir = path.join(__dirname, 'browser-session');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  browser = await puppeteer.launch({
    headless: false,
    userDataDir: userDataDir, // This enables session persistence
    args: [
      '--start-maximized', 
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-web-security', // Sometimes needed for persistent sessions
      '--disable-features=VizDisplayCompositor'
    ],
    defaultViewport: null,
  });

  page = await browser.newPage();
  await page.goto('https://lumo.proton.me', { waitUntil: 'networkidle2' });

  // Check if already logged in
  const loginCheckInterval = setInterval(async () => {
    try {
      const dropdownSelector = 'button[data-testid="heading:userdropdown"]';
      const exists = await page.$(dropdownSelector);
      if (exists) {
        loggedIn = true;
        clearInterval(loginCheckInterval);
        console.log('✅ Already logged in! Session restored from previous session.');
      }
    } catch {}
  }, 2000);

  // Give it some time to check for existing login
  setTimeout(() => {
    if (!loggedIn) {
      console.log('🔑 Please log in manually to Proton Lumo in the opened browser.');
      console.log('💡 Your login will be remembered for next time!');
    }
  }, 5000);
}

const validateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(403).send('Forbidden: Invalid token');
  }
  next();
};

app.post('/api/set-websearch', validateToken, async (req, res) => {
  if (!loggedIn) return res.status(401).send('Please login first.');
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).send('Invalid "enabled" value');

  try {
    await page.bringToFront();
    const result = await page.evaluate((shouldEnable) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const webSearchButton = buttons.find(btn => btn.innerText.trim() === 'Web search');
      if (!webSearchButton) return { success: false, reason: 'Web search button not found' };
      const isActive = webSearchButton.classList.contains('is-active');
      if (isActive !== shouldEnable) {
        webSearchButton.click();
        return { success: true, toggled: true };
      }
      return { success: true, toggled: false };
    }, enabled);

    if (!result.success) {
      return res.status(500).send(`Failed to toggle web search: ${result.reason}`);
    }

    webSearchEnabled = enabled;
    res.send(`Web search ${enabled ? 'enabled' : 'disabled'}.`);
  } catch (err) {
    console.error('❌ Error toggling web search:', err);
    res.status(500).send(`Failed to toggle web search: ${err.message}`);
  }
});

app.post('/api/set-ghostmode', validateToken, async (req, res) => {
  if (!loggedIn) return res.status(401).send('Please login first.');

  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).send('Invalid "enabled" value');

  try {
    await page.bringToFront();

    if (enabled) {
      // ✅ ENABLE ghost mode 
      const result = await page.evaluate(() => {
        const paths = Array.from(document.querySelectorAll('path'));
        const disabledGhostIcon = 'M14.7497 9.25362L15.4433 9.50118L18.0931 7.79902';
        const enabledGhostIcon = 'M17.0185 11.5867C17.7224 11.6254';

        const ghostPath = paths.find(p =>
          p.outerHTML.includes(disabledGhostIcon) || p.outerHTML.includes(enabledGhostIcon)
        );
        if (!ghostPath) return { success: false, reason: 'Ghost icon not found' };

        const ghostButton = ghostPath.closest('button');
        if (!ghostButton) return { success: false, reason: 'Ghost button not found' };

        const isEnabled = ghostPath.outerHTML.includes(enabledGhostIcon);
        return {
          success: true,
          isEnabled,
          selector: ghostButton.getAttribute('data-testid') || ghostButton.outerHTML
        };
      });

      if (!result.success) {
        return res.status(500).send(`Failed to find ghost mode button: ${result.reason}`);
      }

      if (!result.isEnabled) {
        try {
          let buttonSelector = null;
          if (result.selector && typeof result.selector === 'string' && !result.selector.startsWith('<')) {
            buttonSelector = `[data-testid="${result.selector}"]`;
          }

          if (buttonSelector) {
            await page.waitForSelector(buttonSelector, { visible: true, timeout: 3000 });
            await new Promise(resolve => setTimeout(resolve, 100));
            await page.click(buttonSelector, { delay: 50 });
          } else {
            await page.evaluate(() => {
              const disabledGhostIcon = 'M14.7497 9.25362L15.4433 9.50118L18.0931 7.79902';
              const enabledGhostIcon = 'M17.0185 11.5867C17.7224 11.6254';
              const paths = Array.from(document.querySelectorAll('path'));
              const ghostPath = paths.find(p =>
                p.outerHTML.includes(disabledGhostIcon) || p.outerHTML.includes(enabledGhostIcon)
              );
              const ghostButton = ghostPath?.closest('button');
              if (ghostButton) ghostButton.click();
            });
          }

          await new Promise(resolve => setTimeout(resolve, 300));

          const verifyEnabled = await page.evaluate(() => {
            const paths = Array.from(document.querySelectorAll('path'));
            const enabledGhostIcon = 'M17.0185 11.5867C17.7224 11.6254';
            const ghostPath = paths.find(p => p.outerHTML.includes(enabledGhostIcon));
            return !!ghostPath;
          });

          if (!verifyEnabled) {
            return res.status(500).send(`Tried to enable ghost mode, but it's still disabled.`);
          }
        } catch (err) {
          console.error('❌ Error enabling ghost mode:', err);
          return res.status(500).send(`Failed to enable ghost mode: ${err.message}`);
        }
      }

      return res.send(`Ghost mode enabled 🕵️‍♂️ .`);
    }

    // ❌ DISABLE ghost mode via "New chat" workaround but works
    try {
      // Find the "New chat" button and click it
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button.button-for-icon.button-medium.button-solid-norm'));
        const newChatBtn = buttons.find(btn => btn.textContent?.trim().toLowerCase() === 'new chat');
        if (newChatBtn) newChatBtn.click();
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Recheck to confirm ghost mode is now OFF
      const ghostModeDisabled = await page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll('path'));
      const enabledGhostIcon = 'M17.0185 11.5867C17.7224 11.6254';
      const disabledGhostIcon = 'M14.7497 9.25362L15.4433 9.50118L18.0931 7.79902';
      const hasEnabled = paths.some(p => p.outerHTML.includes(enabledGhostIcon));
      const hasDisabled = paths.some(p => p.outerHTML.includes(disabledGhostIcon));
      return !hasEnabled && !hasDisabled;
      });



      if (!ghostModeDisabled) {
        return res.send('Ghost mode disabled 👻 (verified via "New chat").');

      }

      return res.send(`Ghost mode disabled 👻 (via "New chat").`);
    } catch (err) {
      console.error('❌ Error disabling ghost mode:', err);
      return res.status(500).send(`Failed to disable ghost mode: ${err.message}`);
    }

  } catch (err) {
    console.error('❌ Error toggling ghost mode:', err);
    res.status(500).send(`Failed to toggle ghost mode: ${err.message}`);
  }
});


app.post('/api/start-new-chat', validateToken, async (req, res) => {
  if (!loggedIn) return res.status(401).send('Please login first.');

  try {
    // === Save logged conversation if logging is enabled ===
    if (chatLogging?.enabled && chatLogging.log.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filenameBase = `chatlog_${timestamp}`;
      const saveDir = path.join(__dirname, 'chatlogs');

      if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir);

      const fullPath = (ext) => path.join(saveDir, `${filenameBase}.${ext}`);

      if (chatLogging.format === 'txt') {
        const textContent = chatLogging.log.map(
          pair => `You: ${pair.prompt}\nLumo: ${pair.response}`
        ).join('\n\n');
        fs.writeFileSync(fullPath('txt'), textContent, 'utf8');

      } else if (chatLogging.format === 'csv') {
        const header = `"prompt","response"\n`;
        const rows = chatLogging.log.map(
          pair => `"${pair.prompt.replace(/"/g, '""')}","${pair.response.replace(/"/g, '""')}"`
        ).join('\n');
        fs.writeFileSync(fullPath('csv'), header + rows, 'utf8');

      } else {
        // default to json
        fs.writeFileSync(fullPath('json'), JSON.stringify(chatLogging.log, null, 2), 'utf8');
      }

      // Clear the log after saving
      chatLogging.log = [];
    }

    // === Start New Chat as normal ===
    await page.bringToFront();

    const result = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button.button-for-icon.button-medium.button-solid-norm'));
      const newChatBtn = buttons.find(btn => btn.textContent?.trim().toLowerCase() === 'new chat');
      if (newChatBtn) {
        newChatBtn.click();
        return true;
      }
      return false;
    });

    if (!result) {
      return res.status(500).send('❌ Failed to find or click the "New chat" button.');
    }

    await new Promise(resolve => setTimeout(resolve, 300));
    res.send('✅ New chat started successfully.');
  } catch (err) {
    console.error('❌ Error starting new chat:', err);
    res.status(500).send(`Failed to start new chat: ${err.message}`);
  }
});



//upload files

app.post('/api/upload-file', validateToken, upload.array('files', 10), async (req, res) => {
  if (!loggedIn) return res.status(401).send('Please login first.');

  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).send('No files uploaded.');
    }

    // ✅ Log uploaded files info
    console.log('📦 Uploading files:');
    for (const file of files) {
      console.log({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        tempPath: file.path,
      });
    }

    
    await page.bringToFront();

    //  file input path?
    const inputElement = await page.$('input[type="file"]');
    if (!inputElement) {
      console.error('❌ File input element not found on page.');
      return res.status(500).send('Upload input not found on page.');
    }

    // collect all
    const filePaths = files.map((f) => f.path);

    // upload all 
    await inputElement.uploadFile(...filePaths);

    // wait 
    await new Promise((resolve) => setTimeout(resolve, 1000));

    res.send(`✅ ${files.length} file(s) uploaded successfully.`);
  } catch (err) {
    console.error('❌ Error uploading files:', err);
    res.status(500).send(`Failed to upload files: ${err.message}`);
  }
});


app.post('/api/send-prompt', validateToken, async (req, res) => {
  if (!loggedIn) return res.status(401).send('Please login first.');
  const { prompt } = req.body;
  if (!prompt) return res.status(400).send('Prompt is required.');

  try {
    await page.bringToFront();
    const inputSelectors = [
      'p[data-placeholder="Ask anything…"]',
      'div.ProseMirror'
    ];

    let inputHandle = null;
    for (const selector of inputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        inputHandle = await page.$(selector);
        if (inputHandle) break;
      } catch {}
    }

    if (!inputHandle) return res.status(500).send('Prompt input field not found.');

    await inputHandle.focus();

    await page.evaluate(() => {
      const inputElem = document.activeElement;
      if (inputElem) inputElem.textContent = '';
    });

    await page.keyboard.type(prompt, { delay: 20 });
    await page.keyboard.press('Enter');

    const previousResponse = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.assistant-msg-container'))
        .map(div => div.innerText.trim()
          .replace(/I like this response.*$/gis, '')
          .replace(/Report an issue.*$/gis, '')
          .replace(/Copy.*$/gis, '')
          .replace(/Regenerate.*$/gis, '')
          .trim()
        )
        .filter(text => text.length > 0);
      return blocks.length ? blocks[blocks.length - 1] : null;
    });

    const finalResponse = await page.waitForFunction(
      (prevText) => {
        const blocks = Array.from(document.querySelectorAll('.assistant-msg-container'))
          .map(div => div.innerText.trim()
            .replace(/I like this response.*$/gis, '')
            .replace(/Report an issue.*$/gis, '')
            .replace(/Copy.*$/gis, '')
            .replace(/Regenerate.*$/gis, '')
            .trim()
          )
          .filter(text => text.length > 0);
        if (!blocks.length) return false;
        const last = blocks[blocks.length - 1];
        if (!last || last === prevText) return false;
        if (!window._prevContent) {
          window._prevContent = { text: last, time: Date.now() };
          return false;
        }
        if (window._prevContent.text !== last) {
          window._prevContent = { text: last, time: Date.now() };
          return false;
        }
        const elapsed = Date.now() - window._prevContent.time;
        return elapsed > 2000 ? last : false;
      },
      { timeout: 30000 },
      previousResponse
    );

    const responseText = await finalResponse.jsonValue();

    // Log prompt/response pair if chat logging is enabled
    if (chatLogging?.enabled && responseText) {
      chatLogging.log.push({
        prompt,
        response: responseText
      });
    }

    if (!responseText) {
      return res.send('Prompt sent, but response not detected.');
    }

    res.send(responseText);
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).send(`Waiting failed: ${err.message}`);
  }
});





//delete files one by one 

async function clickFirstRemoveButton(page) {
  try {
    await page.waitForSelector('[data-testid="remove-button"]', { timeout: 5000 });

    const fileCard = await page.$('[data-testid="remove-button"]');

    if (!fileCard) throw new Error('Remove button not found.');

    const parentCard = await fileCard.evaluateHandle(el => el.closest('div'));

    const box = await parentCard.boundingBox();
    if (!box) throw new Error('Could not determine bounding box of file card.');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await new Promise(resolve => setTimeout(resolve, 400));

    const btnBox = await fileCard.boundingBox();
    if (!btnBox) throw new Error('Remove button is not visible yet');

    await page.mouse.click(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2);

    console.log('✅ File removed!');
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (err) {
    console.error('❌ Error in clickFirstRemoveButton:', err.message);
  }
}


// remove all files

async function clickAllRemoveButtons(page) {
  try {
    while (true) {
      const removeButtons = await page.$$('[data-testid="remove-button"]');
      if (removeButtons.length === 0) {
        console.log('✅ No more files to remove.');
        break;
      }
      console.log(`🧹 Removing ${removeButtons.length} file(s)...`);
      await clickFirstRemoveButton(page);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (err) {
    console.error('❌ Error in clickAllRemoveButtons:', err.message);
  }
}


app.post('/api/remove-file', validateToken, async (req, res) => {
  if (!loggedIn) return res.status(401).send('Please login first.');

  const { mode } = req.body;
  if (!['single', 'all'].includes(mode)) {
    return res.status(400).send('Invalid mode. Use "single" or "all".');
  }

  try {
    await page.bringToFront();
    if (mode === 'single') {
      await clickFirstRemoveButton(page);
      return res.send('🗑️ Removed one file.');
    } else if (mode === 'all') {
      await clickAllRemoveButtons(page);
      return res.send('🧹 All files removed.');
    }
  } catch (err) {
    console.error('❌ Error in /api/remove-file:', err.message);
    res.status(500).send(`Failed to remove files: ${err.message}`);
  }
});

// Enable or disable chat logging and choose format
app.post('/api/set-save-chat', validateToken, (req, res) => {
  const { enabled, format } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).send('Missing or invalid "enabled" value (must be true or false).');
  }

  const supportedFormats = ['json', 'txt', 'csv'];
  const chosenFormat = (format || 'json').toLowerCase();

  if (!supportedFormats.includes(chosenFormat)) {
    return res.status(400).send(`Invalid format. Supported formats: ${supportedFormats.join(', ')}`);
  }

  chatLogging.enabled = enabled;
  chatLogging.format = chosenFormat;

  // Reset the log when toggling
  if (enabled) {
    chatLogging.log = [];
  }

  res.send(`✅ Chat logging ${enabled ? 'enabled' : 'disabled'} using format: ${chosenFormat}`);
});


// call to Hacker Messages as Service (HMAS)
app.post('/api/send-hacker-message', validateToken, async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes('apikey=')) {
    return res.status(400).send('Missing or invalid API URL with apikey');
  }

  // Determine requested format from URL param or default to json
  const formatMatch = url.match(/format=(json|yaml|html|txt)/i);
  const format = formatMatch ? formatMatch[1].toLowerCase() : FORMAT_JSON;

  // Map format to Accept header
  const acceptHeaderMap = {
    [FORMAT_JSON]: CONTENT_TYPE_JSON,
    [FORMAT_YAML]: CONTENT_TYPE_YAML,
    [FORMAT_HTML]: CONTENT_TYPE_HTML,
    [FORMAT_TXT]: CONTENT_TYPE_PLAIN,
  };
  const acceptHeader = acceptHeaderMap[format] || CONTENT_TYPE_JSON;

  try {
    // Fetch from API URL 
    const response = await fetch(url, {
      headers: { Accept: acceptHeader },
    });

    const contentTypeRaw = (response.headers.get('content-type') || '').toLowerCase();

    let parsedData;
    let rawText = '';

    // Parse response according to content-type or requested format
    if (contentTypeRaw.includes(CONTENT_TYPE_JSON) || format === FORMAT_JSON) {
      parsedData = await response.json();
    } else {
      rawText = await response.text();

      if (contentTypeRaw.includes(CONTENT_TYPE_YAML) || format === FORMAT_YAML) {
        try {
          parsedData = YAML.parse(rawText);
        } catch {
          parsedData = { message: rawText };
        }
      } else if (contentTypeRaw.includes(CONTENT_TYPE_HTML) || format === FORMAT_HTML) {
        // strip html tags 
        parsedData = { message: rawText.replace(/<\/?[^>]+(>|$)/g, '') };
      } else if (format === FORMAT_TXT || contentTypeRaw.includes(CONTENT_TYPE_PLAIN)) {
        parsedData = { message: rawText };
      } else {
        parsedData = { message: rawText };
      }
    }

    // extract string value
    const message = typeof parsedData === 'object'
      ? Object.values(parsedData).find(val => typeof val === 'string' && val.trim()) || 'No message found.'
      : String(parsedData);

    // clean clutter phrases 
    const cleanedMessage = message
      .replace(/I like this response.*$/gis, '')
      .replace(/Report an issue.*$/gis, '')
      .replace(/Copy.*$/gis, '')
      .replace(/Regenerate.*$/gis, '')
      .trim();

    // send prompt text to Lumo 
    const sendToLumo = async (prompt) => {
      await page.bringToFront();
      const inputSelectors = ['p[data-placeholder="Ask anything…"]', 'div.ProseMirror'];
      let inputHandle = null;

      for (const selector of inputSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          inputHandle = await page.$(selector);
          if (inputHandle) break;
        } catch {}
      }
      if (!inputHandle) throw new Error('Lumo input field not found.');

      await inputHandle.focus();

      await page.evaluate(() => {
        const el = document.activeElement;
        if (el) el.textContent = '';
      });

      await page.keyboard.type(prompt, { delay: 20 });
      await page.keyboard.press('Enter');

      // wait for Lumo response
      const previousResponse = await page.evaluate(() => {
        const blocks = Array.from(document.querySelectorAll('.assistant-msg-container'))
          .map(div => div.innerText.trim()
            .replace(/I like this response.*$/gis, '')
            .replace(/Report an issue.*$/gis, '')
            .replace(/Copy.*$/gis, '')
            .replace(/Regenerate.*$/gis, '')
            .trim()
          )
          .filter(text => text.length > 0);
        return blocks.length ? blocks[blocks.length - 1] : null;
      });

      const finalResponse = await page.waitForFunction(
        (prevText) => {
          const blocks = Array.from(document.querySelectorAll('.assistant-msg-container'))
            .map(div => div.innerText.trim()
              .replace(/I like this response.*$/gis, '')
              .replace(/Report an issue.*$/gis, '')
              .replace(/Copy.*$/gis, '')
              .replace(/Regenerate.*$/gis, '')
              .trim()
            )
            .filter(text => text.length > 0);
          if (!blocks.length) return false;
          const last = blocks[blocks.length - 1];
          if (!last || last === prevText) return false;
          if (!window._prevContent) {
            window._prevContent = { text: last, time: Date.now() };
            return false;
          }
          if (window._prevContent.text !== last) {
            window._prevContent = { text: last, time: Date.now() };
            return false;
          }
          const elapsed = Date.now() - window._prevContent.time;
          return elapsed > 2000 ? last : false;
        },
        { timeout: 30000 },
        previousResponse
      );

      return finalResponse.jsonValue();
    };

    const lumoResponse = await sendToLumo(cleanedMessage);

    const output = `
🛰️ Hacker API message sent:
${cleanedMessage}

🤖 Lumo API responded:
${lumoResponse}
    `.trim();

    res.type('text/plain').send(output);
  } catch (err) {
    console.error('❌ Error in send-hacker-prompt:', err);
    res.status(500).send('Proxy Error: ' + err.message);
  }
});


// evolving dialogue
app.post('/api/send-automated-dialogue', validateToken, async (req, res) => {
  if (!loggedIn) return res.status(401).send('Please login first.');
  const { initialPrompt, maxTurns = 30 } = req.body;
  if (!initialPrompt) return res.status(400).send('Initial prompt is required.');

  try {
    // Reset dialogue state
    responseParts = [];
    currentDialogueContext = "";
    isDialogueActive = true;

    // Function to extract keywords from a response
    const extractKeywords = (text) => {
      const stopWords = new Set(['the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were', 'it', 'that', 'this', 'these', 'those', 'be', 'by', 'as', 'are', 'has', 'have', 'had']);
      const words = text.toLowerCase().split(/\s+/)
        .map(word => word.replace(/[^\w\s]/g, ''))
        .filter(word => word.length > 2 && !stopWords.has(word));

      const wordCount = {};
      words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
      });

      return Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);
    };

    // Function to categorize the main topic of a response
    const categorizeTopic = (keywords) => {
      const topicCategories = {
        'weather': ['weather', 'temperature', 'forecast', 'rain', 'snow', 'storm'],
        'travel': ['zurich', 'city', 'location', 'visit', 'tourist', 'travel', 'destination'],
        'technology': ['computer', 'software', 'hardware', 'code', 'programming', 'algorithm'],
        'science': ['research', 'study', 'experiment', 'discovery', 'scientific', 'data'],
        'history': ['historical', 'past', 'event', 'war', 'revolution', 'period'],
        'culture': ['art', 'music', 'film', 'literature', 'tradition', 'custom'],
        'health': ['medical', 'doctor', 'hospital', 'disease', 'treatment', 'health'],
        'food': ['restaurant', 'cooking', 'recipe', 'dish', 'cuisine', 'meal']
      };

      for (const [category, keywordsList] of Object.entries(topicCategories)) {
        if (keywords.some(keyword => keywordsList.includes(keyword))) {
          return category;
        }
      }

      return 'general';
    };

    // Function to generate a follow-up prompt that may transition to a new topic
    const generateFollowUpPrompt = (turnNumber, currentTopic) => {
      const lastResponse = responseParts[responseParts.length - 1];
      const keywords = extractKeywords(lastResponse);
      const currentKeywords = keywords.slice(0, 2);

      // Determine if we should stay on topic or transition
      const shouldTransition = turnNumber % 4 === 0 ||
                              (turnNumber > 5 && Math.random() > 0.7) ||
                              (lastResponse.split(/\s+/).length < 15 && turnNumber > 3);

      if (shouldTransition) {
        // Generate a prompt that transitions to a new topic
        const topicTransitions = {
          'weather': [
            `Speaking of ${currentKeywords[0]}, do you have any favorite ${['books', 'movies', 'places'][Math.floor(Math.random() * 3)]} related to this?`,
            `Does ${currentKeywords[0]} remind you of any interesting ${['stories', 'experiences', 'events'][Math.floor(Math.random() * 3)]}?`,
            `What's something completely different that you find fascinating?`
          ],
          'travel': [
            `Besides ${currentKeywords[0]}, what other destinations interest you?`,
            `Do you have any hobbies unrelated to travel?`,
            `What's a fascinating fact about something completely different?`
          ],
          'technology': [
            `Beyond technology, what other fields interest you?`,
            `What's something in nature that amazes you?`,
            `Do you have any favorite ${['books', 'movies', 'art forms'][Math.floor(Math.random() * 3)]}?`
          ],
          'science': [
            `Outside of science, what captures your attention?`,
            `What's a historical event that you find intriguing?`,
            `Do you enjoy any creative activities like ${['writing', 'painting', 'music'][Math.floor(Math.random() * 3)]}?`
          ],
          'history': [
            `Moving beyond history, what modern topics interest you?`,
            `What's something in the natural world that fascinates you?`,
            `Do you have any favorite ${['novels', 'films', 'artworks'][Math.floor(Math.random() * 3)]}?`
          ],
          'culture': [
            `Beyond cultural topics, what else do you enjoy learning about?`,
            `What scientific discoveries do you find most interesting?`,
            `Do you have any favorite places to visit or explore?`
          ],
          'health': [
            `Outside of health topics, what other subjects interest you?`,
            `What technological advancements do you find most exciting?`,
            `Do you have any favorite ${['books', 'movies', 'hobbies'][Math.floor(Math.random() * 3)]}?`
          ],
          'food': [
            `Beyond food, what other topics do you enjoy discussing?`,
            `What's something in nature that you find fascinating?`,
            `Do you have any favorite ${['historical', 'scientific', 'cultural'][Math.floor(Math.random() * 3)]} topics?`
          ],
          'general': [
            `What's something completely different you'd like to talk about?`,
            `Do you have any favorite ${['books', 'movies', 'hobbies'][Math.floor(Math.random() * 3)]}?`,
            `What's a fascinating fact about something unexpected?`
          ]
        };

        // Select a transition prompt based on the current topic
        const transitionPrompts = topicTransitions[currentTopic] || topicTransitions['general'];
        return transitionPrompts[Math.floor(Math.random() * transitionPrompts.length)];
      } else {
        // Stay on topic with a more specific follow-up
        const topicSpecificPrompts = {
          'weather': [
            `What factors contribute to the ${currentKeywords[0]} patterns in this region?`,
            `How does ${currentKeywords[0]} affect daily life here?`,
            `Are there any interesting ${currentKeywords[0]}-related phenomena?`
          ],
          'travel': [
            `What makes ${currentKeywords[0]} special compared to other places?`,
            `What are some hidden gems in or near ${currentKeywords[0]}?`,
            `How has ${currentKeywords[0]} changed over time?`
          ],
          'technology': [
            `What are the latest developments in ${currentKeywords[0]}?`,
            `How is ${currentKeywords[0]} impacting other industries?`,
            `What challenges does ${currentKeywords[0]} currently face?`
          ],
          'science': [
            `What recent ${currentKeywords[0]} discoveries excite you?`,
            `How does ${currentKeywords[0]} research benefit society?`,
            `What are the biggest questions in ${currentKeywords[0]} today?`
          ],
          'history': [
            `What lesser-known ${currentKeywords[0]} events are interesting?`,
            `How does ${currentKeywords[0]} shape our present?`,
            `What can we learn from ${currentKeywords[0]}?`
          ],
          'culture': [
            `What unique ${currentKeywords[0]} traditions exist?`,
            `How has ${currentKeywords[0]} evolved over time?`,
            `What are some famous figures in ${currentKeywords[0]}?`
          ],
          'health': [
            `What are the latest ${currentKeywords[0]} breakthroughs?`,
            `How can we improve ${currentKeywords[0]} awareness?`,
            `What are common misconceptions about ${currentKeywords[0]}?`
          ],
          'food': [
            `What traditional ${currentKeywords[0]} dishes are popular?`,
            `How has ${currentKeywords[0]} culture influenced other cuisines?`,
            `What are some unique ${currentKeywords[0]} ingredients?`
          ],
          'general': [
            `Could you tell me more about that?`,
            `What are the key aspects of this topic?`,
            `How does this connect to other areas?`
          ]
        };

        // Select a topic-specific prompt
        const specificPrompts = topicSpecificPrompts[currentTopic] || topicSpecificPrompts['general'];
        return specificPrompts[Math.floor(Math.random() * specificPrompts.length)];
      }
    };

    // Function to send a single prompt and get response
    const sendSinglePrompt = async (prompt) => {
      await page.bringToFront();
      const inputSelectors = [
        'p[data-placeholder="Ask anything\\n"]',
        'div.ProseMirror'
      ];
      let inputHandle = null;

      // Wait for and select the input field
      for (const selector of inputSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          inputHandle = await page.$(selector);
          if (inputHandle) break;
        } catch (error) {
          console.error(`Error selecting input with selector ${selector}:`, error);
        }
      }

      if (!inputHandle) throw new Error('Prompt input field not found.');

      await inputHandle.focus();
      await page.evaluate(() => {
        const inputElem = document.activeElement;
        if (inputElem) inputElem.textContent = '';
      });

      console.log("Sending prompt:", prompt);
      await page.keyboard.type(prompt, { delay: 20 });
      await page.keyboard.press('Enter');

      // Wait for the response with increased timeout
      const previousResponse = await page.evaluate(() => {
        const blocks = Array.from(document.querySelectorAll('.assistant-msg-container'))
          .map(div => div.innerText.trim()
            .replace(/I like this response.*$/gis, '')
            .replace(/Report an issue.*$/gis, '')
            .replace(/Copy.*$/gis, '')
            .replace(/Regenerate.*$/gis, '')
            .trim()
          )
          .filter(text => text.length > 0);
        return blocks.length ? blocks[blocks.length - 1] : null;
      });

      const finalResponse = await page.waitForFunction(
        (prevText) => {
          const blocks = Array.from(document.querySelectorAll('.assistant-msg-container'))
            .map(div => div.innerText.trim()
              .replace(/I like this response.*$/gis, '')
              .replace(/Report an issue.*$/gis, '')
              .replace(/Copy.*$/gis, '')
              .replace(/Regenerate.*$/gis, '')
              .trim()
            )
            .filter(text => text.length > 0);
          if (!blocks.length) return false;
          const last = blocks[blocks.length - 1];
          if (!last || last === prevText) return false;
          if (!window._prevContent) {
            window._prevContent = { text: last, time: Date.now() };
            return false;
          }
          if (window._prevContent.text !== last) {
            window._prevContent = { text: last, time: Date.now() };
            return false;
          }
          const elapsed = Date.now() - window._prevContent.time;
          return elapsed > 30000 ? last : false; // Increased timeout to 30 seconds
        },
        { timeout: 60000 }, // Increased overall timeout to 60 seconds
        previousResponse
      );

      const responseText = await finalResponse.jsonValue();

      if (!responseText) throw new Error('No response received from Lumo');

      // Update context and store response
      currentDialogueContext = responseText;
      responseParts.push(responseText);

      return responseText;
    };

    // Initialize response container
    const dialogueResponses = {
      initialPrompt,
      responses: []
    };

    // Send initial prompt
    let currentTopic = 'general';
    const initialResponse = await sendSinglePrompt(initialPrompt);
    dialogueResponses.responses.push({
      turn: 1,
      prompt: initialPrompt,
      response: initialResponse
    });

    // Determine initial topic
    const initialKeywords = extractKeywords(initialResponse);
    currentTopic = categorizeTopic(initialKeywords);

    // Continue the dialogue until maxTurns is reached
    let turnNumber = 2;
    while (isDialogueActive && turnNumber <= maxTurns) {
      // Generate a context-aware follow-up prompt
      const followUpPrompt = generateFollowUpPrompt(turnNumber, currentTopic);

      console.log(`Turn ${turnNumber}: Generated follow-up prompt:`, followUpPrompt);

      try {
        const followUpResponse = await sendSinglePrompt(followUpPrompt);
        dialogueResponses.responses.push({
          turn: turnNumber,
          prompt: followUpPrompt,
          response: followUpResponse
        });

        // Update current topic if we transitioned
        const newKeywords = extractKeywords(followUpResponse);
        const newTopic = categorizeTopic(newKeywords);
        if (newTopic !== currentTopic) {
          currentTopic = newTopic;
          console.log(`Topic transitioned to: ${currentTopic}`);
        }

        turnNumber++;

        // Check if we've reached the maximum turns
        if (turnNumber > maxTurns) {
          console.log(`Reached maximum turns (${maxTurns})`);
          break;
        }

        // Increased delay between turns to 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error during turn ${turnNumber}:`, error);
        // Continue to next turn even if there's an error
        turnNumber++;
      }
    }

    // Log the complete dialogue if chat logging is enabled
    if (chatLogging?.enabled) {
      chatLogging.log.push({
        type: "dialogue",
        initialPrompt,
        responses: dialogueResponses.responses
      });
    }

    res.json({
      dialogue: dialogueResponses,
      suggestion: "Consider enabling Web Search for more accurate and detailed responses",
      completedTurns: turnNumber - 1,
      maxTurns: maxTurns,
      status: "completed",
      finalTopic: currentTopic
    });

  } catch (err) {
    isDialogueActive = false;
    console.error('Error in automated dialogue:', err);
    res.status(500).send(`Dialogue error: ${err.message}`);
  } finally {
    isDialogueActive = false;
  }
});



app.get('/api/help', (req, res) => {
  const helpText = `
=== CURL COMMANDS FOR LUMO API ===

➤ Sending a Prompt to Lumo
curl -X POST http://localhost:3000/api/send-prompt \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "What is the weather in Zurich?"}'

➤ Enabling Web Search
curl -X POST http://localhost:3000/api/set-websearch \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"enabled": true}'

➤ Disabling Web Search
curl -X POST http://localhost:3000/api/set-websearch \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"enabled": false}'

➤ Enabling Ghost Mode
curl -X POST http://localhost:3000/api/set-ghostmode \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"enabled": true}'

➤ Disabling Ghost Mode
curl -X POST http://localhost:3000/api/set-ghostmode \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"enabled": false}'

➤ Start New Chat
curl -X POST http://localhost:3000/api/start-new-chat \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \\
  -H "Content-Type: application/json"

➤ Upload Files (max 10, or depending on Lumo limits)
curl -X POST http://localhost:3000/api/upload-file \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \\
  -F "files=@./test.html" \\
  -F "files=@./test2.txt" \\
  -F "files=@./test3.txt"

➤ Upload a Single File
curl -X POST http://localhost:3000/api/upload-file \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \\
  -F "files=@./test.html"

➤ Delete All Files
curl -X POST http://localhost:3000/api/remove-file \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"mode":"all"}'

➤ Delete a Single File
curl -X POST http://localhost:3000/api/remove-file \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"mode":"single"}'

  
➤ Envolving Function
curl -X POST http://localhost:3000/api/send-automated-dialogue \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"initialPrompt": "what is proton lumo", "maxTurns": 30}'
  

➤ Call to Hmas Api // read the api docs for more commands
➤ Proxy a request to Hmas API and send the response to Lumo
➤ Please note that the api key will be disabled soon
➤ To keep using this feauture consider to buy a api key 
curl -X POST http://localhost:3000/api/send-hacker-message \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://carlostkd.ch/hmas/api.php?as=admin&format=html&apikey=testkey123"}'
  `;


  res.type('text/plain').send(helpText);
});


app.listen(3000, async () => {
  await launchBrowser();
  console.log('🚀 Server listening on http://localhost:3000');
});
