FROM node:18-alpine

# Устанавливаем ffmpeg и другие зависимости
RUN apk add --no-cache ffmpeg python3 make g++ sox && \
    which sox && \
    ln -s $(which sox) /usr/local/bin/sox

# Увеличиваем лимиты на файлы
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_SHARP_PATH="/tmp/node_modules/sharp"

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходники
COPY . .

# Собираем приложение
RUN npm run build

# Запускаем
CMD ["npm", "start"] 