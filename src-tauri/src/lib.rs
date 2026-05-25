use serde::{Deserialize, Serialize};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
    KEYEVENTF_UNICODE, VIRTUAL_KEY, VK_RETURN, VK_TAB,
};

#[derive(Default)]
struct TypingState {
    cancel: Mutex<Option<Arc<AtomicBool>>>,
    window: Mutex<WindowState>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TypeRequest {
    text: String,
    delay_ms: u64,
    countdown_seconds: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowState {
    always_on_top: bool,
    opacity: f64,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            always_on_top: false,
            opacity: 0.96,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowStatePatch {
    always_on_top: Option<bool>,
    opacity: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TypingProgress {
    current: usize,
    total: usize,
    status: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    countdown_remaining: Option<u64>,
}

#[tauri::command]
fn start_typing(
    app: AppHandle,
    request: TypeRequest,
    state: State<'_, TypingState>,
) -> Result<(), String> {
    if request.text.trim().is_empty() {
        return Err("Nothing to type".into());
    }

    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut active = state
            .cancel
            .lock()
            .map_err(|_| "Typing state is unavailable")?;
        if active.is_some() {
            return Err("Typing is already running".into());
        }
        *active = Some(cancel.clone());
    }

    thread::spawn(move || {
        let total = request.text.chars().count();

        for remaining in (1..=request.countdown_seconds).rev() {
            if cancel.load(Ordering::SeqCst) {
                emit_progress(&app, 0, total, "stopped", "Stopped");
                clear_active(&app);
                return;
            }

            emit_countdown_progress(&app, remaining, total);
            thread::sleep(Duration::from_secs(1));
        }

        thread::sleep(Duration::from_millis(250));

        for (index, character) in request.text.chars().enumerate() {
            if cancel.load(Ordering::SeqCst) {
                emit_progress(&app, index, total, "stopped", "Stopped");
                clear_active(&app);
                return;
            }

            if let Err(error) = type_character(character) {
                emit_progress(&app, index, total, "error", error);
                clear_active(&app);
                return;
            }

            let current = index + 1;
            if current == total || current % 8 == 0 {
                emit_progress(
                    &app,
                    current,
                    total,
                    "typing",
                    format!("Typing {current}/{total}"),
                );
            }

            thread::sleep(Duration::from_millis(request.delay_ms));
        }

        emit_progress(&app, total, total, "done", "Complete");
        clear_active(&app);
    });

    Ok(())
}

#[tauri::command]
fn stop_typing(state: State<'_, TypingState>) -> Result<(), String> {
    let active = state
        .cancel
        .lock()
        .map_err(|_| "Typing state is unavailable")?;
    if let Some(cancel) = active.as_ref() {
        cancel.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
fn minimize_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Main window is unavailable".to_string())?
        .minimize()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn close_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Main window is unavailable".to_string())?
        .close()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_window_state(
    app: AppHandle,
    state: WindowStatePatch,
    app_state: State<'_, TypingState>,
) -> Result<WindowState, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is unavailable".to_string())?;

    let mut next = app_state
        .window
        .lock()
        .map_err(|_| "Window state is unavailable")?;

    if let Some(always_on_top) = state.always_on_top {
        window
            .set_always_on_top(always_on_top)
            .map_err(|error| error.to_string())?;
        next.always_on_top = always_on_top;
    }

    if let Some(opacity) = state.opacity {
        let clamped = opacity.clamp(0.7, 1.0);
        next.opacity = clamped;
    }

    Ok(*next)
}

fn clear_active(app: &AppHandle) {
    if let Some(state) = app.try_state::<TypingState>() {
        if let Ok(mut active) = state.cancel.lock() {
            *active = None;
        }
    }
}

fn emit_progress(
    app: &AppHandle,
    current: usize,
    total: usize,
    status: &'static str,
    message: impl Into<String>,
) {
    let _ = app.emit(
        "typing-progress",
        TypingProgress {
            current,
            total,
            status,
            message: message.into(),
            countdown_remaining: None,
        },
    );
}

fn emit_countdown_progress(app: &AppHandle, remaining: u64, total: usize) {
    let _ = app.emit(
        "typing-progress",
        TypingProgress {
            current: 0,
            total,
            status: "countdown",
            message: format!("Typing in {remaining}s"),
            countdown_remaining: Some(remaining),
        },
    );
}

#[cfg(target_os = "windows")]
fn type_character(character: char) -> Result<(), String> {
    match character {
        '\n' => send_virtual_key(VK_RETURN),
        '\t' => send_virtual_key(VK_TAB),
        _ => send_unicode(character),
    }
}

#[cfg(not(target_os = "windows"))]
fn type_character(_character: char) -> Result<(), String> {
    Err("Typing is currently implemented for Windows".into())
}

#[cfg(target_os = "windows")]
fn send_virtual_key(key: VIRTUAL_KEY) -> Result<(), String> {
    let down = keyboard_input(key, 0, KEYBD_EVENT_FLAGS(0));
    let up = keyboard_input(key, 0, KEYEVENTF_KEYUP);
    send_inputs(&[down, up])
}

#[cfg(target_os = "windows")]
fn send_unicode(character: char) -> Result<(), String> {
    let mut buffer = [0u16; 2];
    let encoded = character.encode_utf16(&mut buffer);

    for unit in encoded {
        let down = keyboard_input(VIRTUAL_KEY(0), *unit, KEYEVENTF_UNICODE);
        let up = keyboard_input(VIRTUAL_KEY(0), *unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP);
        send_inputs(&[down, up])?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn keyboard_input(key: VIRTUAL_KEY, scan: u16, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: scan,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

#[cfg(target_os = "windows")]
fn send_inputs(inputs: &[INPUT]) -> Result<(), String> {
    let sent = unsafe { SendInput(inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent == inputs.len() as u32 {
        Ok(())
    } else {
        Err("Windows rejected a keyboard event".into())
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(TypingState::default())
        .invoke_handler(tauri::generate_handler![
            start_typing,
            stop_typing,
            minimize_window,
            close_window,
            set_window_state
        ])
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
