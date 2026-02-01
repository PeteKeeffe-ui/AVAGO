(function () {
    const DEBUG_MAX_LOGS = 50;
    const logs = [];
    let overlay = null;

    // Helper to send log to server
    function reportToServer(type, message, data) {
        if (typeof socket !== 'undefined' && socket.connected) {
            socket.emit('client-debug', {
                type,
                message,
                data,
                url: window.location.href,
                ua: navigator.userAgent,
                timestamp: new Date().toISOString()
            });
        }
    }

    window.AVAGO_Debug = {
        log: function (msg, data = null) {
            this._add('INFO', msg, data);
            console.log(`[AVAGO-DEBUG] ${msg}`, data || '');
        },
        error: function (msg, data = null) {
            this._add('ERROR', msg, data);
            console.error(`[AVAGO-DEBUG] ${msg}`, data || '');
            reportToServer('ERROR', msg, data);
        },
        _add: function (type, message, data) {
            logs.unshift({ type, message, data, time: new Date().toLocaleTimeString() });
            if (logs.length > DEBUG_MAX_LOGS) logs.pop();
            this.updateOverlay();
        },
        show: function () {
            if (!overlay) this.createOverlay();
            overlay.style.display = 'block';
        },
        hide: function () {
            if (overlay) overlay.style.display = 'none';
        },
        createOverlay: function () {
            overlay = document.createElement('div');
            overlay.id = 'avago-debug-overlay';
            overlay.style.cssText = `
                position: fixed; top: 10px; right: 10px; bottom: 10px; width: 400px;
                background: rgba(0,0,0,0.9); color: #0f0; font-family: monospace;
                font-size: 12px; z-index: 99999; padding: 15px; border-radius: 8px;
                display: none; flex-direction: column; border: 1px solid #333;
                box-shadow: 0 0 20px rgba(0,0,0,0.5);
            `;

            overlay.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px;">
                    <strong style="color: #fff;">AVAGO DEBUG CONSOLE</strong>
                    <span onclick="AVAGO_Debug.hide()" style="cursor: pointer; color: #fff;">[X]</span>
                </div>
                <div id="avago-debug-content" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 5px;"></div>
            `;
            document.body.appendChild(overlay);
            this.updateOverlay();
        },
        updateOverlay: function () {
            if (!overlay) return;
            const content = document.getElementById('avago-debug-content');
            content.innerHTML = logs.map(l => `
                <div style="border-bottom: 1px solid #222; padding: 2px 0;">
                    <span style="color: #666;">[${l.time}]</span>
                    <span style="color: ${l.type === 'ERROR' ? '#f55' : '#0a0'}; font-weight: bold;">${l.type}</span>: ${l.message}
                    ${l.data ? `<br><small style="color: #888;">${JSON.stringify(l.data)}</small>` : ''}
                </div>
            `).join('');
        }
    };

    // Global Error Handlers
    window.onerror = function (msg, url, line, col, error) {
        AVAGO_Debug.error(`Global Error: ${msg}`, { url, line, col, stack: error ? error.stack : null });
    };

    window.onunhandledrejection = function (event) {
        AVAGO_Debug.error(`Unhandled Promise Rejection: ${event.reason}`, { reason: event.reason });
    };

    // Add hidden trigger (Triple tap logo or press Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            AVAGO_Debug.show();
        }
    });

    // Capture Socket.io events if available
    setTimeout(() => {
        if (typeof socket !== 'undefined') {
            const originalEmit = socket.emit;
            socket.emit = function (event, ...args) {
                AVAGO_Debug.log(`Emit: ${event}`, args);
                return originalEmit.apply(this, [event, ...args]);
            };

            socket.onAny((event, ...args) => {
                AVAGO_Debug.log(`Receive: ${event}`, args);
            });
        }
    }, 1000);

})();
