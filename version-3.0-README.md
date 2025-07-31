## Boom! Lumo-API 3.0 is her with some seriously awesome features! 

Welcome to the most *thrilling* Lumo-Api update!

If you want your Linux machine to be smarter, faster, and cooler, just follow these simple steps below. It's so easy even your cat could do it but its better to let Lumo-Api take care of it. 🐱💻

---

## Installation Instructions 🛠️

Ready to supercharge your system?  

## Make sure you have installed all the needed packages from the index.js

Then prepare your bash system:

```bash

sudo apt install jq               # JSON ninja skills 

sudo apt install curl             # The internet’s favorite data fetcher 

sudo apt install tcpdump          # For all your packet sniffing needs 

sudo apt install lm-sensors       # Keeps an eye on your system temps 

sudo apt install smartmontools    # Your disk's personal doctor

```

                                     |============================|

Now you can give super powers  and some fun to your computer 

Use the Hmas (Hacker Messages as Service in your projects

Read the Hmas Api Docs for more refined commands

https://carlostkd.ch/hmas

⚠️ Warning this Hmas api key will soon be disabled to keep using this feauture consider buying your api key.

```bash

─$ curl -X POST http://localhost:3000/api/send-hacker-message \

  -H "Authorization: Bearer YOUR_SECRET_TOKEN_HERE" \

  -H "Content-Type: application/json" \

  -d '{"url": "https://carlostkd.ch/hmas/api.php?as=admin&format=html&apikey=testkey123"}'

```

### Now you get:

🛰️ Hacker API message sent:

admin💬 🧬 Genetic Drift Observed: A deep scan is rewriting your system biosignature. Log rotation has been disabled from an external scheduler.

🤖 Lumo API responded:

It seems like there's some interesting activity happening with your system! Let me break down what I understand from your message:

Genetic Drift Observed: This term is often used in biology to describe random changes in the frequency of alleles in a population. In the context of a system, it could mean that there are random variations or changes happening in the system's behavior or configuration.

Deep Scan: This suggests that a comprehensive examination of the system is taking place. It might be checking for vulnerabilities, performance issues, or other aspects of the system.

Rewriting Biosignature: The biosignature could be a unique identifier or set of characteristics that define the system. Rewriting it might indicate that the system is being updated or modified in a fundamental way.

Log Rotation Disabled: Log rotation is a process where old log files are replaced with new ones to manage disk space and maintain system performance. Disabling it suggests that logs are being preserved, possibly for debugging or monitoring purposes.

External Scheduler: This indicates that the log rotation was controlled by an external system or service, which has now been overridden or disabled.

If you need more detailed information about any of these components or have specific questions about what these changes mean for your system, feel free to ask! 


### Oh no... humor seems to have ghosted you. 👻
###  That joke just hit a brick wall, huh?

### Fear not! We're leveling up your computer diagnostics with the mighty powers of the Lumo-API! ⚔️

Create the file lumo.sh and paste this:

```bash
#!/bin/bash

API_URL="http://localhost:3000/api/send-prompt"
UPLOAD_URL="http://localhost:3000/api/upload-file"
NEW_CHAT_URL="http://localhost:3000/api/start-new-chat"
TOKEN="YOUR_SECRET_TOKEN_HERE"
EMAIL_TO="you@example.com"

TMP_DIR="./tmp"
TMP_CURL_OUTPUT="$TMP_DIR/tmp-response.raw"

mkdir -p "$TMP_DIR"
rm -f "$TMP_DIR"/*.txt "$TMP_DIR"/*.raw

# === user optons ===

LAST_LINES=10
JOURNALCTL_LINES=10

# === functions  ===
log_and_prompt() {
  local name="$1"
  local prompt="$2"
  local command="$3"
  local logfile="$TMP_DIR/log-${name}.txt"

  echo "📄 Logging: $name"
  eval "$command" > "$logfile" 2>/dev/null

  if [[ ! -s "$logfile" ]]; then
    echo "⚠️  $name log is empty. Skipping..."
    return
  fi

  echo "⬆️ Uploading $logfile..."
  UPLOAD_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$UPLOAD_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -F "files=@$logfile")

  UPLOAD_STATUS=$(echo "$UPLOAD_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

  if [[ "$UPLOAD_STATUS" != "200" ]]; then
    echo "❌ Upload failed for $name with HTTP $UPLOAD_STATUS"
    node send-email.js "$EMAIL_TO" "❌ Lumo Upload Error ($name)" "Upload failed.\n\n$UPLOAD_RESPONSE"
    return
  fi

  echo "💬 Sending prompt to Lumo for $name..."
  PROMPT=$(jq -Rs . <<< "$prompt")

  curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$API_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": $PROMPT}" > "$TMP_CURL_OUTPUT"

  HTTP_BODY=$(sed '/HTTP_STATUS:/d' "$TMP_CURL_OUTPUT")
  HTTP_STATUS=$(grep "HTTP_STATUS:" "$TMP_CURL_OUTPUT" | cut -d':' -f2)

  if jq -e . >/dev/null 2>&1 <<<"$HTTP_BODY"; then
    REPLY=$(jq -r '.response // .message // empty' <<<"$HTTP_BODY")
  else
    REPLY="$HTTP_BODY"
  fi

  # Wait for the full response from Lumo
  if [[ -z "$REPLY" ]]; then
    echo "⌛ Waiting for Lumo to respond..."
    # Add a delay to allow Lumo to process the request
    sleep 5
    # Retry getting the response
    curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$API_URL" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"prompt\": $PROMPT}" > "$TMP_CURL_OUTPUT"

    HTTP_BODY=$(sed '/HTTP_STATUS:/d' "$TMP_CURL_OUTPUT")
    HTTP_STATUS=$(grep "HTTP_STATUS:" "$TMP_CURL_OUTPUT" | cut -d':' -f2)

    if jq -e . >/dev/null 2>&1 <<<"$HTTP_BODY"; then
      REPLY=$(jq -r '.response // .message // empty' <<<"$HTTP_BODY")
    else
      REPLY="$HTTP_BODY"
    fi
  fi

  [[ -z "$REPLY" ]] && REPLY="⚠️ No meaningful response from Lumo for $name."

  echo "📧 Sending email for $name..."
  node send-email.js "$EMAIL_TO" "🔍 Lumo: $name analysis" "$REPLY"
}

# === defaults ===
#log_and_prompt "dmesg" "Check for hardware or kernel-level issues in this log:" \
#  "dmesg --level=err | tail -n $LAST_LINES | sed '/^\s*$/d'"

# === Optional logs — uncomment to enable or add yours ===

# log_and_prompt "uptime" "What does the system uptime tell us?" \
#   "uptime"

# log_and_prompt "top-procs" "Which processes are consuming the most memory?" \
#   "ps aux --sort=-%mem | head -n 10"

# log_and_prompt "disk-usage" "Give an overview of disk usage. Are there any partitions nearly full?" \
#   "df -h"

# log_and_prompt "auth-log" "Look at recent auth attempts. Any suspicious login activity?" \
#   "sudo tail -n $LAST_LINES /var/log/auth.log"

# log_and_prompt "syslog" "Can you identify any recent system warnings or errors?" \
#   "sudo tail -n $LAST_LINES /var/log/syslog"

# log_and_prompt "fail2ban" "Analyze the current Fail2Ban status. Any banned IPs?" \
#   "sudo fail2ban-client status"

# log_and_prompt "journalctl" "Review the latest journalctl errors. Anything urgent?" \
#   "sudo journalctl -p 3 -xb --no-pager | tail -n $JOURNALCTL_LINES"

# log_and_prompt "sockets" "What services are listening on the system? Check for anomalies." \
#   "ss -tulwn"

# log_and_prompt "ports" "Which processes are listening on which ports?" \
#   "sudo lsof -i -P -n | grep LISTEN"

# log_and_prompt "smart" "Check SMART data. Any signs of disk failure?" \
#   "sudo smartctl -a /dev/sda 2>/dev/null | head -n 50"

# log_and_prompt "temperature" "Are system temperatures within safe limits?" \
#   "sensors"

# log_and_prompt "failed-units" "What services have failed recently?" \
#   "systemctl --failed"

# log_and_prompt "memory" "Analyze current memory usage:" \
#   "free -h"

# log_and_prompt "cpu-load" "Analyze CPU load. Any performance bottlenecks?" \
#   "top -bn1 | head -n 20"

# log_and_prompt "last-boot" "When did the system last reboot?" \
#   "who -b"

# log_and_prompt "last-logins" "Who logged in recently?" \
#   "last -n 10"

# log_and_prompt "kernel-version" "Which kernel version is the system running?" \
#   "uname -a"

# log_and_prompt "mounts" "Show currently mounted filesystems:" \
#   "mount | column -t"

 log_and_prompt "services" "List active system services:" \
   "systemctl list-units --type=service --state=running"

# log_and_prompt "tcpdump" "Where are these network packets coming from?" \
#   "sudo tcpdump -nn -c 10"

# === start new chat and delete the uploaded file ===
echo "🔄 Starting new chat to reset server state..."
NEW_CHAT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$NEW_CHAT_URL" \
  -H "Authorization: Bearer $TOKEN")

NEW_CHAT_STATUS=$(echo "$NEW_CHAT_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

if [[ "$NEW_CHAT_STATUS" != "200" ]]; then
  echo "❌ Failed to start new chat. HTTP status: $NEW_CHAT_STATUS"
  echo "Response: $NEW_CHAT_RESPONSE"
else
  echo "✅ New chat started successfully."
fi

# === clear ===
rm -f "$TMP_CURL_OUTPUT"
echo "✅ Done."
```

Give a file permissions:

sudo chmod +x lumo.sh

Give sudo permissions to run the script without sudo password (otherwise you cant run tcpdump analyze for example)

sudo visudo

add this line

username ALL=(ALL) NOPASSWD: /path/to/lumo.sh

Go to your Proton Mail all settings and under SMTP create a new SMTP submission 

Save your SMTP address submission and token generated

Create a file lumo-email.sh and paste this:

```bash
#!/usr/bin/env node

const nodemailer = require('nodemailer');

async function main() {
  const [,, to, subject, body] = process.argv;

  if (!to || !subject || !body) {
    console.error('Usage: node send-email.js <to> <subject> <body>');
    process.exit(1);
  }

  // Proton SMTP config
  const transporter = nodemailer.createTransport({
    host: 'smtp.protonmail.ch',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: 'yore proton submission email',
      pass: 'your protom SMTP token',
    },
  });

  // email template
  const professionalBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px 5px 0 0;
          margin-bottom: 20px;
        }
        .content {
          padding: 15px;
          border: 1px solid #e9ecef;
          border-radius: 0 0 5px 5px;
        }
        .footer {
          margin-top: 20px;
          font-size: 12px;
          color: #6c757d;
          text-align: center;
        }
        .highlight {
          background-color: #f8f9fa;
          padding: 2px 4px;
          border-radius: 3px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>System Analysis Report</h2>
      </div>
      <div class="content">
        <p>Hello,</p>

        <p>Please find below the analysis report for your system:</p>

        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <pre style="white-space: pre-wrap; word-wrap: break-word; background: transparent; border: none; margin: 0; padding: 0; font-family: monospace;">${body}</pre>
        </div>

        <p>This report was automatically generated by Lumo-Api.</p>

        <p>Best regards,<br>
        Lumo-Api</p>
      </div>
      <div class="footer">
        <p>This is an automated message. Please do not reply directly to this email.</p>
        <p>© ${new Date().getFullYear()} Lumo-Api by @Carlostkd</p>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: '"Lumo-Api" <your proton submission email here>',
    to,
    subject,
    html: professionalBody,
    text: `System Analysis Report

Hello,

Please find below the analysis report for your system:

${body.replace(/<\/?[^>]+(>|$)/g, '')}

This report was automatically generated by Lumo-Api.

Best regards,
Lumo-Api

This is an automated message. Please do not reply directly to this email.
© ${new Date().getFullYear()} Lumo-Api by @Carlostkd `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error('❌ Email failed:', err);
  }
}

main();
```


Choose wich services and how much lines from the "lumo.sh" file  you want to send to Lumo-Api

then manually run the script 

```bash
./lumo.sh
```
 
Or add it to the cron jobs to run at desired time every day.

The script logs in a temporary file your desired system logs then uploads the file to Lumo with a personalized prompt.

### Then you get for example:

Run the script

```bash
./lumo.sh
```

```bash
📄 Logging: log-services.txt
⬆️ Uploading ./tmp/log-dmesg.txt...
💬 Sending prompt to Lumo for dmesg...
📧 Sending email for dmesg...
✅ Email sent to justin@case.com
🔄 Starting new chat to reset server state...
✅ New chat started successfully.
✅ Done.
```

### Check your email and you have:

I can see you've uploaded log-services.txt, which contains a list of system services along with their status. Here's a summary of the active system services:

Accounts Service
Avahi mDNS/DNS-SD Stack
Bluetooth service
Manage, Install and Generate Color Profiles
Regular background program processing daemon
Make remote CUPS printers available locally
CUPS Scheduler
D-Bus System Message Bus
Firmware update daemon
irqbalance daemon
Tool to automatically collect and submit kernel crash signatures
Light Display Manager
Modem Manager
Network Manager
NoMachine Server daemon
Authorization Manager
System Logging Service
RealtimeKit Scheduling Policy Service
Self Monitoring and Reporting Technology (SMART) Daemon
Switcheroo Control Proxy service
Journal Service
User Login Management
Network Name Resolution
Network Time Synchronization
Rule-based Manager for Device Events and Files
Thermal Daemon Service
Anonymizing overlay network for TCP
Disk Manager
Daemon for power management
WPA supplicant

These services are currently loaded and active, meaning they are running and ready to perform their respective functions. If you need more detailed information about any specific service, feel free to ask!

### You can always choose what you want to send:

I can see you've uploaded a file named log-tcpdump.txt containing network packet logs. Based on the contents, these network packets appear to be coming from a device with the IP address 192.168.xxx.xxx. This is a private IP address, indicating that the device is likely part of a local network.

Here are some observations from the log:

The device 192.168.xxx.xxx is communicating with several external IP addresses (185.70.xxx.xxx, 185.70.xxx.xxx) on port 443, which is typically used for HTTPS traffic. This suggests secure web communications.

There is also communication with another device on the local network (192.168.xxx.xxx) on port 53, which is used for DNS (Domain Name System) queries. Specifically, there is a DNS query for lumo.proton.me.

To analyze this further, I can help you with the following tasks:

Identify the devices involved in this communication.
Analyze the nature of the network traffic.
Check for any unusual or suspicious activity.

What would you like to focus on?


## Thats it Happy Lumo Day!!

With this setup, your Linux machine will be smarter, faster, and cooler than ever before. Just remember, even though your cat might think it's the boss, Lumo-Api is really the one making things happen. 

So let it do its thing and enjoy the results! 🐱💻
