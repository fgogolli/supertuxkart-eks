#!/bin/bash

STK_IMAGE=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$STK_REPO:$STK_IMAGE_VERSION-$STK_IMAGE_TAG
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $STK_IMAGE

docker build -t $STK_IMAGE .
docker push $STK_IMAGE
