
export type FileType = 'text' | 'image' | 'code' | 'data' | 'document';

export interface ConversionHistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  sourceFormat: string;
  targetFormat: string;
  status: 'pending' | 'completed' | 'failed';
  result?: string;
  isBinary?: boolean;
}

export interface FormatOption {
  value: string;
  label: string;
  category: FileType;
}

export const FORMATS: FormatOption[] = [
  { value: 'json', label: 'JSON', category: 'data' },
  { value: 'yaml', label: 'YAML', category: 'data' },
  { value: 'xml', label: 'XML', category: 'data' },
  { value: 'csv', label: 'CSV', category: 'data' },
  { value: 'xlsx', label: 'Excel (XLSX)', category: 'document' },
  { value: 'pdf', label: 'PDF Document', category: 'document' },
  { value: 'docx', label: 'Word (DOCX)', category: 'document' },
  { value: 'markdown', label: 'Markdown', category: 'text' },
  { value: 'html', label: 'HTML', category: 'text' },
  { value: 'txt', label: 'Plain Text', category: 'text' },
  { value: 'python', label: 'Python', category: 'code' },
  { value: 'javascript', label: 'JavaScript', category: 'code' },
  { value: 'typescript', label: 'TypeScript', category: 'code' },
  { value: 'rust', label: 'Rust', category: 'code' },
  { value: 'png', label: 'PNG', category: 'image' },
  { value: 'jpeg', label: 'JPEG', category: 'image' },
  { value: 'webp', label: 'WebP', category: 'image' }
];
