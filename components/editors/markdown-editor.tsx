'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Eye,
  Pencil,
  Save,
  Download,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  title: string;
  content: string;
  type: 'md' | 'txt';
  onSave: (title: string, content: string) => Promise<void>;
}

export function MarkdownEditor({
  title: initialTitle,
  content: initialContent,
  type,
  onSave,
}: MarkdownEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── 自動保存（3秒 Debounce） ────────────────────
  const scheduleSave = useCallback(
    (newTitle: string, newContent: string) => {
      setSaved(false);
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(async () => {
        setSaving(true);
        await onSave(newTitle, newContent);
        setSaving(false);
        setSaved(true);
      }, 3000);
    },
    [onSave]
  );

  // ── 手動保存 ──────────────────────────────────────
  const handleManualSave = async () => {
    clearTimeout(autoSaveTimer.current);
    setSaving(true);
    await onSave(title, content);
    setSaving(false);
    setSaved(true);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    scheduleSave(value, content);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    scheduleSave(title, value);
  };

  // ── エクスポート ──────────────────────────────────
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `${title}.${type}`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  // cleanup
  useEffect(() => {
    return () => clearTimeout(autoSaveTimer.current);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-8 text-base font-medium border-none bg-transparent px-0 focus-visible:ring-0 w-64"
            maxLength={50}
          />
          <Badge variant="outline" className="text-xs">
            {type === 'md' ? 'Markdown' : 'テキスト'}
          </Badge>
          {saving ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              保存中...
            </span>
          ) : saved ? (
            <span className="text-xs text-emerald-500">保存済み</span>
          ) : (
            <span className="text-xs text-amber-500">未保存</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {type === 'md' && (
            <div className="flex rounded-lg bg-muted p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-3 text-xs',
                  mode === 'edit' && 'bg-background shadow-sm'
                )}
                onClick={() => setMode('edit')}
              >
                <Pencil className="mr-1.5 h-3 w-3" />
                編集
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-3 text-xs',
                  mode === 'preview' && 'bg-background shadow-sm'
                )}
                onClick={() => setMode('preview')}
              >
                <Eye className="mr-1.5 h-3 w-3" />
                プレビュー
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleManualSave}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            保存
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            エクスポート
          </Button>
        </div>
      </div>

      {/* エディタ / プレビュー */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'edit' || type === 'txt' ? (
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full h-full resize-none border-none bg-background p-6 font-mono text-sm leading-relaxed focus:outline-none"
            placeholder="ここに入力..."
          />
        ) : (
          <div className="prose prose-zinc dark:prose-invert max-w-none p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
