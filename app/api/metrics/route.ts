import { NextRequest, NextResponse } from 'next/server';

// Имитация хранилища метрик (в реальном приложении использовали бы базу данных)
let metrics = {
  requests: [] as any[],
  stats: {
    total: 0,
    success: 0,
    error: 0,
    avgProcessingTime: 0
  }
};

export async function GET() {
  return NextResponse.json(metrics, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Добавляем новую метрику
    metrics.requests.unshift({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      ...data
    });

    // Оставляем только последние 50 запросов
    metrics.requests = metrics.requests.slice(0, 50);

    // Обновляем статистику
    const successCount = metrics.requests.filter(r => r.status === 'success').length;
    const totalTime = metrics.requests.reduce((acc, r) => acc + (r.processingTime || 0), 0);

    metrics.stats = {
      total: metrics.requests.length,
      success: successCount,
      error: metrics.requests.length - successCount,
      avgProcessingTime: Math.floor(totalTime / metrics.requests.length)
    };

    return NextResponse.json({ success: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST'
      }
    });

  } catch (error) {
    console.error('Error updating metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update metrics' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
} 