import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface LogViewerProps {
  lines: string[];
  autoScroll?: boolean;
  onLine?: (line: string) => void;
}

export function LogViewer({ lines, autoScroll = true, onLine }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isAtBottomRef = useRef(true);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: false,
      convertEol: true,
      disableStdin: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        selectionBackground: '#3a3d41',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    // Track scroll position
    if (containerRef.current) {
      const viewport = containerRef.current.querySelector('.xterm-viewport');
      if (viewport) {
        viewport.addEventListener('scroll', () => {
          if (!containerRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = viewport as HTMLElement;
          isAtBottomRef.current = scrollTop + clientHeight >= scrollHeight - 10;
        });
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, []);

  // Write lines to terminal
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    for (const line of lines) {
      terminal.write(ansiToXterm(line) + '\r\n');
      onLine?.(line);
    }

    // Auto-scroll to bottom if enabled and user is at bottom
    if (autoScroll && isAtBottomRef.current && containerRef.current) {
      const viewport = containerRef.current.querySelector('.xterm-viewport') as HTMLElement;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [lines, autoScroll, onLine]);

  // Fit on size changes
  useEffect(() => {
    const interval = setInterval(() => {
      fitAddonRef.current?.fit();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={containerRef}
      className="bg-[#1e1e1e] rounded-md overflow-hidden"
      style={{ height: '400px' }}
    />
  );
}

// xterm handles ANSI colors natively
function ansiToXterm(text: string): string {
  return text;
}

export function clearTerminal(terminal: Terminal | null) {
  if (terminal) {
    terminal.clear();
  }
}
