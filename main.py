#!/usr/bin/env python3
"""
Text Typer - A GUI app to paste text and have it typed out character by character
where your cursor is focused. Perfect for systems that don't support pasting.

Requirements: pip install pyautogui
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import pyautogui
import time
import threading

class TextTyperApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Text Typer")
        self.root.geometry("500x600")
        self.root.resizable(True, True)
        
        # Variable to track if typing is in progress
        self.is_typing = False
        
        # Configure style
        self.root.configure(bg="#f0f0f0")
        
        # Title
        title_label = tk.Label(
            root, 
            text="Text Typer", 
            font=("Helvetica", 18, "bold"),
            bg="#f0f0f0",
            fg="#333"
        )
        title_label.pack(pady=10)
        
        # Instructions
        instructions = tk.Label(
            root,
            text="1. Paste your text below\n2. Click Focus Window (or just click where you want to type)\n3. Click Type to start typing",
            font=("Helvetica", 9),
            bg="#f0f0f0",
            fg="#666",
            justify="left"
        )
        instructions.pack(padx=10, pady=5)
        
        # Text input area
        input_label = tk.Label(root, text="Text to Type:", font=("Helvetica", 10, "bold"), bg="#f0f0f0")
        input_label.pack(anchor="w", padx=15, pady=(10, 5))
        
        self.text_input = scrolledtext.ScrolledText(
            root,
            height=12,
            width=50,
            font=("Courier", 10),
            wrap="word",
            bg="white",
            fg="#333",
            relief="solid",
            borderwidth=1
        )
        self.text_input.pack(padx=15, pady=5, fill="both", expand=True)
        
        # Control frame
        control_frame = tk.Frame(root, bg="#f0f0f0")
        control_frame.pack(padx=15, pady=10, fill="x")
        
        # Delay setting
        delay_frame = tk.Frame(control_frame, bg="#f0f0f0")
        delay_frame.pack(fill="x", pady=(0, 10))
        
        delay_label = tk.Label(delay_frame, text="Delay between chars (ms):", font=("Helvetica", 9), bg="#f0f0f0")
        delay_label.pack(side="left", padx=(0, 10))
        
        self.delay_var = tk.IntVar(value=50)
        delay_spinbox = tk.Spinbox(
            delay_frame,
            from_=10,
            to=500,
            textvariable=self.delay_var,
            width=8,
            font=("Helvetica", 9)
        )
        delay_spinbox.pack(side="left")
        
        # Buttons frame
        button_frame = tk.Frame(control_frame, bg="#f0f0f0")
        button_frame.pack(fill="x")
        
        # Type button (primary action)
        self.type_button = tk.Button(
            button_frame,
            text="🚀 Type!",
            command=self.start_typing,
            font=("Helvetica", 11, "bold"),
            bg="#4CAF50",
            fg="white",
            padx=15,
            pady=10,
            relief="raised",
            cursor="hand2"
        )
        self.type_button.pack(side="left", padx=5)
        
        # Stop button
        self.stop_button = tk.Button(
            button_frame,
            text="⏹ Stop",
            command=self.stop_typing,
            font=("Helvetica", 11, "bold"),
            bg="#f44336",
            fg="white",
            padx=15,
            pady=10,
            relief="raised",
            cursor="hand2",
            state="disabled"
        )
        self.stop_button.pack(side="left", padx=5)
        
        # Clear button
        clear_button = tk.Button(
            button_frame,
            text="🗑 Clear",
            command=self.clear_text,
            font=("Helvetica", 9),
            bg="#2196F3",
            fg="white",
            padx=10,
            pady=8,
            relief="raised",
            cursor="hand2"
        )
        clear_button.pack(side="left", padx=5)
        
        # Status label
        self.status_label = tk.Label(
            root,
            text="Ready to type",
            font=("Helvetica", 9),
            bg="#f0f0f0",
            fg="#666"
        )
        self.status_label.pack(pady=5)
        
        # Countdown label
        self.countdown_label = tk.Label(
            root,
            text="",
            font=("Helvetica", 10, "bold"),
            bg="#f0f0f0",
            fg="#FF9800"
        )
        self.countdown_label.pack(pady=2)
        
        # Focus warning
        focus_warning = tk.Label(
            root,
            text="⚠️  Make sure to click on the window/field where you want the text typed!",
            font=("Helvetica", 8, "italic"),
            bg="#fff3cd",
            fg="#856404",
            wraplength=400,
            pady=5
        )
        focus_warning.pack(padx=10, pady=(0, 5), fill="x")
    
    def clear_text(self):
        """Clear the text input area"""
        self.text_input.delete("1.0", tk.END)
        self.status_label.config(text="Text cleared")
        self.countdown_label.config(text="")
    
    def start_typing(self):
        """Start typing the text"""
        text = self.text_input.get("1.0", tk.END).strip()
        
        if not text:
            messagebox.showwarning("Empty Text", "Please paste or type some text first!")
            return
        
        self.is_typing = True
        self.type_button.config(state="disabled")
        self.stop_button.config(state="normal")
        self.status_label.config(text="Starting in 3 seconds... Click your target window!", fg="#FF9800")
        self.countdown_label.config(text="3")
        
        # Run typing in a separate thread to keep GUI responsive
        threading.Thread(target=self._type_text, args=(text,), daemon=True).start()
    
    def _type_text(self, text):
        """Type the text character by character"""
        delay = self.delay_var.get() / 1000.0  # Convert ms to seconds
        
        # Countdown
        for i in range(3, 0, -1):
            if not self.is_typing:
                return
            self.countdown_label.config(text=str(i))
            self.root.update()
            time.sleep(1)
        
        self.countdown_label.config(text="TYPING...")
        self.status_label.config(text="Typing in progress...", fg="#4CAF50")
        self.root.update()
        
        # Small additional delay before starting
        time.sleep(0.5)
        
        # Type each character
        for i, char in enumerate(text):
            if not self.is_typing:
                self.status_label.config(text="Typing stopped", fg="#f44336")
                self.countdown_label.config(text="")
                return
            
            # Type the character
            try:
                # Handle special characters
                if char == '\n':
                    pyautogui.press('enter')
                elif char == '\t':
                    pyautogui.press('tab')
                else:
                    pyautogui.typewrite(char, interval=0.05)
            except Exception as e:
                print(f"Error typing character '{char}': {e}")
            
            # Progress update every 10 characters
            if (i + 1) % 10 == 0:
                self.status_label.config(text=f"Typing... {i + 1}/{len(text)} characters", fg="#4CAF50")
                self.root.update()
            
            # Delay between characters
            time.sleep(delay)
        
        # Typing complete
        self.is_typing = False
        self.type_button.config(state="normal")
        self.stop_button.config(state="disabled")
        self.status_label.config(text="✓ Typing complete!", fg="#4CAF50")
        self.countdown_label.config(text="")
        self.root.update()
    
    def stop_typing(self):
        """Stop the typing process"""
        self.is_typing = False
        self.type_button.config(state="normal")
        self.stop_button.config(state="disabled")
        self.status_label.config(text="Typing stopped", fg="#f44336")
        self.countdown_label.config(text="")


def main():
    root = tk.Tk()
    app = TextTyperApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
