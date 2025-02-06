'use client';

import { useState, useEffect } from 'react';

// Типы для нашего мониторинга
type RequestLog = {
  id: string;
  timestamp: string;
  status: 'success' | 'error';
  fileType?: string;
  fileSize?: string;
  error?: string;
  processingTime?: number;
};

type Metrics = {
  requests: RequestLog[];
  stats: {
    total: number;
    success: number;
    error: number;
    avgProcessingTime: number;
  };
};

export default function Home() {
  const [metrics, setMetrics] = useState<Metrics>({
    requests: [],
    stats: {
      total: 0,
      success: 0,
      error: 0,
      avgProcessingTime: 0
    }
  });

  // Функция для получения метрик
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  // Получаем метрики каждые 2 секунды
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🎵 Audio Processing Monitor</h1>
        <p className="text-gray-400">Real-time API request monitoring</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-gray-400 text-sm">Total Requests</h3>
          <p className="text-2xl font-bold">{metrics.stats.total}</p>
        </div>
        <div className="bg-green-900 p-4 rounded-lg">
          <h3 className="text-gray-400 text-sm">Successful</h3>
          <p className="text-2xl font-bold">{metrics.stats.success}</p>
        </div>
        <div className="bg-red-900 p-4 rounded-lg">
          <h3 className="text-gray-400 text-sm">Failed</h3>
          <p className="text-2xl font-bold">{metrics.stats.error}</p>
        </div>
        <div className="bg-blue-900 p-4 rounded-lg">
          <h3 className="text-gray-400 text-sm">Avg. Processing Time</h3>
          <p className="text-2xl font-bold">{metrics.stats.avgProcessingTime}ms</p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700">
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">File Type</th>
              <th className="px-4 py-3 text-left">Size</th>
              <th className="px-4 py-3 text-left">Processing Time</th>
              <th className="px-4 py-3 text-left">Error</th>
            </tr>
          </thead>
          <tbody>
            {metrics.requests.map(log => (
              <tr key={log.id} className="border-t border-gray-700 hover:bg-gray-750">
                <td className="px-4 py-3">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    log.status === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                  }`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-3">{log.fileType || '-'}</td>
                <td className="px-4 py-3">{log.fileSize || '-'}</td>
                <td className="px-4 py-3">{log.processingTime ? `${log.processingTime}ms` : '-'}</td>
                <td className="px-4 py-3 text-red-400">{log.error || '-'}</td>
              </tr>
            ))}
            {metrics.requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Waiting for requests...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 