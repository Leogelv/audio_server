FROM node:18-alpine

# Устанавливаем ffmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходники
COPY . .

# Собираем приложение
RUN npm run build

# Запускаем
CMD ["npm", "start"] 