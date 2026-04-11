'use client';

import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Download, Filter } from 'lucide-react';

interface ParsedFile {
  id: string;
  file_name: string;
  status: 'uploaded' | 'scanning' | 'parsed' | 'error';
  parsed_data: {
    name: string;
    email: string;
    phone: string;
    location: string;
    current_role: string;
    years_experience: number;
    skills: string[];
    education?: any[];
    highest_education?: string;
  } | null;
  error_message: string | null;
}

interface Column {
  id: string;
  label: string;
  key: string;
  width: string;
  sortable: boolean;
}

interface Props {
  files: ParsedFile[];
  batchName: string;
}

const COLUMNS: Column[] = [
  { id: 'file_name', label: 'File Name', key: 'file_name', width: '180px', sortable: true },
  { id: 'status', label: 'Status', key: 'status', width: '100px', sortable: true },
  { id: 'name', label: 'Full Name', key: 'parsed_data.name', width: '150px', sortable: true },
  { id: 'email', label: 'Email', key: 'parsed_data.email', width: '200px', sortable: true },
  { id: 'phone', label: 'Phone', key: 'parsed_data.phone', width: '130px', sortable: true },
  { id: 'location', label: 'Location', key: 'parsed_data.location', width: '140px', sortable: true },
  { id: 'role', label: 'Current Role', key: 'parsed_data.current_role', width: '180px', sortable: true },
  { id: 'experience', label: 'Exp (Yrs)', key: 'parsed_data.years_experience', width: '90px', sortable: true },
  { id: 'education', label: 'Highest Education', key: 'parsed_data.highest_education', width: '160px', sortable: false },
  { id: 'skills', label: 'Skills', key: 'parsed_data.skills', width: '300px', sortable: false },
];

