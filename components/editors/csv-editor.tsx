'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { DataGrid, type Column } from 'react-data-grid';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Save,
  Download,
  Upload,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { ImportFileSchema } from '@/types';
import { toast } from 'sonner';
import 'react-data-grid/lib/styles.css';

interface CsvEditorProps {
  title: string;
  content: string;
  onSave: (title: string, content: string) => Promise<void>;
}

type Row = Record<string, string>;

export function CsvEditor({
  title: initialTitle,
  content: initialContent,
  onSave,
}: CsvEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── CSV パース ────────────────────────────────────
  const parseCsv = useCallback((csvText: string) => {
    if (!csvText.trim()) {
      return { headers: ['列1', '列2', '列3'], rows: [{ 列1: '', 列2: '', 列3: '' }] };
    }
    const result = Papa.parse<string[]>(csvText.trim(), { header: false });
    const data = result.data;
    if (data.length === 0) {
      return { headers: ['列1'], rows: [] };
    }
    const headers = data[0];
    const rows = data.slice(1).map((row) => {
      const obj: Row = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? '';
      });
      return obj;
    });
    return { headers, rows };
  }, []);

  const initialParsed = useMemo(
    () => parseCsv(initialContent),
    [initialContent, parseCsv]
  );

  const [headers, setHeaders] = useState<string[]>(initialParsed.headers);
  const [rows, setRows] = useState<Row[]>(initialParsed.rows);

  // ── columns 生成 ──────────────────────────────────
  const columns: Column<Row>[] = useMemo(() => {
    return headers.map((h) => ({
      key: h,
      name: h,
      editable: true,
      resizable: true,
      width: 'auto' as unknown as number,
    }));
  }, [headers]);

  // ── CSV 文字列化 ──────────────────────────────────
  const toCsvString = useCallback(
    (h: string[], r: Row[]) => {
      const data = r.map((row) => h.map((col) => row[col] ?? ''));
      return Papa.unparse({ fields: h, data });
    },
    []
  );

  // ── 自動保存（3秒 Debounce） ────────────────────
  const scheduleSave = useCallback(
    (newTitle: string, newHeaders: string[], newRows: Row[]) => {
      setSaved(false);
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(async () => {
        setSaving(true);
        const csvStr = toCsvString(newHeaders, newRows);
        await onSave(newTitle, csvStr);
        setSaving(false);
        setSaved(true);
      }, 3000);
    },
    [onSave, toCsvString]
  );

  // ── 手動保存 ──────────────────────────────────────
  const handleManualSave = async () => {
    clearTimeout(autoSaveTimer.current);
    setSaving(true);
    const csvStr = toCsvString(headers, rows);
    await onSave(title, csvStr);
    setSaving(false);
    setSaved(true);
  };

  // ── 行変更 ────────────────────────────────────────
  const handleRowsChange = (newRows: Row[]) => {
    setRows(newRows);
    scheduleSave(title, headers, newRows);
  };

  // ── 行追加 ────────────────────────────────────────
  const addRow = () => {
    const newRow: Row = {};
    headers.forEach((h) => (newRow[h] = ''));
    const updated = [...rows, newRow];
    setRows(updated);
    scheduleSave(title, headers, updated);
  };

  // ── 行削除（最後の行） ────────────────────────────
  const removeLastRow = () => {
    if (rows.length === 0) return;
    const updated = rows.slice(0, -1);
    setRows(updated);
    scheduleSave(title, headers, updated);
  };

  // ── エクスポート ──────────────────────────────────
  const handleDownload = () => {
    const csvStr = toCsvString(headers, rows);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `${title}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── インポート ────────────────────────────────────
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const validation = ImportFileSchema.safeParse({
        name: file.name,
        size: file.size,
      });
      if (!validation.success) {
        toast.error(validation.error.issues[0].message);
        return;
      }

      const text = await file.text();
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      scheduleSave(title, parsed.headers, parsed.rows);
    };
    input.click();
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
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave(e.target.value, headers, rows);
            }}
            className="h-8 text-base font-medium border-none bg-transparent px-0 focus-visible:ring-0 w-64"
            maxLength={50}
          />
          <Badge variant="outline" className="text-xs">
            CSV
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
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            行追加
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={removeLastRow}
            disabled={rows.length === 0}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            行削除
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            インポート
          </Button>
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

      {/* DataGrid */}
      <div className="flex-1 overflow-auto">
        <DataGrid
          columns={columns}
          rows={rows}
          onRowsChange={handleRowsChange}
          className="h-full border-none"
        />
      </div>
    </div>
  );
}
