import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface LogViewerProps {
  lines: string[];
  autoScroll?: boolean;
  onLine?: (line: string) => void;
}

const terminalTheme = {
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
};

function initializeTerminal(
  container: HTMLDivElement,
  terminalRef: React.MutableRefObject<Terminal | null>,
  fitAddonRef: React.MutableRefObject<FitAddon | null>,
  isAtBottomRef: React.MutableRefObject<boolean>,
) {
  const terminal = new Terminal(terminalTheme);
  const fitAddon = new FitAddon();
  fitAddonRef.current = fitAddon;
  terminal.open(container);
  fitAddon.fit();
  terminalRef.current = terminal;

  const handleResize = () => {
    fitAddonRef.current?.fit();
  };

  window.addEventListener('resize', handleResize);

  const viewport = container.querySelector('.xterm-viewport');
  if (viewport) {
    viewport.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport as HTMLElement;
      isAtBottomRef.current = scrollTop + clientHeight >= scrollHeight - 10;
    });
  }

  return () => {
    window.removeEventListener('resize', handleResize);
    terminal.dispose();
  };
}

export function LogViewer({ lines, autoScroll = true, onLine }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    if (!containerRef.current) return;
    return initializeTerminal(containerRef.current, terminalRef, fitAddonRef, isAtBottomRef);
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    for (const line of lines) {
      terminal.write(line + '\r\n');
      onLine?.(line);
    }

    if (autoScroll && isAtBottomRef.current && containerRef.current) {
      const viewport = containerRef.current.querySelector('.xterm-viewport');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [lines, autoScroll, onLine]);

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

// eslint-disable-next-line react-refresh/only-export-components
export function clearTerminal(terminal: Terminal | null) {
  if (terminal) {
    terminal.clear();
  }
}
