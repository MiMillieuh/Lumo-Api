import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk, filedialog
import requests
from typing import Optional

# === setup ===
API_BASE = 'http://localhost:3000/api'
AUTH_TOKEN = 'YOUR_SECRET_TOKEN_HERE'  # set your token
HEADERS = {'Authorization': f'Bearer {AUTH_TOKEN}'}
TIMEOUT = 60 

# === class ===
class LumoApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Lumo Chat Assistant")
        self.root.geometry("880x700")  
        self.root.minsize(750, 600)
        self.root.protocol("WM_DELETE_WINDOW", self.close_app)
        self.websearch_enabled = False
        self.chat_logging_enabled = False
        self.chat_log_format = 'json'  
        self.current_chat_log = []  
        self.build_widgets()

    def build_widgets(self) -> None:
        style = ttk.Style()
        style.configure('TButton', foreground='black', background='white')
        style.configure('TLabel', foreground='black', background='white')
        style.configure('TEntry', foreground='black', background='white')
        style.configure('TScrolledText', foreground='black', background='white')

        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        title_frame = ttk.Frame(main_frame)
        title_frame.pack(fill=tk.X, pady=(0, 10))

        self.title_label = ttk.Label(title_frame, text="Lumo Chat Assistant", font=('Helvetica', 16, 'bold'))
        self.title_label.pack(side=tk.LEFT)

        self.close_button = ttk.Button(title_frame, text="Close", command=self.close_app)
        self.close_button.pack(side=tk.RIGHT, padx=5)

        prompt_frame = ttk.Frame(main_frame)
        prompt_frame.pack(fill=tk.X, pady=(0, 5))

        self.prompt_label = ttk.Label(prompt_frame, text="Your Question:")
        self.prompt_label.pack(side=tk.LEFT, padx=(0, 5))

        self.prompt_entry = ttk.Entry(prompt_frame, width=80)
        self.prompt_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.prompt_entry.bind("<Return>", lambda event: self.ask_lumo())

        ask_button_frame = ttk.Frame(main_frame)
        ask_button_frame.pack(fill=tk.X, pady=(0, 10))

        self.ask_button = ttk.Button(ask_button_frame, text="Ask Lumo", command=self.ask_lumo)
        self.ask_button.pack(side=tk.RIGHT, padx=5)

        self.output_box = scrolledtext.ScrolledText(
            main_frame, wrap=tk.WORD, width=70, height=20, font=("Courier", 10)
        )
        self.output_box.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        control_frame = ttk.Frame(main_frame)
        control_frame.pack(fill=tk.X, pady=(0, 10))

        self.clear_button = ttk.Button(control_frame, text="Clear Chat", command=self.clear_output)
        self.clear_button.pack(side=tk.LEFT, padx=5)

        self.toggle_websearch_btn = ttk.Button(
            control_frame, text="Enable Web Search", command=self.toggle_websearch
        )
        self.toggle_websearch_btn.pack(side=tk.LEFT, padx=5)

        self.enable_ghost_btn = ttk.Button(
            control_frame, text="Enable Ghost Mode 🕵️‍♂️", command=self.enable_ghost_mode
        )
        self.enable_ghost_btn.pack(side=tk.LEFT, padx=5)

        self.disable_ghost_btn = ttk.Button(
            control_frame, text="Disable Ghost Mode 👻", command=self.disable_ghost_mode
        )
        self.disable_ghost_btn.pack(side=tk.LEFT, padx=5)

        self.new_chat_btn = ttk.Button(
            control_frame, text="Start New Chat 💬", command=self.start_new_chat
        )
        self.new_chat_btn.pack(side=tk.LEFT, padx=5)

        
        self.upload_file_btn = ttk.Button(
            control_frame, text="Upload File", command=self.upload_file
        )
        self.upload_file_btn.pack(side=tk.LEFT, padx=5)

        self.remove_single_file_btn = ttk.Button(
            control_frame, text="Remove Single File", command=self.remove_single_file
        )
        self.remove_single_file_btn.pack(side=tk.LEFT, padx=5)

        self.remove_all_files_btn = ttk.Button(
            control_frame, text="Remove All Files", command=self.remove_all_files
        )
        self.remove_all_files_btn.pack(side=tk.LEFT, padx=5)

        
        chat_logging_frame = ttk.Frame(control_frame)
        chat_logging_frame.pack(side=tk.LEFT, padx=5)

        
        self.chat_log_format_label = ttk.Label(chat_logging_frame, text="Chat Log Format:")
        self.chat_log_format_label.pack(side=tk.LEFT)

        
        self.chat_log_format_var = tk.StringVar(value="json")
        self.chat_log_format_menu = ttk.OptionMenu(
            chat_logging_frame,
            self.chat_log_format_var,
            "json",
            "json",
            "txt",
            "csv"
        )
        self.chat_log_format_menu.pack(side=tk.LEFT)

        # chat logging
        self.toggle_chat_logging_btn = ttk.Button(
            control_frame, text="Enable Chat Logging", command=self.toggle_chat_logging
        )
        self.toggle_chat_logging_btn.pack(side=tk.LEFT, padx=5)

    def ask_lumo(self) -> None:
        prompt = self.prompt_entry.get().strip()
        if not prompt:
            messagebox.showwarning("Warning", "Please enter a question.")
            return

        self.output_box.insert(tk.END, f"\nYou: {prompt}\n")
        self.output_box.insert(tk.END, "Lumo: Thinking...\n")
        self.output_box.see(tk.END)
        self.root.update_idletasks()

        try:
            response = requests.post(
                f"{API_BASE}/send-prompt",
                json={"prompt": prompt},
                headers=HEADERS,
                timeout=TIMEOUT
            )
            if response.ok:
                self.output_box.insert(tk.END, response.text + "\n")
                # add response to the chat log
                self.current_chat_log.append({
                    "prompt": prompt,
                    "response": response.text
                })
            else:
                self.output_box.insert(tk.END, f"[Error {response.status_code}] {response.text}\n")
        except Exception as e:
            self.output_box.insert(tk.END, f"[Exception] {str(e)}\n")
        finally:
            self.output_box.see(tk.END)
            self.prompt_entry.delete(0, tk.END)

    def clear_output(self) -> None:
        self.output_box.delete(1.0, tk.END)

    def toggle_websearch(self) -> None:
        toggle_to = not self.websearch_enabled
        try:
            response = requests.post(
                f"{API_BASE}/set-websearch",
                json={"enabled": toggle_to},
                headers=HEADERS,
                timeout=10
            )
            if response.ok:
                self.websearch_enabled = toggle_to
                self.toggle_websearch_btn.config(
                    text="Disable Web Search" if toggle_to else "Enable Web Search"
                )
                self.output_box.insert(tk.END, response.text + "\n")
            else:
                self.output_box.insert(tk.END, f"[Toggle Error] {response.text}\n")
        except Exception as e:
            self.output_box.insert(tk.END, f"[Exception] {str(e)}\n")
        finally:
            self.output_box.see(tk.END)

    def enable_ghost_mode(self) -> None:
        try:
            response = requests.post(
                f"{API_BASE}/set-ghostmode",
                json={"enabled": True},
                headers=HEADERS,
                timeout=10
            )
            if response.ok:
                self.output_box.insert(tk.END, f"[Ghost Mode] {response.text}\n")
            else:
                self.output_box.insert(tk.END, f"[Ghost Enable Error] {response.text}\n")
        except Exception as e:
            self.output_box.insert(tk.END, f"[Exception] {str(e)}\n")
        finally:
            self.output_box.see(tk.END)

    def disable_ghost_mode(self) -> None:
        try:
            response = requests.post(
                f"{API_BASE}/set-ghostmode",
                json={"enabled": False},
                headers=HEADERS,
                timeout=10
            )
            if response.ok:
                self.output_box.insert(tk.END, f"[Ghost Mode] {response.text}\n")
            else:
                self.output_box.insert(tk.END, f"[Ghost Disable Error] {response.text}\n")
        except Exception as e:
            self.output_box.insert(tk.END, f"[Exception] {str(e)}\n")
        finally:
            self.output_box.see(tk.END)

    def start_new_chat(self) -> None:
        try:
            # save the chat log 
            if self.chat_logging_enabled and self.current_chat_log:
                self.save_chat_log()

            # clear chat log
            self.current_chat_log = []

            # clear the box
            self.clear_output()

            response = requests.post(
                f"{API_BASE}/start-new-chat",
                headers=HEADERS,
                timeout=10
            )
            if response.ok:
                self.output_box.insert(tk.END, f"[New Chat] {response.text}\n")
            else:
                self.output_box.insert(tk.END, f"[New Chat Error] {response.text}\n")
        except Exception as e:
            self.output_box.insert(tk.END, f"[Exception] {str(e)}\n")
        finally:
            self.output_box.see(tk.END)

    def upload_file(self) -> None:
        # file upload 
        try:
            # select files
            files = filedialog.askopenfilenames(title="Select files to upload")
            if not files:
                messagebox.showwarning("Warning", "No files selected.")
                return

            # files for upload
            files_to_upload = []
            for file_path in files:
                with open(file_path, 'rb') as f:
                    files_to_upload.append(('files', (file_path.split('/')[-1], f.read())))

            # files to the API
            response = requests.post(
                f"{API_BASE}/upload-file",
                files=files_to_upload,
                headers=HEADERS,
                timeout=TIMEOUT
            )

            if response.ok:
                self.output_box.insert(tk.END, f"[Upload Success] {response.text}\n")
            else:
                self.output_box.insert(tk.END, f"[Upload Error] {response.text}\n")
        except Exception as e:
            self.output_box.insert(tk.END, f"[Exception] {str(e)}\n")
        finally:
            self.output_box.see(tk.END)

    def remove_single_file(self) -> None:
        # single file removal 
        try:
            response = requests.post(
                f"{API_BASE}/remove-file",
                json={"mode": "single"},
                headers=HEADERS,
                timeout=TIMEOUT
            )

            if response.ok:
                self.output_box.insert(tk.END, f"[Remove Success] {response.text}\n")
            else:
                self.output_box.insert(tk.END, f"[Remove Error] {response.text}\n")
        except Exception as e:
            self.output_box.insert(tk.END, f"[Exception] {str(e)}\n")
        finally:
            self.output_box.see(tk.END)

    def remove_all_files(self) -> None:
        # all files removal 
        try:
            response = requests.post(
                f"{API_BASE}/remove-file",
                json={"mode": "all"},
                headers=HEADERS,
                timeout=TIMEOUT
            )

            if response.ok:
                self.output_box.insert(tk.END, f"[Remove Success] {response.text}\n")
            else:
                self.output_box.insert(tk.END, f"[Remove Error] {response.text}\n")
        except Exception as e:
            self.output_box.insert(tk.END, f"[Exception] {str(e)}\n")
        finally:
            self.output_box.see(tk.END)

    def toggle_chat_logging(self) -> None:
        # chat logging toggle 
        try:
            toggle_to = not self.chat_logging_enabled
            self.chat_logging_enabled = toggle_to
            self.chat_log_format = self.chat_log_format_var.get()

            # set chat logging
            response = requests.post(
                f"{API_BASE}/set-save-chat",
                json={"enabled": toggle_to, "format": self.chat_log_format},
                headers=HEADERS,
                timeout=10
            )

            if response.ok:
                self.toggle_chat_logging_btn.config(
                    text="Disable Chat Logging" if toggle_to else "Enable Chat Logging"
                )
                self.output_box.insert(tk.END, f"[Chat Logging] Chat logging is now {'enabled' if toggle_to else 'disabled'} using format: {self.chat_log_format}\n")
            else:
                self.output_box.insert(tk.END, f"[Chat Logging Error] {response.text}\n")
        except Exception as e:
            self.output_box.insert(tk.END, f"[Exception] {str(e)}\n")
        finally:
            self.output_box.see(tk.END)

    def save_chat_log(self) -> None:
        """Save the current chat log to the backend."""
        try:
            response = requests.post(
                f"{API_BASE}/save-chat-log",
                json={"log": self.current_chat_log, "format": self.chat_log_format},
                headers=HEADERS,
                timeout=TIMEOUT
            )
            if response.ok:
                self.output_box.insert(tk.END, f"[Chat Log Saved] {response.text}\n")
            else:
                self.output_box.insert(tk.END, f"[Save Chat Log Error] {response.text}\n")
        except Exception as e:
            self.output_box.insert(tk.END, f"[Exception] {str(e)}\n")

    def close_app(self) -> None:
        # save chat log 
        if self.chat_logging_enabled and self.current_chat_log:
            self.save_chat_log()

        if messagebox.askokcancel("Quit", "Do you really want to quit?"):
            self.root.destroy()

# === main ===
if __name__ == "__main__":
    root = tk.Tk()
    app = LumoApp(root)
    root.mainloop()
