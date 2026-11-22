FROM hugomods/hugo:exts-0.154.5 AS build

ARG BASE_URL=https://mr4x2.com/

WORKDIR /src
COPY . .
RUN hugo --gc --minify --baseURL "$BASE_URL"
# Pagefind 1.6.0 crashes with "Illegal instruction" on the server's CPU (no AVX2). Keep 1.5.0.
RUN npx -y pagefind@1.5.0 --site public

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/public/ /usr/share/nginx/html/
