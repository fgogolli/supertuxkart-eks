FROM public.ecr.aws/docker/library/golang:1.20.4 as go-builder
WORKDIR /go/src/supertuxkart

COPY main.go go.mod ./
RUN go mod tidy &&\
    go build -o wrapper .

# Installing STK
FROM public.ecr.aws/debian/debian:stable-slim

RUN apt update && apt install -y supertuxkart && apt clean

RUN useradd -m -u 1000 supertuxkart

WORKDIR /home/supertuxkart
COPY --from=go-builder /go/src/supertuxkart/wrapper .
COPY entrypoint.sh server_config.xml ./

RUN chown -R supertuxkart:supertuxkart /home/supertuxkart && chmod +x wrapper

ENV ENABLE_PLAYER_TRACKING=false
USER 1000
ENTRYPOINT ["./entrypoint.sh"]
