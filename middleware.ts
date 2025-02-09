import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Отключаем базовую аутентификацию
  const response = NextResponse.next();

  // Добавляем CORS заголовки
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', '*');
  response.headers.set('WWW-Authenticate', ''); // Отключаем запрос аутентификации

  return response;
}

export const config = {
  matcher: '/api/:path*',
} 