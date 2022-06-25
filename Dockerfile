FROM node:lts

WORKDIR /usr/src/app

COPY . .

RUN npm install

CMD npm start

EXPOSE 8000