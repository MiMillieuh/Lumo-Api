const express = require('express');
const puppeteer = require('puppeteer-core');
const { executablePath } = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// set your own token here 
const SECRET_TOKEN = 'YOUR_SECRET_TOKEN_HERE';

let browser, page;
let loggedIn = false;
let webSearchEnabled = false;

async function launchBrowser() {
  console.log('Launching Puppeteer...');
  browser = await puppeteer.launch({
    headless: false,
    executablePath: executablePath(),
    args: ['--start-maximized'],
    defaultViewport: null,
  });
  page = await browser.newPage();

  await page.goto('https://lumo.proton.me/chat', { waitUntil: 'networkidle2' });

  console.log('Please log in manually to Proton Lumo in the opened browser.');

  const loginCheckInterval = setInterval(async () => {
    try {
      const dropdownSelector = 'button[data-testid="heading:userdropdown"]';
      const exists = await page.$(dropdownSelector);
      if (exists) {
        loggedIn = true;
        clearInterval(loginCheckInterval);
        console.log('✅ Login detected!');
      }
    } catch {}
  }, 2000);
}

const validateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(403).send('Forbidden: Invalid token');
  }
  next();
};

app.post('/api/set-websearch', validateToken, async (req, res) => {
  if (!loggedIn) {
    return res.status(401).send('Please login first in the opened browser.');
  }
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).send('Invalid "enabled" value, must be boolean.');
  }
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

app.post('/api/send-prompt', validateToken, async (req, res) => {
  if (!loggedIn) {
    return res.status(401).send('Please login first in the opened browser.');
  }
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).send('Prompt is required.');
  }
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

    if (!inputHandle) {
      return res.status(500).send('Prompt input field not found.');
    }

    await inputHandle.focus();

    // to be sure clear existing input if any
    await page.evaluate(() => {
      const inputElem = document.activeElement;
      if (inputElem) {
        inputElem.textContent = '';
      }
    });

    // prompt 
    await page.keyboard.type(prompt, { delay: 20 });
    await page.keyboard.press('Enter');

    // Capture previous assistant response text to detect new reply
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

    // Wait for new different response
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

    if (!responseText) {
      return res.send('Prompt sent, but response not detected.');
    }

    res.send(responseText);
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).send(`Waiting failed: ${err.message}`);
  }
});

app.listen(3000, async () => {
  await launchBrowser();
  console.log('Server listening on http://localhost:3000');
});
