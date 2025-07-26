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




app.post('/api/set-ghostmode', validateToken, async (req, res) => {
  if (!loggedIn) return res.status(401).send('Please login first.');

  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).send('Invalid "enabled" value');

  try {
    await page.bringToFront();

    if (enabled) {
      
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

      return res.send(`Ghost mode enabled 🕵️‍♂️ (click verified).`);
    }

    // new chat workaround dont undestand the ghost button at all....
    try {
      // Find the "New chat" button and click it
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button.button-for-icon.button-medium.button-solid-norm'));
        const newChatBtn = buttons.find(btn => btn.textContent?.trim().toLowerCase() === 'new chat');
        if (newChatBtn) newChatBtn.click();
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // recheck to be sure
      const ghostModeDisabled = await page.evaluate(() => {
        const paths = Array.from(document.querySelectorAll('path'));
        const enabledGhostIcon = 'M17.0185 11.5867C17.7224 11.6254';
        const ghostPath = paths.find(p => p.outerHTML.includes(enabledGhostIcon));
        return !ghostPath;
      });

      if (!ghostModeDisabled) {
        return res.status(500).send('Tried to disable ghost mode, but it is still active.');
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
    await page.bringToFront();

    // new chat function
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

    // small delay to ensure chat start
    await new Promise(resolve => setTimeout(resolve, 300));

    res.send('✅ New chat started successfully.');
  } catch (err) {
    console.error('❌ Error starting new chat:', err);
    res.status(500).send(`Failed to start new chat: ${err.message}`);
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