export default function ComprehensiveDataTable({ files, batchName }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'file_name', direction: 'asc' });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(COLUMNS.map(c => c.id))
  );

  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(f => 
        f.file_name.toLowerCase().includes(term) ||
        f.parsed_data?.name?.toLowerCase().includes(term) ||
        f.parsed_data?.email?.toLowerCase().includes(term) ||
        f.parsed_data?.current_role?.toLowerCase().includes(term) ||
        f.parsed_data?.location?.toLowerCase().includes(term) ||
        f.parsed_data?.skills?.some(s => s.toLowerCase().includes(term))
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortConfig.key as keyof ParsedFile];
      let bVal: any = b[sortConfig.key as keyof ParsedFile];

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [files, searchTerm, sortConfig]);

  const handleSort = (columnId: string) => {
    const column = COLUMNS.find(c => c.id === columnId);
    if (!column?.sortable) return;

    if (sortConfig.key === columnId) {
      setSortConfig({
        ...sortConfig,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      setSortConfig({ key: columnId, direction: 'asc' });
    }
  };

  const handleToggleColumn = (columnId: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnId)) {
      newVisible.delete(columnId);
    } else {
      newVisible.add(columnId);
    }
    setVisibleColumns(newVisible);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === filteredAndSortedFiles.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredAndSortedFiles.map(f => f.id)));
    }
  };

  const handleSelectRow = (fileId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedRows(newSelected);
  };

  const handleExportCSV = () => {
    const visibleColumnsList = COLUMNS.filter(c => visibleColumns.has(c.id));
    const headers = visibleColumnsList.map(c => c.label);
    
    const rows = filteredAndSortedFiles.map(f => {
      return visibleColumnsList.map(col => {
        if (col.id === 'file_name') return f.file_name;
        if (col.id === 'status') return f.status;
        if (col.id === 'skills') {
          const skills = f.parsed_data?.skills || [];
          return Array.isArray(skills) ? skills.join(' | ') : '';
        }
        if (col.id === 'education') return f.parsed_data?.highest_education || '';
        
        const keys = col.key.split('.');
        let val: any = f;
        for (const key of keys) {
          val = val?.[key];
        }
        return val || '';
      }).map(cell => `"${String(cell).replace(/"/g, '""')}"`);
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${batchName.replace(/\s+/g, '_')}_complete_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getValueByPath = (obj: any, path: string): any => {
    const keys = path.split('.');
    let val: any = obj;
    for (const key of keys) {
      val = val?.[key];
    }
    return val;
  };

  const formatValue = (value: any, columnId: string): string => {
    if (value === null || value === undefined) return '-';
    if (columnId === 'skills' && Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Professional Header */}
      <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-5 border-b border-slate-200">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Complete Data View</h2>
            <p className="text-slate-600 text-sm mt-1">{filteredAndSortedFiles.length} of {files.length} records</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Search and Controls */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, email, role, location, skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-slate-900 placeholder:text-slate-400 pl-11 pr-4 py-2.5 rounded-lg border border-slate-300 focus:border-[#1a56db] focus:ring-2 focus:ring-[#1a56db]/20 text-sm font-medium outline-none transition-all"
            />
          </div>
          <div className="relative group">
            <button className="bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all">
              <Filter className="w-4 h-4" />
              Columns
            </button>
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl p-3 hidden group-hover:block z-20">
              <div className="space-y-1">
                {COLUMNS.map(col => (
                  <label key={col.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.id)}
                      onChange={() => handleToggleColumn(col.id)}
                      className="w-4 h-4 rounded border-slate-300 text-[#1a56db] focus:ring-[#1a56db]"
                    />
                    <span className="text-sm font-medium text-slate-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <div className="max-h-[750px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredAndSortedFiles.length && filteredAndSortedFiles.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#1a56db] focus:ring-[#1a56db]"
                  />
                </th>
                <th className="px-4 py-4 w-10"></th>
                {COLUMNS.filter(c => visibleColumns.has(c.id)).map(col => (
                  <th
                    key={col.id}
                    className={`px-4 py-4 text-left ${col.sortable ? 'cursor-pointer hover:bg-slate-100' : ''} transition-colors`}
                    style={{ width: col.width }}
                    onClick={() => handleSort(col.id)}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <span>{col.label}</span>
                      {col.sortable && sortConfig.key === col.id && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-[#1a56db]" /> : <ChevronDown className="w-3 h-3 text-[#1a56db]" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAndSortedFiles.map((file) => (
                <React.Fragment key={file.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(file.id)}
                        onChange={() => handleSelectRow(file.id)}
                        className="w-4 h-4 rounded border-slate-300 text-[#1a56db] focus:ring-[#1a56db]"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setExpandedRow(expandedRow === file.id ? null : file.id)}
                        className="hover:bg-slate-200 p-1.5 rounded-lg transition-colors"
                      >
                        {expandedRow === file.id ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                      </button>
                    </td>
                    {COLUMNS.filter(c => visibleColumns.has(c.id)).map(col => (
                      <td key={col.id} className="px-4 py-4 text-slate-700" style={{ width: col.width }}>
                        {col.id === 'status' ? (
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full ${
                            file.status === 'parsed' ? 'bg-emerald-100 text-emerald-700' :
                            file.status === 'error' ? 'bg-red-100 text-red-700' :
                            file.status === 'scanning' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-50 text-[#1a56db]'
                          }`}>
                            {file.status}
                          </span>
                        ) : col.id === 'skills' ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(file.parsed_data?.skills || []).slice(0, 2).map((s, i) => (
                              <span key={i} className="bg-blue-50 text-[#1a56db] px-2.5 py-1 rounded-full text-xs font-semibold">
                                {s}
                              </span>
                            ))}
                            {(file.parsed_data?.skills?.length || 0) > 2 && (
                              <span className="text-slate-600 text-xs px-2.5 py-1 font-medium">
                                +{file.parsed_data!.skills!.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-800">{formatValue(getValueByPath(file, col.key), col.id)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  
                  {/* Expanded Detail Row */}
                  {expandedRow === file.id && (
                    <tr className="bg-gradient-to-r from-blue-50 to-white border-b-2 border-[#1a56db]/20">
                      <td colSpan={COLUMNS.filter(c => visibleColumns.has(c.id)).length + 2} className="px-6 py-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div className="bg-white border border-slate-200 rounded-lg p-4">
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">File Name</label>
                            <p className="text-slate-900 font-medium break-all">{file.file_name}</p>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg p-4">
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Status</label>
                            <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full ${
                              file.status === 'parsed' ? 'bg-emerald-100 text-emerald-700' :
                              file.status === 'error' ? 'bg-red-100 text-red-700' :
                              file.status === 'scanning' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-50 text-[#1a56db]'
                            }`}>
                              {file.status}
                            </span>
                          </div>
                          
                          {file.parsed_data ? (
                            <>
                              <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Full Name</label>
                                <p className="text-slate-900 font-medium">{file.parsed_data.name || '-'}</p>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Email</label>
                                <p className="text-slate-900 font-mono text-sm break-all">{file.parsed_data.email || '-'}</p>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Phone</label>
                                <p className="text-slate-900 font-medium">{file.parsed_data.phone || '-'}</p>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Location</label>
                                <p className="text-slate-900 font-medium">{file.parsed_data.location || '-'}</p>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Current Role</label>
                                <p className="text-slate-900 font-medium">{file.parsed_data.current_role || '-'}</p>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Years of Experience</label>
                                <p className="text-slate-900 font-medium">{file.parsed_data.years_experience || 0} years</p>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Highest Education</label>
                                <p className="text-slate-900 font-medium">{file.parsed_data.highest_education || '-'}</p>
                              </div>
                              <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-4">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">All Skills ({file.parsed_data.skills?.length || 0})</label>
                                <div className="flex flex-wrap gap-2">
                                  {(file.parsed_data.skills || []).map((skill, i) => (
                                    <span key={i} className="bg-blue-50 text-[#1a56db] px-3 py-1.5 rounded-full text-xs font-semibold">
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </>
                          ) : file.error_message ? (
                            <div className="lg:col-span-3 bg-red-50 border border-red-200 rounded-lg p-4">
                              <p className="text-red-900 font-bold mb-2">Parsing Error:</p>
                              <p className="text-red-800 text-sm">{file.error_message}</p>
                            </div>
                          ) : (
                            <div className="lg:col-span-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <p className="text-amber-800 font-medium">Processing...</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* No Results State */}
      {filteredAndSortedFiles.length === 0 && (
        <div className="py-16 text-center border-t border-slate-200">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No records match your search</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or search term</p>
        </div>
      )}

      {/* Footer */}
      <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center">
        <p className="text-sm text-slate-600 font-medium">
          Showing {filteredAndSortedFiles.length} of {files.length} records
          {selectedRows.size > 0 && <span className="ml-4 text-[#1a56db] font-semibold">{selectedRows.size} selected</span>}
        </p>
      </div>
    </div>
  );
}
