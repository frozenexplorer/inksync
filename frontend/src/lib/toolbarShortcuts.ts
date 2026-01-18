// toolbarShortcuts.ts - Keyboard shortcuts for the enhanced toolbar

import type { Tool } from '@/lib/types';

export interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
    action: 'tool' | 'undo' | 'redo' | 'zoom-in' | 'zoom-out' | 'fit' | 'expand';
    tool?: Tool;
    description: string;
}

export const SHORTCUTS: ShortcutConfig[] = [
    // Tool shortcuts
    { key: 'h', action: 'tool', tool: 'hand', description: 'Hand/Pan tool' },
    { key: 'p', action: 'tool', tool: 'pen', description: 'Pen tool' },
    {
        key: 'p',
        shift: true,
        action: 'tool',
        tool: 'highlighter',
        description: 'Highlighter tool',
    },
    { key: 'e', action: 'tool', tool: 'eraser', description: 'Eraser tool' },
    { key: 'r', action: 'tool', tool: 'shape', description: 'Shape tool' },
    { key: 't', action: 'tool', tool: 'text', description: 'Text tool' },
    { key: 'n', action: 'tool', tool: 'sticky', description: 'Sticky note' },
    { key: 'l', action: 'tool', tool: 'laser', description: 'Laser pointer' },
    { key: 'i', action: 'tool', tool: 'image', description: 'Image upload' },

    // Zoom shortcuts
    {
        key: '+',
        ctrl: true,
        action: 'zoom-in',
        description: 'Zoom in',
    },
    {
        key: '=',
        ctrl: true,
        action: 'zoom-in',
        description: 'Zoom in',
    },
    {
        key: '-',
        ctrl: true,
        action: 'zoom-out',
        description: 'Zoom out',
    },
    {
        key: '0',
        ctrl: true,
        action: 'fit',
        description: 'Fit to screen',
    },

    // Toolbar toggle
    {
        key: '\\',
        action: 'expand',
        description: 'Toggle toolbar',
    },
];

export interface ShortcutHandlers {
    onToolSelect: (tool: Tool) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFit: () => void;
    onToggleExpand: () => void;
}

export function handleKeyboardShortcut(
    event: KeyboardEvent,
    handlers: ShortcutHandlers
): boolean {
    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey;
    const shift = event.shiftKey;
    const alt = event.altKey;
    const meta = event.metaKey;

    // Find matching shortcut
    const shortcut = SHORTCUTS.find((s) => {
        if (s.key !== key) return false;
        if (s.ctrl && !ctrl) return false;
        if (s.shift && !shift) return false;
        if (s.alt && !alt) return false;
        if (s.meta && !meta) return false;
        if (!s.ctrl && ctrl && s.action === 'tool') return false;
        if (!s.shift && shift && s.action === 'tool') return false;
        if (!s.alt && alt) return false;
        if (!s.meta && meta && s.action === 'tool') return false;
        return true;
    });

    if (!shortcut) return false;

    // Execute action
    switch (shortcut.action) {
        case 'tool':
            if (shortcut.tool) {
                handlers.onToolSelect(shortcut.tool);
            }
            break;
        case 'zoom-in':
            handlers.onZoomIn();
            break;
        case 'zoom-out':
            handlers.onZoomOut();
            break;
        case 'fit':
            handlers.onFit();
            break;
        case 'expand':
            handlers.onToggleExpand();
            break;
    }

    return true;
}

export function getShortcutLabel(shortcut: ShortcutConfig): string {
    const parts: string[] = [];

    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.meta) parts.push('⌘');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());

    return parts.join('+');
}

// Get shortcut for a specific tool
export function getToolShortcut(tool: Tool): string {
    const shortcut = SHORTCUTS.find((s) => s.action === 'tool' && s.tool === tool);
    return shortcut ? getShortcutLabel(shortcut) : '';
}
